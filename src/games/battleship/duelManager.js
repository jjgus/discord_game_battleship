const { createFleet, addShip, fireAt, isFleetSunk, cellKey } = require('./grid');

const SHIP_LENGTHS = [3, 2, 2];

function createMatch(challengerId, opponentId, { firstTurn, items = {} } = {}) {
  return {
    players: [challengerId, opponentId],
    fleets: { [challengerId]: createFleet(), [opponentId]: createFleet() },
    placementsComplete: { [challengerId]: false, [opponentId]: false },
    turn: firstTurn || challengerId,
    shots: { [challengerId]: [], [opponentId]: [] },
    items,
  };
}

function placeNextShip(match, userId, placement) {
  const fleet = match.fleets[userId];
  const shipIndex = fleet.ships.length;
  if (shipIndex >= SHIP_LENGTHS.length) throw new Error('All ships already placed');

  const userItems = match.items[userId] || [];
  const armor = shipIndex === 0 && userItems.includes('reinforced_hull') ? 1 : 0;

  const updatedFleet = addShip(fleet, { ...placement, length: SHIP_LENGTHS[shipIndex], armor });
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
  const key = cellKey(row, col);
  const shotsForShooter = match.shots[shooterId] || [];
  const targetId = opponentOf(match, shooterId);
  const targetFleet = match.fleets[targetId];

  const alreadyInShots = shotsForShooter.includes(key);
  const isArmorHit = alreadyInShots && targetFleet.ships.some((ship) => {
    const matchesCell = ship.cells.some((c) => c.row === row && c.col === col);
    return matchesCell && ship.hits.includes(key) && ship.hits.length >= ship.cells.length && ship.armorLeft > 0;
  });

  if (alreadyInShots && !isArmorHit) {
    return { match, hit: false, sunk: false, targetId, alreadyFired: true };
  }

  const { fleet, hit, armorPierced } = fireAt(targetFleet, row, col);
  const sunk = isFleetSunk(fleet);

  return {
    match: {
      ...match,
      fleets: { ...match.fleets, [targetId]: fleet },
      turn: sunk ? null : targetId,
      shots: {
        ...match.shots,
        [shooterId]: armorPierced ? shotsForShooter : [...shotsForShooter, key],
      },
    },
    hit,
    sunk,
    targetId,
    alreadyFired: false,
  };
}

module.exports = { createMatch, placeNextShip, bothPlayersReady, opponentOf, takeShot, SHIP_LENGTHS };
