import dotenv from "dotenv";

dotenv.config();

const required = ["DISCORD_TOKEN", "CLIENT_ID"] as const;
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const config = {
  discordToken: process.env.DISCORD_TOKEN as string,
  clientId: process.env.CLIENT_ID as string,
  guildId: process.env.GUILD_ID,
  dbPath: process.env.DB_PATH ?? "./data/slotbot.db",
  startingBalance: Number(process.env.STARTING_BALANCE ?? 1000),
  dailyReward: Number(process.env.DAILY_REWARD ?? 1500),
  spinCooldownMs: Number(process.env.SPIN_COOLDOWN_MS ?? 10_000),
};
