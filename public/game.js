const GRID_SIZE = 5;

// ── State ─────────────────────────────────────────────────────────────────────

const state = {
  matchId: null,
  playerId: null,
  phase: 'connecting',
  myFleet: { ships: [] },
  opponentFleet: { ships: [] },  // only revealed hits
  myShots: [],          // keys I've fired ("row,col")
  opponentShotsOnMe: [], // keys opponent fired at me
  shipLengths: [],
  currentShipIndex: 0,
  orientation: 'horizontal',
  myTurn: false,
  hoverCell: null,
  spyglassCells: [],   // [{row,col}] revealed by spyglass
  ws: null,
};

// ── Boot ──────────────────────────────────────────────────────────────────────

function boot() {
  const pathParts = location.pathname.split('/');
  state.matchId = pathParts[2];
  state.playerId = new URLSearchParams(location.search).get('p');

  if (!state.matchId || !state.playerId) {
    showStatus('Invalid game link.');
    return;
  }

  showPhase('connecting');

  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${proto}//${location.host}/ws?matchId=${encodeURIComponent(state.matchId)}&p=${encodeURIComponent(state.playerId)}`);
  state.ws = ws;

  ws.onopen = () => {
    showStatus('Connected');
    // Give immediate feedback — server message will refine this shortly
    document.querySelector('#phase-connecting p').textContent = 'Connected — waiting for game server…';
  };
  ws.onclose = () => {
    if (state.phase !== 'done') {
      showStatus('⚠️ Disconnected — refresh to reconnect');
      showPhase('connecting');
      document.querySelector('#phase-connecting p').textContent = '⚠️ Connection lost — please refresh the page.';
      document.querySelector('#phase-connecting .spinner').style.display = 'none';
    }
  };
  ws.onerror = () => showStatus('Connection error');
  ws.onmessage = (e) => handleServerMessage(JSON.parse(e.data));
}

// ── Server message handling ────────────────────────────────────────────────────

function handleServerMessage(msg) {
  switch (msg.type) {
    case 'waiting':
      showPhase('waiting');
      document.getElementById('waiting-msg').textContent = msg.message + ' Make sure they opened their DM link.';
      break;

    case 'welcome':
      state.shipLengths = msg.shipLengths;
      state.myItems = msg.items || [];
      showStatus(`vs ${msg.opponentName}`);
      startPlacement();
      break;

    case 'placed':
      state.myFleet = msg.fleet;
      state.currentShipIndex = msg.shipIndex;
      if (msg.allPlaced) {
        showPhase('waiting-opponent');
        renderFleetGrid('preview-fleet-grid', state.myFleet, [], [], []);
      } else {
        renderPlacementGrid();
        const shipNum = msg.shipIndex + 1;
        document.getElementById('placement-info').textContent =
          `Place ship ${shipNum} of ${state.shipLengths.length} (${msg.nextShipLength} cells)`;
      }
      break;

    case 'waitingOpponent':
      showPhase('waiting-opponent');
      renderFleetGrid('preview-fleet-grid', state.myFleet, [], [], []);
      break;

    case 'battleStart':
      state.myFleet = msg.myFleet;
      state.myTurn = msg.yourTurn;
      if (msg.spyglassCell) {
        state.spyglassCells = [msg.spyglassCell];
      }
      showPhase('battle');
      renderBattle();
      if (msg.spyglassCell) {
        showSpyglassBanner(msg.spyglassCell);
      }
      break;

    case 'shotResult':
      if (msg.isYourShot) {
        state.myShots.push(`${msg.row},${msg.col}`);
        state.opponentFleet = msg.opponentFleet;
        flashCell('enemy-grid', msg.row, msg.col, msg.hit ? 'hit-enemy' : 'miss');
      } else {
        state.opponentShotsOnMe.push(`${msg.row},${msg.col}`);
        state.myFleet = msg.myFleet;
        flashCell('my-grid', msg.row, msg.col, 'hit-on-me');
      }
      renderBattle();
      break;

    case 'turnChange':
      state.myTurn = msg.yourTurn;
      updateTurnBanner();
      renderEnemyGrid();
      break;

    case 'gameOver':
      state.phase = 'done';
      showPhase('done');
      const icon = document.getElementById('result-icon');
      const title = document.getElementById('result-title');
      const sub = document.getElementById('result-sub');
      if (msg.isWinner) {
        icon.textContent = '🏆';
        title.textContent = 'Victory!';
        title.style.color = '#38bdf8';
        sub.textContent = 'You sank the enemy fleet. +50 points!';
      } else {
        icon.textContent = '💀';
        title.textContent = 'Defeated';
        title.style.color = '#ef4444';
        sub.textContent = `${msg.winnerName} won this one. +10 points for the fight.`;
      }
      break;

    case 'cancelled':
      state.phase = 'done';
      showPhase('done');
      document.getElementById('result-icon').textContent = '🚫';
      document.getElementById('result-title').textContent = 'Duel Cancelled';
      document.getElementById('result-title').style.color = '#94a3b8';
      document.getElementById('result-sub').textContent = msg.message || 'The duel was cancelled.';
      break;

    case 'opponentDisconnected':
      showStatus('⚠️ Opponent disconnected');
      break;

    case 'error':
      showStatus(`Error: ${msg.message}`);
      break;
  }
}

// ── Placement ─────────────────────────────────────────────────────────────────

function startPlacement() {
  showPhase('placement');
  const shipNum = state.currentShipIndex + 1;
  const len = state.shipLengths[state.currentShipIndex];
  document.getElementById('placement-info').textContent =
    `Place ship ${shipNum} of ${state.shipLengths.length} (${len} cells)`;

  document.getElementById('btn-rotate').addEventListener('click', toggleOrientation);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') toggleOrientation();
  });

  renderPlacementGrid();
}

function toggleOrientation() {
  state.orientation = state.orientation === 'horizontal' ? 'vertical' : 'horizontal';
  document.getElementById('btn-rotate').textContent =
    state.orientation === 'horizontal' ? '🔄 Rotate (R) →H' : '🔄 Rotate (R) ↓V';
  if (state.hoverCell) renderPlacementGrid();
  else renderPlacementGrid();
}

function shipCells(row, col, length, orientation) {
  const cells = [];
  for (let i = 0; i < length; i++) {
    cells.push(orientation === 'horizontal' ? { row, col: col + i } : { row: row + i, col });
  }
  return cells;
}

function isValidPlacement(cells) {
  const occupied = new Set(state.myFleet.ships.flatMap((s) => s.cells.map((c) => `${c.row},${c.col}`)));
  return cells.every(({ row, col }) => row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE && !occupied.has(`${row},${col}`));
}

function renderPlacementGrid() {
  const el = document.getElementById('placement-grid');
  if (!el) return;
  el.innerHTML = '';

  const len = state.shipLengths[state.currentShipIndex];
  const occupied = new Set(state.myFleet.ships.flatMap((s) => s.cells.map((c) => `${c.row},${c.col}`)));
  let previewCells = new Set();
  let previewValid = false;

  if (state.hoverCell) {
    const { row, col } = state.hoverCell;
    const cells = shipCells(row, col, len, state.orientation);
    previewValid = isValidPlacement(cells);
    cells.forEach((c) => previewCells.add(`${c.row},${c.col}`));
  }

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const key = `${row},${col}`;
      const cell = document.createElement('div');
      cell.className = 'cell';

      if (occupied.has(key)) {
        cell.classList.add('ship');
      } else if (previewCells.has(key)) {
        cell.classList.add(previewValid ? 'preview' : 'preview-invalid');
        if (previewValid) cell.classList.add('clickable');
      } else {
        cell.classList.add('clickable');
      }

      cell.addEventListener('mouseenter', () => {
        state.hoverCell = { row, col };
        renderPlacementGrid();
      });
      cell.addEventListener('mouseleave', () => {
        state.hoverCell = null;
        renderPlacementGrid();
      });
      cell.addEventListener('click', () => {
        if (!occupied.has(key)) placeShip(row, col);
      });

      el.appendChild(cell);
    }
  }
}

function placeShip(row, col) {
  const len = state.shipLengths[state.currentShipIndex];
  const cells = shipCells(row, col, len, state.orientation);
  if (!isValidPlacement(cells)) return;
  state.ws.send(JSON.stringify({ type: 'place', row, col, orientation: state.orientation }));
}

// ── Battle rendering ──────────────────────────────────────────────────────────

function renderBattle() {
  renderMyFleetGrid();
  renderEnemyGrid();
  updateTurnBanner();
  updateFleetStatus();
}

function renderMyFleetGrid() {
  const shipCellMap = new Map();
  state.myFleet.ships.forEach((ship, idx) => {
    ship.cells.forEach((c) => shipCellMap.set(`${c.row},${c.col}`, { ship, idx }));
  });

  const el = document.getElementById('my-grid');
  if (!el) return;
  el.innerHTML = '';

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const key = `${row},${col}`;
      const cell = document.createElement('div');
      cell.className = 'cell';

      const entry = shipCellMap.get(key);
      const wasHit = state.opponentShotsOnMe.includes(key);

      if (entry) {
        cell.classList.add('ship');
        const { ship } = entry;
        const isSunk = ship.hits.length >= ship.cells.length && ship.armorLeft <= 0;
        if (isSunk) cell.classList.add('sunk');
        if (ship.armorLeft > 0) cell.classList.add('armored');
        if (wasHit) cell.classList.add('hit-on-me');
      } else if (wasHit) {
        cell.classList.add('miss');
      }

      el.appendChild(cell);
    }
  }
}

function renderEnemyGrid() {
  const el = document.getElementById('enemy-grid');
  if (!el) return;
  el.innerHTML = '';

  const hitSet = new Set(state.myShots.filter((k) => isHitOnOpponent(k)));
  const missSet = new Set(state.myShots.filter((k) => !isHitOnOpponent(k)));
  const spySet = new Set(state.spyglassCells.map((c) => `${c.row},${c.col}`));

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const key = `${row},${col}`;
      const cell = document.createElement('div');
      cell.className = 'cell';

      if (hitSet.has(key)) {
        cell.classList.add('hit-enemy');
        const sunkShip = state.opponentFleet.ships.find(
          (s) => s.cells.some((c) => `${c.row},${c.col}` === key) && s.hits.length >= s.cells.length && s.armorLeft <= 0
        );
        if (sunkShip) cell.classList.add('sunk-enemy');
      } else if (missSet.has(key)) {
        cell.classList.add('miss');
      } else {
        if (spySet.has(key) && !state.myShots.includes(key)) {
          cell.classList.add('spyglass');
        }
        if (state.myTurn) {
          cell.classList.add('clickable');
          cell.addEventListener('click', () => fireShot(row, col));
        }
      }

      el.appendChild(cell);
    }
  }
}

function renderFleetGrid(gridId, fleet, opponentShots, spyglassCells) {
  const el = document.getElementById(gridId);
  if (!el) return;
  el.innerHTML = '';

  const shipCellMap = new Map();
  fleet.ships.forEach((ship) => {
    ship.cells.forEach((c) => shipCellMap.set(`${c.row},${c.col}`, ship));
  });

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const key = `${row},${col}`;
      const cell = document.createElement('div');
      cell.className = 'cell';

      if (shipCellMap.has(key)) {
        cell.classList.add('ship');
      }

      el.appendChild(cell);
    }
  }
}

function isHitOnOpponent(key) {
  return state.opponentFleet.ships.some((ship) => ship.hits.includes(key));
}

function fireShot(row, col) {
  const key = `${row},${col}`;
  if (state.myShots.includes(key)) return;
  if (!state.myTurn) return;
  state.ws.send(JSON.stringify({ type: 'shoot', row, col }));
}

function flashCell(gridId, row, col, className) {
  const el = document.getElementById(gridId);
  if (!el) return;
  const index = row * GRID_SIZE + col;
  const cell = el.children[index];
  if (!cell) return;
  cell.classList.add(className, 'flash');
  setTimeout(() => cell.classList.remove('flash'), 400);
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

  if (myStatus) {
    myStatus.textContent = fleetStatusText(state.myFleet);
  }
  if (enemyStatus) {
    const enemyText = state.opponentFleet.ships.length
      ? fleetStatusText(state.opponentFleet)
      : '';
    enemyStatus.textContent = enemyText;
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

function showSpyglassBanner(cell) {
  const banner = document.getElementById('spyglass-banner');
  if (!banner) return;
  banner.hidden = false;
  banner.textContent = `🔭 Admiral's Spyglass revealed an enemy ship position!`;
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function showPhase(phase) {
  state.phase = phase;
  const phases = ['connecting', 'waiting', 'placement', 'waiting-opponent', 'battle', 'done'];
  phases.forEach((p) => {
    const el = document.getElementById(`phase-${p}`);
    if (el) el.hidden = p !== phase;
  });
}

function showStatus(msg) {
  const el = document.getElementById('status-bar');
  if (el) el.textContent = msg;
}

// ── Start ─────────────────────────────────────────────────────────────────────

boot();
