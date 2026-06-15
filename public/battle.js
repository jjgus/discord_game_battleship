// GRID_SIZE defined by grid.js (loaded first)

// ── State — grid.js reads/writes these globals ────────────────────────────────

const state = {
  matchId: null,
  playerId: null,
  phase: 'connecting',
  myFleet: { ships: [] },
  opponentFleet: { ships: [] },
  myShots: [],
  opponentShotsOnMe: [],
  spyglassCells: [],
  myTurn: false,
  ws: null,
};

let $myGridCells = null;
let $enemyGridCells = null;

// ── Boot ──────────────────────────────────────────────────────────────────────

function boot() {
  const pathParts = location.pathname.split('/');
  state.matchId = pathParts[2];
  state.playerId = new URLSearchParams(location.search).get('p');

  if (!state.matchId || !state.playerId) {
    showStatus('Invalid battle link.');
    return;
  }

  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(
    `${proto}//${location.host}/ws?matchId=${encodeURIComponent(state.matchId)}&p=${encodeURIComponent(state.playerId)}`
  );
  state.ws = ws;

  ws.onclose = () => {
    if (state.phase !== 'done') showStatus('⚠️ Disconnected — refresh to reconnect');
  };
  ws.onerror = () => showStatus('Connection error');
  ws.onmessage = (e) => handleServerMessage(JSON.parse(e.data));
}

// ── Server message handling ───────────────────────────────────────────────────

function handleServerMessage(msg) {
  switch (msg.type) {
    case 'battleResume':
      state.myFleet = msg.myFleet;
      state.myShots = msg.myShots;
      state.opponentFleet = msg.opponentFleet;
      state.opponentShotsOnMe = msg.opponentShotsOnMe;
      state.myTurn = msg.yourTurn;
      state.spyglassCells = msg.spyglassCells || [];
      showPhase('battle');
      buildBattleGrids();
      if (state.spyglassCells.length) showSpyglassBanner();
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
      refreshEnemyClickability();
      break;

    case 'gameOver':
      showGameOver(msg.isWinner, msg.winnerName);
      break;

    case 'cancelled':
      showCancelled(msg.message);
      break;

    case 'opponentDisconnected':
      showStatus('⚠️ Opponent disconnected — waiting for them to reconnect…');
      break;

    case 'error':
      showStatus(`Error: ${msg.message}`);
      break;
  }
}

// ── Game over ─────────────────────────────────────────────────────────────────

function showGameOver(isWinner, winnerName) {
  state.phase = 'done';
  document.getElementById('result-icon').textContent = isWinner ? '🏆' : '💀';
  document.getElementById('result-title').textContent = isWinner ? 'Victory!' : 'Defeated!';
  document.getElementById('result-sub').textContent = isWinner
    ? 'You sank the enemy fleet!'
    : `${winnerName || 'Opponent'} sank your fleet.`;
  showPhase('done');
}

function showCancelled(message) {
  state.phase = 'done';
  document.getElementById('result-icon').textContent = '🚫';
  document.getElementById('result-title').textContent = 'Cancelled';
  document.getElementById('result-sub').textContent = message || 'The duel was cancelled.';
  showPhase('done');
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function showPhase(phase) {
  state.phase = phase;
  ['connecting', 'battle', 'done'].forEach((p) => {
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
