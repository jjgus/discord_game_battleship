// tests/config.test.js
const { loadConfig } = require('../src/config');

describe('loadConfig', () => {
  test('returns config object when all required env vars are present', () => {
    const env = {
      DISCORD_TOKEN: 'token123',
      DISCORD_CLIENT_ID: 'client123',
      DISCORD_GUILD_ID: 'guild123',
      JSONBIN_API_KEY: 'key123',
      JSONBIN_BIN_ID: 'bin123',
    };

    const config = loadConfig(env);

    expect(config).toEqual({
      discordToken: 'token123',
      discordClientId: 'client123',
      discordGuildId: 'guild123',
      jsonbinApiKey: 'key123',
      jsonbinBinId: 'bin123',
    });
  });

  test('throws an error listing missing variables', () => {
    const env = { DISCORD_TOKEN: 'token123' };

    expect(() => loadConfig(env)).toThrow(
      'Missing required environment variables: DISCORD_CLIENT_ID, DISCORD_GUILD_ID, JSONBIN_API_KEY, JSONBIN_BIN_ID'
    );
  });
});
