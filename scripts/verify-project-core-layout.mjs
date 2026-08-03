import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const viewSource = readFileSync(
  new URL('../src/components/project-info/TargetProjectInformationView.tsx', import.meta.url),
  'utf8',
)
const frameSource = readFileSync(
  new URL('../src/components/project-info/ProjectInformationFrame.tsx', import.meta.url),
  'utf8',
)
const globalStyles = readFileSync(
  new URL('../src/styles/globals.css', import.meta.url),
  'utf8',
)

const gridRule = globalStyles.match(/\.pms-project-info-core-grid\s*\{([\s\S]*?)\}/)?.[1] || ''
const itemRule = globalStyles.match(/\.pms-project-info-core-item\s*\{([\s\S]*?)\}/)?.[1] || ''

assert.match(
  frameSource,
  /className="pms-project-info-core-name">\{projectName\}<\/div>/,
  'the real project name must be the header title',
)
assert.match(viewSource, /projectName=\{project\.name\}/, 'the target information view passes the real project name to the shared frame')
assert.doesNotMatch(
  viewSource,
  /<div>项目名称<\/div>\s*<span>\{project\.name\}<\/span>/,
  'the real project name must not remain a subtitle under a placeholder title',
)
assert.match(
  frameSource,
  /resolveProjectInformationCoreColumnCount\(coreFields\)/,
  'the core grid must derive its desktop columns from non-full-width fields',
)
assert.match(frameSource, /Math\.min\(8, Math\.max\(1, fields\.filter\(field => !field\.fullWidth\)\.length\)\)/, 'the core grid must clamp desktop columns between one and eight')
assert.match(gridRule, /grid-template-columns:\s*repeat\(var\(--pms-project-info-core-columns/, 'the rendered core grid must consume the resolved column count')
assert.match(gridRule, /overflow-x:\s*hidden;/, 'the core grid must not create a horizontal scrollbar')
assert.doesNotMatch(gridRule, /overflow-x:\s*auto;/, 'the old horizontal scrolling behavior must be removed')
assert.match(itemRule, /min-width:\s*0;/, 'core items must be allowed to shrink inside the single row')

console.log('Project core layout verification passed (9 assertions).')
