#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const archiveRoot = path.join(root, 'fangzhijianghu');
const outDir = path.join(root, 'outputs', 'idlewuxia_migration');
fs.mkdirSync(outDir, { recursive: true });

const importantDirs = [
  '竞品资料',
  path.join('竞品资料', '放置江湖apk'),
  path.join('竞品资料', '放置江湖_全量抓取'),
  'outputs',
  'data',
  'tools',
  'analysis_docs',
];

const extensions = new Map([
  ['.lua', 0],
  ['.json', 0],
  ['.csv', 0],
  ['.md', 0],
  ['.sqlite', 0],
  ['.db', 0],
  ['.apk', 0],
  ['.png', 0],
  ['.jpg', 0],
  ['.webp', 0],
]);

function walk(dir, visitor) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, visitor);
    } else if (entry.isFile()) {
      visitor(full);
    }
  }
}

function summarizeDir(rel) {
  const full = path.join(archiveRoot, rel);
  let files = 0;
  let bytes = 0;
  if (fs.existsSync(full)) {
    walk(full, (file) => {
      files += 1;
      bytes += fs.statSync(file).size;
    });
  }
  return { rel, exists: fs.existsSync(full), files, bytes };
}

const byDirectory = importantDirs.map(summarizeDir);
const keyFiles = [];
let totalFiles = 0;
let totalBytes = 0;

walk(archiveRoot, (file) => {
  totalFiles += 1;
  const stat = fs.statSync(file);
  totalBytes += stat.size;
  const ext = path.extname(file).toLowerCase();
  if (extensions.has(ext)) extensions.set(ext, extensions.get(ext) + 1);
  const base = path.basename(file).toLowerCase();
  if (
    base.includes('restored_query') ||
    base.includes('combat_mirror') ||
    base.includes('runtime_slim') ||
    base.includes('fightformula') ||
    base.includes('buff') ||
    base.includes('activezhao') ||
    base.includes('chapter1') ||
    base.includes('fb01')
  ) {
    keyFiles.push({
      rel: path.relative(root, file),
      bytes: stat.size,
      mtime: stat.mtime.toISOString(),
    });
  }
});

keyFiles.sort((a, b) => b.bytes - a.bytes);

const report = {
  schema: 'idlewuxia.fangzhijianghu_source_audit.v1',
  generatedAt: new Date().toISOString(),
  archiveRoot,
  totals: { files: totalFiles, bytes: totalBytes },
  byDirectory,
  byExtension: Object.fromEntries(extensions.entries()),
  keyFiles: keyFiles.slice(0, 200),
  nextActions: [
    'build first-session flow package from fangzhijianghu outputs and analysis_docs',
    'map chapter1/fb01 nodes into config/wuxia_first_session_flow.json',
    'map runtime_slim combat timeline into web combat playback data',
    'separate confirmed competitor evidence from project design proposals',
  ],
};

const jsonPath = path.join(outDir, 'fangzhijianghu_source_audit.json');
const mdPath = path.join(outDir, 'fangzhijianghu_source_audit.md');
fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');
fs.writeFileSync(
  mdPath,
  `# Fangzhi Jianghu Source Audit\n\n` +
    `Generated: ${report.generatedAt}\n\n` +
    `Archive: \`${archiveRoot}\`\n\n` +
    `## Totals\n\n` +
    `- Files: ${totalFiles}\n` +
    `- Bytes: ${totalBytes}\n\n` +
    `## Directory Coverage\n\n` +
    byDirectory.map((d) => `- \`${d.rel}\`: ${d.exists ? 'exists' : 'missing'}, files=${d.files}, bytes=${d.bytes}`).join('\n') +
    `\n\n## Extension Coverage\n\n` +
    Array.from(extensions.entries()).map(([ext, count]) => `- \`${ext}\`: ${count}`).join('\n') +
    `\n\n## Key Files Sample\n\n` +
    keyFiles.slice(0, 40).map((f) => `- \`${f.rel}\` (${f.bytes})`).join('\n') +
    `\n`,
  'utf8',
);

console.log(JSON.stringify({ ok: true, jsonPath, mdPath, totals: report.totals }, null, 2));
