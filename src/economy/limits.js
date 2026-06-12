const MAX_FISH_PER_DAY = 3;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function todayUtcDateString(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function canDuel(user, now = new Date()) {
  if (!user.lastDuelAt) return true;
  return now.getTime() - new Date(user.lastDuelAt).getTime() >= ONE_DAY_MS;
}

function fishAttemptsRemaining(user, now = new Date()) {
  if (user.lastFishDate !== todayUtcDateString(now)) return MAX_FISH_PER_DAY;
  return Math.max(0, MAX_FISH_PER_DAY - user.fishCount);
}

function recordFishAttempt(user, now = new Date()) {
  const today = todayUtcDateString(now);
  if (user.lastFishDate !== today) return { fishCount: 1, lastFishDate: today };
  return { fishCount: user.fishCount + 1, lastFishDate: today };
}

module.exports = { canDuel, fishAttemptsRemaining, recordFishAttempt, todayUtcDateString, MAX_FISH_PER_DAY };
