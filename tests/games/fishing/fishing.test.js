const { randomDelayMs, bigCatchChance, rollBigCatch, MIN_DELAY_MS, MAX_DELAY_MS } = require('../../../src/games/fishing/fishing');

describe('randomDelayMs', () => {
  test('returns the minimum delay when random returns 0', () => {
    expect(randomDelayMs(() => 0)).toBe(MIN_DELAY_MS);
  });
  test('returns a value within the configured range when random returns just under 1', () => {
    const delay = randomDelayMs(() => 0.9999);
    expect(delay).toBeGreaterThanOrEqual(MIN_DELAY_MS);
    expect(delay).toBeLessThan(MAX_DELAY_MS);
  });
});

describe('bigCatchChance', () => {
  test('returns the base chance with no items', () => {
    expect(bigCatchChance({})).toBeCloseTo(0.1);
  });
  test('increases with Better Bait', () => {
    expect(bigCatchChance({ hasBetterBait: true })).toBeCloseTo(0.2);
  });
  test('increases more with Golden Lure', () => {
    expect(bigCatchChance({ hasGoldenLure: true })).toBeCloseTo(0.3);
  });
});

describe('rollBigCatch', () => {
  test('returns true when the random roll is below the chance', () => {
    expect(rollBigCatch({}, () => 0.05)).toBe(true);
  });
  test('returns false when the random roll is at or above the chance', () => {
    expect(rollBigCatch({}, () => 0.5)).toBe(false);
  });
});
