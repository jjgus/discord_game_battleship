async function fetchBin({ baseUrl, binId, apiKey, fetchImpl = fetch }) {
  const response = await fetchImpl(`${baseUrl}/b/${binId}/latest`, {
    method: 'GET',
    headers: { 'X-Master-Key': apiKey },
  });

  if (!response.ok) {
    throw new Error(`JSONBin fetch failed with status ${response.status}`);
  }

  const body = await response.json();
  return body.record;
}

async function updateBin({ baseUrl, binId, apiKey, data, fetchImpl = fetch, timeoutMs = 5000 }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`${baseUrl}/b/${binId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': apiKey,
      },
      body: JSON.stringify(data),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`JSONBin update failed with status ${response.status}`);
    }

    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchBin, updateBin };
