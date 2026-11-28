// 抓取 deepseek-ai/deepseek-harness 的 docs/ 到本目录。
// 用法：node docs/official/_fetch.mjs [--force] [--concurrency=6]
// 默认只补缺失文件；--force 重新下载全部（用于跟随上游更新）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = 'deepseek-ai/deepseek-harness';
const BRANCH = 'master';
const OUT = path.dirname(fileURLToPath(import.meta.url));
const FORCE = process.argv.includes('--force');
const concArg = process.argv.find((a) => a.startsWith('--concurrency='));
const CONCURRENCY = Math.max(1, Number(concArg ? concArg.split('=')[1] : 6) || 6);

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'dsh-docs-mirror' } });
  if (!res.ok) throw new Error('GET ' + url + ' -> ' + res.status);
  return res.json();
}

async function getText(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'dsh-docs-mirror' } });
      if (!res.ok) throw new Error('GET ' + url + ' -> ' + res.status);
      return await res.text();
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }
}

const commit = (await getJson('https://api.github.com/repos/' + REPO + '/commits/' + BRANCH)).sha;
const tree = await getJson('https://api.github.com/repos/' + REPO + '/git/trees/' + BRANCH + '?recursive=1');
if (tree.truncated) console.warn('WARN: tree truncated by GitHub, list may be incomplete');

const files = tree.tree
  .filter((t) => t.type === 'blob' && t.path.startsWith('docs/') && t.path.endsWith('.md'))
  .map((t) => t.path.replace(/^docs\//, ''));
console.log('commit ' + commit.slice(0, 8) + ', docs files: ' + files.length + ', force: ' + FORCE);

let downloaded = 0;
let kept = 0;
const failed = [];
const queue = files.slice();

async function worker() {
  while (queue.length) {
    const rel = queue.shift();
    const dest = path.join(OUT, rel);
    if (!FORCE && fs.existsSync(dest)) { kept++; continue; }
    try {
      const text = await getText('https://raw.githubusercontent.com/' + REPO + '/' + commit + '/docs/' + rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, text, 'utf8');
      downloaded++;
    } catch (err) {
      failed.push(rel + ': ' + String(err).slice(0, 120));
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const meta = { repo: REPO, branch: BRANCH, commit, fetchedAt: new Date().toISOString(), files, failed };
fs.writeFileSync(path.join(OUT, '_meta.json'), JSON.stringify(meta, null, 2), 'utf8');
console.log('downloaded: ' + downloaded + ', kept: ' + kept + ', failed: ' + failed.length);
if (failed.length) console.log(failed.join('\n'));