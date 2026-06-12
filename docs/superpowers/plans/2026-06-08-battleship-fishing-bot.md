# Battleship & Fishing Discord Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Discord bot offering Battleship duels (once/day), a fishing mini-game (3x/day), a shared point economy, and a permanent-upgrade shop, backed by JSONBin.io storage.

**Architecture:** A Node.js + discord.js v14 bot with pure, unit-tested modules for economy math, daily limits, grid/ship logic, and shop purchases; an in-memory cache that writes to JSONBin only on significant game events (duel resolution, fishing attempts, shop purchases) with a 5-second timeout and graceful error handling; and thin command files that wire Discord interactions to those modules. In-progress duel state lives in memory (matches are short-lived; no need to persist mid-match state).

**Tech Stack:** Node.js (18+, for global `fetch`), discord.js v14, Jest for unit tests, JSONBin.io REST API for persistence, dotenv for local config.

---

## File Structure

```
discord_game/
├── package.json
├── .env.example
├── .gitignore
├── jest.config.js
├── src/
│   ├── index.js                        # bot bootstrap, interaction routing
│   ├── deployCommands.js               # registers slash commands with Discord
│   ├── config.js                       # env var loading/validation (pure, testable)
│   ├── storage/
│   │   ├── jsonbinClient.js            # thin JSONBin REST wrapper
│   │   └── store.js                    # in-memory cache + debounced write-through
│   ├── economy/
│   │   ├── points.js                   # duel reward + fishing reward tier math
│   │   └── limits.js                   # daily duel/fishing limit + reset logic
│   ├── games/
│   │   ├── battleship/
│   │   │   ├── grid.js                 # fleet/ship placement/firing logic
│   │   │   └── duelManager.js          # match state machine (turns, placement, win)
│   │   └── fishing/
│   │       └── fishing.js              # delay rolls + big-catch chance math
│   ├── shop/
│   │   └── items.js                    # item catalog + purchase logic
│   └── commands/
│       ├── balance.js
│       ├── leaderboard.js
│       ├── shop.js
│       ├── inventory.js
│       ├── fish.js
│       └── duel.js
└── tests/
    ├── config.test.js
    ├── storage/
    │   ├── jsonbinClient.test.js
    │   └── store.test.js
    ├── economy/
    │   ├── points.test.js
    │   └── limits.test.js
    ├── games/
    │   ├── battleship/
    │   │   ├── grid.test.js
    │   │   └── duelManager.test.js
    │   └── fishing/
    │       └── fishing.test.js
    └── shop/
        └── items.test.js
```

Pure logic (economy, limits, grid, duel state machine, shop, fishing math) gets full TDD coverage with Jest. Discord-facing command files are thin wiring around that tested logic and are verified manually in a test server, per the spec's testing approach.

---

## Task 1: Project Scaffolding & Config

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `jest.config.js`
- Create: `src/config.js`
- Test: `tests/config.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/config.test.js
const { loadConfig } = require('../src/config');

describe('loadConfig', () => {
  test('returns config object when all required env vars are present', () => {
    const env = {
      DISCORD_TOKEN: 'token123',
      DISCORD_CLIENT_ID: 'client123',
      DISCORD_GUILD_ID: 'guild123',
      JSONBIN_API_KEY: 'key123',
      JSONBIN_BIN_ID: 'bin123',
    };

    const config = loadConfig(env);

    expect(config).toEqual({
      discordToken: 'token123',
      discordClientId: 'client123',
      discordGuildId: 'guild123',
      jsonbinApiKey: 'key123',
      jsonbinBinId: 'bin123',
    });
  });

  test('throws an error listing missing variables', () => {
    const env = { DISCORD_TOKEN: 'token123' };

    expect(() => loadConfig(env)).toThrow(
      'Missing required environment variables: DISCORD_CLIENT_ID, DISCORD_GUILD_ID, JSONBIN_API_KEY, JSONBIN_BIN_ID'
    );
  });
});
```

- [ ] **Step 2: Create package.json, jest.config.js, and install dependencies**

```json
// package.json
{
  "name": "discord-battleship-fishing-bot",
  "version": "1.0.0",
  "private": true,
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "deploy-commands": "node src/deployCommands.js",
    "test": "jest"
  },
  "dependencies": {
    "discord.js": "^14.14.1",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "jest": "^29.7.0"
  }
}
```

```js
// jest.config.js
module.exports = {
  testEnvironment: 'node',
};
```

Run: `npm install`
Expected: dependencies installed, `node_modules/` and `package-lock.json` created.

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest tests/config.test.js`
Expected: FAIL with "Cannot find module '../src/config'"

- [ ] **Step 4: Write minimal implementation**

```js
// src/config.js
const REQUIRED_KEYS = [
  'DISCORD_TOKEN',
  'DISCORD_CLIENT_ID',
  'DISCORD_GUILD_ID',
  'JSONBIN_API_KEY',
  'JSONBIN_BIN_ID',
];

function loadConfig(env = process.env) {
  const missing = REQUIRED_KEYS.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    discordToken: env.DISCORD_TOKEN,
    discordClientId: env.DISCORD_CLIENT_ID,
    discordGuildId: env.DISCORD_GUILD_ID,
    jsonbinApiKey: env.JSONBIN_API_KEY,
    jsonbinBinId: env.JSONBIN_BIN_ID,
  };
}

module.exports = { loadConfig };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest tests/config.test.js`
Expected: PASS (2 tests)

- [ ] **Step 6: Create .gitignore and .env.example**

```
# .gitignore
node_modules/
.env
```

```
# .env.example
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
JSONBIN_API_KEY=
JSONBIN_BIN_ID=
```

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json jest.config.js src/config.js tests/config.test.js .gitignore .env.example
git commit -m "feat: add project scaffolding and config loader"
```

---

## Task 2: JSONBin REST Client

**Files:**
- Create: `src/storage/jsonbinClient.js`
- Test: `tests/storage/jsonbinClient.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/storage/jsonbinClient.test.js
const { fetchBin, updateBin } = require('../../src/storage/jsonbinClient');

const baseUrl = 'https://api.jsonbin.io/v3';
const binId = 'bin123';
const apiKey = 'key123';

describe('fetchBin', () => {
  test('returns the record from a successful response', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ record: { users: {} } }),
    });

    const record = await fetchBin({ baseUrl, binId, apiKey, fetchImpl });

    expect(record).toEqual({ users: {} });
    expect(fetchImpl).toHaveBeenCalledWith(
      `${baseUrl}/b/${binId}/latest`,
      expect.objectContaining({ method: 'GET' })
    );
  });

  test('throws when the response is not ok', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 404 });

    await expect(fetchBin({ baseUrl, binId, apiKey, fetchImpl })).rejects.toThrow(
      'JSONBin fetch failed with status 404'
    );
  });
});

describe('updateBin', () => {
  test('sends a PUT request with the given data', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    const data = { users: { '123': { points: 10 } } };

    await updateBin({ baseUrl, binId, apiKey, data, fetchImpl });

    expect(fetchImpl).toHaveBeenCalledWith(
      `${baseUrl}/b/${binId}`,
      expect.objectContaining({ method: 'PUT', body: JSON.stringify(data) })
    );
  });

  test('throws when the response is not ok', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 500 });

    await expect(updateBin({ baseUrl, binId, apiKey, data: {}, fetchImpl })).rejects.toThrow(
      'JSONBin update failed with status 500'
    );
  });

  test('throws when the request times out', async () => {
    const fetchImpl = jest.fn().mockImplementation((_url, { signal }) =>
      new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))
    );

    await expect(updateBin({ baseUrl, binId, apiKey, data: {}, fetchImpl, timeoutMs: 50 })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/storage/jsonbinClient.test.js`
Expected: FAIL with "Cannot find module '../../src/storage/jsonbinClient'"

- [ ] **Step 3: Write minimal implementation**

```js
// src/storage/jsonbinClient.js
async function fetchBin({ baseUrl, binId, apiKey, fetchImpl = fetch }) {
  const response = await fetchImpl(`${baseUrl}/b/${binId}/latest`, {
    method: 'GET',
    headers: { 'X-Master-Key': apiKey },
  });

  if (!response.ok) {
    throw new Error(`JSONBin fetch failed with status ${response.status}`);
  }

  const body = await response.json();
  return body.record;
}

async function updateBin({ baseUrl, binId, apiKey, data, fetchImpl = fetch, timeoutMs = 5000 }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`${baseUrl}/b/${binId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': apiKey,
      },
      body: JSON.stringify(data),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`JSONBin update failed with status ${response.status}`);
    }

    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchBin, updateBin };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/storage/jsonbinClient.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/storage/jsonbinClient.js tests/storage/jsonbinClient.test.js
git commit -m "feat: add JSONBin REST client wrapper"
```

---

## Task 3: In-Memory Store with Event-Driven Writes

**Files:**
- Create: `src/storage/store.js`
- Test: `tests/storage/store.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/storage/store.test.js
const { createStore } = require('../../src/storage/store');

function buildClient(initialRecord = { users: {} }) {
  return {
    fetchBin: jest.fn().mockResolvedValue(initialRecord),
    updateBin: jest.fn().mockResolvedValue({}),
  };
}

describe('store', () => {
  test('load fetches the bin and populates the cache', async () => {
    const client = buildClient({
      users: { '1': { points: 10, lastDuelAt: null, fishCount: 0, lastFishDate: null, ownedItems: [] } },
    });
    const store = createStore({ jsonbinClient: client, baseUrl: 'url', binId: 'bin', apiKey: 'key' });

    await store.load();

    expect(store.getUser('1').points).toBe(10);
    expect(client.fetchBin).toHaveBeenCalledTimes(1);
  });

  test('getUser creates a default record for unknown users', async () => {
    const client = buildClient();
    const store = createStore({ jsonbinClient: client, baseUrl: 'url', binId: 'bin', apiKey: 'key' });
    await store.load();

    const user = store.getUser('new-user');

    expect(user).toEqual({
      points: 0,
      lastDuelAt: null,
      fishCount: 0,
      lastFishDate: null,
      ownedItems: [],
    });
  });

  test('updateUser merges updates into the existing record', async () => {
    const client = buildClient();
    const store = createStore({ jsonbinClient: client, baseUrl: 'url', binId: 'bin', apiKey: 'key' });
    await store.load();
    store.getUser('1');

    const updated = store.updateUser('1', { points: 50 });

    expect(updated.points).toBe(50);
    expect(updated.ownedItems).toEqual([]);
  });

  test('save writes the full cache to JSONBin', async () => {
    const client = buildClient();
    const store = createStore({ jsonbinClient: client, baseUrl: 'url', binId: 'bin', apiKey: 'key' });
    await store.load();
    store.updateUser('1', { points: 50 });

    await store.save();

    expect(client.updateBin).toHaveBeenCalledTimes(1);
  });

  test('save logs and swallows errors so the caller is not interrupted', async () => {
    const client = buildClient();
    client.updateBin = jest.fn().mockRejectedValue(new Error('network error'));
    const store = createStore({ jsonbinClient: client, baseUrl: 'url', binId: 'bin', apiKey: 'key' });
    await store.load();

    await expect(store.save()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/storage/store.test.js`
Expected: FAIL with "Cannot find module '../../src/storage/store'"

- [ ] **Step 3: Write minimal implementation**

```js
// src/storage/store.js
function defaultUser() {
  return { points: 0, lastDuelAt: null, fishCount: 0, lastFishDate: null, ownedItems: [] };
}

function createStore({ jsonbinClient, baseUrl, binId, apiKey }) {
  let cache = { users: {} };

  async function load() {
    cache = await jsonbinClient.fetchBin({ baseUrl, binId, apiKey });
    if (!cache.users) {
      cache.users = {};
    }
    return cache;
  }

  function getUser(userId) {
    if (!cache.users[userId]) {
      cache.users[userId] = defaultUser();
    }
    return { ...cache.users[userId] };
  }

  function updateUser(userId, updates) {
    const user = cache.users[userId] || defaultUser();
    cache.users[userId] = { ...user, ...updates };
    return { ...cache.users[userId] };
  }

  function getAllUsers() {
    return cache.users;
  }

  async function save() {
    try {
      await jsonbinClient.updateBin({ baseUrl, binId, apiKey, data: cache });
    } catch (err) {
      console.error('JSONBin write failed:', err.message);
    }
  }

  return { load, getUser, updateUser, getAllUsers, save };
}

module.exports = { createStore };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/storage/store.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/storage/store.js tests/storage/store.test.js
git commit -m "feat: add in-memory store with event-driven JSONBin writes"
```

---

## Task 4: Economy Point Calculations

**Files:**
- Create: `src/economy/points.js`
- Test: `tests/economy/points.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/economy/points.test.js
const { duelReward, fishingReward } = require('../../src/economy/points');

describe('duelReward', () => {
  test('returns the winner reward for a win', () => {
    expect(duelReward(true)).toBe(50);
  });

  test('returns the consolation reward for a loss', () => {
    expect(duelReward(false)).toBe(10);
  });
});

describe('fishingReward', () => {
  test('returns the fast-tier reward for reactions under 1 second', () => {
    expect(fishingReward(800)).toBe(30);
  });

  test('returns the medium-tier reward for reactions under 2 seconds', () => {
    expect(fishingReward(1500)).toBe(20);
  });

  test('returns the slow-tier reward for reactions under 3 seconds', () => {
    expect(fishingReward(2800)).toBe(10);
  });

  test('returns zero when the player misses the window', () => {
    expect(fishingReward(5000)).toBe(0);
  });

  test('Golden Lure guarantees the minimum reward even on a miss', () => {
    expect(fishingReward(5000, { hasGoldenLure: true })).toBe(10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/economy/points.test.js`
Expected: FAIL with "Cannot find module '../../src/economy/points'"

- [ ] **Step 3: Write minimal implementation**

```js
// src/economy/points.js
const DUEL_WIN_POINTS = 50;
const DUEL_LOSS_POINTS = 10;

const FISH_REWARD_TIERS = [
  { maxMs: 1000, points: 30 },
  { maxMs: 2000, points: 20 },
  { maxMs: 3000, points: 10 },
];

function duelReward(isWinner) {
  return isWinner ? DUEL_WIN_POINTS : DUEL_LOSS_POINTS;
}

function fishingReward(reactionMs, { hasGoldenLure = false } = {}) {
  const tier = FISH_REWARD_TIERS.find((entry) => reactionMs <= entry.maxMs);
  if (tier) {
    return tier.points;
  }
  return hasGoldenLure ? FISH_REWARD_TIERS[FISH_REWARD_TIERS.length - 1].points : 0;
}

module.exports = { duelReward, fishingReward, DUEL_WIN_POINTS, DUEL_LOSS_POINTS, FISH_REWARD_TIERS };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/economy/points.test.js`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/economy/points.js tests/economy/points.test.js
git commit -m "feat: add duel and fishing reward calculations"
```

---

## Task 5: Daily Limit & Reset Logic

**Files:**
- Create: `src/economy/limits.js`
- Test: `tests/economy/limits.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/economy/limits.test.js
const { canDuel, fishAttemptsRemaining, recordFishAttempt } = require('../../src/economy/limits');

describe('canDuel', () => {
  test('allows a duel when the user has never dueled', () => {
    expect(canDuel({ lastDuelAt: null })).toBe(true);
  });

  test('blocks a duel within 24 hours of the last one', () => {
    const now = new Date('2026-06-08T12:00:00Z');
    expect(canDuel({ lastDuelAt: '2026-06-08T01:00:00Z' }, now)).toBe(false);
  });

  test('allows a duel 24 hours after the last one', () => {
    const now = new Date('2026-06-09T01:00:00Z');
    expect(canDuel({ lastDuelAt: '2026-06-08T01:00:00Z' }, now)).toBe(true);
  });
});

describe('fishAttemptsRemaining', () => {
  const now = new Date('2026-06-08T12:00:00Z');

  test('returns the full allotment for a user who has not fished today', () => {
    expect(fishAttemptsRemaining({ fishCount: 2, lastFishDate: '2026-06-07' }, now)).toBe(3);
  });

  test('returns the remaining attempts for a user who fished today', () => {
    expect(fishAttemptsRemaining({ fishCount: 2, lastFishDate: '2026-06-08' }, now)).toBe(1);
  });

  test('never returns a negative number', () => {
    expect(fishAttemptsRemaining({ fishCount: 5, lastFishDate: '2026-06-08' }, now)).toBe(0);
  });
});

describe('recordFishAttempt', () => {
  const now = new Date('2026-06-08T12:00:00Z');

  test('starts a fresh count when the stored date is not today', () => {
    expect(recordFishAttempt({ fishCount: 3, lastFishDate: '2026-06-07' }, now)).toEqual({
      fishCount: 1,
      lastFishDate: '2026-06-08',
    });
  });

  test('increments the count when the stored date is today', () => {
    expect(recordFishAttempt({ fishCount: 1, lastFishDate: '2026-06-08' }, now)).toEqual({
      fishCount: 2,
      lastFishDate: '2026-06-08',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/economy/limits.test.js`
Expected: FAIL with "Cannot find module '../../src/economy/limits'"

- [ ] **Step 3: Write minimal implementation**

```js
// src/economy/limits.js
const MAX_FISH_PER_DAY = 3;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function todayUtcDateString(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function canDuel(user, now = new Date()) {
  if (!user.lastDuelAt) {
    return true;
  }
  return now.getTime() - new Date(user.lastDuelAt).getTime() >= ONE_DAY_MS;
}

function fishAttemptsRemaining(user, now = new Date()) {
  if (user.lastFishDate !== todayUtcDateString(now)) {
    return MAX_FISH_PER_DAY;
  }
  return Math.max(0, MAX_FISH_PER_DAY - user.fishCount);
}

function recordFishAttempt(user, now = new Date()) {
  const today = todayUtcDateString(now);
  if (user.lastFishDate !== today) {
    return { fishCount: 1, lastFishDate: today };
  }
  return { fishCount: user.fishCount + 1, lastFishDate: today };
}

module.exports = { canDuel, fishAttemptsRemaining, recordFishAttempt, todayUtcDateString, MAX_FISH_PER_DAY };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/economy/limits.test.js`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/economy/limits.js tests/economy/limits.test.js
git commit -m "feat: add daily duel and fishing limit logic"
```

---

## Task 6: Battleship Grid & Ship Logic

**Files:**
- Create: `src/games/battleship/grid.js`
- Test: `tests/games/battleship/grid.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/games/battleship/grid.test.js
const { createFleet, addShip, fireAt, isFleetSunk } = require('../../../src/games/battleship/grid');

describe('addShip', () => {
  test('adds a horizontal ship within bounds', () => {
    const fleet = addShip(createFleet(), { startRow: 0, startCol: 0, length: 2, orientation: 'horizontal' });

    expect(fleet.ships).toHaveLength(1);
    expect(fleet.ships[0].cells).toEqual([{ row: 0, col: 0 }, { row: 0, col: 1 }]);
  });

  test('rejects a ship that would go out of bounds', () => {
    expect(() =>
      addShip(createFleet(), { startRow: 0, startCol: 4, length: 2, orientation: 'horizontal' })
    ).toThrow('Cannot place ship there');
  });

  test('rejects a ship that overlaps an existing ship', () => {
    const fleet = addShip(createFleet(), { startRow: 0, startCol: 0, length: 2, orientation: 'horizontal' });

    expect(() =>
      addShip(fleet, { startRow: 0, startCol: 1, length: 2, orientation: 'vertical' })
    ).toThrow('Cannot place ship there');
  });
});

describe('fireAt', () => {
  test('records a hit when the shot lands on a ship cell', () => {
    const fleet = addShip(createFleet(), { startRow: 0, startCol: 0, length: 2, orientation: 'horizontal' });

    const { fleet: updated, hit } = fireAt(fleet, 0, 0);

    expect(hit).toBe(true);
    expect(updated.ships[0].hits).toEqual(['0,0']);
  });

  test('reports a miss when the shot lands on an empty cell', () => {
    const fleet = addShip(createFleet(), { startRow: 0, startCol: 0, length: 2, orientation: 'horizontal' });

    expect(fireAt(fleet, 4, 4).hit).toBe(false);
  });
});

describe('isFleetSunk', () => {
  test('returns false while any ship has unhit cells', () => {
    const fleet = addShip(createFleet(), { startRow: 0, startCol: 0, length: 2, orientation: 'horizontal' });
    const { fleet: afterOneHit } = fireAt(fleet, 0, 0);

    expect(isFleetSunk(afterOneHit)).toBe(false);
  });

  test('returns true once every ship cell has been hit', () => {
    const fleet = addShip(createFleet(), { startRow: 0, startCol: 0, length: 2, orientation: 'horizontal' });
    const { fleet: afterFirst } = fireAt(fleet, 0, 0);
    const { fleet: afterSecond } = fireAt(afterFirst, 0, 1);

    expect(isFleetSunk(afterSecond)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/games/battleship/grid.test.js`
Expected: FAIL with "Cannot find module '../../../src/games/battleship/grid'"

- [ ] **Step 3: Write minimal implementation**

```js
// src/games/battleship/grid.js
const GRID_SIZE = 5;

function cellKey(row, col) {
  return `${row},${col}`;
}

function isInBounds(row, col) {
  return row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE;
}

function buildShipCells(startRow, startCol, length, orientation) {
  const cells = [];
  for (let i = 0; i < length; i += 1) {
    const row = orientation === 'vertical' ? startRow + i : startRow;
    const col = orientation === 'horizontal' ? startCol + i : startCol;
    cells.push({ row, col });
  }
  return cells;
}

function canPlaceShip(existingShips, cells) {
  if (!cells.every(({ row, col }) => isInBounds(row, col))) {
    return false;
  }
  const occupied = new Set();
  existingShips.forEach((ship) => {
    ship.cells.forEach(({ row, col }) => occupied.add(cellKey(row, col)));
  });
  return cells.every(({ row, col }) => !occupied.has(cellKey(row, col)));
}

function createFleet() {
  return { ships: [] };
}

function addShip(fleet, { startRow, startCol, length, orientation }) {
  const cells = buildShipCells(startRow, startCol, length, orientation);
  if (!canPlaceShip(fleet.ships, cells)) {
    throw new Error('Cannot place ship there');
  }
  return { ships: [...fleet.ships, { cells, hits: [] }] };
}

function fireAt(fleet, row, col) {
  let hit = false;
  const ships = fleet.ships.map((ship) => {
    const matchesTarget = ship.cells.some((cell) => cell.row === row && cell.col === col);
    if (!matchesTarget || ship.hits.includes(cellKey(row, col))) {
      return ship;
    }
    hit = true;
    return { ...ship, hits: [...ship.hits, cellKey(row, col)] };
  });
  return { fleet: { ships }, hit };
}

function isFleetSunk(fleet) {
  return fleet.ships.every((ship) => ship.cells.length === ship.hits.length);
}

module.exports = { GRID_SIZE, createFleet, addShip, fireAt, isFleetSunk, buildShipCells, canPlaceShip, cellKey };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/games/battleship/grid.test.js`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/games/battleship/grid.js tests/games/battleship/grid.test.js
git commit -m "feat: add Battleship fleet, placement, and firing logic"
```

---

## Task 7: Shop Item Catalog & Purchase Logic

**Files:**
- Create: `src/shop/items.js`
- Test: `tests/shop/items.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/shop/items.test.js
const { SHOP_ITEMS, findItem, purchaseItem } = require('../../src/shop/items');

describe('findItem', () => {
  test('returns the item matching the given id', () => {
    expect(findItem('better_bait')).toMatchObject({ id: 'better_bait', price: 60 });
  });

  test('returns undefined for an unknown id', () => {
    expect(findItem('does_not_exist')).toBeUndefined();
  });
});

describe('purchaseItem', () => {
  test('succeeds and deducts points when the user can afford the item', () => {
    const user = { points: 100, ownedItems: [] };

    expect(purchaseItem(user, 'better_bait')).toEqual({
      ok: true,
      updates: { points: 40, ownedItems: ['better_bait'] },
    });
  });

  test('fails when the user already owns the item', () => {
    const user = { points: 100, ownedItems: ['better_bait'] };

    expect(purchaseItem(user, 'better_bait')).toEqual({ ok: false, reason: 'already_owned' });
  });

  test('fails when the user cannot afford the item', () => {
    const user = { points: 10, ownedItems: [] };

    expect(purchaseItem(user, 'better_bait')).toEqual({ ok: false, reason: 'insufficient_points' });
  });

  test('fails for an unknown item id', () => {
    const user = { points: 1000, ownedItems: [] };

    expect(purchaseItem(user, 'does_not_exist')).toEqual({ ok: false, reason: 'unknown_item' });
  });
});

describe('SHOP_ITEMS', () => {
  test('contains exactly three items per game', () => {
    expect(SHOP_ITEMS.filter((item) => item.game === 'battleship')).toHaveLength(3);
    expect(SHOP_ITEMS.filter((item) => item.game === 'fishing')).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/shop/items.test.js`
Expected: FAIL with "Cannot find module '../../src/shop/items'"

- [ ] **Step 3: Write minimal implementation**

```js
// src/shop/items.js
const SHOP_ITEMS = [
  {
    id: 'lucky_compass',
    game: 'battleship',
    name: 'Lucky Compass',
    emoji: '🧭',
    price: 60,
    description: 'Slightly better odds of going first in a duel',
  },
  {
    id: 'reinforced_hull',
    game: 'battleship',
    name: 'Reinforced Hull',
    emoji: '🛡️',
    price: 150,
    description: 'One ship gains +1 cell of armor before it sinks',
  },
  {
    id: 'admirals_spyglass',
    game: 'battleship',
    name: "Admiral's Spyglass",
    emoji: '🔭',
    price: 280,
    description: 'Reveals one random enemy ship cell at the start of each duel',
  },
  {
    id: 'better_bait',
    game: 'fishing',
    name: 'Better Bait',
    emoji: '🪱',
    price: 60,
    description: 'Slightly increases the big-catch bonus chance',
  },
  {
    id: 'quality_rod',
    game: 'fishing',
    name: 'Quality Rod',
    emoji: '🎣',
    price: 150,
    description: 'Widens the fast-reaction window for top-tier rewards',
  },
  {
    id: 'golden_lure',
    game: 'fishing',
    name: 'Golden Lure',
    emoji: '✨',
    price: 280,
    description: 'Notably increases big-catch chance and guarantees a minimum reward',
  },
];

function findItem(itemId) {
  return SHOP_ITEMS.find((item) => item.id === itemId);
}

function purchaseItem(user, itemId) {
  const item = findItem(itemId);
  if (!item) {
    return { ok: false, reason: 'unknown_item' };
  }
  if (user.ownedItems.includes(itemId)) {
    return { ok: false, reason: 'already_owned' };
  }
  if (user.points < item.price) {
    return { ok: false, reason: 'insufficient_points' };
  }
  return {
    ok: true,
    updates: { points: user.points - item.price, ownedItems: [...user.ownedItems, itemId] },
  };
}

module.exports = { SHOP_ITEMS, findItem, purchaseItem };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/shop/items.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/shop/items.js tests/shop/items.test.js
git commit -m "feat: add shop item catalog and purchase logic"
```

---

## Task 8: Fishing Mechanics Module

**Files:**
- Create: `src/games/fishing/fishing.js`
- Test: `tests/games/fishing/fishing.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/games/fishing/fishing.test.js
const { randomDelayMs, bigCatchChance, rollBigCatch, MIN_DELAY_MS, MAX_DELAY_MS } = require('../../../src/games/fishing/fishing');

describe('randomDelayMs', () => {
  test('returns the minimum delay when random returns 0', () => {
    expect(randomDelayMs(() => 0)).toBe(MIN_DELAY_MS);
  });

  test('returns a value within the configured range when random returns just under 1', () => {
    const delay = randomDelayMs(() => 0.9999);
    expect(delay).toBeGreaterThanOrEqual(MIN_DELAY_MS);
    expect(delay).toBeLessThan(MAX_DELAY_MS);
  });
});

describe('bigCatchChance', () => {
  test('returns the base chance with no items', () => {
    expect(bigCatchChance({})).toBeCloseTo(0.1);
  });

  test('increases with Better Bait', () => {
    expect(bigCatchChance({ hasBetterBait: true })).toBeCloseTo(0.2);
  });

  test('increases more with Golden Lure', () => {
    expect(bigCatchChance({ hasGoldenLure: true })).toBeCloseTo(0.3);
  });
});

describe('rollBigCatch', () => {
  test('returns true when the random roll is below the chance', () => {
    expect(rollBigCatch({}, () => 0.05)).toBe(true);
  });

  test('returns false when the random roll is at or above the chance', () => {
    expect(rollBigCatch({}, () => 0.5)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/games/fishing/fishing.test.js`
Expected: FAIL with "Cannot find module '../../../src/games/fishing/fishing'"

- [ ] **Step 3: Write minimal implementation**

```js
// src/games/fishing/fishing.js
const MIN_DELAY_MS = 30 * 1000;
const MAX_DELAY_MS = 2 * 60 * 1000;
const REEL_WINDOW_MS = 5000;
const BIG_CATCH_BONUS = 15;
const BASE_BIG_CATCH_CHANCE = 0.1;
const ITEM_BONUS_CHANCE = 0.1;

function randomDelayMs(randomImpl = Math.random) {
  return MIN_DELAY_MS + Math.floor(randomImpl() * (MAX_DELAY_MS - MIN_DELAY_MS));
}

function bigCatchChance({ hasBetterBait = false, hasGoldenLure = false } = {}) {
  let chance = BASE_BIG_CATCH_CHANCE;
  if (hasBetterBait) {
    chance += ITEM_BONUS_CHANCE;
  }
  if (hasGoldenLure) {
    chance += ITEM_BONUS_CHANCE * 2;
  }
  return chance;
}

function rollBigCatch(options, randomImpl = Math.random) {
  return randomImpl() < bigCatchChance(options);
}

module.exports = {
  MIN_DELAY_MS,
  MAX_DELAY_MS,
  REEL_WINDOW_MS,
  BIG_CATCH_BONUS,
  randomDelayMs,
  bigCatchChance,
  rollBigCatch,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/games/fishing/fishing.test.js`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/games/fishing/fishing.js tests/games/fishing/fishing.test.js
git commit -m "feat: add fishing delay and big-catch chance math"
```

---

## Task 9: Battleship Duel Manager (Match State Machine)

**Files:**
- Create: `src/games/battleship/duelManager.js`
- Test: `tests/games/battleship/duelManager.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/games/battleship/duelManager.test.js
const {
  createMatch,
  placeNextShip,
  bothPlayersReady,
  takeShot,
} = require('../../../src/games/battleship/duelManager');

describe('placeNextShip', () => {
  test('places ships in order using the predefined lengths', () => {
    let match = createMatch('alice', 'bob');

    match = placeNextShip(match, 'alice', { startRow: 0, startCol: 0, orientation: 'horizontal' });

    expect(match.fleets.alice.ships[0].cells).toHaveLength(3);
    expect(match.placementsComplete.alice).toBe(false);
  });

  test('marks a player ready once all ships are placed', () => {
    let match = createMatch('alice', 'bob');
    match = placeNextShip(match, 'alice', { startRow: 0, startCol: 0, orientation: 'horizontal' });
    match = placeNextShip(match, 'alice', { startRow: 1, startCol: 0, orientation: 'horizontal' });
    match = placeNextShip(match, 'alice', { startRow: 2, startCol: 0, orientation: 'horizontal' });

    expect(match.placementsComplete.alice).toBe(true);
  });
});

describe('bothPlayersReady', () => {
  test('returns false until both players finish placement', () => {
    const match = { ...createMatch('alice', 'bob'), placementsComplete: { alice: true, bob: false } };
    expect(bothPlayersReady(match)).toBe(false);
  });

  test('returns true once both players finish placement', () => {
    const match = { ...createMatch('alice', 'bob'), placementsComplete: { alice: true, bob: true } };
    expect(bothPlayersReady(match)).toBe(true);
  });
});

describe('takeShot', () => {
  function readyMatch() {
    let match = createMatch('alice', 'bob');
    match = placeNextShip(match, 'alice', { startRow: 4, startCol: 0, orientation: 'horizontal' });
    match = placeNextShip(match, 'bob', { startRow: 0, startCol: 0, orientation: 'horizontal' });
    return match;
  }

  test('passes the turn to the target after a miss', () => {
    const { match, hit, sunk } = takeShot(readyMatch(), 'alice', 4, 4);

    expect(hit).toBe(false);
    expect(sunk).toBe(false);
    expect(match.turn).toBe('bob');
  });

  test('reports a hit and keeps the fleet alive when not all cells are hit', () => {
    const { hit, sunk } = takeShot(readyMatch(), 'alice', 0, 0);

    expect(hit).toBe(true);
    expect(sunk).toBe(false);
  });

  test('reports the fleet sunk and clears the turn once the final cell is hit', () => {
    let match = readyMatch();
    ({ match } = takeShot(match, 'alice', 0, 0));
    ({ match } = takeShot(match, 'bob', 4, 3));
    ({ match } = takeShot(match, 'alice', 0, 1));
    ({ match } = takeShot(match, 'bob', 4, 3));

    const { match: final, sunk } = takeShot(match, 'alice', 0, 2);

    expect(sunk).toBe(true);
    expect(final.turn).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/games/battleship/duelManager.test.js`
Expected: FAIL with "Cannot find module '../../../src/games/battleship/duelManager'"

- [ ] **Step 3: Write minimal implementation**

```js
// src/games/battleship/duelManager.js
const { createFleet, addShip, fireAt, isFleetSunk } = require('./grid');

const SHIP_LENGTHS = [3, 2, 2];

function createMatch(challengerId, opponentId) {
  return {
    players: [challengerId, opponentId],
    fleets: { [challengerId]: createFleet(), [opponentId]: createFleet() },
    placementsComplete: { [challengerId]: false, [opponentId]: false },
    turn: challengerId,
  };
}

function placeNextShip(match, userId, placement) {
  const fleet = match.fleets[userId];
  const shipIndex = fleet.ships.length;
  if (shipIndex >= SHIP_LENGTHS.length) {
    throw new Error('All ships already placed');
  }

  const updatedFleet = addShip(fleet, { ...placement, length: SHIP_LENGTHS[shipIndex] });
  return {
    ...match,
    fleets: { ...match.fleets, [userId]: updatedFleet },
    placementsComplete: {
      ...match.placementsComplete,
      [userId]: updatedFleet.ships.length === SHIP_LENGTHS.length,
    },
  };
}

function bothPlayersReady(match) {
  return match.players.every((id) => match.placementsComplete[id]);
}

function opponentOf(match, userId) {
  return match.players.find((id) => id !== userId);
}

function takeShot(match, shooterId, row, col) {
  const targetId = opponentOf(match, shooterId);
  const { fleet, hit } = fireAt(match.fleets[targetId], row, col);
  const sunk = isFleetSunk(fleet);

  return {
    match: {
      ...match,
      fleets: { ...match.fleets, [targetId]: fleet },
      turn: sunk ? null : targetId,
    },
    hit,
    sunk,
    targetId,
  };
}

module.exports = { createMatch, placeNextShip, bothPlayersReady, opponentOf, takeShot, SHIP_LENGTHS };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/games/battleship/duelManager.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/games/battleship/duelManager.js tests/games/battleship/duelManager.test.js
git commit -m "feat: add Battleship duel match state machine"
```

---

## Task 10: Balance & Leaderboard Commands

**Files:**
- Create: `src/commands/balance.js`
- Create: `src/commands/leaderboard.js`

These wrap the already-tested `store` module and are verified manually (Task 15) since they're thin Discord wiring.

- [ ] **Step 1: Create the balance command**

```js
// src/commands/balance.js
const { SlashCommandBuilder } = require('discord.js');

const data = new SlashCommandBuilder().setName('balance').setDescription('Check your point balance');

async function execute(interaction, { store }) {
  const user = store.getUser(interaction.user.id);
  await interaction.reply({ content: `You have **${user.points}** points.`, ephemeral: true });
}

module.exports = { data, execute };
```

- [ ] **Step 2: Create the leaderboard command**

```js
// src/commands/leaderboard.js
const { SlashCommandBuilder } = require('discord.js');

const data = new SlashCommandBuilder().setName('leaderboard').setDescription("Show the server's top point-holders");

const TOP_COUNT = 10;

async function execute(interaction, { store }) {
  const ranked = Object.entries(store.getAllUsers())
    .sort((a, b) => b[1].points - a[1].points)
    .slice(0, TOP_COUNT);

  if (ranked.length === 0) {
    await interaction.reply('No one has earned any points yet!');
    return;
  }

  const lines = ranked.map(([userId, userData], index) => `${index + 1}. <@${userId}> — ${userData.points} points`);
  await interaction.reply(`**Leaderboard**\n${lines.join('\n')}`);
}

module.exports = { data, execute };
```

- [ ] **Step 3: Commit**

```bash
git add src/commands/balance.js src/commands/leaderboard.js
git commit -m "feat: add balance and leaderboard commands"
```

---

## Task 11: Shop & Inventory Commands

**Files:**
- Create: `src/commands/shop.js`
- Create: `src/commands/inventory.js`

- [ ] **Step 1: Create the shop command**

```js
// src/commands/shop.js
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { SHOP_ITEMS, purchaseItem } = require('../shop/items');

const data = new SlashCommandBuilder().setName('shop').setDescription('Browse and buy permanent upgrades');

const ITEMS_PER_ROW = 3;

const PURCHASE_FAILURE_MESSAGES = {
  unknown_item: "That item doesn't exist.",
  already_owned: 'You already own that item.',
  insufficient_points: "You don't have enough points for that.",
};

function buildShopRows(user) {
  const rows = [];
  SHOP_ITEMS.forEach((item, index) => {
    const rowIndex = Math.floor(index / ITEMS_PER_ROW);
    if (!rows[rowIndex]) {
      rows[rowIndex] = new ActionRowBuilder();
    }
    rows[rowIndex].addComponents(
      new ButtonBuilder()
        .setCustomId(`shop_buy_${item.id}`)
        .setLabel(`${item.emoji} ${item.name} (${item.price})`)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(user.ownedItems.includes(item.id) || user.points < item.price)
    );
  });
  return rows;
}

function describeItems() {
  return SHOP_ITEMS.map(
    (item) => `${item.emoji} **${item.name}** (${item.game}, ${item.price} pts)\n${item.description}`
  ).join('\n\n');
}

async function execute(interaction, { store }) {
  const user = store.getUser(interaction.user.id);
  await interaction.reply({
    content: `**Shop** — you have ${user.points} points\n\n${describeItems()}`,
    components: buildShopRows(user),
    ephemeral: true,
  });
}

async function handleButton(interaction, { store }) {
  const itemId = interaction.customId.replace('shop_buy_', '');
  const user = store.getUser(interaction.user.id);
  const result = purchaseItem(user, itemId);

  if (!result.ok) {
    await interaction.reply({ content: PURCHASE_FAILURE_MESSAGES[result.reason], ephemeral: true });
    return;
  }

  store.updateUser(interaction.user.id, result.updates);
  await interaction.reply({
    content: `Purchased! You now have ${result.updates.points} points.`,
    ephemeral: true,
  });
}

module.exports = { data, execute, handleButton };
```

- [ ] **Step 2: Create the inventory command**

```js
// src/commands/inventory.js
const { SlashCommandBuilder } = require('discord.js');
const { findItem } = require('../shop/items');

const data = new SlashCommandBuilder().setName('inventory').setDescription('View your owned upgrades');

async function execute(interaction, { store }) {
  const user = store.getUser(interaction.user.id);

  if (user.ownedItems.length === 0) {
    await interaction.reply({
      content: "You don't own any upgrades yet. Check `/shop` to buy some!",
      ephemeral: true,
    });
    return;
  }

  const lines = user.ownedItems.map((itemId) => {
    const item = findItem(itemId);
    return `${item.emoji} **${item.name}** — ${item.description}`;
  });

  await interaction.reply({ content: `**Your upgrades**\n${lines.join('\n')}`, ephemeral: true });
}

module.exports = { data, execute };
```

- [ ] **Step 3: Commit**

```bash
git add src/commands/shop.js src/commands/inventory.js
git commit -m "feat: add shop and inventory commands"
```

---

## Task 12: Fishing Command

**Files:**
- Create: `src/commands/fish.js`

This command is mostly Discord interaction wiring around the already-tested `economy/limits`, `economy/points`, and `games/fishing/fishing` modules — verified manually in Task 15.

- [ ] **Step 1: Create the fish command**

```js
// src/commands/fish.js
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { fishAttemptsRemaining, recordFishAttempt, MAX_FISH_PER_DAY } = require('../economy/limits');
const { fishingReward } = require('../economy/points');
const { randomDelayMs, REEL_WINDOW_MS, BIG_CATCH_BONUS, rollBigCatch } = require('../games/fishing/fishing');

const data = new SlashCommandBuilder().setName('fish').setDescription('Cast a line and try to catch a fish');

function reelButtonRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('fish_reel_in').setLabel('Reel In!').setStyle(ButtonStyle.Success)
  );
}

async function execute(interaction, { store }) {
  const user = store.getUser(interaction.user.id);

  if (fishAttemptsRemaining(user) <= 0) {
    await interaction.reply({
      content: `You've used all ${MAX_FISH_PER_DAY} of your fishing attempts for today. Come back after midnight UTC!`,
      ephemeral: true,
    });
    return;
  }

  const message = await interaction.reply({ content: 'Casting your line... 🎣', fetchReply: true });

  setTimeout(() => startBite(message, interaction.user.id, store), randomDelayMs());
}

async function startBite(message, userId, store) {
  const bitMessage = await message.edit({ content: 'Fish on! Reel it in!', components: [reelButtonRow()] });
  const castAt = Date.now();
  let collected = false;

  const collector = bitMessage.createMessageComponentCollector({
    filter: (buttonInteraction) => buttonInteraction.user.id === userId,
    time: REEL_WINDOW_MS,
    max: 1,
  });

  collector.on('collect', async (buttonInteraction) => {
    collected = true;
    await resolveCatch({ buttonInteraction, message: bitMessage, store, userId, reactionMs: Date.now() - castAt });
  });

  collector.on('end', async () => {
    if (!collected) {
      await resolveCatch({ buttonInteraction: null, message: bitMessage, store, userId, reactionMs: REEL_WINDOW_MS + 1 });
    }
  });
}

async function resolveCatch({ buttonInteraction, message, store, userId, reactionMs }) {
  const user = store.getUser(userId);
  const hasGoldenLure = user.ownedItems.includes('golden_lure');
  const hasBetterBait = user.ownedItems.includes('better_bait');

  let points = fishingReward(reactionMs, { hasGoldenLure });
  let bigCatch = false;
  if (points > 0 && rollBigCatch({ hasBetterBait, hasGoldenLure })) {
    points += BIG_CATCH_BONUS;
    bigCatch = true;
  }

  store.updateUser(userId, { ...recordFishAttempt(user), points: user.points + points });

  const summary =
    points > 0
      ? `You reeled it in${bigCatch ? ' — **a big catch!**' : ''} and earned **${points}** points!`
      : 'The fish got away this time!';

  if (buttonInteraction) {
    await buttonInteraction.update({ content: summary, components: [] });
  } else {
    await message.edit({ content: summary, components: [] });
  }
}

module.exports = { data, execute, resolveCatch };
```

- [ ] **Step 2: Commit**

```bash
git add src/commands/fish.js
git commit -m "feat: add fishing command and catch resolution flow"
```

---

## Task 13: Duel Command — Challenge & Ship Placement

**Files:**
- Create: `src/commands/duel.js`

Battleship match state lives in an in-memory `Map` (keyed by channel ID) passed in via context — matches are short-lived, so no persistence is needed. This task covers the challenge/accept/decline flow and the DM-based ship placement; Task 14 adds the battle and resolution.

- [ ] **Step 1: Create the duel command with challenge and placement handling**

```js
// src/commands/duel.js
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { canDuel } = require('../economy/limits');
const { duelReward } = require('../economy/points');
const {
  createMatch,
  placeNextShip,
  bothPlayersReady,
  takeShot,
  SHIP_LENGTHS,
} = require('../games/battleship/duelManager');
const { GRID_SIZE } = require('../games/battleship/grid');

const CHALLENGE_TIMEOUT_MS = 60 * 1000;
const COLUMN_LETTERS = ['A', 'B', 'C', 'D', 'E'];

const data = new SlashCommandBuilder()
  .setName('duel')
  .setDescription('Challenge another user to a Battleship match')
  .addUserOption((option) => option.setName('opponent').setDescription('Who to challenge').setRequired(true));

function gridButtons(customIdPrefix) {
  const rows = [];
  for (let row = 0; row < GRID_SIZE; row += 1) {
    const actionRow = new ActionRowBuilder();
    for (let col = 0; col < GRID_SIZE; col += 1) {
      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`${customIdPrefix}_${row}_${col}`)
          .setLabel(`${COLUMN_LETTERS[col]}${row + 1}`)
          .setStyle(ButtonStyle.Secondary)
      );
    }
    rows.push(actionRow);
  }
  return rows;
}

async function execute(interaction, context) {
  const challenger = interaction.user;
  const opponent = interaction.options.getUser('opponent');

  if (opponent.id === challenger.id || opponent.bot) {
    await interaction.reply({ content: "You can't duel yourself or a bot.", ephemeral: true });
    return;
  }

  if (!canDuel(context.store.getUser(challenger.id))) {
    await interaction.reply({ content: "You've already dueled today. Try again tomorrow!", ephemeral: true });
    return;
  }

  const acceptRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`duel_accept_${challenger.id}_${opponent.id}`).setLabel('Accept').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`duel_decline_${challenger.id}_${opponent.id}`).setLabel('Decline').setStyle(ButtonStyle.Danger)
  );

  const message = await interaction.reply({
    content: `${opponent}, ${challenger} has challenged you to a Battleship duel! Do you accept?`,
    components: [acceptRow],
    fetchReply: true,
  });

  const collector = message.createMessageComponentCollector({
    filter: (buttonInteraction) => buttonInteraction.user.id === opponent.id,
    time: CHALLENGE_TIMEOUT_MS,
    max: 1,
  });

  collector.on('collect', async (buttonInteraction) => {
    if (buttonInteraction.customId.startsWith('duel_decline')) {
      await buttonInteraction.update({ content: `${opponent} declined the challenge.`, components: [] });
      return;
    }
    await buttonInteraction.update({ content: `${opponent} accepted! Check your DMs to place your ships.`, components: [] });
    await startMatch({ channelId: interaction.channelId, challenger, opponent, context });
  });

  collector.on('end', async (collected) => {
    if (collected.size === 0) {
      await message.edit({ content: `${opponent} didn't respond in time. Challenge expired.`, components: [] });
    }
  });
}

async function startMatch({ channelId, challenger, opponent, context }) {
  context.matches.set(channelId, createMatch(challenger.id, opponent.id));

  await Promise.all(
    [challenger, opponent].map((player) =>
      player.send({
        content:
          `Place your fleet (${SHIP_LENGTHS.join(', ')}-cell ships)! ` +
          `Tap a starting cell for ship #1 (${SHIP_LENGTHS[0]} cells, placed left-to-right).`,
        components: gridButtons(`place_${channelId}_${player.id}`),
      })
    )
  );
}

async function handlePlacement(buttonInteraction, context) {
  const [, channelId, userId, rowStr, colStr] = buttonInteraction.customId.split('_');
  const match = context.matches.get(channelId);
  if (!match) {
    await buttonInteraction.reply({ content: 'This match is no longer active.', ephemeral: true });
    return;
  }

  let updated;
  try {
    updated = placeNextShip(match, userId, {
      startRow: Number(rowStr),
      startCol: Number(colStr),
      orientation: 'horizontal',
    });
  } catch (error) {
    await buttonInteraction.reply({ content: "That ship won't fit there — try a different cell.", ephemeral: true });
    return;
  }
  context.matches.set(channelId, updated);

  const nextShipIndex = updated.fleets[userId].ships.length;
  if (nextShipIndex >= SHIP_LENGTHS.length) {
    await buttonInteraction.update({ content: 'Fleet placed! Waiting for your opponent...', components: [] });
  } else {
    await buttonInteraction.update({
      content: `Ship placed! Now place ship #${nextShipIndex + 1} (${SHIP_LENGTHS[nextShipIndex]} cells).`,
      components: gridButtons(`place_${channelId}_${userId}`),
    });
  }

  if (bothPlayersReady(updated)) {
    const channel = await buttonInteraction.client.channels.fetch(channelId);
    await announceTurn(channel, channelId, updated);
  }
}

async function announceTurn(channel, channelId, match) {
  await channel.send({
    content: `<@${match.turn}>, it's your turn! Pick a cell to fire at.`,
    components: gridButtons(`shoot_${channelId}_${match.turn}`),
  });
}

module.exports = { data, execute, handlePlacement, announceTurn };
```

- [ ] **Step 2: Commit**

```bash
git add src/commands/duel.js
git commit -m "feat: add duel command with challenge and ship placement flow"
```

---

## Task 14: Duel Command — Battle & Resolution

**Files:**
- Modify: `src/commands/duel.js`

Adds shot handling and match resolution on top of Task 13's challenge/placement flow.

- [ ] **Step 1: Add shot handling and match resolution**

Add these functions to `src/commands/duel.js` (they use `takeShot`, `duelReward`, `COLUMN_LETTERS`, and `announceTurn`, all already in scope from Task 13's imports/definitions), and update the final `module.exports` to also include `handleShot`:

```js
async function handleShot(buttonInteraction, context) {
  const [, channelId, shooterId, rowStr, colStr] = buttonInteraction.customId.split('_');

  if (buttonInteraction.user.id !== shooterId) {
    await buttonInteraction.reply({ content: "It's not your turn.", ephemeral: true });
    return;
  }

  const match = context.matches.get(channelId);
  const { match: updated, hit, sunk, targetId } = takeShot(match, shooterId, Number(rowStr), Number(colStr));
  context.matches.set(channelId, updated);

  await buttonInteraction.update({
    content: `<@${shooterId}> fired at ${COLUMN_LETTERS[Number(colStr)]}${Number(rowStr) + 1} — it was a **${hit ? 'HIT' : 'miss'}**!`,
    components: [],
  });

  if (sunk) {
    await finishMatch(buttonInteraction.channel, channelId, shooterId, targetId, context);
    return;
  }

  await announceTurn(buttonInteraction.channel, channelId, updated);
}

async function finishMatch(channel, channelId, winnerId, loserId, context) {
  context.matches.delete(channelId);

  const winnerPoints = duelReward(true);
  const loserPoints = duelReward(false);
  const now = new Date().toISOString();
  const winner = context.store.getUser(winnerId);
  const loser = context.store.getUser(loserId);

  context.store.updateUser(winnerId, { points: winner.points + winnerPoints, lastDuelAt: now });
  context.store.updateUser(loserId, { points: loser.points + loserPoints, lastDuelAt: now });

  await channel.send(
    `🎉 <@${winnerId}> sank <@${loserId}>'s fleet and wins **+${winnerPoints} points**! ` +
      `<@${loserId}> earns **+${loserPoints} points** for a good fight.`
  );
}

module.exports = { data, execute, handlePlacement, handleShot };
```

- [ ] **Step 2: Commit**

```bash
git add src/commands/duel.js
git commit -m "feat: add Battleship battle flow and match resolution"
```

---

## Task 15: Bot Bootstrap & Command Deployment

**Files:**
- Create: `src/index.js`
- Create: `src/deployCommands.js`

- [ ] **Step 1: Create the command deployment script**

```js
// src/deployCommands.js
require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { loadConfig } = require('./config');
const balance = require('./commands/balance');
const leaderboard = require('./commands/leaderboard');
const shop = require('./commands/shop');
const inventory = require('./commands/inventory');
const fish = require('./commands/fish');
const duel = require('./commands/duel');

async function main() {
  const config = loadConfig();
  const commands = [balance, leaderboard, shop, inventory, fish, duel].map((command) => command.data.toJSON());

  const rest = new REST().setToken(config.discordToken);
  await rest.put(Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId), { body: commands });
  console.log(`Registered ${commands.length} commands.`);
}

main().catch((error) => {
  console.error('Failed to register commands:', error);
  process.exit(1);
});
```

- [ ] **Step 2: Create the bot entry point**

```js
// src/index.js
require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { loadConfig } = require('./config');
const { createStore } = require('./storage/store');
const jsonbinClient = require('./storage/jsonbinClient');
const balance = require('./commands/balance');
const leaderboard = require('./commands/leaderboard');
const shop = require('./commands/shop');
const inventory = require('./commands/inventory');
const fish = require('./commands/fish');
const duel = require('./commands/duel');

const JSONBIN_BASE_URL = 'https://api.jsonbin.io/v3';

async function main() {
  const config = loadConfig();
  const store = createStore({
    jsonbinClient,
    baseUrl: JSONBIN_BASE_URL,
    binId: config.jsonbinBinId,
    apiKey: config.jsonbinApiKey,
  });
  await store.load();

  const context = { store, matches: new Map() };

  const commands = new Collection();
  [balance, leaderboard, shop, inventory, fish, duel].forEach((command) => commands.set(command.data.name, command));

  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages] });

  client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (command) {
        await command.execute(interaction, context);
      }
      return;
    }

    if (interaction.isButton()) {
      if (interaction.customId.startsWith('shop_buy_')) {
        await shop.handleButton(interaction, context);
      } else if (interaction.customId.startsWith('place_')) {
        await duel.handlePlacement(interaction, context);
      } else if (interaction.customId.startsWith('shoot_')) {
        await duel.handleShot(interaction, context);
      }
    }
  });

  client.once('clientReady', () => {
    console.log(`Logged in as ${client.user.tag}`);
  });

  await client.login(config.discordToken);
}

main().catch((error) => {
  console.error('Failed to start bot:', error);
  process.exit(1);
});
```

- [ ] **Step 3: Commit**

```bash
git add src/index.js src/deployCommands.js
git commit -m "feat: add bot bootstrap and slash command deployment"
```

---

## Task 16: Manual End-to-End Verification

**Prerequisites:** A test Discord server, a bot application with a token, and a JSONBin bin pre-seeded with `{"users": {}}`. Populate `.env` from `.env.example` with real values.

- [x] **Step 1: Register commands and start the bot**

Run: `npm run deploy-commands`
Expected: console logs `Registered 6 commands.`

Run: `npm start`
Expected: console logs `Logged in as <BotName>#1234`

- [x] **Step 2: Verify the economy commands**

In the test server: run `/balance` (expect 0 points for a new user), then `/leaderboard` (expect either "No one has earned any points yet!" or a ranked list).

- [x] **Step 3: Verify fishing end-to-end**

Run `/fish`, wait for "Fish on! Reel it in!", click **Reel In!** quickly and verify a points message appears and `/balance` reflects the new total. Run it 3 times and verify the 4th attempt is rejected with the daily-limit message.

- [x] **Step 4: Verify the shop and inventory**

Run `/shop`, confirm all 6 items display with correct prices and that affordability/ownership disables buttons appropriately. Buy an affordable item, verify points are deducted and `/inventory` shows it. Attempt to buy it again and confirm the "already own" message appears.

- [x] **Step 5: Verify the duel flow with two accounts**

From a second test account, accept a `/duel` challenge, place fleets via DM, and play through a full match in the channel — confirming turn order, hit/miss feedback, win/loss point awards, and that both accounts are blocked from dueling again until the next UTC day.

- [x] **Step 6: Verify persistence survives a restart**

Stop the bot (`Ctrl+C`), confirm the JSONBin bin now contains the updated user records (via the JSONBin dashboard or API), restart the bot, and confirm `/balance` still reflects the prior totals.
