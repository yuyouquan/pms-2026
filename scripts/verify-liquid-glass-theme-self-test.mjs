import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const scriptsDir = path.dirname(fileURLToPath(import.meta.url))
const verifier = path.join(scriptsDir, 'verify-liquid-glass-theme.mjs')
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pms-liquid-glass-theme-'))
const fixtureFile = path.join(fixtureRoot, 'src/components/BrandLiteralFixture.ts')
const roadmapFixtureFile = path.join(fixtureRoot, 'src/components/roadmap/RoadmapView.tsx')
const cssFixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pms-liquid-glass-css-'))
const repositoryCss = fs.readFileSync(path.join(scriptsDir, '../src/styles/globals.css'), 'utf8')

const validRootTokens = `:root {
  --pms-brand-strong: #5d49f6;
  --pms-brand: #7562ff;
  --pms-brand-soft: #ad98ee;
  --pms-brand-surface: #f5f3ff;
  --pms-brand-border: #dcd6ff;
  --pms-gradient-brand: linear-gradient(106deg, #5d49f6 0%, #7562ff 50%, #ad98ee 100%);
  --pms-page: #f4f6fb;
  --pms-surface-solid: #fff;
  --pms-surface-glass: rgb(255 255 255 / 76%);
  --pms-text-primary: #27243a;
  --pms-text-secondary: #625d70;
  --pms-text-tertiary: #817b90;
  --pms-border: #e6e3ef;
  --pms-radius-control: 8px;
  --pms-radius-surface: 12px;
  --pms-glass-filter: blur(14px) saturate(145%);
  --pms-shadow-glass: 0 12px 32px rgb(75 59 148 / 8%);
  --pms-shadow-floating: 0 22px 60px rgb(79 62 158 / 12%);
  --primary: var(--pms-brand-strong);
  --accent: var(--pms-brand);
  --text-primary: var(--pms-text-primary);
  --bg-primary: var(--pms-page);
  --border: var(--pms-border);
  --radius-md: var(--pms-radius-control);
  --shadow-md: var(--pms-shadow-glass);
}
`

function runVerifier(args) {
  return spawnSync(process.execPath, [verifier, ...args], { encoding: 'utf8' })
}

try {
  fs.mkdirSync(path.dirname(fixtureFile), { recursive: true })
  fs.writeFileSync(fixtureFile, "export const fixtureBrand = '#5D49F6'\n")

  const result = runVerifier(['--scan-root', fixtureRoot])

  assert.notEqual(result.status, 0, 'The raw-brand scanner must reject a fixture literal')
  assert.match(
    result.stderr,
    /src\/components\/BrandLiteralFixture\.ts: forbidden raw PMS brand literal\(s\): #5d49f6/i,
  )

  const cssFixture = path.join(cssFixtureRoot, 'src/styles/globals.css')
  fs.mkdirSync(path.dirname(cssFixture), { recursive: true })
  fs.writeFileSync(cssFixture, `${validRootTokens}.fixture { background: #5D49F6; }\n`)

  const cssResult = runVerifier(['--css-root', cssFixtureRoot])
  assert.notEqual(cssResult.status, 0, 'The CSS scanner must reject a brand literal outside :root')
  assert.match(
    cssResult.stderr,
    /src\/styles\/globals\.css: raw PMS brand literal\(s\) outside :root: #5d49f6/i,
  )

  fs.writeFileSync(cssFixture, repositoryCss)
  const validCssResult = runVerifier(['--css-root', cssFixtureRoot])
  assert.equal(
    validCssResult.status,
    0,
    `The verifier's built-in mutation suite must pass for valid CSS:\n${validCssResult.stderr}`,
  )

  fs.writeFileSync(fixtureFile, "export const roadmapBrand = '#f5f3ff'\n")
  const baselineResult = runVerifier(['--scan-root', fixtureRoot])
  assert.notEqual(baselineResult.status, 0, 'The raw-brand scanner must reject the former roadmap baseline literal')
  assert.match(
    baselineResult.stderr,
    /src\/components\/BrandLiteralFixture\.ts: forbidden raw PMS brand literal\(s\): #f5f3ff/i,
  )

  fs.mkdirSync(path.dirname(roadmapFixtureFile), { recursive: true })
  fs.writeFileSync(roadmapFixtureFile, "export const legacyAlphaBrand = '#6366F180'\n")
  const alphaHexResult = runVerifier(['--scan-root', fixtureRoot])
  assert.notEqual(alphaHexResult.status, 0, 'The legacy scanner must reject an eight-digit hex literal')
  assert.match(
    alphaHexResult.stderr,
    /src\/components\/roadmap\/RoadmapView\.tsx: legacy brand literal\(s\): #6366F180/,
  )

  fs.writeFileSync(roadmapFixtureFile, "export const safeAlphaBrand = '#6365F180'\n")
  const safeAlphaHexResult = runVerifier(['--scan-root', fixtureRoot])
  assert.doesNotMatch(
    safeAlphaHexResult.stderr,
    /src\/components\/roadmap\/RoadmapView\.tsx: legacy brand literal/,
    'The legacy scanner must not reject a neighboring non-legacy eight-digit hex literal',
  )
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true })
  fs.rmSync(cssFixtureRoot, { recursive: true, force: true })
}

console.log('Liquid glass theme verifier self-test passed')
