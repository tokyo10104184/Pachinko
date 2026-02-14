export type SymbolDef = {
  icon: string;
  weight: number;
  baseMultiplier: number;
};

const symbols: SymbolDef[] = [
  { icon: "🍒", weight: 30, baseMultiplier: 2 },
  { icon: "🍋", weight: 25, baseMultiplier: 3 },
  { icon: "🔔", weight: 20, baseMultiplier: 5 },
  { icon: "⭐", weight: 14, baseMultiplier: 8 },
  { icon: "💎", weight: 8, baseMultiplier: 15 },
  { icon: "7️⃣", weight: 3, baseMultiplier: 35 },
];

const wild = "🃏";
const scatter = "🎰";

function weightedRandom() {
  const total = symbols.reduce((acc, s) => acc + s.weight, 0) + 3;
  let roll = Math.random() * total;

  if (roll < 1.5) return wild;
  if (roll < 3) return scatter;
  roll -= 3;

  for (const symbol of symbols) {
    if (roll < symbol.weight) return symbol.icon;
    roll -= symbol.weight;
  }
  return symbols[0].icon;
}

function allSame(arr: string[]) {
  return arr.every((v) => v === arr[0]);
}

function count(arr: string[], target: string) {
  return arr.filter((s) => s === target).length;
}

export type SpinResult = {
  reels: string[];
  payout: number;
  description: string;
  freeSpins: number;
  jackpotHit: boolean;
};

export function spin(bet: number, jackpotAmount: number): SpinResult {
  const reels = [weightedRandom(), weightedRandom(), weightedRandom()];
  const scatters = count(reels, scatter);
  const wilds = count(reels, wild);

  let payout = 0;
  let freeSpins = 0;
  let description = "ハズレ…次こそ！";
  let jackpotHit = false;

  if (allSame(reels) && reels[0] !== scatter && reels[0] !== wild) {
    const def = symbols.find((s) => s.icon === reels[0]);
    payout = bet * (def?.baseMultiplier ?? 1);
    description = `${reels[0]}揃い! x${def?.baseMultiplier}`;
  }

  if (wilds >= 2) {
    const multi = wilds === 2 ? 6 : 25;
    payout = Math.max(payout, bet * multi);
    description = `ワイルドボーナス! x${multi}`;
  }

  if (scatters >= 2) {
    freeSpins = scatters === 2 ? 1 : 3;
    description += ` / フリースピン +${freeSpins}`;
    payout += Math.floor(bet * 0.5 * scatters);
  }

  if (reels.includes("7️⃣") && reels.includes("💎") && reels.includes(wild)) {
    payout = Math.max(payout, bet * 75);
    description = "アルティメット役! x75";
  }

  if (allSame(reels) && reels[0] === "7️⃣") {
    jackpotHit = Math.random() < 0.25;
    if (jackpotHit) {
      payout += jackpotAmount;
      description = `MEGA JACKPOT当選! +${jackpotAmount.toLocaleString()}G`;
    } else {
      payout = Math.max(payout, bet * 50);
      description = "777フィーバー! x50";
    }
  }

  return { reels, payout, description, freeSpins, jackpotHit };
}
