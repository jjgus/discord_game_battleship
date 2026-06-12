const MIN_DELAY_MS = 30 * 1000;
const MAX_DELAY_MS = 2 * 60 * 1000;
const REEL_WINDOW_MS = 5000;
const BIG_CATCH_BONUS = 15;
const BASE_BIG_CATCH_CHANCE = 0.1;
const ITEM_BONUS_CHANCE = 0.1;

function randomDelayMs(randomImpl = Math.random) {
  return MIN_DELAY_MS + Math.floor(randomImpl() * (MAX_DELAY_MS - MIN_DELAY_MS));
}

function bigCatchChance({ hasBetterBait = false, hasGoldenLure = false } = {}) {
  let chance = BASE_BIG_CATCH_CHANCE;
  if (hasBetterBait) chance += ITEM_BONUS_CHANCE;
  if (hasGoldenLure) chance += ITEM_BONUS_CHANCE * 2;
  return chance;
}

function rollBigCatch(options, randomImpl = Math.random) {
  return randomImpl() < bigCatchChance(options);
}

module.exports = { MIN_DELAY_MS, MAX_DELAY_MS, REEL_WINDOW_MS, BIG_CATCH_BONUS, randomDelayMs, bigCatchChance, rollBigCatch };
