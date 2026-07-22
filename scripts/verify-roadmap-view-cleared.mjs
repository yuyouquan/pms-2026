#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const sourcePath = path.join(root, 'src/components/roadmap/RoadmapView.tsx')
const source = fs.readFileSync(sourcePath, 'utf8')
const failures = []

for (const legacyMount of [
  "import MilestoneView from './MilestoneView'",
  "import MRTrainView from './MRTrainView'",
  '<MilestoneView',
  '<MRTrainView',
]) {
  if (source.includes(legacyMount)) {
    failures.push(`Legacy roadmap content is still mounted: ${legacyMount}`)
  }
}

for (const retainedShell of [
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
