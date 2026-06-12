const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { canDuel } = require('../economy/limits');
const { duelReward } = require('../economy/points');
const {
  createMatch,
  placeNextShip,
  bothPlayersReady,
  takeShot,
  SHIP_LENGTHS,
} = require('../games/battleship/duelManager');
const { GRID_SIZE } = require('../games/battleship/grid');

const CHALLENGE_TIMEOUT_MS = 60 * 1000;
const COLUMN_LETTERS = ['A', 'B', 'C', 'D', 'E'];

const data = new SlashCommandBuilder()
  .setName('duel')
  .setDescription('Challenge another user to a Battleship match')
  .addUserOption((option) => option.setName('opponent').setDescription('Who to challenge').setRequired(true));

function gridButtons(customIdPrefix) {
  const rows = [];
  for (let row = 0; row < GRID_SIZE; row += 1) {
    const actionRow = new ActionRowBuilder();
    for (let col = 0; col < GRID_SIZE; col += 1) {
      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`${customIdPrefix}_${row}_${col}`)
          .setLabel(`${COLUMN_LETTERS[col]}${row + 1}`)
          .setStyle(ButtonStyle.Secondary)
      );
    }
    rows.push(actionRow);
  }
  return rows;
}

async function execute(interaction, context) {
  const challenger = interaction.user;
  const opponent = interaction.options.getUser('opponent');

  if (opponent.id === challenger.id || opponent.bot) {
    await interaction.reply({ content: "You can't duel yourself or a bot.", ephemeral: true });
    return;
  }

  if (!canDuel(context.store.getUser(challenger.id))) {
    await interaction.reply({ content: "You've already dueled today. Try again tomorrow!", ephemeral: true });
    return;
  }

  const acceptRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`duel_accept_${challenger.id}_${opponent.id}`).setLabel('Accept').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`duel_decline_${challenger.id}_${opponent.id}`).setLabel('Decline').setStyle(ButtonStyle.Danger)
  );

  const message = await interaction.reply({
    content: `${opponent}, ${challenger} has challenged you to a Battleship duel! Do you accept?`,
    components: [acceptRow],
    fetchReply: true,
  });

  const collector = message.createMessageComponentCollector({
    filter: (buttonInteraction) => buttonInteraction.user.id === opponent.id,
    time: CHALLENGE_TIMEOUT_MS,
    max: 1,
  });

  collector.on('collect', async (buttonInteraction) => {
    if (buttonInteraction.customId.startsWith('duel_decline')) {
      await buttonInteraction.update({ content: `${opponent} declined the challenge.`, components: [] });
      return;
    }
    await buttonInteraction.update({ content: `${opponent} accepted! Check your DMs to place your ships.`, components: [] });
    await startMatch({ channelId: interaction.channelId, challenger, opponent, context });
  });

  collector.on('end', async (collected) => {
    if (collected.size === 0) {
      await message.edit({ content: `${opponent} didn't respond in time. Challenge expired.`, components: [] });
    }
  });
}

async function startMatch({ channelId, challenger, opponent, context }) {
  context.matches.set(channelId, createMatch(challenger.id, opponent.id));

  await Promise.all(
    [challenger, opponent].map((player) =>
      player.send({
        content:
          `Place your fleet (${SHIP_LENGTHS.join(', ')}-cell ships)! ` +
          `Tap a starting cell for ship #1 (${SHIP_LENGTHS[0]} cells, placed left-to-right).`,
        components: gridButtons(`place_${channelId}_${player.id}`),
      })
    )
  );
}

async function handlePlacement(buttonInteraction, context) {
  const [, channelId, userId, rowStr, colStr] = buttonInteraction.customId.split('_');
  const match = context.matches.get(channelId);
  if (!match) {
    await buttonInteraction.reply({ content: 'This match is no longer active.', ephemeral: true });
    return;
  }

  let updated;
  try {
    updated = placeNextShip(match, userId, {
      startRow: Number(rowStr),
      startCol: Number(colStr),
      orientation: 'horizontal',
    });
  } catch (error) {
    await buttonInteraction.reply({ content: "That ship won't fit there — try a different cell.", ephemeral: true });
    return;
  }
  context.matches.set(channelId, updated);

  const nextShipIndex = updated.fleets[userId].ships.length;
  if (nextShipIndex >= SHIP_LENGTHS.length) {
    await buttonInteraction.update({ content: 'Fleet placed! Waiting for your opponent...', components: [] });
  } else {
    await buttonInteraction.update({
      content: `Ship placed! Now place ship #${nextShipIndex + 1} (${SHIP_LENGTHS[nextShipIndex]} cells).`,
      components: gridButtons(`place_${channelId}_${userId}`),
    });
  }

  if (bothPlayersReady(updated)) {
    const channel = await buttonInteraction.client.channels.fetch(channelId);
    await announceTurn(channel, channelId, updated);
  }
}

async function announceTurn(channel, channelId, match) {
  await channel.send({
    content: `<@${match.turn}>, it's your turn! Pick a cell to fire at.`,
    components: gridButtons(`shoot_${channelId}_${match.turn}`),
  });
}

module.exports = { data, execute, handlePlacement, announceTurn };
