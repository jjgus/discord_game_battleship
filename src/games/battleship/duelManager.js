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
  if (shipIndex >= SHIP_LENGTHS.length) throw new Error('All ships already placed');

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
