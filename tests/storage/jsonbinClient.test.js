const { fetchBin, updateBin } = require('../../src/storage/jsonbinClient');

const baseUrl = 'https://api.jsonbin.io/v3';
const binId = 'bin123';
const apiKey = 'key123';

describe('fetchBin', () => {
  test('returns the record from a successful response', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ record: { users: {} } }),
    });

    const record = await fetchBin({ baseUrl, binId, apiKey, fetchImpl });

    expect(record).toEqual({ users: {} });
    expect(fetchImpl).toHaveBeenCalledWith(
      `${baseUrl}/b/${binId}/latest`,
      expect.objectContaining({ method: 'GET' })
    );
  });

  test('throws when the response is not ok', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 404 });

    await expect(fetchBin({ baseUrl, binId, apiKey, fetchImpl })).rejects.toThrow(
      'JSONBin fetch failed with status 404'
    );
  });
});

describe('updateBin', () => {
  test('sends a PUT request with the given data', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    const data = { users: { '123': { points: 10 } } };

    await updateBin({ baseUrl, binId, apiKey, data, fetchImpl });

    expect(fetchImpl).toHaveBeenCalledWith(
      `${baseUrl}/b/${binId}`,
      expect.objectContaining({ method: 'PUT', body: JSON.stringify(data) })
    );
  });

  test('throws when the response is not ok', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 500 });

    await expect(updateBin({ baseUrl, binId, apiKey, data: {}, fetchImpl })).rejects.toThrow(
      'JSONBin update failed with status 500'
    );
  });

  test('throws when the request times out', async () => {
    const fetchImpl = jest.fn().mockImplementation((_url, { signal }) =>
      new Promise((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      )
    );

    await expect(updateBin({ baseUrl, binId, apiKey, data: {}, fetchImpl, timeoutMs: 50 })).rejects.toThrow();
  });
});
