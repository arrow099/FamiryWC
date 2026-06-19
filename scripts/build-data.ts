import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAppData } from "@/lib/app-data/buildAppData";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outputPath = join(root, "public", "data.json");

async function main() {
  const state = buildAppData({
    capturedAt: new Date().toISOString(),
  });

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  console.log(`Wrote ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
