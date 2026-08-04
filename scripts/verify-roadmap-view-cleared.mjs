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

if (!analysis.hasTosRoadmapHeader) failures.push('tOS roadmap header text is missing')
if (!analysis.hasProjectRoadmapImport) failures.push('Rebuilt ProjectRoadmapModule import is missing')
if (!analysis.mountsProjectRoadmapModule) failures.push('Rebuilt ProjectRoadmapModule is not mounted')
if (analysis.importsSummaryBoard || analysis.mountsSummaryBoard) failures.push('Project summary board remains reachable from RoadmapView')
if (analysis.hasProjectViewSwitcher) failures.push('Legacy project-view switcher remains in RoadmapView')

if (failures.length) {
  console.error('Roadmap cleared-state verification failed:')
  failures.forEach(failure => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('tOS roadmap single-entry verification passed.')
