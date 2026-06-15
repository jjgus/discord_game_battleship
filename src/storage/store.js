function defaultUser() {
  return { points: 0, lastDuelAt: null, fishCount: 0, lastFishDate: null, ownedItems: [] };
}

function defaultTournament() {
  return {
    active: false,
    startDate: null,
    announcementChannelId: null,
    pendingParticipants: [],
    participants: [],
    schedule: [],
  };
}

function createStore({ jsonbinClient, baseUrl, binId, apiKey }) {
  let cache = { users: {}, tournament: defaultTournament() };

  async function load() {
    const data = await jsonbinClient.fetchBin({ baseUrl, binId, apiKey });
    cache = { users: {}, tournament: defaultTournament(), ...data };
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
    return { ...cache.users };
  }

  function getTournament() {
    return { ...cache.tournament };
  }

  function updateTournament(updates) {
    cache.tournament = { ...cache.tournament, ...updates };
    return { ...cache.tournament };
  }

  async function save() {
    try {
      await jsonbinClient.updateBin({ baseUrl, binId, apiKey, data: cache });
    } catch (err) {
      console.error('JSONBin write failed:', err.message);
    }
  }

  return { load, getUser, updateUser, getAllUsers, getTournament, updateTournament, save };
}

module.exports = { createStore };
