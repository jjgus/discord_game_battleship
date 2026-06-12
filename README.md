# Battleship & Fishing Discord Bot

A Discord bot for company events featuring Battleship duels, a fishing mini-game, a shared point economy, and a permanent-upgrade shop.

## Features

- `/duel @user` — Challenge someone to a 1v1 Battleship match (once per day)
- `/fish` — Cast a line for points (up to 3 times per day)
- `/shop` — Buy permanent upgrades with your points
- `/inventory` — View your owned upgrades
- `/balance` — Check your point total
- `/leaderboard` — See the server's top players

---

## Prerequisites

- [Node.js](https://nodejs.org) v18 or higher
- A [Discord application](https://discord.com/developers/applications) with a bot token
- A [JSONBin.io](https://jsonbin.io) account (free tier)

---

## Step 1: Create a Discord Bot

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications) and click **New Application**
2. Give it a name (e.g. `GameBot`) and click **Create**
3. Go to the **Bot** tab and click **Add Bot**
4. Under **Token**, click **Reset Token** and copy it — this is your `DISCORD_TOKEN`
5. Scroll down and enable these **Privileged Gateway Intents**:
   - Message Content Intent
6. Go to the **OAuth2 → URL Generator** tab:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Send Messages`, `Use Slash Commands`, `Send Messages in Threads`
7. Copy the generated URL and open it in your browser to invite the bot to your server

**Finding your IDs:**
- `DISCORD_CLIENT_ID` — found on the **General Information** tab (Application ID)
- `DISCORD_GUILD_ID` — right-click your Discord server → **Copy Server ID** (enable Developer Mode in Discord Settings → Advanced first)

---

## Step 2: Set Up JSONBin

1. Go to [jsonbin.io](https://jsonbin.io) and create a free account
2. Click **Create Bin** and paste this as the initial content:
   ```json
   { "users": {} }
   ```
3. Save the bin — copy the **Bin ID** from the URL (e.g. `6641abc123def...`) — this is your `JSONBIN_BIN_ID`
4. Go to **API Keys** in your account dashboard and create a key — this is your `JSONBIN_API_KEY`

---

## Step 3: Configure Environment Variables

Copy the example file:

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

## Step 4: Install Dependencies

```bash
npm install
```

---

## Step 5: Register Slash Commands

Run this once to register the bot's commands with your Discord server:

```bash
npm run deploy-commands
```

Expected output: `Registered 6 commands.`

---

## Step 6: Start the Bot

```bash
npm start
```

Expected output: `Logged in as YourBot#1234`

The bot is now running. Test it by typing `/balance` in your server.

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
└── commands/             # Slash command handlers
```
