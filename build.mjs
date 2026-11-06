import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
const root = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(await fs.readFile(path.join(root, "data/manifest.json"), "utf8"));
const data = await fs.readFile(path.join(root, "data/contracts.json"));
if (createHash("sha256").update(data).digest("hex") !== manifest.dataSha256) throw new Error("Published dataset checksum mismatch");
const output = path.join(root, "site");
const files = ["index.html", "app.js", "styles.css", "data-model.js", "vendor/papaparse.js", "vendor/papaparse.LICENSE", "data/manifest.json", "data/contracts.json"];
// Only this fixed output directory is replaced; source data stays untouched.
await fs.rm(output, { recursive: true, force: true });
for (const file of files) {
  await fs.mkdir(path.dirname(path.join(output, file)), { recursive: true });
  await fs.copyFile(path.join(root, file), path.join(output, file));
}
console.log("Static dashboard prepared: " + manifest.version);
