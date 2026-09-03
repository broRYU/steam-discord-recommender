function truncate(text, max) {
  if (!text) return "説明はSteamストアで確認できます。";
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function yen(priceInCents) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format((priceInCents ?? 0) / 100);
}

function priceText(candidate, details) {
  if (details.is_free) return "無料";
  const price = details.price_overview;
  if (!price) return "価格未定";
  if (price?.discount_percent > 0) {
    return `${price.final_formatted}（${price.discount_percent}% OFF／通常 ${price.initial_formatted}）`;
  }
  return price?.final_formatted ?? yen(candidate.final_price);
}

function reason(candidate, details) {
  const parts = [];
  if (candidate.sources.includes("人気の近日登場")) parts.push("Steamの人気近日登場ランキング掲載");
  if (candidate.sources.includes("トップセラー")) parts.push("現在のトップセラー");
  if ((candidate.discount_percent ?? 0) >= 20) parts.push(`${candidate.discount_percent}% OFF`);
  const genres = (details.genres ?? []).slice(0, 3).map((genre) => genre.description);
  if (genres.length) parts.push(genres.join("・"));
  return parts.length ? parts.join(" / ") : candidate.sources.join(" / ");
}

export function buildPayload(recommendations) {
  const upcoming = recommendations.every(({ candidate }) => candidate.sources.includes("人気の近日登場"));
  return {
    username: "Steam おすすめ案内",
    content: upcoming
      ? "🚀 もうすぐリリースされるSteam注目ゲームです！"
      : "🎮 今日のSteamおすすめゲームです！",
    allowed_mentions: { parse: [] },
    embeds: recommendations.map(({ candidate, details }) => ({
      title: details.name,
      url: `https://store.steampowered.com/app/${candidate.id}/`,
      description: truncate(details.short_description, 350),
      color: 0x1b2838,
      fields: [
        { name: "おすすめポイント", value: reason(candidate, details), inline: false },
        ...(candidate.sources.includes("人気の近日登場")
          ? [{ name: "発売予定", value: details.release_date?.date || "近日登場", inline: true }]
          : []),
        { name: "価格", value: priceText(candidate, details), inline: true },
        { name: "対応OS", value: Object.entries(details.platforms ?? {}).filter(([, enabled]) => enabled).map(([name]) => name).join(" / ") || "不明", inline: true },
      ],
      image: details.header_image ? { url: details.header_image } : undefined,
      footer: {
        text: candidate.sources.includes("人気の近日登場")
          ? `Steam App ID: ${candidate.id} • 発売日・価格はストアでご確認ください`
          : `Steam App ID: ${candidate.id} • 価格・セール期間はストアでご確認ください`,
      },
    })),
  };
}

export async function postToDiscord(webhookUrl, payload) {
  const url = new URL(webhookUrl);
  url.searchParams.set("wait", "true");
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Discordへの投稿に失敗しました（HTTP ${response.status}: ${body.slice(0, 200)}）`);
  }
  return response.json();
}
