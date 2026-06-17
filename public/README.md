# Battleship — Repository Integration Guide

This folder contains drop-in files to bring the **Battleship Design System** look (themed UI + pixel-art ships + battle markers) into the actual game client at
**https://github.com/jjgus/discord_game_battleship** (vanilla JS in `public/`).

It's split into two tiers:

- **Tier A — visual refresh.** New theme + assets. No game-logic changes. Low risk.
- **Tier B — ship images on the grid.** Overlays the real ship art onto cells during placement and battle, including the L-ship, 3-cell, and 2-cell ships. Hooks the existing render functions — no edits to `grid.js`/`game.js` *if* their function/global names match (see the checklist).

Copy everything here into the repo's **`public/`** folder, preserving structure:

```
public/
  game.css              ← REPLACE with handoff/game.css
  ship-overlay.js       ← ADD     (handoff/ship-overlay.js)
  assets/
    ships/  battleship.svg destroyer.svg patrol.svg top-L.svg top-3.svg top-2.svg
    markers/ explosion.svg flame.svg splash.svg target.svg
    emblem.svg
```

The old `public/assets/ships/{corvette,destroyer,patrol}.svg` (plain rectangles) can be deleted.

---

## Tier A — visual refresh (5 minutes, no logic changes)

1. **Replace** `public/game.css` with `handoff/game.css`.
2. **Copy** the `assets/` tree into `public/assets/`.
3. Done. The class names in the new CSS are unchanged from the original
   (`.cell`, `.cell.ship`, `.cell.hit-enemy`, `.cell.miss`, `#turn-banner.my-turn`,
   `.spinner`, etc.), so the existing markup is restyled in place.

What you get from Tier A alone:
- Deep-navy "naval command console" theme, sonar-cyan accents, pixel fonts.
- **Pixel-art markers** for hits/misses: `explosion.svg` and `splash.svg` are wired
  via CSS `background-image` on `.cell.hit-enemy` / `.cell.miss` — replacing the old
  emoji/character markers. (If the old JS injects emoji as text into the cell, remove
  that line so it doesn't double up — see Tier-A note below.)

> **Tier-A note on markers:** if `game.js`/`battle.js` set cell **text** like
> `cell.textContent = '💥'`, delete those assignments; the CSS now supplies the marker
> image. The class toggles (`add('hit-enemy')` etc.) stay exactly as they are.

---

## Tier B — real ship images on the grid

`ship-overlay.js` draws each ship's pixel art on top of the grid, sized and rotated to
fit its cells, and shows a **ghost preview that follows the cursor** during placement.
It works by *wrapping* the game's existing render functions and reading its existing
state — so you add one `<script>` and (ideally) change nothing else.

### 1. Load the script

In **`public/game.html`**, after the existing game scripts:

```html
<script src="/grid.js"></script>
<script src="/game.js"></script>
<script src="/ship-overlay.js"></script>   <!-- ADD LAST -->
```

In **`public/battle.html`** (the spectator/battle view), after `battle.js`:

```html
<script src="/battle.js"></script>
<script src="/ship-overlay.js"></script>   <!-- ADD LAST -->
```

### 2. Verify the hook points (the one thing to check)

`ship-overlay.js` assumes these names exist as **globals** (read the top of the file —
they're all listed in one place). Open `grid.js`/`game.js` and confirm, or adjust the
names in `ship-overlay.js` to match:

| What the overlay needs | Used for | If your name differs |
|---|---|---|
| `state.myFleet.ships[]` — each with `.cells` (`[{row,col}]`), and `.hits` | drawing your fleet + sunk state | edit `overlayFleet` / `isSunk` |
| `state.opponentShotsOnMe` — array of `"row,col"` keys that hit me | flame/explosion markers on your ships | edit `overlayFleet` |
| `state.hoverCell` — `{row,col}` under the cursor in placement | ghost preview position | edit `overlayPlacement` |
| `currentConfig()` → `{ id }` of the ship being placed | ghost sprite (not strictly needed — sprite is chosen by shape) | edit `overlayPlacement` |
| `previewCellsFor(row,col)` → `[{row,col}]` | ghost footprint (uses the game's own rotation logic) | edit `overlayPlacement` |
| `isValidPlacement(cells)` → bool | valid (cyan) vs invalid (red) ghost tint | edit `overlayPlacement` |
| Render fns: `renderMyFleetFull`, `patchMyCell`, `buildFleetPreviewGrid`, `refreshPlacementOccupied`, `refreshPlacementPreview` | when to repaint the overlay | edit the `install()` list at the bottom |
| Grid element IDs: `my-grid`, `placement-grid`, `preview-fleet-grid` | which grids to overlay | edit the `overlay*` calls |

> These names are inferred from the repo's structure (it already implements `L_ROTATIONS`,
> `shape === 'L'`, and a 5×5 placement preview). **If a name doesn't match, the overlay
> silently no-ops for that hook** — it never throws — so Tier A keeps working while you
> reconcile names. Search `ship-overlay.js` for the name and update it; everything is in
> the `install()` function and the three `overlay*` renderers.

### 3. How sprite selection works (no config needed)

The overlay picks art **from the cells' geometry**, so it's robust to ship IDs:

- **Bent (L) shape** → `top-L.svg`, rotated to match (0/90/180/270°).
- **Linear, ≥3 cells** → `battleship.svg` (detailed side-view), spanning the length.
- **Linear, 2 cells** → `patrol.svg` (side-view), spanning the length.

Vertical ships are auto-rotated 90°. Side-view ships keep their native proportions
(they're centered on the run of cells, not stretched). Sunk ships get a charred/desaturated
filter; the flame marker is drawn **above** the ship art on hit cells.

To use different art, change the `SPRITE` map at the top of `ship-overlay.js`
(`src` + `aspect` = nativeHeight / nativeWidth).

---

## Mapping: design-system → repo

| Design system (this project) | Repo file it becomes |
|---|---|
| `tokens/*.css` (colors, type, spacing) | folded into `public/game.css` `:root` |
| `assets/ships/*.svg`, `assets/markers/*.svg`, `assets/brand/emblem.svg` | `public/assets/...` |
| `ui_kits/battleship/FleetBoard.jsx` (overlay math) | ported to vanilla `public/ship-overlay.js` |
| `ui_kits/battleship/gameLogic.jsx` (L/line shapes, rotation) | **already exists** in the repo's `grid.js` — not re-ported |

The React components in this design system remain the **design source of truth** for
future visual changes; regenerate/adjust art and theme here, then re-copy into `public/`.

---

## Quick local test

The repo serves `public/` statically. After copying the files:

```bash
npm install
npm start          # or: node server.js  (see the repo's package.json)
# open the game URL, create/replay a match, place ships, fire.
```

Check: ships appear as pixel art on the board; ghost follows the cursor and turns red on
invalid placement; hits show explosions on the enemy board and flames on yours; misses
show splashes.
