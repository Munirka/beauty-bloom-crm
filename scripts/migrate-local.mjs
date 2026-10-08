import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const config = JSON.parse(await readFile("dist/server/wrangler.json", "utf8"));
const directory = resolve(root, ".sites-runtime");
await mkdir(directory, { recursive: true });
const configPath = resolve(directory, "migration-config.json");
await writeFile(
  configPath,
  JSON.stringify({
    name: config.name,
    compatibility_date: config.compatibility_date,
    d1_databases: config.d1_databases.map((database) => ({
      ...database,
      migrations_dir: resolve(root, "drizzle"),
    })),
  }),
);
const result = spawnSync(
  process.execPath,
  [
    "--import",
    resolve(root, "scripts/sites-env.mjs"),
    resolve(root, "node_modules/wrangler/bin/wrangler.js"),
    "d1",
    "migrations",
    "apply",
    "DB",
    "--local",
    "--config",
    configPath,
    "--persist-to",
    resolve(root, ".wrangler/state"),
  ],
  { stdio: "inherit" },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
