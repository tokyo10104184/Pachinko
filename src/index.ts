import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { config } from "./config";
import { Store } from "./store";
import { spin } from "./slot";

const store = new Store(config.dbPath, config.startingBalance);

const commands = [
  new SlashCommandBuilder().setName("slot").setDescription("スロットを回す")
    .addIntegerOption((opt) => opt.setName("bet").setDescription("賭け金").setRequired(true).setMinValue(10)),
  new SlashCommandBuilder().setName("balance").setDescription("所持金を見る"),
  new SlashCommandBuilder().setName("daily").setDescription("デイリーボーナスを受け取る"),
  new SlashCommandBuilder().setName("jackpot").setDescription("現在のジャックポット額を見る"),
  new SlashCommandBuilder().setName("rank").setDescription("所持金ランキング"),
  new SlashCommandBuilder().setName("help_slot").setDescription("遊び方を表示"),
].map((c) => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(config.discordToken);
  const route = config.guildId
    ? Routes.applicationGuildCommands(config.clientId, config.guildId)
    : Routes.applicationCommands(config.clientId);

  await rest.put(route, { body: commands });
}

function msToReadable(ms: number) {
  const h = Math.floor(ms / (60 * 60 * 1000));
  const m = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  return `${h}時間${m}分`;
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", () => {
  console.log(`Logged in as ${client.user?.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const userId = interaction.user.id;
  const user = store.getOrCreateUser(userId);

  if (interaction.commandName === "balance") {
    await interaction.reply(`💰 所持金: **${user.balance.toLocaleString()} G**`);
    return;
  }

  if (interaction.commandName === "jackpot") {
    await interaction.reply(`👑 現在のJACKPOT: **${store.getJackpot().toLocaleString()} G**`);
    return;
  }

  if (interaction.commandName === "rank") {
    const rows = store.topBalances(10);
    const body = rows
      .map((r, i) => `${i + 1}. <@${r.user_id}> - ${r.balance.toLocaleString()} G (最大勝利 ${r.biggest_win.toLocaleString()} G)`)
      .join("\n");
    await interaction.reply({ content: `🏆 **所持金ランキング**\n${body}` });
    return;
  }

  if (interaction.commandName === "daily") {
    const now = Date.now();
    const can = store.canClaimDaily(user, now);
    if (!can.canClaim) {
      await interaction.reply({ content: `まだ受け取れません。次回まで **${msToReadable(can.remainingMs)}**`, ephemeral: true });
      return;
    }

    const bonus = config.dailyReward + Math.floor(user.streakDays * 100);
    const streak = store.claimDaily(userId, bonus, now);
    await interaction.reply(`🎁 デイリー報酬 **${bonus.toLocaleString()} G** 獲得! (連続${streak}日)`);
    return;
  }

  if (interaction.commandName === "help_slot") {
    const embed = new EmbedBuilder()
      .setTitle("🎰 Pachinko Slot BOT ガイド")
      .setDescription("/slot bet:<金額> で遊べます。")
      .addFields(
        { name: "役", value: "777: x50、💎7️⃣🃏: x75、同一絵柄: x2〜x35" },
        { name: "特殊", value: "🃏2個以上で高倍率、🎰2個以上でフリースピン" },
        { name: "経済", value: "各スピンの2%がジャックポットに積み立て" },
      )
      .setColor(0xe67e22);

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (interaction.commandName === "slot") {
    const bet = interaction.options.getInteger("bet", true);
    const now = Date.now();

    if (bet > user.balance) {
      await interaction.reply({ content: "残高不足です。/daily か低いbetを試してください。", ephemeral: true });
      return;
    }

    if (now - user.lastSpinAt < config.spinCooldownMs) {
      const left = config.spinCooldownMs - (now - user.lastSpinAt);
      await interaction.reply({ content: `クールダウン中: あと${Math.ceil(left / 1000)}秒`, ephemeral: true });
      return;
    }

    let totalPayout = 0;
    let totalBet = bet;
    let freeSpins = 0;
    const logs: string[] = [];

    store.addJackpot(Math.max(1, Math.floor(bet * 0.02)));

    const first = spin(bet, store.getJackpot());
    totalPayout += first.payout;
    freeSpins += first.freeSpins;
    logs.push(`[1] ${first.reels.join(" | ")} -> ${first.description} (${first.payout}G)`);
    if (first.jackpotHit) {
      store.consumeJackpot();
    }

    for (let i = 0; i < freeSpins; i++) {
      const fs = spin(0, store.getJackpot());
      totalPayout += fs.payout;
      logs.push(`[FREE ${i + 1}] ${fs.reels.join(" | ")} -> ${fs.description} (${fs.payout}G)`);
      if (fs.jackpotHit) {
        store.consumeJackpot();
      }
    }

    const nextBalance = user.balance - totalBet + totalPayout;
    store.updateAfterSpin(userId, nextBalance, totalBet, totalPayout, now);

    const diff = totalPayout - totalBet;
    const color = diff >= 0 ? 0x2ecc71 : 0xe74c3c;
    const embed = new EmbedBuilder()
      .setTitle("🎰 SLOT RESULT")
      .setDescription(logs.join("\n").slice(0, 4000))
      .addFields(
        { name: "BET", value: `${totalBet.toLocaleString()} G`, inline: true },
        { name: "PAYOUT", value: `${totalPayout.toLocaleString()} G`, inline: true },
        { name: "収支", value: `${diff >= 0 ? "+" : ""}${diff.toLocaleString()} G`, inline: true },
        { name: "残高", value: `${nextBalance.toLocaleString()} G`, inline: true },
        { name: "JACKPOT", value: `${store.getJackpot().toLocaleString()} G`, inline: true },
      )
      .setColor(color);

    await interaction.reply({ embeds: [embed] });
  }
});

(async () => {
  await registerCommands();
  await client.login(config.discordToken);
})();
