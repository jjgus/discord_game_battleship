const { SlashCommandBuilder } = require('discord.js');

const data = new SlashCommandBuilder().setName('leaderboard').setDescription("Show the server's top point-holders");

const TOP_COUNT = 10;

async function execute(interaction, { store }) {
  const ranked = Object.entries(store.getAllUsers())
    .sort((a, b) => b[1].points - a[1].points)
    .slice(0, TOP_COUNT);

  if (ranked.length === 0) {
    await interaction.reply('No one has earned any points yet!');
    return;
  }

  const lines = ranked.map(([userId, userData], index) => `${index + 1}. <@${userId}> — ${userData.points} points`);
  await interaction.reply(`**Leaderboard**\n${lines.join('\n')}`);
}

module.exports = { data, execute };
