const GRID_SIZE = 5;

function cellKey(row, col) { return `${row},${col}`; }

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
  if (!cells.every(({ row, col }) => isInBounds(row, col))) return false;
  const occupied = new Set();
  existingShips.forEach((ship) => {
    ship.cells.forEach(({ row, col }) => occupied.add(cellKey(row, col)));
  });
  return cells.every(({ row, col }) => !occupied.has(cellKey(row, col)));
}

function createFleet() { return { ships: [] }; }

function addShip(fleet, { startRow, startCol, length, orientation }) {
  const cells = buildShipCells(startRow, startCol, length, orientation);
  if (!canPlaceShip(fleet.ships, cells)) throw new Error('Cannot place ship there');
  return { ships: [...fleet.ships, { cells, hits: [] }] };
}

function fireAt(fleet, row, col) {
  let hit = false;
  const ships = fleet.ships.map((ship) => {
    const matchesTarget = ship.cells.some((cell) => cell.row === row && cell.col === col);
    if (!matchesTarget || ship.hits.includes(cellKey(row, col))) return ship;
    hit = true;
    return { ...ship, hits: [...ship.hits, cellKey(row, col)] };
  });
  return { fleet: { ships }, hit };
}

function isFleetSunk(fleet) {
  return fleet.ships.every((ship) => ship.cells.length === ship.hits.length);
}

module.exports = { GRID_SIZE, createFleet, addShip, fireAt, isFleetSunk, buildShipCells, canPlaceShip, cellKey };
