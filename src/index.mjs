import { resolve } from "node:path";
import { loadDotEnv, getConfig } from "./config.mjs";
import { buildPayload, postToDiscord } from "./discord.mjs";
import { appendHistory, readHistory } from "./history.mjs";
import { collectCandidates, fetchFeatured, selectRecommendations } from "./steam.mjs";

const historyPath = resolve("data/history.json");

async function main() {
  loadDotEnv();
  const config = getConfig({ cliDryRun: process.argv.includes("--dry-run") });
  const history = await readHistory(historyPath);
  const categories = await fetchFeatured(config);
  const candidates = collectCandidates(categories, config, history);
  const recommendations = await selectRecommendations(candidates, config);

  if (!recommendations.length) {
    throw new Error("条件に合う未投稿のゲームが見つかりませんでした。価格・割引率・除外設定を緩めてください");
  }

  const payload = buildPayload(recommendations);
  if (config.dryRun) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  await postToDiscord(config.webhookUrl, payload);
  await appendHistory(historyPath, recommendations);
  console.log(`${recommendations.map(({ details }) => details.name).join("、")} をDiscordへ投稿しました`);
}

main().catch((error) => {
  console.error(`エラー: ${error.message}`);
  process.exitCode = 1;
});
