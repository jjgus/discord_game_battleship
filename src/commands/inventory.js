const { SlashCommandBuilder } = require('discord.js');
const { findItem } = require('../shop/items');

const data = new SlashCommandBuilder().setName('inventory').setDescription('View your owned upgrades');

async function execute(interaction, { store }) {
  const user = store.getUser(interaction.user.id);

  if (user.ownedItems.length === 0) {
    await interaction.reply({
      content: "You don't own any upgrades yet. Check `/shop` to buy some!",
      ephemeral: true,
    });
    return;
  }

  const lines = user.ownedItems.map((itemId) => {
    const item = findItem(itemId);
    if (!item) return `❓ Unknown item (${itemId})`;
    return `${item.emoji} **${item.name}** — ${item.description}`;
  });

  await interaction.reply({ content: `**Your upgrades**\n${lines.join('\n')}`, ephemeral: true });
}

module.exports = { data, execute };
