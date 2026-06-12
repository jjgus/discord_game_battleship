const { canDuel, fishAttemptsRemaining, recordFishAttempt } = require('../../src/economy/limits');

describe('canDuel', () => {
  test('allows a duel when the user has never dueled', () => {
    expect(canDuel({ lastDuelAt: null })).toBe(true);
  });
  test('blocks a duel within 24 hours of the last one', () => {
    const now = new Date('2026-06-08T12:00:00Z');
    expect(canDuel({ lastDuelAt: '2026-06-08T01:00:00Z' }, now)).toBe(false);
  });
  test('allows a duel 24 hours after the last one', () => {
    const now = new Date('2026-06-09T01:00:00Z');
    expect(canDuel({ lastDuelAt: '2026-06-08T01:00:00Z' }, now)).toBe(true);
  });
});

describe('fishAttemptsRemaining', () => {
  const now = new Date('2026-06-08T12:00:00Z');
  test('returns the full allotment for a user who has not fished today', () => {
    expect(fishAttemptsRemaining({ fishCount: 2, lastFishDate: '2026-06-07' }, now)).toBe(3);
  });
  test('returns the remaining attempts for a user who fished today', () => {
    expect(fishAttemptsRemaining({ fishCount: 2, lastFishDate: '2026-06-08' }, now)).toBe(1);
  });
  test('never returns a negative number', () => {
    expect(fishAttemptsRemaining({ fishCount: 5, lastFishDate: '2026-06-08' }, now)).toBe(0);
  });
});

describe('recordFishAttempt', () => {
  const now = new Date('2026-06-08T12:00:00Z');
  test('starts a fresh count when the stored date is not today', () => {
    expect(recordFishAttempt({ fishCount: 3, lastFishDate: '2026-06-07' }, now)).toEqual({
      fishCount: 1,
      lastFishDate: '2026-06-08',
    });
  });
  test('increments the count when the stored date is today', () => {
    expect(recordFishAttempt({ fishCount: 1, lastFishDate: '2026-06-08' }, now)).toEqual({
      fishCount: 2,
      lastFishDate: '2026-06-08',
    });
  });
});
