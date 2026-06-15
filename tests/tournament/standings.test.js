const { computeStandings, formatStandings } = require('../../src/tournament/standings');

const tournament = {
  participants: ['alice', 'bob', 'charlie'],
  schedule: [
    { day: 1, date: '2026-06-15', matchups: [{ p1: 'alice', p2: 'bob', winner: 'alice' }] },
    { day: 2, date: '2026-06-16', matchups: [{ p1: 'bob', p2: 'charlie', winner: 'charlie' }] },
    { day: 3, date: '2026-06-17', matchups: [{ p1: 'alice', p2: 'charlie', winner: null }] },
  ],
};

describe('computeStandings', () => {
  test('tallies wins and losses from completed matches', () => {
    const standings = computeStandings(tournament);
    expect(standings.alice).toEqual({ wins: 1, losses: 0 });
    expect(standings.bob).toEqual({ wins: 0, losses: 2 });
    expect(standings.charlie).toEqual({ wins: 1, losses: 0 });
  });

  test('includes all participants even with zero matches played', () => {
    const empty = { participants: ['alice', 'bob'], schedule: [] };
    const standings = computeStandings(empty);
    expect(standings.alice).toEqual({ wins: 0, losses: 0 });
    expect(standings.bob).toEqual({ wins: 0, losses: 0 });
  });

  test('does not count unplayed matches', () => {
    const standings = computeStandings(tournament);
    const total = Object.values(standings).reduce((sum, s) => sum + s.wins + s.losses, 0);
    expect(total).toBe(4);
  });
});

describe('formatStandings', () => {
  test('sorts by wins descending', () => {
    const standings = { alice: { wins: 3, losses: 0 }, bob: { wins: 1, losses: 2 } };
    const lines = formatStandings(standings);
    expect(lines[0]).toContain('alice');
    expect(lines[1]).toContain('bob');
  });

  test('breaks win ties by losses ascending', () => {
    const standings = {
      alice: { wins: 2, losses: 1 },
      bob: { wins: 2, losses: 0 },
    };
    const lines = formatStandings(standings);
    expect(lines[0]).toContain('bob');
    expect(lines[1]).toContain('alice');
  });
});
