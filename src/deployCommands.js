require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { loadConfig } = require('./config');
const balance = require('./commands/balance');
const leaderboard = require('./commands/leaderboard');
const shop = require('./commands/shop');
const inventory = require('./commands/inventory');
const fish = require('./commands/fish');
const duel = require('./commands/duel');

async function main() {
  const config = loadConfig();
  const commands = [balance, leaderboard, shop, inventory, fish, duel].map((command) => command.data.toJSON());

  const rest = new REST().setToken(config.discordToken);
  await rest.put(Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId), { body: commands });
  console.log(`Registered ${commands.length} commands.`);
}

main().catch((error) => {
  console.error('Failed to register commands:', error);
  process.exit(1);
});
