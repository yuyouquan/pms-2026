#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const sourcePath = path.join(root, 'src/components/roadmap/RoadmapView.tsx')
const source = fs.readFileSync(sourcePath, 'utf8')
const failures = []

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function findLegacyRoadmapReferences(content) {
  const references = []
  const legacyModulePattern = /import\s+(?:[\s\S]*?\s+from\s+)?['"]\.\/(MilestoneView|MRTrainView)['"]/g
  const defaultImportPattern = /import\s+([A-Za-z_$][\w$]*)\s*(?:,\s*[\s\S]*?)?\s+from\s+['"]\.\/(?:MilestoneView|MRTrainView)['"]/g
  const legacyJsxNames = new Set(['MilestoneView', 'MRTrainView'])

  for (const match of content.matchAll(legacyModulePattern)) {
    references.push(`legacy module import: ./${match[1]}`)
  }
  for (const match of content.matchAll(defaultImportPattern)) {
    legacyJsxNames.add(match[1])
  }
  for (const name of legacyJsxNames) {
    if (new RegExp(`<\\s*${escapeRegExp(name)}\\b`).test(content)) {
      references.push(`legacy JSX mount: <${name}`)
    }
  }

  return references
}

const aliasFixture = 'import LegacyMilestone from "./MilestoneView"\nconst view = <LegacyMilestone />'
if (findLegacyRoadmapReferences(aliasFixture).length !== 2) {
  failures.push('Legacy roadmap detector does not catch an aliased double-quoted import and JSX mount')
}

for (const legacyReference of findLegacyRoadmapReferences(source)) {
  failures.push(`Legacy roadmap content is still mounted: ${legacyReference}`)
}

for (const retainedShell of [
  '项目视图',
  "label: '项目计划汇总看板'",
  "label: '项目路标视图'",
  '<ProjectPlanSummaryBoard',
  ') : null}',
]) {
  if (!source.includes(retainedShell)) {
    failures.push(`Roadmap shell or blank branch is missing: ${retainedShell}`)
  }
}

if (failures.length) {
  console.error('Roadmap cleared-state verification failed:')
  failures.forEach(failure => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('Roadmap cleared-state verification passed.')
