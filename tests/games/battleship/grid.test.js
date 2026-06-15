const { createFleet, addShip, fireAt, isFleetSunk } = require('../../../src/games/battleship/grid');

describe('addShip', () => {
  test('adds a horizontal ship within bounds', () => {
    const fleet = addShip(createFleet(), { startRow: 0, startCol: 0, length: 2, orientation: 'horizontal' });
    expect(fleet.ships).toHaveLength(1);
    expect(fleet.ships[0].cells).toEqual([{ row: 0, col: 0 }, { row: 0, col: 1 }]);
  });
  test('stores armor on the ship when specified', () => {
    const fleet = addShip(createFleet(), { startRow: 0, startCol: 0, length: 2, orientation: 'horizontal', armor: 1 });
    expect(fleet.ships[0].armorLeft).toBe(1);
  });
  test('defaults armorLeft to 0 when armor is not specified', () => {
    const fleet = addShip(createFleet(), { startRow: 0, startCol: 0, length: 2, orientation: 'horizontal' });
    expect(fleet.ships[0].armorLeft).toBe(0);
  });
  test('rejects a ship that would go out of bounds', () => {
    expect(() =>
      addShip(createFleet(), { startRow: 0, startCol: 4, length: 2, orientation: 'horizontal' })
    ).toThrow('Cannot place ship there');
  });
  test('rejects a ship that overlaps an existing ship', () => {
    const fleet = addShip(createFleet(), { startRow: 0, startCol: 0, length: 2, orientation: 'horizontal' });
    expect(() =>
      addShip(fleet, { startRow: 0, startCol: 1, length: 2, orientation: 'vertical' })
    ).toThrow('Cannot place ship there');
  });
});

describe('fireAt', () => {
  test('records a hit when the shot lands on a ship cell', () => {
    const fleet = addShip(createFleet(), { startRow: 0, startCol: 0, length: 2, orientation: 'horizontal' });
    const { fleet: updated, hit } = fireAt(fleet, 0, 0);
    expect(hit).toBe(true);
    expect(updated.ships[0].hits).toEqual(['0,0']);
  });
  test('reports a miss when the shot lands on an empty cell', () => {
    const fleet = addShip(createFleet(), { startRow: 0, startCol: 0, length: 2, orientation: 'horizontal' });
    expect(fireAt(fleet, 4, 4).hit).toBe(false);
  });
  test('depletes armor when all cells are hit and armor remains', () => {
    const fleet = addShip(createFleet(), { startRow: 0, startCol: 0, length: 2, orientation: 'horizontal', armor: 1 });
    const { fleet: after1 } = fireAt(fleet, 0, 0);
    const { fleet: after2 } = fireAt(after1, 0, 1);
    const { fleet: after3, hit, armorPierced } = fireAt(after2, 0, 0);
    expect(hit).toBe(true);
    expect(armorPierced).toBe(true);
    expect(after3.ships[0].armorLeft).toBe(0);
  });
});

describe('isFleetSunk', () => {
  test('returns false while any ship has unhit cells', () => {
    const fleet = addShip(createFleet(), { startRow: 0, startCol: 0, length: 2, orientation: 'horizontal' });
    const { fleet: afterOneHit } = fireAt(fleet, 0, 0);
    expect(isFleetSunk(afterOneHit)).toBe(false);
  });
  test('returns true once every ship cell has been hit', () => {
    const fleet = addShip(createFleet(), { startRow: 0, startCol: 0, length: 2, orientation: 'horizontal' });
    const { fleet: afterFirst } = fireAt(fleet, 0, 0);
    const { fleet: afterSecond } = fireAt(afterFirst, 0, 1);
    expect(isFleetSunk(afterSecond)).toBe(true);
  });
  test('armored ship survives all cells being hit until armor is depleted', () => {
    const fleet = addShip(createFleet(), { startRow: 0, startCol: 0, length: 2, orientation: 'horizontal', armor: 1 });
    const { fleet: after1 } = fireAt(fleet, 0, 0);
    const { fleet: after2 } = fireAt(after1, 0, 1);
    expect(isFleetSunk(after2)).toBe(false);
    const { fleet: after3 } = fireAt(after2, 0, 0);
    expect(isFleetSunk(after3)).toBe(true);
  });
});
