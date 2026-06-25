#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const sourcePath = path.join(root, 'src/components/roadmap/ProjectPlanSummaryBoard.tsx')
const source = fs.readFileSync(sourcePath, 'utf8')
const failures = []

for (const required of [
  "collapsePreviewType?: 'category' | 'series'",
  "collapsePreviewType: 'category'",
  "collapsePreviewType: 'series'",
  'row.collapsePreviewType === \'category\'',
  'row.collapsePreviewType !== \'category\'',
  '另收起 {row.hiddenProjectCount} 个项目',
  'pms-summary-project-hidden',
]) {
  if (!source.includes(required)) {
    failures.push(`Project summary collapse behavior missing ${required}`)
  }
}

if (source.includes('<Tag color="blue" style={{ margin: 0, borderRadius: 10 }}>+{row.hiddenProjectCount}</Tag>')) {
  failures.push('Project hidden count should use text like product-series hidden count, not the compact +N tag')
}

if (failures.length) {
  console.error('Project summary collapse behavior verification failed:')
  failures.forEach(failure => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('Project summary collapse behavior verification passed.')
