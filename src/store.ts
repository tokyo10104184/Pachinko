import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export type UserAccount = {
  userId: string;
  balance: number;
  totalSpins: number;
  totalWon: number;
  totalLost: number;
  biggestWin: number;
  lastDailyAt: number;
  lastSpinAt: number;
  streakDays: number;
};

export class Store {
  private db: Database.Database;

  constructor(dbPath: string, private readonly startingBalance: number) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.initialize();
  }

  private initialize() {
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        balance INTEGER NOT NULL,
        total_spins INTEGER NOT NULL DEFAULT 0,
        total_won INTEGER NOT NULL DEFAULT 0,
        total_lost INTEGER NOT NULL DEFAULT 0,
        biggest_win INTEGER NOT NULL DEFAULT 0,
        last_daily_at INTEGER NOT NULL DEFAULT 0,
        last_spin_at INTEGER NOT NULL DEFAULT 0,
        streak_days INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS jackpot (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        amount INTEGER NOT NULL
      );

      INSERT OR IGNORE INTO jackpot (id, amount) VALUES (1, 5000);
    `);
  }

  getOrCreateUser(userId: string): UserAccount {
    const get = this.db.prepare("SELECT * FROM users WHERE user_id = ?");
    const row = get.get(userId) as any;
    if (row) return this.mapUser(row);

    this.db
      .prepare("INSERT INTO users (user_id, balance) VALUES (?, ?)")
      .run(userId, this.startingBalance);

    return {
      userId,
      balance: this.startingBalance,
      totalSpins: 0,
      totalWon: 0,
      totalLost: 0,
      biggestWin: 0,
      lastDailyAt: 0,
      lastSpinAt: 0,
      streakDays: 0,
    };
  }

  private mapUser(row: any): UserAccount {
    return {
      userId: row.user_id,
      balance: row.balance,
      totalSpins: row.total_spins,
      totalWon: row.total_won,
      totalLost: row.total_lost,
      biggestWin: row.biggest_win,
      lastDailyAt: row.last_daily_at,
      lastSpinAt: row.last_spin_at,
      streakDays: row.streak_days,
    };
  }

  updateAfterSpin(userId: string, nextBalance: number, bet: number, payout: number, now: number) {
    const deltaWon = Math.max(0, payout - bet);
    const deltaLost = Math.max(0, bet - payout);

    this.db
      .prepare(`
        UPDATE users
        SET
          balance = ?,
          total_spins = total_spins + 1,
          total_won = total_won + ?,
          total_lost = total_lost + ?,
          biggest_win = MAX(biggest_win, ?),
          last_spin_at = ?
        WHERE user_id = ?
      `)
      .run(nextBalance, deltaWon, deltaLost, payout, now, userId);
  }

  canClaimDaily(user: UserAccount, now: number): { canClaim: boolean; remainingMs: number } {
    const interval = 24 * 60 * 60 * 1000;
    const elapsed = now - user.lastDailyAt;
    return elapsed >= interval
      ? { canClaim: true, remainingMs: 0 }
      : { canClaim: false, remainingMs: interval - elapsed };
  }

  claimDaily(userId: string, reward: number, now: number) {
    const user = this.getOrCreateUser(userId);
    const lastDate = new Date(user.lastDailyAt).toDateString();
    const nowDate = new Date(now).toDateString();
    const yesterdayDate = new Date(now - 24 * 60 * 60 * 1000).toDateString();

    let nextStreak = 1;
    if (lastDate === yesterdayDate) nextStreak = user.streakDays + 1;
    if (lastDate === nowDate) nextStreak = user.streakDays;

    this.db
      .prepare(
        `UPDATE users SET balance = balance + ?, last_daily_at = ?, streak_days = ? WHERE user_id = ?`
      )
      .run(reward, now, nextStreak, userId);

    return nextStreak;
  }

  getJackpot() {
    const row = this.db.prepare("SELECT amount FROM jackpot WHERE id = 1").get() as { amount: number };
    return row.amount;
  }

  addJackpot(amount: number) {
    this.db.prepare("UPDATE jackpot SET amount = amount + ? WHERE id = 1").run(amount);
  }

  consumeJackpot() {
    const amount = this.getJackpot();
    this.db.prepare("UPDATE jackpot SET amount = 5000 WHERE id = 1").run();
    return amount;
  }

  topBalances(limit = 10) {
    return this.db
      .prepare("SELECT user_id, balance, total_spins, biggest_win FROM users ORDER BY balance DESC LIMIT ?")
      .all(limit) as Array<{ user_id: string; balance: number; total_spins: number; biggest_win: number }>;
  }
}
