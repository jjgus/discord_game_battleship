const { duelReward, fishingReward } = require('../../src/economy/points');

describe('duelReward', () => {
  test('returns the winner reward for a win', () => {
    expect(duelReward(true)).toBe(50);
  });
  test('returns the consolation reward for a loss', () => {
    expect(duelReward(false)).toBe(10);
  });
});

describe('fishingReward', () => {
  test('returns the fast-tier reward for reactions under 1 second', () => {
    expect(fishingReward(800)).toBe(30);
  });
  test('returns the medium-tier reward for reactions under 2 seconds', () => {
    expect(fishingReward(1500)).toBe(20);
  });
  test('returns the slow-tier reward for reactions under 3 seconds', () => {
    expect(fishingReward(2800)).toBe(10);
  });
  test('returns zero when the player misses the window', () => {
    expect(fishingReward(5000)).toBe(0);
  });
  test('Golden Lure guarantees the minimum reward even on a miss', () => {
    expect(fishingReward(5000, { hasGoldenLure: true })).toBe(10);
  });
});
