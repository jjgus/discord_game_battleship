function defaultUser() {
  return { points: 0, lastDuelAt: null, fishCount: 0, lastFishDate: null, ownedItems: [] };
}

function createStore({ jsonbinClient, baseUrl, binId, apiKey }) {
  let cache = { users: {} };

  async function load() {
    cache = await jsonbinClient.fetchBin({ baseUrl, binId, apiKey });
    if (!cache.users) {
      cache.users = {};
    }
    return cache;
  }

  function getUser(userId) {
    if (!cache.users[userId]) {
      cache.users[userId] = defaultUser();
    }
    return { ...cache.users[userId] };
  }

  function updateUser(userId, updates) {
    const user = cache.users[userId] || defaultUser();
    cache.users[userId] = { ...user, ...updates };
    return { ...cache.users[userId] };
  }

  function getAllUsers() {
    return cache.users;
  }

  async function save() {
    try {
      await jsonbinClient.updateBin({ baseUrl, binId, apiKey, data: cache });
    } catch (err) {
      console.error('JSONBin write failed:', err.message);
    }
  }

  return { load, getUser, updateUser, getAllUsers, save };
}

module.exports = { createStore };
