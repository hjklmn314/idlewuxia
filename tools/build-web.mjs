import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".");
const output = path.join(root, "www");
const entries = ["index.html", "src", "config", "public"];

fs.rmSync(output, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
fs.mkdirSync(output, { recursive: true });

for (const entry of entries) {
  const source = path.join(root, entry);
  if (!fs.existsSync(source)) throw new Error(`Missing web build input: ${entry}`);
  fs.cpSync(source, path.join(output, entry), { recursive: true });
}

const indexPath = path.join(output, "index.html");
const index = fs.readFileSync(indexPath, "utf8");
for (const requiredNode of ['id="app"', 'id="wuxiaShell"']) {
  if (!index.includes(requiredNode)) {
    throw new Error(`Wuxia web shell node is missing from web build: ${requiredNode}`);
  }
}

console.log(`Built Capacitor web assets at ${output}`);

