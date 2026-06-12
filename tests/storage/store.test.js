const { createStore } = require('../../src/storage/store');

function buildClient(initialRecord = { users: {} }) {
  return {
    fetchBin: jest.fn().mockResolvedValue(initialRecord),
    updateBin: jest.fn().mockResolvedValue({}),
  };
}

describe('store', () => {
  test('load fetches the bin and populates the cache', async () => {
    const client = buildClient({
      users: { '1': { points: 10, lastDuelAt: null, fishCount: 0, lastFishDate: null, ownedItems: [] } },
    });
    const store = createStore({ jsonbinClient: client, baseUrl: 'url', binId: 'bin', apiKey: 'key' });

    await store.load();

    expect(store.getUser('1').points).toBe(10);
    expect(client.fetchBin).toHaveBeenCalledTimes(1);
  });

  test('getUser creates a default record for unknown users', async () => {
    const client = buildClient();
    const store = createStore({ jsonbinClient: client, baseUrl: 'url', binId: 'bin', apiKey: 'key' });
    await store.load();

    const user = store.getUser('new-user');

    expect(user).toEqual({
      points: 0,
      lastDuelAt: null,
      fishCount: 0,
      lastFishDate: null,
      ownedItems: [],
    });
  });

  test('updateUser merges updates into the existing record', async () => {
    const client = buildClient();
    const store = createStore({ jsonbinClient: client, baseUrl: 'url', binId: 'bin', apiKey: 'key' });
    await store.load();
    store.getUser('1');

    const updated = store.updateUser('1', { points: 50 });

    expect(updated.points).toBe(50);
    expect(updated.ownedItems).toEqual([]);
  });

  test('save writes the full cache to JSONBin', async () => {
    const client = buildClient();
    const store = createStore({ jsonbinClient: client, baseUrl: 'url', binId: 'bin', apiKey: 'key' });
    await store.load();
    store.updateUser('1', { points: 50 });

    await store.save();

    expect(client.updateBin).toHaveBeenCalledTimes(1);
  });

  test('save logs and swallows errors so the caller is not interrupted', async () => {
    const client = buildClient();
    client.updateBin = jest.fn().mockRejectedValue(new Error('network error'));
    const store = createStore({ jsonbinClient: client, baseUrl: 'url', binId: 'bin', apiKey: 'key' });
    await store.load();

    await expect(store.save()).resolves.toBeUndefined();
  });
});
