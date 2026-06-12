const SHOP_ITEMS = [
  { id: 'lucky_compass', game: 'battleship', name: 'Lucky Compass', emoji: '🧭', price: 60, description: 'Slightly better odds of going first in a duel' },
  { id: 'reinforced_hull', game: 'battleship', name: 'Reinforced Hull', emoji: '🛡️', price: 150, description: 'One ship gains +1 cell of armor before it sinks' },
  { id: 'admirals_spyglass', game: 'battleship', name: "Admiral's Spyglass", emoji: '🔭', price: 280, description: 'Reveals one random enemy ship cell at the start of each duel' },
  { id: 'better_bait', game: 'fishing', name: 'Better Bait', emoji: '🪱', price: 60, description: 'Slightly increases the big-catch bonus chance' },
  { id: 'quality_rod', game: 'fishing', name: 'Quality Rod', emoji: '🎣', price: 150, description: 'Widens the fast-reaction window for top-tier rewards' },
  { id: 'golden_lure', game: 'fishing', name: 'Golden Lure', emoji: '✨', price: 280, description: 'Notably increases big-catch chance and guarantees a minimum reward' },
];

function findItem(itemId) {
  return SHOP_ITEMS.find((item) => item.id === itemId);
}

function purchaseItem(user, itemId) {
  const item = findItem(itemId);
  if (!item) return { ok: false, reason: 'unknown_item' };
  if (user.ownedItems.includes(itemId)) return { ok: false, reason: 'already_owned' };
  if (user.points < item.price) return { ok: false, reason: 'insufficient_points' };
  return { ok: true, updates: { points: user.points - item.price, ownedItems: [...user.ownedItems, itemId] } };
}

module.exports = { SHOP_ITEMS, findItem, purchaseItem };
