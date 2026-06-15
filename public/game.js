const GRID_SIZE = 5;

const L_ROTATIONS = [
  [{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 1, col: 1 }],
  [{ row: 0, col: 1 }, { row: 1, col: 0 }, { row: 1, col: 1 }],
  [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 0 }],
  [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 1 }],
];
const L_ROTATION_LABELS = ['⌐', 'Γ', '└', '┘'];

const SHIP_ICONS = {
  destroyer: '/assets/ships/destroyer.svg',
  'patrol-a': '/assets/ships/patrol.svg',
  'patrol-b': '/assets/ships/patrol.svg',
  corvette:   '/assets/ships/corvette.svg',
};

// ── State ─────────────────────────────────────────────────────────────────────

const state = {
  matchId: null,
  playerId: null,
  phase: 'connecting',
  myFleet: { ships: [] },
  opponentFleet: { ships: [] },
  myShots: [],
  opponentShotsOnMe: [],
  shipConfigs: [],
  currentShipIndex: 0,
  orientation: 'horizontal',
  lRotation: 0,
  hoverCell: null,
  spyglassCells: [],
  myTurn: false,
  ws: null,
};

// Cached DOM cell arrays — built once, updated with class changes only
let $placementCells = null;   // flat[row*5+col]
let $myGridCells = null;
let $enemyGridCells = null;
let prevPreviewKeys = new Set(); // keys currently showing preview class

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
      state.shipConfigs = msg.shipConfigs;
      state.myItems = msg.items || [];
      showStatus(`vs ${msg.opponentName}`);
      startPlacement();
      break;

    case 'placed':
      state.myFleet = msg.fleet;
      state.currentShipIndex = msg.shipIndex;
      state.lRotation = 0;
      if (msg.allPlaced) {
        showPhase('waiting-opponent');
        buildFleetPreviewGrid();
      } else {
        refreshPlacementOccupied();
        updatePlacementInfo(msg.shipIndex, msg.nextShipConfig);
      }
      break;

    case 'waitingOpponent':
      showPhase('waiting-opponent');
      buildFleetPreviewGrid();
      break;

    case 'battleStart':
      state.myFleet = msg.myFleet;
      state.myTurn = msg.yourTurn;
      if (msg.spyglassCell) state.spyglassCells = [msg.spyglassCell];
      showPhase('battle');
      buildBattleGrids();
      if (msg.spyglassCell) showSpyglassBanner();
      break;

    case 'shotResult':
      if (msg.isYourShot) {
        state.myShots.push(`${msg.row},${msg.col}`);
        state.opponentFleet = msg.opponentFleet;
        patchEnemyCell(msg.row, msg.col, msg.hit);
      } else {
        state.opponentShotsOnMe.push(`${msg.row},${msg.col}`);
        state.myFleet = msg.myFleet;
        patchMyCell(msg.row, msg.col);
      }
      updateFleetStatus();
      break;

    case 'turnChange':
      state.myTurn = msg.yourTurn;
      updateTurnBanner();
      // Re-render enemy grid so click handlers appear/disappear correctly
      refreshEnemyClickability();
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

// ── Placement — build once, patch incrementally ───────────────────────────────

function startPlacement() {
  showPhase('placement');
  state.lRotation = 0;
  updatePlacementInfo(state.currentShipIndex, state.shipConfigs[state.currentShipIndex]);
  buildPlacementGrid();

  document.getElementById('btn-rotate').addEventListener('click', toggleOrientation);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') toggleOrientation();
  });
}

function buildPlacementGrid() {
  const el = document.getElementById('placement-grid');
  if (!el) return;
  el.innerHTML = '';
  $placementCells = [];
  prevPreviewKeys = new Set();

  // Single delegated listeners — no per-cell listeners needed
  el.addEventListener('mouseover', (e) => {
    const target = e.target.closest('[data-row]');
    if (!target) return;
    const row = +target.dataset.row;
    const col = +target.dataset.col;
    if (state.hoverCell?.row === row && state.hoverCell?.col === col) return;
    state.hoverCell = { row, col };
    refreshPlacementPreview();
  });
  el.addEventListener('mouseleave', () => {
    if (!state.hoverCell) return;
    state.hoverCell = null;
    refreshPlacementPreview();
  });
  el.addEventListener('click', (e) => {
    const target = e.target.closest('[data-row]');
    if (!target) return;
    const row = +target.dataset.row;
    const col = +target.dataset.col;
    placeShip(row, col);
  });

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const cell = document.createElement('div');
      cell.className = 'cell clickable';
      cell.dataset.row = row;
      cell.dataset.col = col;
      el.appendChild(cell);
      $placementCells.push(cell);
    }
  }
}

// Called on hover change — only touches the ~6 cells that change
function refreshPlacementPreview() {
  const occupied = occupiedSet();

  // Clear previous preview classes
  prevPreviewKeys.forEach((key) => {
    const [r, c] = key.split(',');
    const cell = $placementCells[+r * GRID_SIZE + +c];
    if (cell && !occupied.has(key)) {
      cell.classList.remove('preview', 'preview-invalid');
      cell.classList.add('clickable');
    }
  });
  prevPreviewKeys = new Set();

  if (!state.hoverCell) return;

  const cells = previewCellsFor(state.hoverCell.row, state.hoverCell.col);
  const valid = isValidPlacement(cells, occupied);

  cells.forEach(({ row, col }) => {
    if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return;
    const key = `${row},${col}`;
    if (occupied.has(key)) return;
    const cell = $placementCells[row * GRID_SIZE + col];
    if (!cell) return;
    cell.classList.remove('clickable');
    cell.classList.add(valid ? 'preview' : 'preview-invalid');
    if (valid) cell.classList.add('clickable');
    prevPreviewKeys.add(key);
  });
}

// Called after a ship is placed — marks the new ship's cells as occupied
function refreshPlacementOccupied() {
  if (!$placementCells) return;
  const occupied = occupiedSet();
  prevPreviewKeys = new Set();
  $placementCells.forEach((cell) => {
    const key = `${cell.dataset.row},${cell.dataset.col}`;
    if (occupied.has(key)) {
      cell.className = 'cell ship';
    } else {
      cell.className = 'cell clickable';
    }
  });
}

function occupiedSet() {
  return new Set(state.myFleet.ships.flatMap((s) => s.cells.map((c) => `${c.row},${c.col}`)));
}

function currentConfig() {
  return state.shipConfigs[state.currentShipIndex];
}

function isLShip() {
  const cfg = currentConfig();
  return cfg && cfg.shape === 'L';
}

function updatePlacementInfo(shipIndex, config) {
  if (!config) return;
  const shipNum = shipIndex + 1;
  const total = state.shipConfigs.length;
  const label = isLShip()
    ? `${config.name} (L-shape)`
    : `${config.name} (${config.length} cells)`;
  document.getElementById('placement-info').textContent = `Ship ${shipNum} of ${total} — ${label}`;

  const iconEl = document.getElementById('ship-icon');
  if (iconEl) {
    iconEl.src = SHIP_ICONS[config.id] || '';
    iconEl.alt = config.name;
  }

  updateRotateButton();
}

function updateRotateButton() {
  const btn = document.getElementById('btn-rotate');
  if (!btn) return;
  if (isLShip()) {
    btn.textContent = `🔄 Rotate (R) ${L_ROTATION_LABELS[state.lRotation]}`;
  } else {
    btn.textContent = state.orientation === 'horizontal' ? '🔄 Rotate (R) →H' : '🔄 Rotate (R) ↓V';
  }
}

function toggleOrientation() {
  if (isLShip()) {
    state.lRotation = (state.lRotation + 1) % 4;
  } else {
    state.orientation = state.orientation === 'horizontal' ? 'vertical' : 'horizontal';
  }
  updateRotateButton();
  refreshPlacementPreview();
}

function previewCellsFor(row, col) {
  const cfg = currentConfig();
  if (!cfg) return [];
  if (cfg.shape === 'L') {
    return L_ROTATIONS[state.lRotation].map((o) => ({ row: row + o.row, col: col + o.col }));
  }
  const cells = [];
  for (let i = 0; i < cfg.length; i++) {
    cells.push(state.orientation === 'horizontal' ? { row, col: col + i } : { row: row + i, col });
  }
  return cells;
}

function isValidPlacement(cells, occupied) {
  if (!occupied) occupied = occupiedSet();
  return cells.every(({ row, col }) =>
    row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE && !occupied.has(`${row},${col}`)
  );
}

function placeShip(row, col) {
  const cells = previewCellsFor(row, col);
  if (!isValidPlacement(cells)) return;

  const cfg = currentConfig();
  if (cfg.shape === 'L') {
    state.ws.send(JSON.stringify({ type: 'place', cells }));
  } else {
    state.ws.send(JSON.stringify({ type: 'place', row, col, orientation: state.orientation }));
  }
}

// ── Fleet preview (waiting-opponent screen) ───────────────────────────────────

function buildFleetPreviewGrid() {
  const el = document.getElementById('preview-fleet-grid');
  if (!el) return;
  el.innerHTML = '';

  const occupied = occupiedSet();
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const cell = document.createElement('div');
      cell.className = occupied.has(`${row},${col}`) ? 'cell ship' : 'cell';
      el.appendChild(cell);
    }
  }
}

// ── Battle — build once, patch incrementally ──────────────────────────────────

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

// Patch a single enemy cell after firing — no full rebuild
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
  flashCell(cell, hit ? 'hit-enemy' : 'miss');
}

// Patch a single cell on my fleet after being hit
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
  flashCell(cell, 'hit-on-me');
}

// Re-add/remove click handlers on enemy grid when turn changes
function refreshEnemyClickability() {
  if (!$enemyGridCells) return;
  const hitKeys = new Set(state.myShots);
  $enemyGridCells.forEach((cell, i) => {
    const row = Math.floor(i / GRID_SIZE);
    const col = i % GRID_SIZE;
    const key = `${row},${col}`;
    if (hitKeys.has(key)) return; // already fired
    if (state.myTurn) {
      cell.classList.add('clickable');
      cell.onclick = () => fireShot(row, col);
    } else {
      cell.classList.remove('clickable');
      cell.onclick = null;
    }
  });
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

// Flashes a DOM cell element directly (no grid ID lookup needed)
function flashCell(cellEl, className) {
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
