/* ============================================================
   ship-overlay.js  —  draws the real pixel ship art on top of the
   battle/placement grids. Drop-in: just add
       <script src="/ship-overlay.js"></script>
   AFTER grid.js and game.js (game.html) / battle.js (battle.html).

   It reads the existing globals (`state`, `currentConfig`,
   `previewCellsFor`, `isValidPlacement`) and wraps the existing render
   functions, so NO edits to game.js / grid.js are required.
   ============================================================ */
(function () {
  'use strict';

  // sprite file + native aspect (height / width) for proportion-preserving scaling.
  // Linear ships use the detailed side-view art; the L-ship uses the top-down L sprite.
  var SPRITE = {
    L:      { src: '/assets/ships/top-L.svg',      aspect: 1 },        // L-shape (square footprint)
    line3:  { src: '/assets/ships/battleship.svg', aspect: 22 / 48 },  // 3-cell side-view
    line2:  { src: '/assets/ships/patrol.svg',     aspect: 14 / 32 },  // 2-cell side-view
  };

  // which 90°-rotation of the base L sprite matches a set of normalised offsets
  var L_SPRITE_ROT = [
    { keys: ['0,0', '1,0', '1,1'], deg: 0 },
    { keys: ['0,0', '0,1', '1,0'], deg: 90 },
    { keys: ['0,0', '0,1', '1,1'], deg: 180 },
    { keys: ['0,1', '1,0', '1,1'], deg: 270 },
  ];

  // choose sprite purely from cell geometry (robust, no repo-specific IDs)
  function spriteForCells(cells) {
    if (isLShape(cells)) return SPRITE.L;
    return cells.length >= 3 ? SPRITE.line3 : SPRITE.line2;
  }

  function norm(cells) {
    var minR = Infinity, minC = Infinity;
    cells.forEach(function (c) { if (c.row < minR) minR = c.row; if (c.col < minC) minC = c.col; });
    return cells.map(function (c) { return { row: c.row - minR, col: c.col - minC }; });
  }

  function isLShape(cells) {
    if (cells.length !== 3) return false;
    var rows = new Set(cells.map(function (c) { return c.row; }));
    var cols = new Set(cells.map(function (c) { return c.col; }));
    return rows.size > 1 && cols.size > 1;   // bent, not collinear
  }

  function lRotationDeg(cells) {
    var keys = norm(cells).map(function (o) { return o.row + ',' + o.col; }).sort().join('|');
    for (var i = 0; i < L_SPRITE_ROT.length; i++) {
      if (L_SPRITE_ROT[i].keys.slice().sort().join('|') === keys) return L_SPRITE_ROT[i].deg;
    }
    return 0;
  }

  // overlay layer for a grid element (created once, reused)
  function layerFor(grid) {
    var layer = grid.querySelector(':scope > .ship-overlay');
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'ship-overlay';
      grid.appendChild(layer);
    }
    layer.innerHTML = '';
    return layer;
  }

  // pixel box for a set of cells, read straight from the live DOM (responsive-safe)
  function boxOf(grid, cells) {
    var nodes = grid.querySelectorAll('.cell');
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, ok = true;
    cells.forEach(function (c) {
      var el = nodes[c.row * GRID_SIZE + c.col];
      if (!el) { ok = false; return; }
      x0 = Math.min(x0, el.offsetLeft);
      y0 = Math.min(y0, el.offsetTop);
      x1 = Math.max(x1, el.offsetLeft + el.offsetWidth);
      y1 = Math.max(y1, el.offsetTop + el.offsetHeight);
    });
    if (!ok) return null;
    return { left: x0, top: y0, w: x1 - x0, h: y1 - y0 };
  }

  function drawShip(layer, grid, cells, opts) {
    opts = opts || {};
    var box = boxOf(grid, cells);
    if (!box) return;
    var sprite = opts.sprite || spriteForCells(cells);
    var img = document.createElement('img');
    img.src = sprite.src;
    img.alt = '';
    if (opts.ghost) img.className = 'ghost';

    var deg = 0, imgW, imgH;
    if (sprite === SPRITE.L) {
      deg = lRotationDeg(cells);
      imgW = box.w; imgH = box.h;                 // square footprint
    } else {
      var vertical = box.h > box.w;
      var long = vertical ? box.h : box.w;        // span the ship's length
      imgW = long;
      imgH = long * sprite.aspect;                // keep native proportions
      if (vertical) deg = 90;
    }

    var cx = box.left + box.w / 2, cy = box.top + box.h / 2;
    img.style.width = imgW + 'px';
    img.style.height = imgH + 'px';
    img.style.left = cx + 'px';
    img.style.top = cy + 'px';
    img.style.transform = 'translate(-50%,-50%) rotate(' + deg + 'deg)';
    if (opts.sunk) img.style.filter = 'grayscale(0.6) brightness(0.5) sepia(0.5) hue-rotate(-25deg)';
    else if (opts.ghost) img.style.filter = opts.valid
      ? 'drop-shadow(0 0 6px rgba(47,214,207,0.5)) brightness(1.1)'
      : 'sepia(1) saturate(4) hue-rotate(-35deg)';
    else img.style.filter = 'drop-shadow(0 2px 3px rgba(0,0,0,0.55))';
    layer.appendChild(img);
  }

  function drawMarker(layer, grid, key, kind) {
    var p = key.split(',');
    var box = boxOf(grid, [{ row: +p[0], col: +p[1] }]);
    if (!box) return;
    var img = document.createElement('img');
    img.src = '/assets/markers/' + kind + '.svg';
    img.alt = '';
    img.style.width = (box.w * 0.6) + 'px';
    img.style.height = (box.w * 0.6) + 'px';
    img.style.left = (box.left + box.w / 2) + 'px';
    img.style.top = (box.top + box.h / 2) + 'px';
    img.style.transform = 'translate(-50%,-50%)';
    img.style.zIndex = '3';
    layer.appendChild(img);
  }

  function shipId(ship) {
    return ship.id || ship.shipId || (ship.config && ship.config.id) || ship.shape || '';
  }
  function isSunk(ship) {
    return ship.hits && ship.cells && ship.hits.length >= ship.cells.length && (ship.armorLeft || 0) <= 0;
  }

  // ── overlay renderers ──────────────────────────────────────────
  function overlayFleet(gridId, withMarkers) {
    var grid = document.getElementById(gridId);
    if (!grid || typeof state === 'undefined' || !state.myFleet) return;
    var layer = layerFor(grid);
    state.myFleet.ships.forEach(function (ship) {
      drawShip(layer, grid, ship.cells, { id: shipId(ship), sunk: isSunk(ship) });
    });
    if (withMarkers && state.opponentShotsOnMe) {
      state.myFleet.ships.forEach(function (ship) {
        var sunk = isSunk(ship);
        ship.cells.forEach(function (c) {
          var key = c.row + ',' + c.col;
          if (state.opponentShotsOnMe.indexOf(key) !== -1) {
            drawMarker(layer, grid, key, sunk ? 'explosion' : 'flame');
          }
        });
      });
    }
  }

  function overlayPlacement() {
    var grid = document.getElementById('placement-grid');
    if (!grid || typeof state === 'undefined') return;
    var layer = layerFor(grid);
    // already-placed ships
    (state.myFleet.ships || []).forEach(function (ship) {
      drawShip(layer, grid, ship.cells, { id: shipId(ship), sunk: false });
    });
    // ghost of the ship currently being placed
    if (state.hoverCell && typeof currentConfig === 'function') {
      var cfg = currentConfig();
      if (cfg && typeof previewCellsFor === 'function') {
        var cells = previewCellsFor(state.hoverCell.row, state.hoverCell.col);
        var inBounds = cells.every(function (c) { return c.row >= 0 && c.row < 5 && c.col >= 0 && c.col < 5; });
        if (inBounds) {
          var valid = typeof isValidPlacement === 'function' ? isValidPlacement(cells) : true;
          drawShip(layer, grid, cells, { id: cfg.id, ghost: true, valid: valid });
        }
      }
    }
  }

  // ── wrap the existing render functions (no edits to their files) ──
  function wrap(name, after) {
    if (typeof window[name] !== 'function') return;
    var orig = window[name];
    window[name] = function () {
      var r = orig.apply(this, arguments);
      try { after(); } catch (e) { /* no-op */ }
      return r;
    };
  }

  function install() {
    wrap('renderMyFleetFull', function () { overlayFleet('my-grid', true); });
    wrap('patchMyCell', function () { overlayFleet('my-grid', true); });
    wrap('buildFleetPreviewGrid', function () { overlayFleet('preview-fleet-grid', false); });
    wrap('refreshPlacementOccupied', overlayPlacement);
    wrap('refreshPlacementPreview', overlayPlacement);
    // first paint (in case a render already ran before this script loaded)
    overlayFleet('my-grid', true);
    overlayFleet('preview-fleet-grid', false);
    overlayPlacement();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }
})();
