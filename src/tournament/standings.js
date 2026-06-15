function computeStandings(tournament) {
  const standings = {};
  tournament.participants.forEach((p) => {
    standings[p] = { wins: 0, losses: 0 };
  });

  tournament.schedule.forEach((day) => {
    day.matchups.forEach((m) => {
      if (!m.winner) return;
      const loser = m.winner === m.p1 ? m.p2 : m.p1;
      if (standings[m.winner]) standings[m.winner].wins += 1;
      if (standings[loser]) standings[loser].losses += 1;
    });
  });

  return standings;
}

function formatStandings(standings) {
  return Object.entries(standings)
    .sort(([, a], [, b]) => b.wins - a.wins || a.losses - b.losses)
    .map(([userId, { wins, losses }], i) => `${i + 1}. <@${userId}> — ${wins}W ${losses}L`);
}

module.exports = { computeStandings, formatStandings };
