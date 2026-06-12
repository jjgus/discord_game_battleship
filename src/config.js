const REQUIRED_KEYS = [
  'DISCORD_TOKEN',
  'DISCORD_CLIENT_ID',
  'DISCORD_GUILD_ID',
  'JSONBIN_API_KEY',
  'JSONBIN_BIN_ID',
];

function loadConfig(env = process.env) {
  const missing = REQUIRED_KEYS.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    discordToken: env.DISCORD_TOKEN,
    discordClientId: env.DISCORD_CLIENT_ID,
    discordGuildId: env.DISCORD_GUILD_ID,
    jsonbinApiKey: env.JSONBIN_API_KEY,
    jsonbinBinId: env.JSONBIN_BIN_ID,
  };
}

module.exports = { loadConfig };
