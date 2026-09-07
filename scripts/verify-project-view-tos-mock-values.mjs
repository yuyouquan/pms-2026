import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const repoRoot = process.cwd()
const sourceFiles = [
  'src/data/projects.ts',
  'src/data/externalProjectPool.ts',
]

// Project fixtures include technical multi-version references and machine patch
// versions; both prefixed and numeric snapshots are supported by enum adapters.
const validTosSnapshot = /^(?:tOS)?\d+\.\d+(?:\.\d+)?$/
const fieldPattern = /\b(tosVersion|tosVersionName|tosVersions)\s*:\s*'([^']*)'/g
const failures = []

sourceFiles.forEach(file => {
  const sourcePath = path.join(repoRoot, file)
  const source = fs.readFileSync(sourcePath, 'utf8')

  for (const match of source.matchAll(fieldPattern)) {
    const [, field, rawValue] = match
    const line = source.slice(0, match.index).split('\n').length
    const values = rawValue.split(',').map(value => value.trim())

    values.forEach(value => {
      if (!validTosSnapshot.test(value)) {
        failures.push(`${field} at ${file}:${line} uses "${value || '(empty)'}"`)
      }
    })
  }
})

if (failures.length > 0) {
  console.error('tOS mock values must use supported version snapshot syntax:')
  failures.forEach(failure => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('Project view tOS mock version snapshots are valid.')
