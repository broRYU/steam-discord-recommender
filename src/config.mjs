import { existsSync, readFileSync } from "node:fs";

export function loadDotEnv(path = ".env") {
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

function integer(name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} は ${min}〜${max} の整数で指定してください`);
  }
  return value;
}

function boolean(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  if (["1", "true", "yes", "on"].includes(raw.toLowerCase())) return true;
  if (["0", "false", "no", "off"].includes(raw.toLowerCase())) return false;
  throw new Error(`${name} は true または false で指定してください`);
}

function choice(name, fallback, allowed) {
  const value = (process.env[name] ?? fallback).toLowerCase();
  if (!allowed.includes(value)) {
    throw new Error(`${name} は ${allowed.join(" または ")} で指定してください`);
  }
  return value;
}

function webhookUrl(raw, required) {
  if (!raw) {
    if (required) throw new Error("DISCORD_WEBHOOK_URL が設定されていません");
    return "";
  }
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("DISCORD_WEBHOOK_URL の形式が正しくありません");
  }
  const validHost = parsed.hostname === "discord.com" || parsed.hostname.endsWith(".discord.com") || parsed.hostname === "discordapp.com";
  if (parsed.protocol !== "https:" || !validHost || !/^\/api\/webhooks\/[^/]+\/[^/]+/.test(parsed.pathname)) {
    throw new Error("DISCORD_WEBHOOK_URL はDiscordのHTTPS Webhook URLを指定してください");
  }
  return raw;
}

export function getConfig({ cliDryRun = false } = {}) {
  const dryRun = cliDryRun || boolean("DRY_RUN", false);
  const excludedAppIds = new Set(
    (process.env.EXCLUDE_APP_IDS ?? "")
      .split(",")
      .map((value) => Number(value.trim()))
      .filter(Number.isInteger),
  );

  return {
    webhookUrl: webhookUrl(process.env.DISCORD_WEBHOOK_URL, !dryRun),
    countryCode: (process.env.COUNTRY_CODE ?? "JP").toUpperCase(),
    language: process.env.LANGUAGE ?? "japanese",
    recommendationMode: choice("RECOMMENDATION_MODE", "upcoming", ["upcoming", "popular"]),
    maxPrice: integer("MAX_PRICE_YEN", 5000),
    minDiscount: integer("MIN_DISCOUNT_PERCENT", 0, { min: 0, max: 100 }),
    postCount: integer("POST_COUNT", 1, { min: 1, max: 10 }),
    allowFree: boolean("ALLOW_FREE_GAMES", true),
    allowMature: boolean("ALLOW_MATURE_GAMES", false),
    excludedAppIds,
    dryRun,
  };
}
