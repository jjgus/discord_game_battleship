// GRID_SIZE is defined by grid.js (loaded before this script)

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
  // battle-phase fields (grid.js reads these)
  opponentFleet: { ships: [] },
  myShots: [],
  opponentShotsOnMe: [],
  spyglassCells: [],
  myTurn: false,
  // placement
  shipConfigs: [],
  currentShipIndex: 0,
  orientation: 'horizontal',
  lRotation: 0,
  hoverCell: null,
  wsReady: false,
  ws: null,
};

// Cached placement cells — built once in buildPlacementGrid()
let $placementCells = null;
let prevPreviewKeys = new Set();
// grid.js battle cell arrays — defined here so grid.js can write to them
let $myGridCells = null;
let $enemyGridCells = null;

let placementListenersAttached = false;

// ── Boot ──────────────────────────────────────────────────────────────────────

function boot() {
  const pathParts = location.pathname.split('/');
  state.matchId = pathParts[2];
  state.playerId = new URLSearchParams(location.search).get('p');

  if (!state.matchId || !state.playerId) {
    showStatus('Invalid game link.');
    return;
  }

  const data = window.__GAME_DATA__;
  if (data && data.shipConfigs && data.shipConfigs.length > 0) {
    state.shipConfigs = data.shipConfigs;
    showStatus(`vs ${data.opponentName}`);
    showPhase('placement');
    startPlacement();
  } else {
    showPhase('connecting');
  }

  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(
    `${proto}//${location.host}/ws?matchId=${encodeURIComponent(state.matchId)}&p=${encodeURIComponent(state.playerId)}`
  );
  state.ws = ws;

  ws.onopen = () => {
    state.wsReady = true;
    // Placement grid may already be rendered; re-render to enable clicks
    if (state.phase === 'placement') refreshPlacementOccupied();
  };
  ws.onclose = () => {
    if (state.phase !== 'done') showStatus('⚠️ Disconnected — refresh to reconnect');
  };
  ws.onerror = () => showStatus('Connection error');
  ws.onmessage = (e) => handleServerMessage(JSON.parse(e.data));
}

// ── Server message handling ────────────────────────────────────────────────────

function handleServerMessage(msg) {
  switch (msg.type) {
    case 'connected':
      // WS open; placement grid already rendered from __GAME_DATA__
      break;

    case 'welcome':
      // Reconnect mid-placement — restore state
      if (!state.shipConfigs.length) state.shipConfigs = msg.shipConfigs;
      state.myFleet = msg.fleet || { ships: [] };
      state.currentShipIndex = msg.currentShipIndex || 0;
      showStatus(`vs ${msg.opponentName}`);
      showPhase('placement');
      if (!placementListenersAttached) startPlacement();
      refreshPlacementOccupied();
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
      window.location.replace(`/battle/${state.matchId}?p=${state.playerId}`);
      break;

    case 'cancelled':
      document.getElementById('cancelled-msg').textContent = '🚫 ' + (msg.message || 'The duel was cancelled.');
      showPhase('cancelled');
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

  if (!placementListenersAttached) {
    document.getElementById('btn-rotate').addEventListener('click', toggleOrientation);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'r' || e.key === 'R') toggleOrientation();
    });
    placementListenersAttached = true;
  }
}

function buildPlacementGrid() {
  const el = document.getElementById('placement-grid');
  if (!el) return;
  el.innerHTML = '';
  $placementCells = [];
  prevPreviewKeys = new Set();

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
    if (!state.wsReady) return;
    const target = e.target.closest('[data-row]');
    if (!target) return;
    placeShip(+target.dataset.row, +target.dataset.col);
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

// Incremental hover update — only touches ~6 cells
function refreshPlacementPreview() {
  const occupied = occupiedSet();

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

// Called after a ship is placed — marks occupied cells, clears preview state
function refreshPlacementOccupied() {
  if (!$placementCells) return;
  const occupied = occupiedSet();
  prevPreviewKeys = new Set();
  $placementCells.forEach((cell) => {
    const key = `${cell.dataset.row},${cell.dataset.col}`;
    cell.className = occupied.has(key) ? 'cell ship' : 'cell clickable';
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
  const label = isLShip() ? `${config.name} (L-shape)` : `${config.name} (${config.length} cells)`;
  document.getElementById('placement-info').textContent = `Ship ${shipNum} of ${total} — ${label}`;

  const iconEl = document.getElementById('ship-icon');
  if (iconEl) { iconEl.src = SHIP_ICONS[config.id] || ''; iconEl.alt = config.name; }

  updateRotateButton();
}

function updateRotateButton() {
  const btn = document.getElementById('btn-rotate');
  if (!btn) return;
  btn.textContent = isLShip()
    ? `🔄 Rotate (R) ${L_ROTATION_LABELS[state.lRotation]}`
    : state.orientation === 'horizontal' ? '🔄 Rotate (R) →H' : '🔄 Rotate (R) ↓V';
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

// ── UI helpers ────────────────────────────────────────────────────────────────

function showPhase(phase) {
  state.phase = phase;
  const phases = ['connecting', 'placement', 'waiting-opponent', 'cancelled'];
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
