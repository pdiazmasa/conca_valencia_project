import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateFamily } from "./numberGuard.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const familiesDir = path.resolve(__dirname, "../src/data/families");

const files = fs
  .readdirSync(familiesDir)
  .filter((name) => name.endsWith(".json"))
  .sort();

if (files.length === 0) {
  console.error(`No family JSON files found in ${familiesDir}`);
  process.exit(1);
}

let hasErrors = false;

console.log(`Checking numbers and fact references across ${files.length} family files...\n`);

for (const file of files) {
  const fullPath = path.join(familiesDir, file);
  const raw = fs.readFileSync(fullPath, "utf8");
  const family = JSON.parse(raw);
  const result = validateFamily(family);

  if (result.ok) {
    console.log(`PASS  ${file} (${Object.keys(family.facts ?? {}).length} facts)`);
  } else {
    hasErrors = true;
    console.error(`FAIL  ${file}`);
    for (const err of result.errors) {
      console.error(`  - ${err}`);
    }
  }
}

console.log("");
if (hasErrors) {
  console.error("Number guard FAILED.");
  process.exit(1);
} else {
  console.log("Number guard PASSED: all displayed numbers match facts.");
}
