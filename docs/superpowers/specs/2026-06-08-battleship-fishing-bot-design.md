# Discord Battleship & Fishing Points Bot — Design Spec

## Purpose

A lightweight Discord bot for a company server offering two interactive,
points-based games:

- **Battleship duels** — players challenge each other to a quick 1v1 match,
  once per day.
- **Fishing** — a casual solo mini-game players can attempt up to 3 times per
  day for bonus points.
- **Shop** — a small set of permanent upgrades players can buy with points to
  gain an edge in either game.

Both games feed into a single shared point economy with a server-wide
leaderboard. The project is intentionally scoped small — minimal commands,
minimal state, fast to build and maintain. The bot is expected to run for a
**two-week event**, which informs the shop's pricing (see below).

## Tech Stack

- **Runtime/Library:** Node.js + discord.js v14 (slash commands + message
  components/buttons for interactivity).
- **Hosting:** Ephemeral/serverless (no persistent local filesystem assumed).
- **Storage:** [JSONBin.io](https://jsonbin.io) as the persistence layer — a
  hosted JSON document store accessed via REST API.

## Data Model

A single JSON document stored in one JSONBin bin:

```json
{
  "users": {
    "<discordUserId>": {
      "points": 100,
      "lastDuelAt": "2026-06-08T00:00:00Z",
      "fishCount": 0,
      "lastFishDate": "2026-06-08",
      "ownedItems": ["lucky_compass", "better_bait"]
    }
  }
}
```

- `points` — shared currency across both games and the shop.
- `lastDuelAt` — ISO timestamp of the user's last completed duel; gates the
  once-per-day duel limit.
- `fishCount` / `lastFishDate` — number of fishing attempts used today and the
  UTC date they apply to; reset when `lastFishDate` no longer matches today's
  UTC date.
- `ownedItems` — list of shop item IDs the user has permanently purchased;
  effects are applied automatically wherever relevant (see Shop section).

### Persistence Strategy

To avoid exceeding JSONBin's API rate limits (gameplay actions would otherwise
trigger an API call each), the bot:

1. Loads the full document into an **in-memory cache** on startup.
2. Treats the in-memory cache as the source of truth during gameplay so
   actions are never blocked by network latency or API failures.
3. **Write-throughs to JSONBin on a short debounce** (e.g. batched every
   ~10–30 seconds, and on graceful shutdown) rather than per-action.
4. Retries failed writes with backoff; gameplay continues uninterrupted in the
   meantime since the cache remains authoritative.

## Battleship Duel Flow

1. **Challenge:** `/duel @user`
   - Bot checks the challenger's `lastDuelAt` — if they've already completed a
     duel today (any opponent), the command is rejected with an ephemeral
     message stating when they can duel again.
   - Bot rejects challenges targeting a bot account or the challenger
     themselves.
   - Bot posts a challenge message in-channel with **Accept / Decline**
     buttons visible to the target. The challenge expires after ~60 seconds if
     not acted upon.
   - A declined or expired challenge does **not** consume either player's
     daily duel slot — only a completed match does.

2. **Setup:** Once accepted, the bot DMs each player a **5x5 grid of buttons**
   to place a small fleet (2–3 ships, 2–3 cells each — kept intentionally
   small so matches stay quick and fit Discord's 25-button-per-message limit).
   Players tap cells in sequence to place each ship.

3. **Battle:** Turn-based, played out in the **server channel** so it's
   spectatable:
   - The bot posts the active player's 5x5 target grid as buttons.
   - The active player taps a cell to fire; the bot reveals hit/miss and
     updates the board.
   - Turns alternate until one player's entire fleet is sunk.

4. **Resolution:**
   - Winner receives a fixed reward (e.g. **+50 points**), loser receives a
     smaller consolation (e.g. **+10 points**).
   - Both players' `lastDuelAt` is stamped to the current time, consuming
     their daily duel slot.
   - The result is announced in the channel.

## Fishing Mini-Game Flow

`/fish` — limited to **3 attempts per day**, resetting at **midnight UTC**
(tracked via `fishCount` + `lastFishDate`; when the stored date no longer
matches today's UTC date, the count resets to 0 before the new attempt is
recorded).

1. Bot checks the daily attempt count; if exhausted, replies ephemerally with
   when the limit resets.
2. Bot replies "Casting your line... 🎣" and waits a **random delay between 30
   seconds and 2 minutes** — fishing is meant to be a casual background
   activity, not a reflex test.
3. Bot edits the message to "Fish on! Reel it in!" and attaches a **Reel In**
   button.
4. The speed of the player's tap determines the reward:
   - Fast (e.g. <1s): high reward (e.g. +30)
   - Medium (e.g. <2s): moderate reward (e.g. +20)
   - Slow (e.g. <3s): small reward (e.g. +10)
   - No response / too slow: the fish gets away (+0)
   - A small random chance of a "big catch" bonus adds variety.
   - Every attempt (including a +0 result) counts toward the daily cap of 3.

## Shop

Permanent, one-time-purchase upgrades that give players a lasting edge. Each
game has three tiers — a cheap quality-of-life pickup, a mid-tier mechanical
edge, and a premium "best in slot" item. Pricing is deliberately tuned for the
**two-week event window**: an active player (one duel/day, three fishing
attempts/day) earns roughly 75–90 points/day, so a casual player can afford
the cheap tier within a couple of days, and a dedicated player can realistically
reach the premium tier by the event's end.

| Item | Game | Effect | Price |
|---|---|---|---|
| 🧭 Lucky Compass | Battleship | Slightly better odds of going first in a duel | 60 pts |
| 🛡️ Reinforced Hull | Battleship | One ship gains +1 cell of "armor" (survives one extra hit before sinking); auto-applied during ship placement | 150 pts |
| 🔭 Admiral's Spyglass | Battleship | At the start of each duel, one random enemy ship cell is revealed | 280 pts |
| 🪱 Better Bait | Fishing | Slightly increases the chance of a "big catch" bonus on every attempt | 60 pts |
| 🎣 Quality Rod | Fishing | Widens the fast-reaction window (e.g. <1.5s instead of <1s counts as "fast"), making top-tier rewards easier to land | 150 pts |
| ✨ Golden Lure | Fishing | Notably increases big-catch bonus chance and raises the minimum reward (no more "fish got away" results) | 280 pts |

**Buying flow (`/shop`):** Bot posts the item list with **Buy** buttons. Each
button shows price and is disabled if the player can't afford the item or
already owns it. On purchase, points are deducted, the item ID is added to
`ownedItems`, and effects apply automatically from then on — no activation
step needed. `/inventory` lets a player view what they currently own.

## Commands

| Command | Purpose |
|---|---|
| `/duel @user` | Challenge another user to a Battleship match |
| `/fish` | Attempt to catch a fish for bonus points (up to 3/day) |
| `/shop` | Browse and buy permanent upgrades with points |
| `/inventory` | View your owned upgrades |
| `/balance` | Check your own point total |
| `/leaderboard` | Show the server's top point-holders |

## Shared Economy

Both games write to the same `points` field on a user's record, and the shop
spends from that same balance. `/leaderboard` ranks all known users by total
`points` regardless of which game(s) they earned them through.

## Error Handling & Edge Cases

- **Cooldown/limit violations** (duel already used today, fishing attempts
  exhausted) → ephemeral reply telling the user when they can next play.
- **Invalid duel target** (self or a bot account) → rejected with a friendly
  ephemeral message; no slot consumed.
- **Challenge declined or expired** → ephemeral notice to the challenger; no
  penalty, no slot consumed.
- **Insufficient points / already owned** in the shop → the relevant Buy
  button is disabled; an attempted purchase replies ephemerally explaining why.
- **JSONBin write failure** → retried with backoff; in-memory state remains
  authoritative so gameplay is never blocked by storage issues.

## Testing Approach

- **Unit tests** for pure logic: point calculations (duel rewards, fishing
  speed tiers, shop purchase deduction), daily-limit reset logic (UTC date
  rollover for both duels and fishing), shop affordability/ownership checks,
  and grid/ship-placement validation (including item-modified effects like
  Reinforced Hull).
- **Integration-style tests** for the in-memory cache + debounced JSONBin
  write-through (using a mocked JSONBin client): verifying batching, retry/
  backoff behavior, and that cache stays authoritative on write failure.
- Manual verification in a test Discord server for the interactive flows
  (button grids, challenge accept/decline, fishing timing) since Discord's
  component interactions are difficult to fully unit test.
