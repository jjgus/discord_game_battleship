require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { loadConfig } = require('./config');
const { createStore } = require('./storage/store');
const jsonbinClient = require('./storage/jsonbinClient');
const balance = require('./commands/balance');
const leaderboard = require('./commands/leaderboard');
const shop = require('./commands/shop');
const inventory = require('./commands/inventory');
const fish = require('./commands/fish');
const duel = require('./commands/duel');

const JSONBIN_BASE_URL = 'https://api.jsonbin.io/v3';

async function main() {
  const config = loadConfig();
  const store = createStore({
    jsonbinClient,
    baseUrl: JSONBIN_BASE_URL,
    binId: config.jsonbinBinId,
    apiKey: config.jsonbinApiKey,
  });
  await store.load();

  const context = { store, matches: new Map() };

  const commands = new Collection();
  [balance, leaderboard, shop, inventory, fish, duel].forEach((command) => commands.set(command.data.name, command));

  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages] });

  client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (command) {
        await command.execute(interaction, context);
      }
      return;
    }

    if (interaction.isButton()) {
      if (interaction.customId.startsWith('shop_buy_')) {
        await shop.handleButton(interaction, context);
      } else if (interaction.customId.startsWith('place_')) {
        await duel.handlePlacement(interaction, context);
      } else if (interaction.customId.startsWith('shoot_')) {
        await duel.handleShot(interaction, context);
      }
    }
  });

  client.once('clientReady', () => {
    console.log(`Logged in as ${client.user.tag}`);
  });

  await client.login(config.discordToken);
}

main().catch((error) => {
  console.error('Failed to start bot:', error);
  process.exit(1);
});
