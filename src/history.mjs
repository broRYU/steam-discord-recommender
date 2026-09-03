import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function readHistory(path) {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw new Error(`投稿履歴を読み込めません: ${error.message}`);
  }
}

export async function appendHistory(path, recommendations, now = new Date()) {
  const history = await readHistory(path);
  const additions = recommendations.map(({ candidate, details }) => ({
    appId: candidate.id,
    name: details.name,
    postedAt: now.toISOString(),
  }));
  const next = [...history, ...additions].slice(-100);
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}
