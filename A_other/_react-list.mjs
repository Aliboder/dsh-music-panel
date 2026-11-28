import { readFileSync } from 'node:fs'
const buf = readFileSync('D:/DeepSeek Harness/resources/app.asar')
const headerSize = buf.readUInt32LE(12)
const header = JSON.parse(buf.toString('utf8', 16, 16 + headerSize).replace(/\u0000+$/g, ''))
function walk(node, prefix) {
  const out = []
  for (const [name, entry] of Object.entries(node.files || {})) {
    const path = prefix + '/' + name
    if (entry.files) out.push(...walk(entry, path))
    else out.push(path)
  }
  return out
}
const all = walk(header, '')
const hits = all.filter(p => /node_modules\/react(-dom)?\/(package\.json|umd\/[^/]+|index\.js|cjs\/react-dom\.production\.min\.js)$/.test(p))
for (const h of hits.slice(0, 40)) console.log(h)
const pkg = all.filter(p => /node_modules\/react\/package\.json$/.test(p))
console.log('react packages:', pkg)