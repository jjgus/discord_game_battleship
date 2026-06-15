const {
  generateSchedule,
  getTodaysMatchup,
  getOpponentForToday,
  recordResult,
} = require('../../src/tournament/scheduler');

describe('generateSchedule', () => {
  test('produces N-1 rounds for an even number of players', () => {
    const schedule = generateSchedule(['a', 'b', 'c', 'd'], '2026-06-15');
    expect(schedule).toHaveLength(3);
  });

  test('produces N-1 rounds for an odd number of players (bye added)', () => {
    const schedule = generateSchedule(['a', 'b', 'c'], '2026-06-15');
    expect(schedule).toHaveLength(3);
  });

  test('assigns sequential dates starting from startDate', () => {
    const schedule = generateSchedule(['a', 'b', 'c', 'd'], '2026-06-15');
    expect(schedule[0].date).toBe('2026-06-15');
    expect(schedule[1].date).toBe('2026-06-16');
    expect(schedule[2].date).toBe('2026-06-17');
  });

  test('every player appears in exactly one matchup per round', () => {
    const players = ['a', 'b', 'c', 'd'];
    const schedule = generateSchedule(players, '2026-06-15');
    schedule.forEach((day) => {
      const appeared = new Set();
      day.matchups.forEach((m) => {
        expect(appeared.has(m.p1)).toBe(false);
        expect(appeared.has(m.p2)).toBe(false);
        appeared.add(m.p1);
        appeared.add(m.p2);
      });
    });
  });

  test('every pair plays exactly once in a full round-robin', () => {
    const players = ['a', 'b', 'c', 'd'];
    const schedule = generateSchedule(players, '2026-06-15');
    const pairs = new Set();
    schedule.forEach((day) => {
      day.matchups.forEach((m) => {
        const key = [m.p1, m.p2].sort().join('|');
        expect(pairs.has(key)).toBe(false);
        pairs.add(key);
      });
    });
    expect(pairs.size).toBe(6);
  });

  test('bye matchups are excluded from the schedule', () => {
    const schedule = generateSchedule(['a', 'b', 'c'], '2026-06-15');
    schedule.forEach((day) => {
      day.matchups.forEach((m) => {
        expect(m.p1).not.toBe('bye');
        expect(m.p2).not.toBe('bye');
      });
    });
  });
});

describe('getTodaysMatchup', () => {
  const tournament = {
    active: true,
    schedule: [
      { day: 1, date: '2026-06-15', matchups: [{ p1: 'alice', p2: 'bob', winner: null }] },
      { day: 2, date: '2026-06-16', matchups: [{ p1: 'alice', p2: 'charlie', winner: null }] },
    ],
  };

  test('returns the matchup for a player on the correct date', () => {
    const now = new Date('2026-06-15T10:00:00Z');
    expect(getTodaysMatchup(tournament, 'alice', now)).toEqual({ p1: 'alice', p2: 'bob', winner: null });
  });

  test('returns null when the player has no matchup today', () => {
    const now = new Date('2026-06-15T10:00:00Z');
    expect(getTodaysMatchup(tournament, 'charlie', now)).toBeNull();
  });

  test('returns null when tournament is inactive', () => {
    const now = new Date('2026-06-15T10:00:00Z');
    expect(getTodaysMatchup({ ...tournament, active: false }, 'alice', now)).toBeNull();
  });
});

describe('getOpponentForToday', () => {
  const tournament = {
    active: true,
    schedule: [
      { day: 1, date: '2026-06-15', matchups: [{ p1: 'alice', p2: 'bob', winner: null }] },
    ],
  };

  test('returns the opponent for p1', () => {
    const now = new Date('2026-06-15T10:00:00Z');
    expect(getOpponentForToday(tournament, 'alice', now)).toBe('bob');
  });

  test('returns the opponent for p2', () => {
    const now = new Date('2026-06-15T10:00:00Z');
    expect(getOpponentForToday(tournament, 'bob', now)).toBe('alice');
  });

  test('returns null when no matchup today', () => {
    const now = new Date('2026-06-16T10:00:00Z');
    expect(getOpponentForToday(tournament, 'alice', now)).toBeNull();
  });
});

describe('recordResult', () => {
  const tournament = {
    active: true,
    schedule: [
      { day: 1, date: '2026-06-15', matchups: [{ p1: 'alice', p2: 'bob', winner: null }] },
    ],
  };

  test('records the winner for the correct day', () => {
    const updated = recordResult(tournament, 'alice', 'bob', '2026-06-15');
    expect(updated.schedule[0].matchups[0].winner).toBe('alice');
  });

  test('works regardless of which player won (p2 wins)', () => {
    const updated = recordResult(tournament, 'bob', 'alice', '2026-06-15');
    expect(updated.schedule[0].matchups[0].winner).toBe('bob');
  });

  test('does not mutate the original tournament', () => {
    recordResult(tournament, 'alice', 'bob', '2026-06-15');
    expect(tournament.schedule[0].matchups[0].winner).toBeNull();
  });
});
