# Battleship: Fast Load + Separate Battle Page

**Date:** 2026-06-15  
**Status:** Approved

## Problem

Two issues degraded the game experience:

1. **Slow placement load** — The placement grid required a full WebSocket round trip before appearing. On Railway's TLS proxy this added 1–2 seconds of spinner after both players were already connected.
2. **No battle page transition** — All game phases (connecting, waiting, placement, battle, done) lived on a single URL. When the battle started there was no sense of a new phase beginning.
3. **Bug (fixed)** — `section { display: flex }` in game.css overrode the UA stylesheet's `[hidden] { display: none }`, causing all phases to render simultaneously. Fixed by adding `[hidden] { display: none !important; }`.

## Solution Overview

Two dedicated pages with a single responsibility each:

- **Placement page** (`/game/:matchId?p=userId`) — renders the ship placement grid immediately using data embedded in the HTML response. No WebSocket wait.
- **Battle page** (`/battle/:matchId?p=userId`) — new page loaded when battle starts. Shows a brief "Battle starting…" transition while WebSocket reconnects, then renders the battle grid.

## Architecture

### Placement Page

Server injects game data directly into the HTML response:

```html
<script>window.__GAME_DATA__ = { matchId, playerId, shipLengths, playerName, opponentName }</script>
```

`game.js` reads `__GAME_DATA__` on DOMContentLoaded and calls `startPlacement()` immediately — zero WebSocket round trips for initial render. The grid is visible at once but cells are not clickable until the WS handshake completes (prevents sending before the socket is ready). WebSocket connects in the background; once open, cells become interactive.

The `#phase-waiting` section (waiting for opponent to connect before placement) is removed — players can now place ships independently as soon as their own page loads. `#phase-waiting-opponent` (you placed, waiting for opponent to finish placing) is kept.

When `battleStart` arrives: `window.location.replace('/battle/' + matchId + '?p=' + playerId)`.

### Battle Page

New `battle.html` + `battle.js`. Loads with "Battle starting…" spinner. WebSocket connects; server detects `session.phase === 'battle'` and sends `battleResume`:

```json
{
  "type": "battleResume",
  "myFleet": { ... },
  "myShots": ["0,1", "2,3"],
  "opponentFleet": { ... },
  "yourTurn": true,
  "spyglassCells": [{ "row": 1, "col": 2 }]
}
```

Grid renders immediately on receipt. The `done` screen lives on the battle page.

### Shared Rendering (`grid.js`)

Grid rendering functions (`renderMyFleetGrid`, `renderEnemyGrid`, `flashCell`, `fleetStatusText`, `renderFleetGrid`) are extracted to `public/grid.js`, loaded by both pages via `<script src="/grid.js">`. This avoids duplication without over-engineering.

## Data Flow

```
Player opens /game/:matchId?p=userId
  ← HTML with embedded __GAME_DATA__
  → Placement grid renders immediately
  → WS connects in background
  → place messages sent over WS
  ← placed confirmations
  ← battleStart (when both ready)
  → window.location.replace('/battle/:matchId?p=userId')

Player lands on /battle/:matchId?p=userId
  ← battle.html ("Battle starting…")
  → WS connects
  ← battleResume (full state)
  → Battle grid renders
```

## Server Changes (`gameServer.js`)

- **`/game/:matchId` route** — changed from `res.sendFile()` to a template that injects `__GAME_DATA__` JSON. Returns 404 if session not found.
- **`/battle/:matchId` route** — new. Validates session exists and `phase === 'battle'`. Serves `battle.html`. Returns 404 otherwise (prevents premature access).
- **WS connection handler** — on reconnect:
  - `phase === 'placement'` → send `welcome` with current fleet state (supports page refresh mid-placement)
  - `phase === 'battle'` → send `battleResume` with full battle state
  - `phase === 'done'` → send `cancelled` with "Game already ended" message
- **`welcome` message** — still sent for placement reconnects; `game.js` ignores it if `__GAME_DATA__` already populated.

## Client Changes

### `game.html`
- Remove `#phase-waiting` section (no longer needed — placement starts immediately)
- Add `<script>window.__GAME_DATA__ = {}</script>` before `game.js`

### `game.js`
- Boot reads from `window.__GAME_DATA__` if populated; calls `startPlacement()` immediately
- WS `welcome` handler: no-op if data already present (handles reconnect case)
- `battleStart` handler: `window.location.replace(...)` instead of `showPhase('battle')`
- Remove `phase-battle` and `phase-done` sections (moved to battle page)

### `battle.html` (new)
- Header, "Battle starting…" spinner, battle grid section, done section

### `battle.js` (new)
- Reads `matchId` + `playerId` from URL
- Connects WS, handles: `battleResume`, `shotResult`, `turnChange`, `gameOver`, `cancelled`, `opponentDisconnected`
- Imports shared functions from `grid.js`

### `grid.js` (new)
- Extracted: `renderMyFleetGrid`, `renderEnemyGrid`, `renderFleetGrid`, `flashCell`, `updateTurnBanner`, `updateFleetStatus`, `fleetStatusText`, `showSpyglassBanner`
- Constants: `GRID_SIZE`

## Edge Cases

| Scenario | Behavior |
|---|---|
| Player opens `/battle/` before battle starts | Server returns 404 |
| Player refreshes placement page mid-placement | WS reconnects, server sends `welcome` with current fleet, placement resumes |
| Player refreshes battle page | WS reconnects, server sends `battleResume`, game resumes |
| Match cancelled during placement | `cancelled` WS message → game.js shows done screen inline |
| Match cancelled during battle | `cancelled` WS message → battle.js shows done screen |
| Opponent disconnects during battle | `opponentDisconnected` shown in battle.js |

## Files Modified / Created

| File | Change |
|---|---|
| `public/game.css` | Add `[hidden] { display: none !important; }` (already done) |
| `public/game.html` | Remove waiting section, add `__GAME_DATA__` script tag |
| `public/game.js` | Boot from `__GAME_DATA__`, navigate on `battleStart`, remove battle/done phases |
| `public/grid.js` | New — shared rendering functions |
| `public/battle.html` | New — battle phase page |
| `public/battle.js` | New — battle phase logic |
| `src/server/gameServer.js` | Inject `__GAME_DATA__`, add `/battle/` route, add `battleResume` message |
