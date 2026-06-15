const BYE = 'bye';

function generateSchedule(participants, startDateStr) {
  const players = [...participants];
  if (players.length % 2 !== 0) players.push(BYE);
  const n = players.length;
  const rounds = n - 1;
  const schedule = [];

  const fixed = players[0];
  const rotating = players.slice(1);

  for (let round = 0; round < rounds; round++) {
    const roundPlayers = [fixed, ...rotating];
    const matchups = [];
    for (let i = 0; i < n / 2; i++) {
      const p1 = roundPlayers[i];
      const p2 = roundPlayers[n - 1 - i];
      if (p1 !== BYE && p2 !== BYE) {
        matchups.push({ p1, p2, winner: null });
      }
    }

    const date = new Date(`${startDateStr}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + round);

    schedule.push({
      day: round + 1,
      date: date.toISOString().slice(0, 10),
      matchups,
    });

    rotating.unshift(rotating.pop());
  }

  return schedule;
}

function getTodaysEntry(tournament, now = new Date()) {
  if (!tournament || !tournament.active) return null;
  const today = now.toISOString().slice(0, 10);
  return tournament.schedule.find((d) => d.date === today) || null;
}

function getTodaysMatchup(tournament, userId, now = new Date()) {
  const entry = getTodaysEntry(tournament, now);
  if (!entry) return null;
  return entry.matchups.find((m) => m.p1 === userId || m.p2 === userId) || null;
}

function getOpponentForToday(tournament, userId, now = new Date()) {
  const matchup = getTodaysMatchup(tournament, userId, now);
  if (!matchup) return null;
  return matchup.p1 === userId ? matchup.p2 : matchup.p1;
}

function recordResult(tournament, winnerId, loserId, dateStr) {
  const schedule = tournament.schedule.map((day) => {
    if (day.date !== dateStr) return day;
    const matchups = day.matchups.map((m) => {
      const isThisMatch =
        (m.p1 === winnerId && m.p2 === loserId) ||
        (m.p1 === loserId && m.p2 === winnerId);
      return isThisMatch ? { ...m, winner: winnerId } : m;
    });
    return { ...day, matchups };
  });
  return { ...tournament, schedule };
}

module.exports = {
  generateSchedule,
  getTodaysEntry,
  getTodaysMatchup,
  getOpponentForToday,
  recordResult,
};
