const { SlashCommandBuilder } = require('discord.js');

const data = new SlashCommandBuilder().setName('balance').setDescription('Check your point balance');

async function execute(interaction, { store }) {
  const user = store.getUser(interaction.user.id);
  await interaction.reply({ content: `You have **${user.points}** points.`, ephemeral: true });
}

module.exports = { data, execute };
