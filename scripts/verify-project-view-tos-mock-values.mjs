import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const repoRoot = process.cwd()
const sourceFiles = [
  'src/data/projects.ts',
  'src/data/externalProjectPool.ts',
]

const allowed = new Set(['tOS16.1', 'tOS16.3'])
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
      if (!allowed.has(value)) {
        failures.push(`${field} at ${file}:${line} uses "${value || '(empty)'}"`)
      }
    })
  }
})

if (failures.length > 0) {
  console.error('tOS mock values must be exactly tOS16.1 or tOS16.3:')
  failures.forEach(failure => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('Project view tOS mock values are limited to tOS16.1 and tOS16.3.')
