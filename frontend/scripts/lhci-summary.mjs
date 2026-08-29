// Prints a compact Lighthouse scores table from a `lhci collect` run so the
// workflow job summary shows a clear, human-readable result.
//
//   node frontend/scripts/lhci-summary.mjs [lighthouseci_dir]
//
// Defaults to frontend/.lighthouseci. Reads the collected LHR JSONs, computes
// the median category score per URL and appends the table to $GITHUB_STEP_SUMMARY
// when set (GitHub Actions), otherwise prints to stdout.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const defaultDir = fileURLToPath(new URL('../.lighthouseci', import.meta.url))
const lhciDir = process.argv[2] ?? defaultDir

if (!fs.existsSync(lhciDir)) {
  console.error(`No Lighthouse output at ${lhciDir} — collect step may have failed.`)
  process.exit(1)
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

const urls = new Map()
for (const file of fs.readdirSync(lhciDir)) {
  if (!file.endsWith('.json')) continue
  const raw = JSON.parse(fs.readFileSync(path.join(lhciDir, file), 'utf8'))
  if (!raw.categories) continue
  urls.set(raw.finalUrl, raw) // LHR JSON, keyed by URL
}

// Rebuild runs per URL (multiple runs share the same finalUrl).
const runsByUrl = new Map()
for (const file of fs.readdirSync(lhciDir)) {
  if (!file.endsWith('.json')) continue
  const raw = JSON.parse(fs.readFileSync(path.join(lhciDir, file), 'utf8'))
  if (!raw.categories) continue
  const url = raw.finalUrl
  if (!runsByUrl.has(url)) runsByUrl.set(url, { performance: [], accessibility: [], bp: [], seo: [] })
  const bucket = runsByUrl.get(url)
  bucket.performance.push(raw.categories.performance?.score ?? 0)
  bucket.accessibility.push(raw.categories.accessibility?.score ?? 0)
  bucket.bp.push(raw.categories['best-practices']?.score ?? 0)
  bucket.seo.push(raw.categories.seo?.score ?? 0)
}

let links = {}
try {
  links = JSON.parse(fs.readFileSync(path.join(lhciDir, 'links.json'), 'utf8'))
} catch {
  links = {}
}

const fmt = (v) => Math.round(v * 100)

const lines = []
lines.push('## Lighthouse CI')
lines.push('')
lines.push('| Страница | Performance | Accessibility | Best Practices | SEO | Отчёт |')
lines.push('|---|---|---|---|---|---|')
for (const [url, bucket] of runsByUrl) {
  lines.push(
    `| ${url} | ${fmt(median(bucket.performance))} | ${fmt(median(bucket.accessibility))} | ` +
      `${fmt(median(bucket.bp))} | ${fmt(median(bucket.seo))} | ${links[url] ? `[открыть](${links[url]})` : '—'} |`,
  )
}
lines.push('')
lines.push('Полные HTML-отчёты — в артефакте `lighthouse-reports` (каталог `.lighthouseci/`).')

const output = lines.join('\n')

if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, output + '\n')
}

console.log(output)