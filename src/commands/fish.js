const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { fishAttemptsRemaining, recordFishAttempt, MAX_FISH_PER_DAY } = require('../economy/limits');
const { fishingReward } = require('../economy/points');
const { randomDelayMs, REEL_WINDOW_MS, BIG_CATCH_BONUS, rollBigCatch } = require('../games/fishing/fishing');

const data = new SlashCommandBuilder().setName('fish').setDescription('Cast a line and try to catch a fish');

function reelButtonRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('fish_reel_in').setLabel('Reel In!').setStyle(ButtonStyle.Success)
  );
}

async function execute(interaction, { store }) {
  const user = store.getUser(interaction.user.id);

  if (fishAttemptsRemaining(user) <= 0) {
    await interaction.reply({
      content: `You've used all ${MAX_FISH_PER_DAY} of your fishing attempts for today. Come back after midnight UTC!`,
      ephemeral: true,
    });
    return;
  }

  const message = await interaction.reply({ content: 'Casting your line... 🎣', fetchReply: true });

  setTimeout(() => startBite(message, interaction.user.id, store), randomDelayMs());
}

async function startBite(message, userId, store) {
  const bitMessage = await message.edit({ content: 'Fish on! Reel it in!', components: [reelButtonRow()] });
  const castAt = Date.now();
  let collected = false;

  const collector = bitMessage.createMessageComponentCollector({
    filter: (buttonInteraction) => buttonInteraction.user.id === userId,
    time: REEL_WINDOW_MS,
    max: 1,
  });

  collector.on('collect', async (buttonInteraction) => {
    collected = true;
    await resolveCatch({ buttonInteraction, message: bitMessage, store, userId, reactionMs: Date.now() - castAt });
  });

  collector.on('end', async () => {
    if (!collected) {
      await resolveCatch({ buttonInteraction: null, message: bitMessage, store, userId, reactionMs: REEL_WINDOW_MS + 1 });
    }
  });
}

async function resolveCatch({ buttonInteraction, message, store, userId, reactionMs }) {
  const user = store.getUser(userId);
  const hasGoldenLure = user.ownedItems.includes('golden_lure');
  const hasBetterBait = user.ownedItems.includes('better_bait');

  let points = fishingReward(reactionMs, { hasGoldenLure });
  let bigCatch = false;
  if (points > 0 && rollBigCatch({ hasBetterBait, hasGoldenLure })) {
    points += BIG_CATCH_BONUS;
    bigCatch = true;
  }

  store.updateUser(userId, { ...recordFishAttempt(user), points: user.points + points });
  store.save();

  const summary =
    points > 0
      ? `You reeled it in${bigCatch ? ' — **a big catch!**' : ''} and earned **${points}** points!`
      : 'The fish got away this time!';

  if (buttonInteraction) {
    await buttonInteraction.update({ content: summary, components: [] });
  } else {
    await message.edit({ content: summary, components: [] });
  }
}

module.exports = { data, execute, resolveCatch };
