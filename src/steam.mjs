const STORE_BASE = "https://store.steampowered.com";

async function getJson(url, label) {
  const response = await fetch(url, {
    headers: { "user-agent": "steam-discord-recommender/1.0" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`${label}の取得に失敗しました（HTTP ${response.status}）`);
  return response.json();
}

export function dailyNoise(appId, date = new Date()) {
  const day = date.toISOString().slice(0, 10);
  let hash = 2166136261;
  for (const char of `${day}:${appId}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

export function collectCandidates(categories, config, history = []) {
  const sources = config.recommendationMode === "upcoming"
    ? [["人気の近日登場", categories.popular_upcoming?.items ?? [], 60]]
    : [
        ["トップセラー", categories.top_sellers?.items ?? [], 45],
        ["スペシャル", categories.specials?.items ?? [], 30],
        ["新作", categories.new_releases?.items ?? [], 18],
      ];
  const byId = new Map();

  for (const [source, items, sourceScore] of sources) {
    for (const item of items) {
      if (!Number.isInteger(item.id) || config.excludedAppIds.has(item.id)) continue;
      const current = byId.get(item.id) ?? { ...item, sources: [], score: 0 };
      current.sources.push(source);
      current.score += sourceScore;
      if (source === "人気の近日登場") {
        current.score += Math.max(0, 50 - (item.popularity_rank ?? 50));
      }
      current.score += Math.max(0, item.discount_percent ?? 0) * 0.7;
      current.score += dailyNoise(item.id) * (source === "人気の近日登場" ? 10 : 25);
      byId.set(item.id, current);
    }
  }

  const recentIds = new Set(history.slice(-100).map((entry) => entry.appId));
  return [...byId.values()]
    .filter((item) => {
      const price = item.final_price ?? 0;
      const isFree = price === 0;
      return !recentIds.has(item.id)
        && (config.recommendationMode === "upcoming" || config.allowFree || !isFree)
        && price <= config.maxPrice * 100
        && (config.recommendationMode === "upcoming" || (item.discount_percent ?? 0) >= config.minDiscount);
    })
    .sort((a, b) => b.score - a.score);
}

export async function fetchFeatured(config) {
  if (config.recommendationMode === "upcoming") {
    const url = new URL("/search/results/", STORE_BASE);
    url.searchParams.set("query", "");
    url.searchParams.set("start", "0");
    url.searchParams.set("count", "50");
    url.searchParams.set("sort_by", "_ASC");
    url.searchParams.set("supportedlang", config.language);
    url.searchParams.set("filter", "popularcomingsoon");
    url.searchParams.set("infinite", "1");
    url.searchParams.set("cc", config.countryCode);
    url.searchParams.set("l", config.language);
    const result = await getJson(url, "Steam人気の近日登場一覧");
    return { popular_upcoming: { items: parsePopularUpcoming(result.results_html ?? "") } };
  }

  const url = new URL("/api/featuredcategories", STORE_BASE);
  url.searchParams.set("cc", config.countryCode);
  url.searchParams.set("l", config.language);
  return getJson(url, "Steamおすすめ一覧");
}

export function parsePopularUpcoming(html) {
  const seen = new Set();
  const items = [];
  for (const match of html.matchAll(/data-ds-appid="(\d+)"/g)) {
    const id = Number(match[1]);
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({ id, popularity_rank: items.length + 1 });
  }
  return items;
}

export async function fetchAppDetails(appId, config) {
  const url = new URL("/api/appdetails", STORE_BASE);
  url.searchParams.set("appids", String(appId));
  url.searchParams.set("cc", config.countryCode);
  url.searchParams.set("l", config.language);
  const result = await getJson(url, `App ${appId} の詳細`);
  return result[String(appId)]?.success ? result[String(appId)].data : null;
}

function ageNumber(requiredAge) {
  if (typeof requiredAge === "number") return requiredAge;
  const match = String(requiredAge ?? "0").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

export async function selectRecommendations(candidates, config) {
  const selected = [];
  for (const candidate of candidates.slice(0, 30)) {
    try {
      const details = await fetchAppDetails(candidate.id, config);
      if (!details || details.type !== "game") continue;
      if (config.recommendationMode === "upcoming" && !details.release_date?.coming_soon) continue;
      if (!config.allowMature && ageNumber(details.required_age) > 0) continue;
      selected.push({ candidate, details });
      if (selected.length >= config.postCount) break;
    } catch (error) {
      console.warn(`App ${candidate.id} を候補から除外: ${error.message}`);
    }
  }
  return selected;
}
