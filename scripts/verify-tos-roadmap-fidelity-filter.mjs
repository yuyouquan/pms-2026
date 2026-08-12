#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import ts from 'typescript'

const root = process.cwd()
const require = createRequire(import.meta.url)

function loadTypeScriptModule(relativePath) {
  const filename = path.join(root, relativePath)
  const source = fs.readFileSync(filename, 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText
  const module = { exports: {} }
  const wrapper = vm.runInThisContext(`(function (exports, require, module) {${compiled}\n})`, { filename })
  wrapper(module.exports, require, module)
  return module.exports
}

const incompleteBrandDraft = [{ id: 'draft-brand', field: 'brand', operator: 'equals', value: [] }]
const { resolveRoadmapFilterDraft } = loadTypeScriptModule('src/lib/roadmapFilterDraft.ts')

assert.deepEqual(
  resolveRoadmapFilterDraft({
    wasOpen: true,
    open: true,
    draft: incompleteBrandDraft,
    applied: [],
  }),
  incompleteBrandDraft,
  'an incomplete condition must survive parent filter updates while the panel stays open',
)

const filterSource = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapFilterDrawer.tsx'), 'utf8')
assert.match(filterSource, /resolveRoadmapFilterDraft/, 'filter popover must use opening-edge draft hydration')
assert.match(filterSource, /title="条件筛选"/, 'roadmap filter title must match the approved compact panel')
assert.match(filterSource, /width=\{432\}/, 'roadmap filter panel must use the approved compact width')

const filtersSource = fs.readFileSync(path.join(root, 'src/lib/roadmapFilters.ts'), 'utf8')
assert.match(
  filtersSource,
  /DEFAULT_ROADMAP_EVOLUTION_VISIBLE_COLUMNS[\s\S]*?'platform'[\s\S]*?'str5Date'[\s\S]*?'launchDate'/,
  'evolution defaults must include platform, STR5, and launch date',
)
assert.doesNotMatch(
  filtersSource.match(/DEFAULT_ROADMAP_EVOLUTION_VISIBLE_COLUMNS[\s\S]*?\], ROADMAP_EVOLUTION_LOCKED_COLUMNS\)/)?.[0] ?? '',
  /'startRam'|'developMode'/,
  'evolution defaults must not include RAM or development mode',
)

const cardSource = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapProjectCard.tsx'), 'utf8')
assert.match(cardSource, /onOpenProjectDetails/, 'evolution cards must expose a details action')
assert.match(cardSource, /onClick=\{.*onOpenProjectDetails/s, 'clicking an evolution card must open details')

const moduleSource = fs.readFileSync(path.join(root, 'src/components/roadmap/ProjectRoadmapModule.tsx'), 'utf8')
assert.match(moduleSource, /RoadmapProjectDetailsModal/, 'roadmap module must mount the project details modal')

console.log('tOS roadmap fidelity and filter contract passed')
