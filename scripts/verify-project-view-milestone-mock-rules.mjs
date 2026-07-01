#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const summaryPath = path.join(root, 'src/components/roadmap/ProjectPlanSummaryBoard.tsx')
const roadmapPath = path.join(root, 'src/components/roadmap/MilestoneView.tsx')
const summarySource = fs.readFileSync(summaryPath, 'utf8')
const roadmapSource = fs.readFileSync(roadmapPath, 'utf8')
const failures = []

const machineMilestones = "['概念启动', 'STR1', 'STR2', 'STR3', 'STR4', 'STR4A', 'STR5', 'MR1', 'MR2', 'MR3', 'MR4', 'MR5']"
const tosMilestones = "['概念启动', 'STR1', 'STR2', 'STR3', 'STR4', 'STR4A', 'STR5', 'tOS16.1.101', 'tOS16.1.102', 'tOS16.1.103', 'tOS16.1.104']"

for (const [label, source] of [
  ['Project plan summary board', summarySource],
  ['Roadmap milestone view', roadmapSource],
]) {
  for (const required of [
    machineMilestones,
    tosMilestones,
  ]) {
    if (!source.includes(required)) {
      failures.push(`${label} missing milestone mock rule: ${required}`)
    }
  }

  if (source.includes("const MACHINE_MILESTONE_NAMES = ['概念启动', 'STR1', 'STR2', 'STR3', 'STR4', 'STR4A', 'STR5', 'STR6']")) {
    failures.push(`${label} still uses the old machine STR6 mock milestone list`)
  }

  if (source.includes("tOS版本项目: ['概念启动', 'MR1', 'MR2', 'MR3', 'MR4', 'MR5', 'MR6', 'MR7']")) {
    failures.push(`${label} still uses the old tOS MR mock milestone list`)
  }
}

if (failures.length) {
  console.error('Project view milestone mock rule verification failed:')
  failures.forEach(failure => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('Project view milestone mock rule verification passed.')
