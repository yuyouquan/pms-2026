#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { analyzeRoadmapSource, getRoadmapAnalysisFixtureFailures } from './lib/roadmap-source-analysis.mjs'

const root = process.cwd()
const sourcePath = path.join(root, 'src/components/roadmap/RoadmapView.tsx')
const source = fs.readFileSync(sourcePath, 'utf8')
const failures = []
const analysis = analyzeRoadmapSource(source, sourcePath)

failures.push(...getRoadmapAnalysisFixtureFailures())

for (const legacyImport of analysis.legacyImports) {
  failures.push(`Legacy roadmap module is still imported: ${legacyImport}`)
}
for (const legacyMount of analysis.legacyJsxMounts) {
  failures.push(`Legacy roadmap content is still mounted: <${legacyMount}>`)
}

if (!analysis.hasProjectViewHeader) failures.push('Project-view header text is missing')
if (!analysis.hasProjectViewOptionLabels) failures.push('Project-view option labels are missing')
if (!analysis.summaryConditionals.some(conditional => conditional.mountsSummaryBoard && conditional.hasNullFalseBranch)) {
  failures.push('Summary conditional must mount ProjectPlanSummaryBoard and use a null roadmap branch')
}

if (failures.length) {
  console.error('Roadmap cleared-state verification failed:')
  failures.forEach(failure => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('Roadmap cleared-state verification passed.')
