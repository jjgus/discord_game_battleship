const DUEL_WIN_POINTS = 50;
const DUEL_LOSS_POINTS = 10;
const QUALITY_ROD_FAST_THRESHOLD_MS = 1500;

const FISH_REWARD_TIERS = [
  { maxMs: 1000, points: 30 },
  { maxMs: 2000, points: 20 },
  { maxMs: 3000, points: 10 },
];

function duelReward(isWinner) {
  return isWinner ? DUEL_WIN_POINTS : DUEL_LOSS_POINTS;
}

function fishingReward(reactionMs, { hasGoldenLure = false, hasQualityRod = false } = {}) {
  if (hasQualityRod && reactionMs <= QUALITY_ROD_FAST_THRESHOLD_MS) {
    return FISH_REWARD_TIERS[0].points;
  }
  const tier = FISH_REWARD_TIERS.find((entry) => reactionMs <= entry.maxMs);
  if (tier) {
    return tier.points;
  }
  return hasGoldenLure ? FISH_REWARD_TIERS[FISH_REWARD_TIERS.length - 1].points : 0;
}

module.exports = { duelReward, fishingReward, DUEL_WIN_POINTS, DUEL_LOSS_POINTS, FISH_REWARD_TIERS, QUALITY_ROD_FAST_THRESHOLD_MS };
