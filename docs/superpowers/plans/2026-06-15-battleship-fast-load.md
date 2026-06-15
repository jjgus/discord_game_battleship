# Battleship Fast-Load + Separate Battle Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the placement grid instantly from server-injected HTML data, and navigate both players to a dedicated `/battle/` URL when the battle begins.

**Architecture:** Server embeds `window.__GAME_DATA__` JSON into the `/game/:matchId` HTML response so `game.js` can render the placement grid immediately on load. When both players finish placing, `game.js` navigates to `/battle/:matchId` which serves a new `battle.html`. The battle page connects a fresh WebSocket; the server detects the session is in battle phase and sends a `battleResume` message with full state. Shared grid rendering lives in `public/grid.js`, loaded by both pages.

**Tech Stack:** Node.js, Express, `ws` WebSocket library, vanilla JS (no bundler), Railway hosting.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `public/grid.js` | Create | Shared battle rendering functions (GRID_SIZE, renderBattle, renderMyFleetGrid, renderEnemyGrid, renderFleetGrid, flashCell, updateTurnBanner, updateFleetStatus, fleetStatusText, showSpyglassBanner, isHitOnOpponent, fireShot) |
| `public/game.html` | Modify | Remove #phase-waiting, #phase-battle, #phase-done; add __GAME_DATA__ script tag; load grid.js |
| `public/game.js` | Modify | Boot from __GAME_DATA__; enable clicks only after WS open; navigate to /battle/ on battleStart; remove battle rendering (delegated to grid.js) |
| `public/battle.html` | Create | Battle + done sections only |
| `public/battle.js` | Create | Boot from URL, connect WS, handle battleResume + all battle messages, delegate rendering to grid.js |
| `src/server/gameServer.js` | Modify | Inject __GAME_DATA__ into /game/:matchId response; add /battle/:matchId route; add sendBattleResume; update WS connect handler |

---

### Task 1: Create `public/grid.js`

Extract all battle rendering from `game.js` into a shared script that both pages load. Functions reference a global `state` object defined by whichever page script loads after it.

**Files:**
- Create: `public/grid.js`

- [ ] **Step 1: Create `public/grid.js`**

```js
const GRID_SIZE = 5;

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

function renderFleetGrid(gridId, fleet) {
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
      if (shipCellMap.has(key)) cell.classList.add('ship');
      el.appendChild(cell);
    }
  }
}


function isHitOnOpponent(key) {
  return state.opponentFleet.ships.some((ship) => ship.hits.includes(key));
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

function fireShot(row, col) {
  const key = `${row},${col}`;
  if (state.myShots.includes(key)) return;
  if (!state.myTurn) return;
  if (!state.ws || state.ws.readyState !== 1) return;
  state.ws.send(JSON.stringify({ type: 'shoot', row, col }));
}
```

- [ ] **Step 2: Commit**

```bash
git add public/grid.js
git commit -m "feat: extract shared battle rendering into grid.js"
```

---

### Task 2: Update `src/server/gameServer.js` — routes and battleResume

Add `fs` require, change `/game/:matchId` to inject `__GAME_DATA__`, add `/battle/:matchId` route, and add `sendBattleResume` helper.

**Files:**
- Modify: `src/server/gameServer.js`

- [ ] **Step 1: Add `fs` require at top of `gameServer.js`**

Add after the existing requires at line 1:
```js
const fs = require('fs');
```

So the top of the file becomes:
```js
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const { createFleet, addShip, fireAt, isFleetSunk, cellKey } = require('../games/battleship/grid');
const { SHIP_LENGTHS } = require('../games/battleship/duelManager');
const { duelReward } = require('../economy/points');
const { recordResult } = require('../tournament/scheduler');
```

- [ ] **Step 2: Replace the `/game/:matchId` route**

Replace the existing route (lines 78–94 in the original file):
```js
  app.get('/game/:matchId', (req, res) => {
    const session = sessions.get(req.params.matchId);
    if (!session) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="UTF-8"><title>Game Not Found</title>
        <style>body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
        .box{text-align:center;padding:40px;background:#1e293b;border-radius:16px;border:1px solid #334155;}
        h1{font-size:2rem;margin-bottom:12px;color:#ef4444;}p{color:#94a3b8;}</style></head>
        <body><div class="box"><h1>Game Not Found</h1>
        <p>This game has already ended or the link is invalid.<br>Start a new duel on Discord to get a fresh link.</p>
        </div></body></html>
      `);
    }
    res.sendFile(path.join(__dirname, '../../public/game.html'));
  });
```

With:
```js
  app.get('/game/:matchId', (req, res) => {
    const session = sessions.get(req.params.matchId);
    const playerId = req.query.p;

    if (!session || !session.players[playerId]) {
      return res.status(404).send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Game Not Found</title>
        <style>body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
        .box{text-align:center;padding:40px;background:#1e293b;border-radius:16px;border:1px solid #334155;}
        h1{font-size:2rem;margin-bottom:12px;color:#ef4444;}p{color:#94a3b8;}</style></head>
        <body><div class="box"><h1>Game Not Found</h1>
        <p>This game has already ended or the link is invalid.<br>Start a new duel on Discord to get a fresh link.</p>
        </div></body></html>`);
    }

    if (session.phase === 'battle') {
      return res.redirect(302, `/battle/${req.params.matchId}?p=${playerId}`);
    }

    const otherId = session.playerIds.find((id) => id !== playerId);
    const gameData = {
      matchId: session.matchId,
      playerId,
      playerName: session.players[playerId].name,
      opponentName: session.players[otherId].name,
      shipLengths: SHIP_LENGTHS,
    };

    const html = fs.readFileSync(path.join(__dirname, '../../public/game.html'), 'utf8');
    const injected = html.replace('window.__GAME_DATA__ = {}', `window.__GAME_DATA__ = ${JSON.stringify(gameData)}`);
    res.setHeader('Content-Type', 'text/html');
    res.send(injected);
  });
```

- [ ] **Step 3: Add `/battle/:matchId` route immediately after the `/game/:matchId` route**

```js
  app.get('/battle/:matchId', (req, res) => {
    const session = sessions.get(req.params.matchId);
    const playerId = req.query.p;

    if (!session || !session.players[playerId] || session.phase !== 'battle') {
      return res.status(404).send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Game Not Found</title>
        <style>body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
        .box{text-align:center;padding:40px;background:#1e293b;border-radius:16px;border:1px solid #334155;}
        h1{font-size:2rem;margin-bottom:12px;color:#ef4444;}p{color:#94a3b8;}</style></head>
        <body><div class="box"><h1>Battle Not Found</h1>
        <p>This battle has ended or the link is invalid.</p>
        </div></body></html>`);
    }

    res.sendFile(path.join(__dirname, '../../public/battle.html'));
  });
```

- [ ] **Step 4: Add `sendBattleResume` function**

Add this function after the existing `sendBothWelcome` function (around line 191 in original):

```js
function sendBattleResume(session, playerId, ws) {
  const player = session.players[playerId];
  const otherId = session.playerIds.find((id) => id !== playerId);
  const other = session.players[otherId];

  send(ws, {
    type: 'battleResume',
    myFleet: player.fleet,
    myShots: player.shots,
    opponentFleet: other.fleet,
    opponentShotsOnMe: other.shots,
    yourTurn: session.turn === playerId,
    spyglassCells: [],
  });
}
```

- [ ] **Step 5: Update the WS `connection` handler**

Replace the section that currently does `sendBothWelcome` / `send waiting` (inside `wss.on('connection', ...)`, after `player.ws = ws`):

**Current code:**
```js
    if (other.ws && other.ws.readyState === 1) {
      sendBothWelcome(session);
    } else {
      send(ws, { type: 'waiting', message: 'Waiting for your opponent to connect...' });
    }
```

**Replace with:**
```js
    if (session.phase === 'battle') {
      sendBattleResume(session, playerId, ws);
    } else if (session.phase === 'done') {
      send(ws, { type: 'cancelled', message: 'This game has already ended.' });
      ws.close();
    } else {
      // placement phase — __GAME_DATA__ handles initial render; send welcome only on reconnect
      const isReconnect = session.shipCursor[playerId] > 0;
      if (isReconnect) {
        send(ws, {
          type: 'welcome',
          opponentName: other.name,
          items: session.items[playerId] || [],
          shipLengths: SHIP_LENGTHS,
          fleet: player.fleet,
          currentShipIndex: session.shipCursor[playerId],
        });
      } else {
        send(ws, { type: 'connected' });
      }
    }
```

- [ ] **Step 6: Commit**

```bash
git add src/server/gameServer.js
git commit -m "feat: inject __GAME_DATA__ into placement page, add /battle/ route and battleResume"
```

---

### Task 3: Update `public/game.html` and `public/game.js`

Remove battle/done sections from game.html, add the data injection placeholder and grid.js script. Rewrite game.js to boot from embedded data and delegate battle rendering to grid.js.

**Files:**
- Modify: `public/game.html`
- Modify: `public/game.js`

- [ ] **Step 1: Replace `public/game.html` entirely**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>⚓ Battleship</title>
  <link rel="stylesheet" href="/game.css" />
</head>
<body>
  <div id="app">
    <header>
      <h1>⚓ Battleship</h1>
      <div id="status-bar"></div>
    </header>

    <main>
      <!-- CONNECTING (shown briefly before __GAME_DATA__ is read) -->
      <section id="phase-connecting">
        <div class="spinner"></div>
        <p>Connecting…</p>
      </section>

      <!-- PLACEMENT -->
      <section id="phase-placement" hidden>
        <div class="placement-header">
          <div id="placement-info">Place ship 1 of 3</div>
          <button id="btn-rotate" class="btn-secondary">🔄 Rotate (R)</button>
        </div>
        <div id="placement-grid" class="grid"></div>
        <p class="hint">Ships are placed in the selected direction from the cell you click.</p>
      </section>

      <!-- WAITING FOR OPPONENT TO PLACE -->
      <section id="phase-waiting-opponent" hidden>
        <div class="spinner"></div>
        <p>Fleet placed! Waiting for opponent…</p>
        <div id="preview-fleet-wrapper">
          <h3>Your Fleet</h3>
          <div id="preview-fleet-grid" class="grid"></div>
        </div>
      </section>

      <!-- CANCELLED (shown if duel is cancelled during placement) -->
      <section id="phase-cancelled" hidden>
        <p id="cancelled-msg" style="font-size:1.1rem;color:var(--text-dim);text-align:center;"></p>
      </section>
    </main>
  </div>

  <script>window.__GAME_DATA__ = {}</script>
  <script src="/grid.js"></script>
  <script src="/game.js"></script>
</body>
</html>
```

- [ ] **Step 2: Replace `public/game.js` entirely**

```js
// ── State ─────────────────────────────────────────────────────────────────────

const state = {
  matchId: null,
  playerId: null,
  phase: 'connecting',
  myFleet: { ships: [] },
  // battle-phase fields (referenced by grid.js functions)
  opponentFleet: { ships: [] },
  myShots: [],
  opponentShotsOnMe: [],
  spyglassCells: [],
  myTurn: false,
  // placement
  shipLengths: [],
  currentShipIndex: 0,
  orientation: 'horizontal',
  hoverCell: null,
  wsReady: false,
  ws: null,
};

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
  if (data && data.shipLengths && data.shipLengths.length > 0) {
    state.shipLengths = data.shipLengths;
    showStatus(`vs ${data.opponentName}`);
    showPhase('placement');
    startPlacement();
  } else {
    showPhase('connecting');
  }

  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${proto}//${location.host}/ws?matchId=${encodeURIComponent(state.matchId)}&p=${encodeURIComponent(state.playerId)}`);
  state.ws = ws;

  ws.onopen = () => {
    state.wsReady = true;
    renderPlacementGrid();
  };
  ws.onclose = () => {
    if (state.phase !== 'done') {
      showStatus('⚠️ Disconnected — refresh to reconnect');
    }
  };
  ws.onerror = () => showStatus('Connection error');
  ws.onmessage = (e) => handleServerMessage(JSON.parse(e.data));
}

// ── Server message handling ────────────────────────────────────────────────────

function handleServerMessage(msg) {
  switch (msg.type) {
    case 'connected':
      // WS open; grid already rendered from __GAME_DATA__ — nothing to do
      break;

    case 'welcome':
      // Reconnect mid-placement: restore fleet state and re-render
      state.myFleet = msg.fleet || { ships: [] };
      state.currentShipIndex = msg.currentShipIndex || 0;
      if (!state.shipLengths.length) state.shipLengths = msg.shipLengths;
      showStatus(`vs ${msg.opponentName}`);
      showPhase('placement');
      startPlacement();
      break;

    case 'placed':
      state.myFleet = msg.fleet;
      state.currentShipIndex = msg.shipIndex;
      if (msg.allPlaced) {
        showPhase('waiting-opponent');
        renderFleetGrid('preview-fleet-grid', state.myFleet);
      } else {
        renderPlacementGrid();
        document.getElementById('placement-info').textContent =
          `Place ship ${msg.shipIndex + 1} of ${state.shipLengths.length} (${msg.nextShipLength} cells)`;
      }
      break;

    case 'waitingOpponent':
      showPhase('waiting-opponent');
      renderFleetGrid('preview-fleet-grid', state.myFleet);
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

// ── Placement ─────────────────────────────────────────────────────────────────

function startPlacement() {
  showPhase('placement');
  const shipNum = state.currentShipIndex + 1;
  const len = state.shipLengths[state.currentShipIndex];
  document.getElementById('placement-info').textContent =
    `Place ship ${shipNum} of ${state.shipLengths.length} (${len} cells)`;

  if (!placementListenersAttached) {
    document.getElementById('btn-rotate').addEventListener('click', toggleOrientation);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'r' || e.key === 'R') toggleOrientation();
    });
    placementListenersAttached = true;
  }

  renderPlacementGrid();
}

function toggleOrientation() {
  state.orientation = state.orientation === 'horizontal' ? 'vertical' : 'horizontal';
  document.getElementById('btn-rotate').textContent =
    state.orientation === 'horizontal' ? '🔄 Rotate (R) →H' : '🔄 Rotate (R) ↓V';
  renderPlacementGrid();
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
  return cells.every(({ row, col }) =>
    row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE && !occupied.has(`${row},${col}`)
  );
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
        if (state.wsReady) cell.classList.add('clickable');
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
        if (!state.wsReady) return;
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
```

- [ ] **Step 3: Commit**

```bash
git add public/game.html public/game.js
git commit -m "feat: boot placement grid from __GAME_DATA__, navigate to /battle/ on start"
```

---

### Task 4: Create `public/battle.html` and `public/battle.js`

New page for the battle phase. Loads `grid.js` for rendering and `battle.js` for logic.

**Files:**
- Create: `public/battle.html`
- Create: `public/battle.js`

- [ ] **Step 1: Create `public/battle.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>⚔️ Battle</title>
  <link rel="stylesheet" href="/game.css" />
</head>
<body>
  <div id="app">
    <header>
      <h1>⚔️ Battle</h1>
      <div id="status-bar"></div>
    </header>

    <main>
      <!-- STARTING -->
      <section id="phase-starting">
        <div class="spinner"></div>
        <p>Battle starting…</p>
      </section>

      <!-- BATTLE -->
      <section id="phase-battle" hidden>
        <div id="turn-banner"></div>
        <div class="battle-area">
          <div class="board">
            <h3>Your Fleet</h3>
            <div id="my-grid" class="grid"></div>
            <div id="my-fleet-status" class="fleet-status"></div>
          </div>
          <div class="board">
            <h3>Enemy Waters</h3>
            <div id="enemy-grid" class="grid"></div>
            <div id="enemy-fleet-status" class="fleet-status"></div>
          </div>
        </div>
        <div id="spyglass-banner" hidden></div>
      </section>

      <!-- DONE -->
      <section id="phase-done" hidden>
        <div id="result-box">
          <div id="result-icon"></div>
          <div id="result-title"></div>
          <div id="result-sub"></div>
        </div>
      </section>
    </main>
  </div>

  <script src="/grid.js"></script>
  <script src="/battle.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `public/battle.js`**

```js
// ── State ─────────────────────────────────────────────────────────────────────

const state = {
  matchId: null,
  playerId: null,
  phase: 'starting',
  myFleet: { ships: [] },
  opponentFleet: { ships: [] },
  myShots: [],
  opponentShotsOnMe: [],
  spyglassCells: [],
  myTurn: false,
  ws: null,
};

// ── Boot ──────────────────────────────────────────────────────────────────────

function boot() {
  const pathParts = location.pathname.split('/');
  state.matchId = pathParts[2];
  state.playerId = new URLSearchParams(location.search).get('p');

  if (!state.matchId || !state.playerId) {
    document.querySelector('#phase-starting p').textContent = 'Invalid battle link.';
    return;
  }

  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(
    `${proto}//${location.host}/ws?matchId=${encodeURIComponent(state.matchId)}&p=${encodeURIComponent(state.playerId)}`
  );
  state.ws = ws;

  ws.onclose = () => {
    if (state.phase !== 'done') {
      document.querySelector('#phase-starting p').textContent = '⚠️ Connection lost — please refresh.';
      showPhase('starting');
    }
  };
  ws.onerror = () => showStatus('Connection error');
  ws.onmessage = (e) => handleServerMessage(JSON.parse(e.data));
}

// ── Server message handling ────────────────────────────────────────────────────

function handleServerMessage(msg) {
  switch (msg.type) {
    case 'battleResume':
      state.myFleet = msg.myFleet;
      state.myShots = msg.myShots || [];
      state.opponentFleet = msg.opponentFleet || { ships: [] };
      state.opponentShotsOnMe = msg.opponentShotsOnMe || [];
      state.myTurn = msg.yourTurn;
      state.spyglassCells = msg.spyglassCells || [];
      showPhase('battle');
      renderBattle();
      if (state.spyglassCells.length) showSpyglassBanner();
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

    case 'gameOver': {
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
    }

    case 'cancelled':
      state.phase = 'done';
      showPhase('done');
      document.getElementById('result-icon').textContent = '🚫';
      document.getElementById('result-title').textContent = 'Duel Cancelled';
      document.getElementById('result-title').style.color = '#94a3b8';
      document.getElementById('result-sub').textContent = msg.message || 'The duel was cancelled.';
      break;

    case 'opponentDisconnected':
      showStatus('⚠️ Opponent disconnected — waiting for them to reconnect…');
      break;

    case 'error':
      showStatus(`Error: ${msg.message}`);
      break;
  }
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function showPhase(phase) {
  state.phase = phase;
  const phases = ['starting', 'battle', 'done'];
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
```

- [ ] **Step 3: Commit**

```bash
git add public/battle.html public/battle.js
git commit -m "feat: add battle page with battleResume flow"
```

---

### Task 5: Manual End-to-End Verification

- [ ] **Step 1: Start the server locally**

```bash
node src/index.js
```

Expected output: `Game server listening on port 3000`

- [ ] **Step 2: Simulate two players connecting**

Open two browser tabs:
- Tab A: `http://localhost:3000/game/MATCH_ID?p=PLAYER_A_ID`
- Tab B: `http://localhost:3000/game/MATCH_ID?p=PLAYER_B_ID`

(Get a real matchId by triggering `/duel challenge` on Discord, then copying the DM link.)

- [ ] **Step 3: Verify placement grid appears immediately**

In both tabs: the 5×5 grid should appear instantly on page load (no spinner waiting for opponent). Status bar should show `vs OpponentName`. Cells should become clickable within ~1s (after WS connects).

- [ ] **Step 4: Place all ships in both tabs**

Place all 3 ships in Tab A. Tab A shows "Fleet placed! Waiting for opponent…". Place all 3 ships in Tab B.

- [ ] **Step 5: Verify battle page navigation**

Both tabs should navigate to `/battle/MATCH_ID?p=PLAYER_ID`. The URL in the address bar should change. "Battle starting…" spinner should appear briefly, then the battle grids should appear.

- [ ] **Step 6: Verify battle works correctly**

Click enemy grid cells to fire. Verify hits/misses render. Verify turn alternates. Verify the game ends with Victory/Defeated screen.

- [ ] **Step 7: Verify reconnect on battle page**

While in battle, refresh one tab. The page should reconnect and show the current battle state (previously fired shots, ship positions, whose turn it is).

- [ ] **Step 8: Deploy to Railway and repeat Steps 2–6 in production**

Push to main, wait for Railway deploy, verify with real Discord bot DM links.
