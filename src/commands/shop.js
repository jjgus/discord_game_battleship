const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { SHOP_ITEMS, purchaseItem } = require('../shop/items');

const data = new SlashCommandBuilder().setName('shop').setDescription('Browse and buy permanent upgrades');

const ITEMS_PER_ROW = 3;

const PURCHASE_FAILURE_MESSAGES = {
  unknown_item: "That item doesn't exist.",
  already_owned: 'You already own that item.',
  insufficient_points: "You don't have enough points for that.",
};

function buildShopRows(user) {
  const rows = [];
  SHOP_ITEMS.forEach((item, index) => {
    const rowIndex = Math.floor(index / ITEMS_PER_ROW);
    if (!rows[rowIndex]) {
      rows[rowIndex] = new ActionRowBuilder();
    }
    rows[rowIndex].addComponents(
      new ButtonBuilder()
        .setCustomId(`shop_buy_${item.id}`)
        .setLabel(`${item.emoji} ${item.name} (${item.price})`)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(user.ownedItems.includes(item.id) || user.points < item.price)
    );
  });
  return rows;
}

function describeItems() {
  return SHOP_ITEMS.map(
    (item) => `${item.emoji} **${item.name}** (${item.game}, ${item.price} pts)\n${item.description}`
  ).join('\n\n');
}

async function execute(interaction, { store }) {
  const user = store.getUser(interaction.user.id);
  await interaction.reply({
    content: `**Shop** — you have ${user.points} points\n\n${describeItems()}`,
    components: buildShopRows(user),
    ephemeral: true,
  });
}

async function handleButton(interaction, { store }) {
  const itemId = interaction.customId.replace('shop_buy_', '');
  const user = store.getUser(interaction.user.id);
  const result = purchaseItem(user, itemId);

  if (!result.ok) {
    await interaction.reply({ content: PURCHASE_FAILURE_MESSAGES[result.reason], ephemeral: true });
    return;
  }

  store.updateUser(interaction.user.id, result.updates);
  store.save();
  await interaction.reply({
    content: `Purchased! You now have ${result.updates.points} points.`,
    ephemeral: true,
  });
}

module.exports = { data, execute, handleButton };
