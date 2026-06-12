const { SHOP_ITEMS, findItem, purchaseItem } = require('../../src/shop/items');

describe('findItem', () => {
  test('returns the item matching the given id', () => {
    expect(findItem('better_bait')).toMatchObject({ id: 'better_bait', price: 60 });
  });
  test('returns undefined for an unknown id', () => {
    expect(findItem('does_not_exist')).toBeUndefined();
  });
});

describe('purchaseItem', () => {
  test('succeeds and deducts points when the user can afford the item', () => {
    const user = { points: 100, ownedItems: [] };
    expect(purchaseItem(user, 'better_bait')).toEqual({
      ok: true,
      updates: { points: 40, ownedItems: ['better_bait'] },
    });
  });
  test('fails when the user already owns the item', () => {
    const user = { points: 100, ownedItems: ['better_bait'] };
    expect(purchaseItem(user, 'better_bait')).toEqual({ ok: false, reason: 'already_owned' });
  });
  test('fails when the user cannot afford the item', () => {
    const user = { points: 10, ownedItems: [] };
    expect(purchaseItem(user, 'better_bait')).toEqual({ ok: false, reason: 'insufficient_points' });
  });
  test('fails for an unknown item id', () => {
    const user = { points: 1000, ownedItems: [] };
    expect(purchaseItem(user, 'does_not_exist')).toEqual({ ok: false, reason: 'unknown_item' });
  });
});

describe('SHOP_ITEMS', () => {
  test('contains exactly three items per game', () => {
    expect(SHOP_ITEMS.filter((item) => item.game === 'battleship')).toHaveLength(3);
    expect(SHOP_ITEMS.filter((item) => item.game === 'fishing')).toHaveLength(3);
  });
});
