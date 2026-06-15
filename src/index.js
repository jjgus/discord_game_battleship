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
const tournament = require('./commands/tournament');
const { getTodaysEntry } = require('./tournament/scheduler');
const { startGameServer, createWebMatch } = require('./server/gameServer');

const JSONBIN_BASE_URL = 'https://api.jsonbin.io/v3';
const DAILY_CHECK_INTERVAL_MS = 60 * 1000;

async function postDailyMatchups(client, store) {
  const t = store.getTournament();
  if (!t.active || !t.announcementChannelId) return;

  const entry = getTodaysEntry(t);
  if (!entry) return;

  try {
    const channel = await client.channels.fetch(t.announcementChannelId);
    const lines = entry.matchups.map((m) => `⚔️ <@${m.p1}> vs <@${m.p2}>`);
    await channel.send(
      `📅 **Tournament — Day ${entry.day}** (${entry.date})\n${lines.join('\n')}\n` +
      `Use \`/duel @opponent\` to play your match today!`
    );
  } catch (err) {
    console.error('Daily announcement failed:', err.message);
  }
}

async function main() {
  const config = loadConfig();
  const store = createStore({
    jsonbinClient,
    baseUrl: JSONBIN_BASE_URL,
    binId: config.jsonbinBinId,
    apiKey: config.jsonbinApiKey,
  });

  const port = parseInt(process.env.PORT || '3000', 10);
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages] });

  // Bind the port BEFORE store.load() so Railway's health check never gets connection refused
  startGameServer({ port, store, discordClient: client });

  // Load persisted data after the server is already listening
  await store.load();

  const rawWebUrl = process.env.WEB_URL || `http://localhost:${port}`;
  const webUrl = rawWebUrl.startsWith('http') ? rawWebUrl : `https://${rawWebUrl}`;
  const context = {
    store,
    fishingSessions: new Set(),
    webUrl,
    createWebMatch: (opts) => createWebMatch({ ...opts }),
  };

  const commands = new Collection();
  [balance, leaderboard, shop, inventory, fish, duel, tournament].forEach((command) =>
    commands.set(command.data.name, command)
  );

  client.on('interactionCreate', async (interaction) => {
    try {
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
        }
      }
    } catch (err) {
      console.error('Interaction error:', err.message);
      const reply = { content: 'Something went wrong — please try again.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply).catch(() => {});
      } else {
        await interaction.reply(reply).catch(() => {});
      }
    }
  });

  client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);

    let lastAnnouncedDate = null;
    setInterval(async () => {
      const today = new Date().toISOString().slice(0, 10);
      if (lastAnnouncedDate === today) return;
      lastAnnouncedDate = today;
      await postDailyMatchups(client, store);
    }, DAILY_CHECK_INTERVAL_MS);
  });

  await client.login(config.discordToken);
}

main().catch((error) => {
  console.error('Failed to start bot:', error);
  process.exit(1);
});
