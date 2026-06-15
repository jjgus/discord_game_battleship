const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const { randomUUID } = require('crypto');
const { createFleet, addShip, fireAt, isFleetSunk, cellKey } = require('../games/battleship/grid');
const { SHIP_LENGTHS } = require('../games/battleship/duelManager');
const { duelReward } = require('../economy/points');
const { recordResult } = require('../tournament/scheduler');

const sessions = new Map();
const channelToMatch = new Map();

function createWebMatch({ channelId, challengerId, challengerName, opponentId, opponentName, items, firstTurn }) {
  const matchId = randomUUID();
  const session = {
    matchId,
    channelId,
    players: {
      [challengerId]: { userId: challengerId, name: challengerName, fleet: createFleet(), shots: [], ready: false, ws: null },
      [opponentId]: { userId: opponentId, name: opponentName, fleet: createFleet(), shots: [], ready: false, ws: null },
    },
    playerIds: [challengerId, opponentId],
    items,
    firstTurn,
    turn: null,
    phase: 'placement',
    shipCursor: { [challengerId]: 0, [opponentId]: 0 },
  };
  sessions.set(matchId, session);
  channelToMatch.set(channelId, matchId);
  return matchId;
}

function isMatchActiveInChannel(channelId) {
  return channelToMatch.has(channelId);
}

function startGameServer({ port = 3000, store, discordClient } = {}) {
  const app = express();
  app.use(express.static(path.join(__dirname, '../../public')));

  app.get('/', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8"><title>⚓ Battleship Game Server</title>
      <style>body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
      .box{text-align:center;padding:40px;background:#1e293b;border-radius:16px;border:1px solid #334155;}
      h1{font-size:2rem;margin-bottom:12px;}p{color:#94a3b8;}</style></head>
      <body><div class="box"><h1>⚓ Battleship</h1>
      <p>Game server is running.<br>Accept a <code>/duel</code> challenge on Discord to receive your game link.</p>
      </div></body></html>
    `);
  });

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

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    if (req.url.startsWith('/ws')) {
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const matchId = url.searchParams.get('matchId');
    const playerId = url.searchParams.get('p');

    const session = sessions.get(matchId);
    if (!session || !session.players[playerId]) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid game session.' }));
      ws.close();
      return;
    }

    const player = session.players[playerId];
    player.ws = ws;

    const otherId = session.playerIds.find((id) => id !== playerId);
    const other = session.players[otherId];

    if (other.ws && other.ws.readyState === 1) {
      sendBothWelcome(session);
    } else {
      send(ws, { type: 'waiting', message: 'Waiting for your opponent to connect...' });
    }

    ws.on('message', (data) => {
      try {
        handleMessage(session, playerId, JSON.parse(data.toString()), { store, discordClient });
      } catch {
        send(ws, { type: 'error', message: 'Invalid message.' });
      }
    });

    ws.on('close', () => {
      player.ws = null;
      if (session.phase !== 'done') {
        if (other.ws && other.ws.readyState === 1) {
          send(other.ws, { type: 'opponentDisconnected' });
        }
      }
    });
  });

  httpServer.listen(port, () => {
    console.log(`Game server listening on port ${port}`);
  });

  return httpServer;
}

function send(ws, msg) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function sendBothWelcome(session) {
  for (const pid of session.playerIds) {
    const p = session.players[pid];
    const oppId = session.playerIds.find((id) => id !== pid);
    const opp = session.players[oppId];
    send(p.ws, {
      type: 'welcome',
      playerId: pid,
      opponentName: opp.name,
      items: session.items[pid] || [],
      shipLengths: SHIP_LENGTHS,
    });
  }
}

function handleMessage(session, playerId, msg, { store, discordClient }) {
  const player = session.players[playerId];
  const otherId = session.playerIds.find((id) => id !== playerId);
  const other = session.players[otherId];

  if (msg.type === 'place') {
    if (session.phase !== 'placement') return;
    const shipIndex = session.shipCursor[playerId];
    if (shipIndex >= SHIP_LENGTHS.length) return;
    const length = SHIP_LENGTHS[shipIndex];
    const hasArmor = (session.items[playerId] || []).includes('reinforced_hull') && shipIndex === 0;

    try {
      const newFleet = addShip(player.fleet, {
        startRow: msg.row,
        startCol: msg.col,
        length,
        orientation: msg.orientation || 'horizontal',
        armor: hasArmor ? 1 : 0,
      });
      player.fleet = newFleet;
      session.shipCursor[playerId]++;

      const nextIndex = session.shipCursor[playerId];
      const allPlaced = nextIndex >= SHIP_LENGTHS.length;

      send(player.ws, {
        type: 'placed',
        fleet: player.fleet,
        shipIndex: nextIndex,
        nextShipLength: allPlaced ? null : SHIP_LENGTHS[nextIndex],
        allPlaced,
      });

      if (allPlaced) {
        player.ready = true;
        if (other.ready) {
          startBattle(session);
        } else {
          send(player.ws, { type: 'waitingOpponent' });
        }
      }
    } catch {
      send(player.ws, { type: 'error', message: "Ship won't fit there — try a different cell." });
    }
    return;
  }

  if (msg.type === 'shoot') {
    if (session.phase !== 'battle') return;
    if (session.turn !== playerId) {
      send(player.ws, { type: 'error', message: "It's not your turn." });
      return;
    }

    const key = cellKey(msg.row, msg.col);
    if (player.shots.includes(key)) {
      send(player.ws, { type: 'error', message: "You've already fired at that cell." });
      return;
    }

    const { fleet: newFleet, hit } = fireAt(other.fleet, msg.row, msg.col);
    other.fleet = newFleet;
    player.shots.push(key);

    const sunk = isFleetSunk(newFleet);

    send(player.ws, { type: 'shotResult', row: msg.row, col: msg.col, hit, sunk, isYourShot: true, opponentFleet: newFleet });
    send(other.ws, { type: 'shotResult', row: msg.row, col: msg.col, hit, sunk, isYourShot: false, myFleet: newFleet });

    if (sunk) {
      endGame(session, playerId, otherId, { store, discordClient });
    } else {
      session.turn = otherId;
      send(player.ws, { type: 'turnChange', yourTurn: false });
      send(other.ws, { type: 'turnChange', yourTurn: true });
    }
    return;
  }
}

function startBattle(session) {
  const [p1, p2] = session.playerIds;
  let firstTurn = session.firstTurn;
  if (!firstTurn) {
    const p1Compass = (session.items[p1] || []).includes('lucky_compass');
    const p2Compass = (session.items[p2] || []).includes('lucky_compass');
    if (p1Compass && !p2Compass) firstTurn = Math.random() < 0.7 ? p1 : p2;
    else if (p2Compass && !p1Compass) firstTurn = Math.random() < 0.7 ? p2 : p1;
    else firstTurn = Math.random() < 0.5 ? p1 : p2;
  }

  session.turn = firstTurn;
  session.phase = 'battle';

  for (const pid of session.playerIds) {
    const p = session.players[pid];
    const oppId = session.playerIds.find((id) => id !== pid);
    let spyglassCell = null;

    if ((session.items[pid] || []).includes('admirals_spyglass')) {
      const allCells = session.players[oppId].fleet.ships.flatMap((s) => s.cells);
      if (allCells.length > 0) {
        spyglassCell = allCells[Math.floor(Math.random() * allCells.length)];
      }
    }

    send(p.ws, {
      type: 'battleStart',
      yourTurn: pid === firstTurn,
      myFleet: p.fleet,
      spyglassCell,
    });
  }
}

async function endGame(session, winnerId, loserId, { store, discordClient }) {
  session.phase = 'done';

  for (const pid of session.playerIds) {
    send(session.players[pid].ws, {
      type: 'gameOver',
      isWinner: pid === winnerId,
      winnerName: session.players[winnerId].name,
    });
  }

  const winnerPoints = duelReward(true);
  const loserPoints = duelReward(false);
  const nowIso = new Date().toISOString();

  const winner = store.getUser(winnerId);
  const loser = store.getUser(loserId);
  store.updateUser(winnerId, { points: winner.points + winnerPoints, lastDuelAt: nowIso });
  store.updateUser(loserId, { points: loser.points + loserPoints, lastDuelAt: nowIso });

  const tournament = store.getTournament();
  if (tournament.active) {
    store.updateTournament(recordResult(tournament, winnerId, loserId, nowIso.slice(0, 10)));
  }

  store.save();

  try {
    const channel = await discordClient.channels.fetch(session.channelId);
    await channel.send(
      `🎉 <@${winnerId}> sank <@${loserId}>'s fleet and wins **+${winnerPoints} points**! ` +
        `<@${loserId}> earns **+${loserPoints} points** for a good fight.`
    );
  } catch (err) {
    console.error('Failed to post game result to Discord:', err.message);
  }

  sessions.delete(session.matchId);
  channelToMatch.delete(session.channelId);
}

module.exports = { startGameServer, createWebMatch, isMatchActiveInChannel };
