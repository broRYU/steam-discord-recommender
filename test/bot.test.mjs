import test from "node:test";
import assert from "node:assert/strict";
import { buildPayload } from "../src/discord.mjs";
import { collectCandidates, dailyNoise, parsePopularUpcoming } from "../src/steam.mjs";

const config = {
  excludedAppIds: new Set(),
  recommendationMode: "popular",
  allowFree: true,
  maxPrice: 5000,
  minDiscount: 0,
};

test("dailyNoise is stable for the same day", () => {
  const date = new Date("2026-09-01T12:00:00Z");
  assert.equal(dailyNoise(123, date), dailyNoise(123, date));
  assert.notEqual(dailyNoise(123, date), dailyNoise(124, date));
});

test("collectCandidates filters recent and expensive games", () => {
  const categories = {
    top_sellers: { items: [
      { id: 1, final_price: 1000, discount_percent: 0 },
      { id: 2, final_price: 600000, discount_percent: 0 },
      { id: 3, final_price: 1000, discount_percent: 0 },
    ] },
  };
  const candidates = collectCandidates(categories, config, [{ appId: 3 }]);
  assert.deepEqual(candidates.map((item) => item.id), [1]);
});

test("buildPayload disables mentions and creates store links", () => {
  const payload = buildPayload([{
    candidate: { id: 10, final_price: 120000, discount_percent: 20, sources: ["トップセラー"] },
    details: {
      name: "Example Game",
      short_description: "説明",
      platforms: { windows: true, mac: false, linux: true },
      genres: [{ description: "RPG" }],
      price_overview: { final_formatted: "¥ 1,200", initial_formatted: "¥ 1,500", discount_percent: 20 },
    },
  }]);
  assert.deepEqual(payload.allowed_mentions, { parse: [] });
  assert.equal(payload.embeds[0].url, "https://store.steampowered.com/app/10/");
  assert.match(payload.embeds[0].fields.find((field) => field.name === "価格").value, /20% OFF/);
});

test("upcoming mode only uses Steam coming soon games", () => {
  const categories = {
    popular_upcoming: { items: [{ id: 20, popularity_rank: 1 }] },
    top_sellers: { items: [{ id: 21, final_price: 1000, discount_percent: 0 }] },
  };
  const candidates = collectCandidates(categories, { ...config, recommendationMode: "upcoming", allowFree: false });
  assert.deepEqual(candidates.map((item) => item.id), [20]);
  assert.deepEqual(candidates[0].sources, ["人気の近日登場"]);
});

test("parsePopularUpcoming keeps Steam ranking order and removes duplicates", () => {
  const html = '<a data-ds-appid="30"></a><a data-ds-appid="20"></a><a data-ds-appid="30"></a>';
  assert.deepEqual(parsePopularUpcoming(html), [
    { id: 30, popularity_rank: 1 },
    { id: 20, popularity_rank: 2 },
  ]);
});

test("upcoming payload includes release date and unknown price", () => {
  const payload = buildPayload([{
    candidate: { id: 20, popularity_rank: 1, sources: ["人気の近日登場"] },
    details: {
      name: "Coming Soon Game",
      short_description: "説明",
      platforms: { windows: true },
      genres: [{ description: "アドベンチャー" }],
      release_date: { coming_soon: true, date: "2026年10月1日" },
    },
  }]);
  assert.match(payload.content, /もうすぐリリース/);
  assert.equal(payload.embeds[0].fields.find((field) => field.name === "発売予定").value, "2026年10月1日");
  assert.equal(payload.embeds[0].fields.find((field) => field.name === "価格").value, "価格未定");
});
