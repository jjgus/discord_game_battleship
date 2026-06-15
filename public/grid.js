// Shared battle rendering — loaded by both game.html (placement page) and battle.html.
// References globals: state, $myGridCells, $enemyGridCells (defined by the page script).

const GRID_SIZE = 5;

// ── Grid construction ─────────────────────────────────────────────────────────

function buildBattleGrids() {
  $myGridCells = buildGrid('my-grid');
  $enemyGridCells = buildGrid('enemy-grid');
  renderMyFleetFull();
  renderEnemyFull();
  updateTurnBanner();
  updateFleetStatus();
}

function buildGrid(id) {
  const el = document.getElementById(id);
  if (!el) return [];
  el.innerHTML = '';
  const cells = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      el.appendChild(cell);
      cells.push(cell);
    }
  }
  return cells;
}

// ── Full renders (called once on battle start / reconnect) ────────────────────

function renderMyFleetFull() {
  if (!$myGridCells) return;
  const shipCellMap = new Map();
  state.myFleet.ships.forEach((ship) => {
    ship.cells.forEach((c) => shipCellMap.set(`${c.row},${c.col}`, ship));
  });

  $myGridCells.forEach((cell, i) => {
    const row = Math.floor(i / GRID_SIZE);
    const col = i % GRID_SIZE;
    const key = `${row},${col}`;
    cell.className = 'cell';
    const ship = shipCellMap.get(key);
    const wasHit = state.opponentShotsOnMe.includes(key);
    if (ship) {
      cell.classList.add('ship');
      if (ship.hits.length >= ship.cells.length && ship.armorLeft <= 0) cell.classList.add('sunk');
      if (ship.armorLeft > 0) cell.classList.add('armored');
      if (wasHit) cell.classList.add('hit-on-me');
    } else if (wasHit) {
      cell.classList.add('miss');
    }
  });
}

function renderEnemyFull() {
  if (!$enemyGridCells) return;
  const hitSet = new Set(state.myShots.filter(isHitOnOpponent));
  const missSet = new Set(state.myShots.filter((k) => !isHitOnOpponent(k)));
  const spySet = new Set(state.spyglassCells.map((c) => `${c.row},${c.col}`));

  $enemyGridCells.forEach((cell, i) => {
    const row = Math.floor(i / GRID_SIZE);
    const col = i % GRID_SIZE;
    const key = `${row},${col}`;
    cell.className = 'cell';
    cell.onclick = null;

    if (hitSet.has(key)) {
      cell.classList.add('hit-enemy');
      const sunk = state.opponentFleet.ships.find(
        (s) => s.cells.some((c) => `${c.row},${c.col}` === key) && s.hits.length >= s.cells.length && s.armorLeft <= 0
      );
      if (sunk) cell.classList.add('sunk-enemy');
    } else if (missSet.has(key)) {
      cell.classList.add('miss');
    } else {
      if (spySet.has(key)) cell.classList.add('spyglass');
      if (state.myTurn) {
        cell.classList.add('clickable');
        cell.onclick = () => fireShot(row, col);
      }
    }
  });
}

// ── Incremental patches (per shot) ────────────────────────────────────────────

function patchEnemyCell(row, col, hit) {
  if (!$enemyGridCells) return;
  const cell = $enemyGridCells[row * GRID_SIZE + col];
  if (!cell) return;
  cell.className = 'cell';
  cell.onclick = null;
  if (hit) {
    cell.classList.add('hit-enemy');
    const key = `${row},${col}`;
    const sunk = state.opponentFleet.ships.find(
      (s) => s.cells.some((c) => `${c.row},${c.col}` === key) && s.hits.length >= s.cells.length && s.armorLeft <= 0
    );
    if (sunk) cell.classList.add('sunk-enemy');
  } else {
    cell.classList.add('miss');
  }
  flashCell(cell);
}

function patchMyCell(row, col) {
  if (!$myGridCells) return;
  const cell = $myGridCells[row * GRID_SIZE + col];
  if (!cell) return;
  const key = `${row},${col}`;
  const shipCellMap = new Map();
  state.myFleet.ships.forEach((ship) => {
    ship.cells.forEach((c) => shipCellMap.set(`${c.row},${c.col}`, ship));
  });
  const ship = shipCellMap.get(key);
  if (ship) {
    cell.classList.add('ship', 'hit-on-me');
    if (ship.hits.length >= ship.cells.length && ship.armorLeft <= 0) cell.classList.add('sunk');
  } else {
    cell.classList.add('miss');
  }
  flashCell(cell);
}

function refreshEnemyClickability() {
  if (!$enemyGridCells) return;
  const hitKeys = new Set(state.myShots);
  $enemyGridCells.forEach((cell, i) => {
    const row = Math.floor(i / GRID_SIZE);
    const col = i % GRID_SIZE;
    if (hitKeys.has(`${row},${col}`)) return;
    if (state.myTurn) {
      cell.classList.add('clickable');
      cell.onclick = () => fireShot(row, col);
    } else {
      cell.classList.remove('clickable');
      cell.onclick = null;
    }
  });
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function isHitOnOpponent(key) {
  return state.opponentFleet.ships.some((ship) => ship.hits.includes(key));
}

function fireShot(row, col) {
  const key = `${row},${col}`;
  if (state.myShots.includes(key)) return;
  if (!state.myTurn) return;
  if (!state.ws || state.ws.readyState !== 1) return;
  state.ws.send(JSON.stringify({ type: 'shoot', row, col }));
}

function flashCell(cellEl) {
  cellEl.classList.add('flash');
  setTimeout(() => cellEl.classList.remove('flash'), 400);
}

function updateTurnBanner() {
  const banner = document.getElementById('turn-banner');
  if (!banner) return;
  if (state.myTurn) {
    banner.textContent = '🎯 Your turn — click the enemy grid to fire!';
    banner.className = 'my-turn';
  } else {
    banner.textContent = '⏳ Waiting for opponent to fire…';
    banner.className = 'opponent-turn';
  }
}

function updateFleetStatus() {
  const myStatus = document.getElementById('my-fleet-status');
  const enemyStatus = document.getElementById('enemy-fleet-status');
  if (myStatus) myStatus.textContent = fleetStatusText(state.myFleet);
  if (enemyStatus) {
    enemyStatus.textContent = state.opponentFleet.ships.length ? fleetStatusText(state.opponentFleet) : '';
  }
}

function fleetStatusText(fleet) {
  return fleet.ships
    .map((ship) => {
      const isSunk = ship.hits.length >= ship.cells.length && ship.armorLeft <= 0;
      if (isSunk) return '☠️';
      const hits = '🟥'.repeat(ship.hits.length);
      const intact = '⬜'.repeat(ship.cells.length - ship.hits.length);
      const armor = ship.armorLeft > 0 ? '🛡️' : '';
      return hits + intact + armor;
    })
    .join('  ');
}

function showSpyglassBanner() {
  const banner = document.getElementById('spyglass-banner');
  if (!banner) return;
  banner.hidden = false;
  banner.textContent = `🔭 Admiral's Spyglass revealed an enemy ship position!`;
}
