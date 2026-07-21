import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const viewSource = readFileSync(
  new URL('../src/components/project-info/TargetProjectInformationView.tsx', import.meta.url),
  'utf8',
)
const globalStyles = readFileSync(
  new URL('../src/styles/globals.css', import.meta.url),
  'utf8',
)

const gridRule = globalStyles.match(/\.pms-project-info-core-grid\s*\{([\s\S]*?)\}/)?.[1] || ''
const itemRule = globalStyles.match(/\.pms-project-info-core-item\s*\{([\s\S]*?)\}/)?.[1] || ''

assert.match(
  viewSource,
  /className="pms-project-info-core-name">\{project\.name\}<\/div>/,
  'the real project name must be the header title',
)
assert.doesNotMatch(
  viewSource,
  /<div>项目名称<\/div>\s*<span>\{project\.name\}<\/span>/,
  'the real project name must not remain a subtitle under a placeholder title',
)
assert.match(
  viewSource,
  /gridTemplateColumns:\s*`repeat\(\$\{coreFields\.length\}, minmax\(0, 1fr\)\)`/,
  'the core grid must divide the available row width across every visible field',
)
assert.match(gridRule, /overflow-x:\s*hidden;/, 'the core grid must not create a horizontal scrollbar')
assert.doesNotMatch(gridRule, /overflow-x:\s*auto;/, 'the old horizontal scrolling behavior must be removed')
assert.match(itemRule, /min-width:\s*0;/, 'core items must be allowed to shrink inside the single row')

console.log('Project core layout verification passed (6 assertions).')
