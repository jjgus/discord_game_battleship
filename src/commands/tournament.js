const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { generateSchedule, getTodaysMatchup, getOpponentForToday, getTodaysEntry } = require('../tournament/scheduler');
const { computeStandings, formatStandings } = require('../tournament/standings');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(dateStr) {
  const [, m, d] = dateStr.split('-');
  return `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`;
}

const data = new SlashCommandBuilder()
  .setName('tournament')
  .setDescription('Tournament management')
  .addSubcommand((sub) =>
    sub.setName('register').setDescription('Register yourself for the upcoming tournament')
  )
  .addSubcommand((sub) =>
    sub
      .setName('begin')
      .setDescription('Start the tournament with all registered players (admin only)')
      .addStringOption((opt) =>
        opt
          .setName('start_date')
          .setDescription('Start date in YYYY-MM-DD format (defaults to today UTC)')
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub.setName('today').setDescription("See today's matchup and your opponent")
  )
  .addSubcommand((sub) =>
    sub.setName('standings').setDescription('View current tournament standings')
  )
  .addSubcommand((sub) =>
    sub.setName('schedule').setDescription('View the full tournament schedule')
  )
  .addSubcommand((sub) =>
    sub.setName('stop').setDescription('Stop the tournament and clear all data (admin only)')
  );

async function execute(interaction, { store }) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'register') return handleRegister(interaction, store);
  if (sub === 'begin') return handleBegin(interaction, store);
  if (sub === 'stop') return handleStop(interaction, store);
  if (sub === 'today') return handleToday(interaction, store);
  if (sub === 'standings') return handleStandings(interaction, store);
  if (sub === 'schedule') return handleSchedule(interaction, store);
}

async function handleRegister(interaction, store) {
  const tournament = store.getTournament();
  const userId = interaction.user.id;

  if (tournament.active) {
    await interaction.reply({ content: 'The tournament has already started — registration is closed.', ephemeral: true });
    return;
  }

  if (tournament.pendingParticipants.includes(userId)) {
    await interaction.reply({ content: "You're already registered! Wait for an admin to start the tournament.", ephemeral: true });
    return;
  }

  store.updateTournament({
    pendingParticipants: [...tournament.pendingParticipants, userId],
  });
  store.save();

  const count = tournament.pendingParticipants.length + 1;
  await interaction.reply({
    content: `✅ You're registered for the tournament! **${count}** player${count === 1 ? '' : 's'} signed up so far.`,
    ephemeral: true,
  });
}

async function handleBegin(interaction, store) {
  if (!interaction.memberPermissions || !interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: 'Only administrators can start the tournament.', ephemeral: true });
    return;
  }

  const tournament = store.getTournament();

  if (tournament.active) {
    await interaction.reply({ content: 'A tournament is already running.', ephemeral: true });
    return;
  }

  const participants = tournament.pendingParticipants;
  if (participants.length < 2) {
    await interaction.reply({ content: `Not enough players registered — need at least 2, have ${participants.length}.`, ephemeral: true });
    return;
  }

  const startDate = interaction.options.getString('start_date') || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    await interaction.reply({ content: 'Invalid date format — use YYYY-MM-DD.', ephemeral: true });
    return;
  }

  const schedule = generateSchedule(participants, startDate);
  store.updateTournament({
    active: true,
    startDate,
    announcementChannelId: interaction.channelId,
    participants,
    pendingParticipants: [],
    schedule,
  });
  store.save();

  const rounds = schedule.length;
  const endDate = schedule[rounds - 1].date;

  await interaction.reply(
    `🏆 **Tournament started!** ${participants.length} players, ${rounds} rounds.\n` +
    `📅 Runs from **${formatDate(startDate)}** to **${formatDate(endDate)}**.\n` +
    `Use \`/tournament today\` to see your daily matchup. Daily matchups will be posted here each morning.`
  );
}

async function handleStop(interaction, store) {
  if (!interaction.memberPermissions || !interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: 'Only administrators can stop the tournament.', ephemeral: true });
    return;
  }

  const tournament = store.getTournament();
  if (!tournament.active && tournament.pendingParticipants.length === 0) {
    await interaction.reply({ content: 'No tournament is currently running or pending.', ephemeral: true });
    return;
  }

  store.updateTournament({
    active: false,
    startDate: null,
    announcementChannelId: null,
    pendingParticipants: [],
    participants: [],
    schedule: [],
  });
  store.save();

  await interaction.reply('🛑 **Tournament stopped.** All registration and match data has been cleared. Players can register again with `/tournament register`.');
}

async function handleToday(interaction, store) {
  const tournament = store.getTournament();
  const userId = interaction.user.id;

  if (!tournament.active) {
    await interaction.reply({ content: 'No tournament is currently running.', ephemeral: true });
    return;
  }

  if (!tournament.participants.includes(userId)) {
    await interaction.reply({ content: "You're not a participant in this tournament.", ephemeral: true });
    return;
  }

  const entry = getTodaysEntry(tournament);
  if (!entry) {
    await interaction.reply({ content: 'No matches are scheduled for today — the tournament may have ended.', ephemeral: true });
    return;
  }

  const matchup = getTodaysMatchup(tournament, userId);
  if (!matchup) {
    await interaction.reply({
      content: `📅 **Day ${entry.day} — ${formatDate(entry.date)}**\nYou have a bye today. No duel scheduled.`,
      ephemeral: true,
    });
    return;
  }

  const opponentId = matchup.p1 === userId ? matchup.p2 : matchup.p1;
  const resultLine = matchup.winner
    ? `\n✅ Result: ${matchup.winner === userId ? '**You won!**' : '**You lost.**'}`
    : `\n⚔️ Challenge them with \`/duel <@${opponentId}>\``;

  await interaction.reply({
    content: `📅 **Day ${entry.day} — ${formatDate(entry.date)}**\nYour opponent today: <@${opponentId}>${resultLine}`,
    ephemeral: true,
  });
}

async function handleStandings(interaction, store) {
  const tournament = store.getTournament();

  if (!tournament.active) {
    await interaction.reply({ content: 'No tournament is currently running.', ephemeral: true });
    return;
  }

  const standings = computeStandings(tournament);
  const lines = formatStandings(standings);

  const played = tournament.schedule.filter((d) => d.matchups.some((m) => m.winner)).length;
  const total = tournament.schedule.length;

  await interaction.reply(
    `🏆 **Tournament Standings** (Day ${played}/${total})\n${lines.join('\n')}`
  );
}

async function handleSchedule(interaction, store) {
  const tournament = store.getTournament();

  if (!tournament.active) {
    await interaction.reply({ content: 'No tournament is currently running.', ephemeral: true });
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const chunks = [];
  let current = `📅 **Tournament Schedule** (${tournament.participants.length} players)\n`;

  for (const day of tournament.schedule) {
    const isPast = day.date < today;
    const isToday = day.date === today;
    const prefix = isToday ? '▶️' : isPast ? '✅' : '🔜';
    const matchLines = day.matchups.map((m) => {
      const result = m.winner ? ` → <@${m.winner}> won` : '';
      return `  <@${m.p1}> vs <@${m.p2}>${result}`;
    });
    const dayLine = `${prefix} **Day ${day.day}** (${formatDate(day.date)})\n${matchLines.join('\n')}\n`;

    if (current.length + dayLine.length > 1900) {
      chunks.push(current);
      current = dayLine;
    } else {
      current += dayLine;
    }
  }
  if (current.trim()) chunks.push(current);

  await interaction.reply({ content: chunks[0], ephemeral: true });
  for (const chunk of chunks.slice(1)) {
    await interaction.followUp({ content: chunk, ephemeral: true });
  }
}

module.exports = { data, execute };
