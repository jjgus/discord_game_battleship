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
