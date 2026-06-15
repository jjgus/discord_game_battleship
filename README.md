# Battleship & Fishing Discord Bot

A Discord bot for company events featuring Battleship duels, a fishing mini-game, a shared point economy, and a permanent-upgrade shop.

## Commands

| Command | Description |
|---|---|
| `/duel @user` | Challenge someone to a 1v1 Battleship match (once per day) |
| `/fish` | Cast a line for points (up to 3 times per day) |
| `/shop` | Buy permanent upgrades with your points |
| `/inventory` | View your owned upgrades |
| `/balance` | Check your point total |
| `/leaderboard` | See the server's top players |
| `/tournament register` | Sign up for the tournament |
| `/tournament begin` | Start the tournament — admin only |
| `/tournament today` | See today's assigned opponent |
| `/tournament standings` | View the win/loss table |
| `/tournament schedule` | View the full match schedule |

---

## 🎣 Fishing

### How to play

1. Type `/fish` — the bot replies **"Casting your line... 🎣"**
2. **Wait 30 seconds to 2 minutes** — the delay is random, so keep the channel open
3. When the bot says **"Fish on! Reel it in!"** a **Reel In!** button appears
4. Click the button as fast as you can — your reaction speed determines your reward
5. Repeat up to **3 times per day** (resets at midnight UTC)

### Reaction speed tiers

| Reaction time | Points earned |
|---|---|
| Under 1 second | **+30 pts** |
| Under 2 seconds | **+20 pts** |
| Under 3 seconds | **+10 pts** |
| Missed / too slow | **+0 pts** |

You have **5 seconds** from when the button appears to click it before the fish escapes.

### Big catch bonus

On any successful reel-in (10 pts or more), there is a chance to trigger a **Big Catch** for an extra **+15 pts**.

| Setup | Big catch chance |
|---|---|
| No items | **10%** |
| Better Bait only | **20%** |
| Golden Lure only | **30%** |
| Both items | **30%** (Golden Lure caps the bonus) |

### Shop upgrades for fishing

| Item | Price | Effect |
|---|---|---|
| 🪱 Better Bait | 60 pts | Big catch chance: 10% → 20% |
| 🎣 Quality Rod | 150 pts | Fast-reaction window: <1s → <1.5s |
| ✨ Golden Lure | 280 pts | Big catch chance: 10% → 30% · Guarantees minimum **+10 pts** even on a miss |

### Daily earnings estimate (fishing)

| Play style | pts/day |
|---|---|
| No items, average luck | ~45 pts (3 × ~15 avg) |
| All fishing items, average luck | ~75 pts (3 × ~25 avg) |

---

## ⚓ Battleship

### How to play

1. Type `/duel @username` to challenge someone
2. The opponent has **60 seconds** to Accept or Decline
3. If accepted, both players receive a **DM with a 5×5 grid** to place their ships
4. Tap a starting cell for each ship — ships are placed **left-to-right** from the cell you pick
5. Once both fleets are placed, the battle moves to the **server channel** so everyone can watch
6. Players alternate turns firing at each other's grid by clicking cells
7. First player to **sink all enemy ships** wins

### Fleet composition

Each player places **3 ships** on a **5×5 grid**:

| Ship | Cells |
|---|---|
| Ship 1 | 3 cells |
| Ship 2 | 2 cells |
| Ship 3 | 2 cells |

**Total: 7 ship cells** out of 25 on the grid — roughly **28% of the grid is occupied**.

### Placement tips

Ships are placed horizontally (left-to-right). Valid starting columns for each ship length:

| Ship length | Valid starting columns |
|---|---|
| 3 cells | A, B, C (columns D and E would go off the edge) |
| 2 cells | A, B, C, D |

### Turn order

- **No items:** 50/50 random — either player goes first
- **You own Lucky Compass, opponent doesn't:** **70%** chance you go first
- **Opponent owns Lucky Compass, you don't:** 70% chance they go first
- **Both own Lucky Compass:** 50/50

### Rewards

| Outcome | Points |
|---|---|
| Win | **+50 pts** |
| Lose | **+10 pts** (consolation) |

One duel per day — the slot is used **only when a match completes** (declining or letting the challenge expire doesn't count).

### Shop upgrades for Battleship

| Item | Price | Effect |
|---|---|---|
| 🧭 Lucky Compass | 60 pts | 70% chance to go first (vs opponent without one) |
| 🛡️ Reinforced Hull | 150 pts | Your first ship survives **one extra hit** before sinking |
| 🔭 Admiral's Spyglass | 280 pts | At match start, one random enemy ship cell is revealed in the channel |

### Armored ship mechanic (Reinforced Hull)

With **Reinforced Hull**, your first ship (3 cells) can absorb **4 hits** instead of 3 before sinking. After all 3 cells are hit, the ship is still alive — the opponent must fire at one of those cells again to pierce the armor and sink it.

---

## 🏆 Tournament

When a tournament is active, `/duel` is restricted to your **assigned opponent for the day**. The schedule is generated as a **round-robin** — every participant plays every other participant exactly once, one match per day.

### Running a tournament

```
1. Players run /tournament register to sign up
2. Admin runs /tournament begin [YYYY-MM-DD] to start
3. The bot posts daily matchups in the announcement channel each midnight UTC
4. Players use /duel @their-assigned-opponent to play their match
5. Results are recorded automatically when the match ends
```

### Odd number of players

If the participant count is odd, one player gets a **bye** each day (no match scheduled). Bye days are blocked — the player cannot duel anyone else that day.

---

## 💰 Point Economy

Both games feed the same point pool, which is also used by the shop.

### Full earnings potential (14-day event)

| Activity | pts/day | pts over 14 days |
|---|---|---|
| Duel win (1/day) | +50 | +700 |
| Duel loss (1/day) | +10 | +140 |
| Fishing, 3×/day (avg) | +45–75 | +630–1,050 |
| **Active player ceiling** | **~125** | **~1,750** |

### Shop pricing context

| Tier | Price | Reachable after |
|---|---|---|
| Cheap (60 pts) | 1–2 days of play |
| Mid (150 pts) | 3–4 days of play |
| Premium (280 pts) | 5–7 days of play |

---

## Setup

### Prerequisites

- [Node.js](https://nodejs.org) v18 or higher
- A [Discord application](https://discord.com/developers/applications) with a bot token
- A [JSONBin.io](https://jsonbin.io) account (free tier)

---

### Step 1: Create a Discord Bot

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications) and click **New Application**
2. Give it a name (e.g. `GameBot`) and click **Create**
3. Go to the **Bot** tab and click **Add Bot**
4. Under **Token**, click **Reset Token** and copy it — this is your `DISCORD_TOKEN`
5. Scroll down and enable **Message Content Intent** under Privileged Gateway Intents
6. Go to the **OAuth2 → URL Generator** tab:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Send Messages`, `Use Slash Commands`, `Send Messages in Threads`
7. Copy the generated URL and open it in your browser to invite the bot to your server

**Finding your IDs:**
- `DISCORD_CLIENT_ID` — found on the **General Information** tab (Application ID)
- `DISCORD_GUILD_ID` — right-click your Discord server → **Copy Server ID** (enable Developer Mode in Discord Settings → Advanced first)

---

### Step 2: Set Up JSONBin

1. Go to [jsonbin.io](https://jsonbin.io) and create a free account
2. Click **Create Bin** and paste this as the initial content:
   ```json
   { "users": {} }
   ```
3. Save the bin — copy the **Bin ID** from the URL (e.g. `6641abc123def...`) — this is your `JSONBIN_BIN_ID`
4. Go to **API Keys** in your account dashboard and create a key — this is your `JSONBIN_API_KEY`

---

### Step 3: Configure Environment Variables

```bash
cp .env.example .env
```

Fill in `.env`:

```env
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_application_id_here
DISCORD_GUILD_ID=your_server_id_here
JSONBIN_API_KEY=your_jsonbin_api_key_here
JSONBIN_BIN_ID=your_jsonbin_bin_id_here
```

---

### Step 4: Install Dependencies

```bash
npm install
```

---

### Step 5: Register Slash Commands

Run this **once** to register the bot's commands with your Discord server:

```bash
npm run deploy-commands
```

Expected output: `Registered 7 commands.`

---

### Step 6: Start the Bot

```bash
npm start
```

Expected output: `Logged in as YourBot#1234`

Type `/balance` in your server to confirm the bot is responding.

---

## Hosting (Recommended: Railway)

For a 2-week event, [Railway](https://railway.app) is the easiest free option — connect your GitHub repo and it runs 24/7 without sleeping.

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) and create a new project from your GitHub repo
3. Add your environment variables under **Variables** (same 5 keys from `.env`)
4. Railway will automatically run `npm start`

> Free tier credit easily covers a 2-week event.

---

## Running Tests

```bash
npm test
```

---

## Project Structure

```
src/
├── index.js              # Bot entry point and interaction routing
├── deployCommands.js     # Registers slash commands with Discord
├── config.js             # Environment variable validation
├── storage/
│   ├── jsonbinClient.js  # JSONBin REST API wrapper
│   └── store.js          # In-memory cache with event-driven writes
├── economy/
│   ├── points.js         # Point reward calculations
│   └── limits.js         # Daily limit and reset logic
├── games/
│   ├── battleship/       # Grid, ship placement, duel state machine
│   └── fishing/          # Fishing delay and catch mechanics
├── shop/
│   └── items.js          # Shop catalog and purchase logic
├── tournament/
│   ├── scheduler.js      # Round-robin schedule generation
│   └── standings.js      # Win/loss standings computation
└── commands/             # Slash command handlers
```
