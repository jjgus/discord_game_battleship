# Battleship & Fishing Discord Bot

A Discord bot for company events featuring Battleship duels, a fishing mini-game, a shared point economy, and a permanent-upgrade shop.

## Commands

| Command | Description |
|---|---|
| `/duel challenge @user` | Challenge someone to a 1v1 Battleship match (once per day) |
| `/duel cancel` | Cancel the ongoing duel in this channel (players or admin) |
| `/fish` | Cast a line for points (up to 3 times per day) |
| `/shop` | Buy permanent upgrades with your points |
| `/inventory` | View your owned upgrades |
| `/balance` | Check your point total |
| `/leaderboard` | See the server's top players |
| `/tournament register` | Sign up for the tournament |
| `/tournament begin` | Start the tournament — admin only |
| `/tournament stop` | Stop the tournament and clear all data — admin only |
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

1. Type `/duel challenge @username` to challenge someone
2. The opponent has **5 minutes** to Accept or Decline
3. If accepted, both players receive a **DM with a link** to open the game in their browser
4. Each player opens their personal game link and places ships on the **7×7 grid**
5. Ships are placed by hovering over the grid — press **R** to rotate — and clicking to confirm
6. Once both fleets are placed, **both players are automatically redirected** to the battle page
7. Players take turns firing at the enemy grid by clicking cells
8. **Landing a hit grants an extra shot** — your turn only ends on a miss
9. First player to **sink all enemy ships** wins

### Fleet composition

Each player places **4 ships** on a **7×7 grid**:

| Ship | Shape | Cells |
|---|---|---|
| Destroyer | Straight | 3 cells |
| Patrol Boat | Straight | 2 cells |
| Patrol Boat | Straight | 2 cells |
| Corvette | L-shape | 3 cells |

**Total: 10 ship cells** out of 49 on the grid — roughly **20% of the grid is occupied**.

### Turn mechanic — hit streak

| Shot result | What happens |
|---|---|
| **Hit** | You fire again immediately |
| **Miss** | Turn passes to your opponent |
| **Last ship sunk** | Game over — you win |

A lucky streak of hits lets you fire multiple times in a row, making accurate early shots decisive.

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
| 🔭 Admiral's Spyglass | 280 pts | At match start, one random enemy ship cell is revealed |

### Armored ship mechanic (Reinforced Hull)

With **Reinforced Hull**, your first ship (Destroyer, 3 cells) can absorb **4 hits** instead of 3 before sinking. After all 3 cells are hit the ship is still alive — the opponent must fire at one of those cells again to pierce the armor and sink it.

---

## 🏆 Tournament

When a tournament is active, `/duel` is restricted to your **assigned opponent for the day**. The schedule is generated as a **round-robin** — every participant plays every other participant exactly once, one match per day.

### Running a tournament

```
1. Players run /tournament register to sign up
2. Admin runs /tournament begin [YYYY-MM-DD] to start
3. The bot posts daily matchups in the announcement channel each midnight UTC
4. Players use /duel challenge @their-assigned-opponent to play their match
5. Results are recorded automatically when the match ends
6. Admin can run /tournament stop at any time to end the tournament early
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
- `ALLOWED_CHANNEL_ID` *(optional)* — right-click the channel you want the bot to live in → **Copy Channel ID**

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
WEB_URL=https://your-railway-app.up.railway.app

# Optional — if set, bot commands only respond in this channel
ALLOWED_CHANNEL_ID=your_channel_id_here
```

**`ALLOWED_CHANNEL_ID`** — when set, the bot silently ignores commands in all other channels and replies ephemerally with a pointer to the correct channel. Leave it unset to allow commands everywhere.

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
3. Add your environment variables under **Variables** (the keys from `.env`, including `WEB_URL` set to your Railway public domain)
4. Railway will automatically run `npm start`

> Free tier credit easily covers a 2-week event.

### Testing locally

Visit `/test` on your running server (e.g. `http://localhost:3000/test`) to instantly create a test match and get links for both players — no Discord bot needed.

---

## Player Registration Tracking

The first time any user runs a bot command, they are automatically registered. The bot posts a public message in the bot channel:

> 👋 @User just joined the game! We now have **12** registered players.

This lets admins passively track participation without any manual effort.

---

## Running Tests

```bash
npm test
```

---

## Project Structure

```
src/
├── index.js              # Bot entry point, interaction routing, channel guard, registration announcements
├── deployCommands.js     # Registers slash commands with Discord
├── config.js             # Environment variable validation (incl. ALLOWED_CHANNEL_ID)
├── storage/
│   ├── jsonbinClient.js  # JSONBin REST API wrapper
│   └── store.js          # In-memory cache with event-driven writes
├── economy/
│   ├── points.js         # Point reward calculations
│   └── limits.js         # Daily limit and reset logic
├── games/
│   ├── battleship/       # 7×7 grid, ship placement, L-ship support, duel state machine
│   └── fishing/          # Fishing delay and catch mechanics
├── shop/
│   └── items.js          # Shop catalog and purchase logic
├── server/
│   └── gameServer.js     # Express + WebSocket game server, /game/, /battle/, /test routes
├── tournament/
│   ├── scheduler.js      # Round-robin schedule generation
│   └── standings.js      # Win/loss standings computation
└── commands/             # Slash command handlers

public/
├── game.html             # Ship placement page (boots instantly from server-injected data)
├── game.js               # Placement logic — L-ship support, incremental grid updates
├── battle.html           # Battle page (separate URL, navigated to when battle starts)
├── battle.js             # Battle logic — hit streak turns, game-over screen
├── grid.js               # Shared battle rendering (grids, cell patches, flash, banners)
├── ship-overlay.js       # Pixel-art ship images drawn on top of grids
├── game.css              # Naval command console theme — deep navy, sonar-cyan accents
└── assets/
    ├── ships/            # Pixel-art SVGs: destroyer, patrol, corvette (L-shape)
    └── markers/          # SVG hit/miss markers: explosion, flame, splash, target
```
