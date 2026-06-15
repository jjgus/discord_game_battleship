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
const { GRID_SIZE, cellKey } = require('../games/battleship/grid');
const { getOpponentForToday, getTodaysMatchup, recordResult } = require('../tournament/scheduler');
const { isMatchActiveInChannel } = require('../server/gameServer');

const CHALLENGE_TIMEOUT_MS = 5 * 60 * 1000;
const COLUMN_LETTERS = ['A', 'B', 'C', 'D', 'E'];

const data = new SlashCommandBuilder()
  .setName('duel')
  .setDescription('Challenge another user to a Battleship match')
  .addUserOption((option) => option.setName('opponent').setDescription('Who to challenge').setRequired(true));

function placementGridButtons(customIdPrefix, fleet) {
  const shipCells = new Set();
  fleet.ships.forEach((ship) => {
    ship.cells.forEach(({ row, col }) => shipCells.add(cellKey(row, col)));
  });

  const rows = [];
  for (let row = 0; row < GRID_SIZE; row += 1) {
    const actionRow = new ActionRowBuilder();
    for (let col = 0; col < GRID_SIZE; col += 1) {
      const isShip = shipCells.has(cellKey(row, col));
      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`${customIdPrefix}_${row}_${col}`)
          .setLabel(isShip ? '🚢' : `${COLUMN_LETTERS[col]}${row + 1}`)
          .setStyle(isShip ? ButtonStyle.Primary : ButtonStyle.Secondary)
          .setDisabled(isShip)
      );
    }
    rows.push(actionRow);
  }
  return rows;
}

function battleGridButtons(customIdPrefix, targetFleet, shotsFromShooter) {
  const hitCells = new Set();
  const armorPierceCells = new Set();

  targetFleet.ships.forEach((ship) => {
    ship.hits.forEach((key) => hitCells.add(key));
    if (ship.hits.length >= ship.cells.length && ship.armorLeft > 0) {
      ship.cells.forEach(({ row, col }) => armorPierceCells.add(cellKey(row, col)));
    }
  });

  const missedCells = new Set(shotsFromShooter.filter((key) => !hitCells.has(key)));

  const rows = [];
  for (let row = 0; row < GRID_SIZE; row += 1) {
    const actionRow = new ActionRowBuilder();
    for (let col = 0; col < GRID_SIZE; col += 1) {
      const key = cellKey(row, col);
      const isArmorTarget = armorPierceCells.has(key);
      const isHit = hitCells.has(key);
      const isMiss = missedCells.has(key);

      let label, style, disabled;
      if (isArmorTarget) {
        label = '🛡️'; style = ButtonStyle.Danger; disabled = false;
      } else if (isHit) {
        label = '💥'; style = ButtonStyle.Danger; disabled = true;
      } else if (isMiss) {
        label = '·'; style = ButtonStyle.Secondary; disabled = true;
      } else {
        label = `${COLUMN_LETTERS[col]}${row + 1}`; style = ButtonStyle.Secondary; disabled = false;
      }

      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`${customIdPrefix}_${row}_${col}`)
          .setLabel(label)
          .setStyle(style)
          .setDisabled(disabled)
      );
    }
    rows.push(actionRow);
  }
  return rows;
}

function fleetStatusText(fleet) {
  return fleet.ships.map((ship) => {
    const isSunk = ship.hits.length >= ship.cells.length && ship.armorLeft <= 0;
    if (isSunk) return '☠️';
    const hitBlocks = '🟥'.repeat(ship.hits.length);
    const intactBlocks = '⬜'.repeat(ship.cells.length - ship.hits.length);
    const armorTag = ship.armorLeft > 0 ? '🛡️' : '';
    return hitBlocks + intactBlocks + armorTag;
  }).join('  ');
}

function resolveFirstTurn(challengerId, opponentId, challengerItems, opponentItems) {
  const challengerHasCompass = challengerItems.includes('lucky_compass');
  const opponentHasCompass = opponentItems.includes('lucky_compass');
  if (challengerHasCompass && !opponentHasCompass) {
    return Math.random() < 0.7 ? challengerId : opponentId;
  }
  if (opponentHasCompass && !challengerHasCompass) {
    return Math.random() < 0.7 ? opponentId : challengerId;
  }
  return Math.random() < 0.5 ? challengerId : opponentId;
}

function getRandomShipCell(fleet) {
  const allCells = fleet.ships.flatMap((ship) => ship.cells);
  if (allCells.length === 0) return null;
  return allCells[Math.floor(Math.random() * allCells.length)];
}

async function execute(interaction, context) {
  const challenger = interaction.user;
  const opponent = interaction.options.getUser('opponent');

  if (opponent.id === challenger.id || opponent.bot) {
    await interaction.reply({ content: "You can't duel yourself or a bot.", ephemeral: true });
    return;
  }

  if (isMatchActiveInChannel(interaction.channelId)) {
    await interaction.reply({ content: 'A Battleship match is already running in this channel!', ephemeral: true });
    return;
  }

  const tournament = context.store.getTournament();
  if (tournament.active && tournament.participants.includes(challenger.id)) {
    const scheduledOpponentId = getOpponentForToday(tournament, challenger.id);
    if (!scheduledOpponentId) {
      await interaction.reply({
        content: "You don't have a scheduled match today — it's a bye day. Enjoy the rest!",
        ephemeral: true,
      });
      return;
    }
    if (opponent.id !== scheduledOpponentId) {
      await interaction.reply({
        content: `The tournament has assigned you to duel <@${scheduledOpponentId}> today. Challenge them instead!`,
        ephemeral: true,
      });
      return;
    }
    const matchup = getTodaysMatchup(tournament, challenger.id);
    if (matchup && matchup.winner) {
      await interaction.reply({
        content: "Today's tournament match has already been played.",
        ephemeral: true,
      });
      return;
    }
  }

  if (!canDuel(context.store.getUser(challenger.id))) {
    await interaction.reply({ content: "You've already dueled today. Try again tomorrow!", ephemeral: true });
    return;
  }

  if (!canDuel(context.store.getUser(opponent.id))) {
    await interaction.reply({
      content: `${opponent.username} has already dueled today and can't be challenged again until tomorrow.`,
      ephemeral: true,
    });
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
    try {
      await startMatch({ channelId: interaction.channelId, challenger, opponent, context });
    } catch (err) {
      console.error('startMatch failed:', err.message);
      await interaction.followUp({
        content: 'Could not start the match — make sure both players have DMs open and try again.',
      });
    }
  });

  collector.on('end', async (collected) => {
    if (collected.size === 0) {
      await message.edit({ content: `${opponent} didn't respond in time. Challenge expired.`, components: [] });
    }
  });
}

async function startMatch({ channelId, challenger, opponent, context }) {
  const challengerUser = context.store.getUser(challenger.id);
  const opponentUser = context.store.getUser(opponent.id);

  const firstTurn = resolveFirstTurn(
    challenger.id,
    opponent.id,
    challengerUser.ownedItems,
    opponentUser.ownedItems
  );

  const matchId = context.createWebMatch({
    channelId,
    challengerId: challenger.id,
    challengerName: challenger.username,
    opponentId: opponent.id,
    opponentName: opponent.username,
    items: {
      [challenger.id]: challengerUser.ownedItems,
      [opponent.id]: opponentUser.ownedItems,
    },
    firstTurn,
  });

  const makeUrl = (userId) => `${context.webUrl}/game/${matchId}?p=${userId}`;

  await Promise.all([
    challenger.send(`⚓ **Your Battleship game is ready!**\n[Click here to open the game](${makeUrl(challenger.id)})`),
    opponent.send(`⚓ **Your Battleship game is ready!**\n[Click here to open the game](${makeUrl(opponent.id)})`),
  ]);
}

async function handlePlacement(buttonInteraction, context) {
  const [, channelId, userId, rowStr, colStr] = buttonInteraction.customId.split('_');
  const match = context.matches.get(channelId);
  if (!match) {
    await buttonInteraction.reply({ content: 'This match is no longer active.', ephemeral: true });
    return;
  }

  if (buttonInteraction.user.id !== userId) {
    await buttonInteraction.reply({ content: "Those aren't your ships!", ephemeral: true });
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
      components: placementGridButtons(`place_${channelId}_${userId}`, updated.fleets[userId]),
    });
  }

  if (bothPlayersReady(updated)) {
    const channel = await buttonInteraction.client.channels.fetch(channelId);
    await announceMatchStart(channel, channelId, updated);
  }
}

async function announceMatchStart(channel, channelId, match) {
  const revealLines = match.players
    .filter((playerId) => (match.items[playerId] || []).includes('admirals_spyglass'))
    .map((playerId) => {
      const opponentId = match.players.find((id) => id !== playerId);
      const cell = getRandomShipCell(match.fleets[opponentId]);
      return cell
        ? `🔭 <@${playerId}>'s Admiral's Spyglass reveals the enemy has a ship at **${COLUMN_LETTERS[cell.col]}${cell.row + 1}**!`
        : null;
    })
    .filter(Boolean);

  if (revealLines.length > 0) {
    await channel.send(revealLines.join('\n'));
  }

  await announceTurn(channel, channelId, match);
}

async function announceTurn(channel, channelId, match) {
  const shooterId = match.turn;
  const targetId = match.players.find((id) => id !== shooterId);
  const shotsFromShooter = match.shots[shooterId] || [];
  const ownFleetStatus = fleetStatusText(match.fleets[shooterId]);
  await channel.send({
    content: `<@${shooterId}>, it's your turn! Pick a cell to fire at.\nYour fleet: ${ownFleetStatus}`,
    components: battleGridButtons(`shoot_${channelId}_${shooterId}`, match.fleets[targetId], shotsFromShooter),
  });
}

async function handleShot(buttonInteraction, context) {
  const [, channelId, shooterId, rowStr, colStr] = buttonInteraction.customId.split('_');

  const match = context.matches.get(channelId);
  if (!match) {
    await buttonInteraction.reply({ content: 'This match is no longer active.', ephemeral: true });
    return;
  }

  if (buttonInteraction.user.id !== shooterId || match.turn !== shooterId) {
    await buttonInteraction.reply({ content: "It's not your turn.", ephemeral: true });
    return;
  }

  const { match: updated, hit, sunk, targetId, alreadyFired } = takeShot(
    match, shooterId, Number(rowStr), Number(colStr)
  );

  if (alreadyFired) {
    await buttonInteraction.reply({ content: "You've already fired at that cell — pick a different one!", ephemeral: true });
    return;
  }

  context.matches.set(channelId, updated);

  await buttonInteraction.update({
    content: `<@${shooterId}> fired at ${COLUMN_LETTERS[Number(colStr)]}${Number(rowStr) + 1} — it was a **${hit ? 'HIT' : 'miss'}**!`,
    components: [],
  });

  if (sunk) {
    await finishMatch(buttonInteraction.channel, channelId, shooterId, targetId, context);
    return;
  }

  await announceTurn(buttonInteraction.channel, channelId, updated);
}

async function finishMatch(channel, channelId, winnerId, loserId, context) {
  context.matches.delete(channelId);

  const winnerPoints = duelReward(true);
  const loserPoints = duelReward(false);
  const now = new Date();
  const nowIso = now.toISOString();
  const winner = context.store.getUser(winnerId);
  const loser = context.store.getUser(loserId);

  context.store.updateUser(winnerId, { points: winner.points + winnerPoints, lastDuelAt: nowIso });
  context.store.updateUser(loserId, { points: loser.points + loserPoints, lastDuelAt: nowIso });

  const tournament = context.store.getTournament();
  if (tournament.active) {
    const today = nowIso.slice(0, 10);
    context.store.updateTournament(recordResult(tournament, winnerId, loserId, today));
  }

  context.store.save();

  await channel.send(
    `🎉 <@${winnerId}> sank <@${loserId}>'s fleet and wins **+${winnerPoints} points**! ` +
      `<@${loserId}> earns **+${loserPoints} points** for a good fight.`
  );
}

module.exports = { data, execute, handlePlacement, handleShot };
