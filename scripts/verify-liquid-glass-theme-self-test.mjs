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

try {
  fs.mkdirSync(path.dirname(fixtureFile), { recursive: true })
  fs.writeFileSync(fixtureFile, "export const fixtureBrand = '#5D49F6'\n")

  const result = spawnSync(process.execPath, [verifier, '--scan-root', fixtureRoot], {
    encoding: 'utf8',
  })

  assert.notEqual(result.status, 0, 'The raw-brand scanner must reject a fixture literal')
  assert.match(
    result.stderr,
    /src\/components\/BrandLiteralFixture\.ts: forbidden raw PMS brand literal\(s\): #5d49f6/i,
  )
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true })
}

console.log('Liquid glass raw-brand scanner self-test passed')
