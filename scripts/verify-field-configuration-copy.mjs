#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const activeFiles = [
  'src/components/shared/SortableColumnSettings.tsx',
  'src/components/project-summary/ProjectSummaryTable.tsx',
  'src/components/roadmap/RoadmapToolbar.tsx',
  'src/components/roadmap/ProjectPlanSummaryBoard.tsx',
  'src/components/roadmap/MilestoneView.tsx',
  'src/components/technical-project/TechnicalPlanModule.tsx',
  'src/containers/ProjectSpaceContainer.tsx',
]

const forbidden = [
  />\s*列设置\s*</,
  /title=["']列设置["']/,
  /aria-label=["']列设置["']/,
  /ariaLabel=["']列设置["']/,
  /列设置已保存/,
]

for (const relativePath of activeFiles) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8')
  for (const pattern of forbidden) {
    assert.doesNotMatch(source, pattern, `${relativePath} still exposes old column-settings copy`)
  }
}

const sharedSource = fs.readFileSync(
  path.join(root, 'src/components/shared/SortableColumnSettings.tsx'),
  'utf8',
)
assert.match(sharedSource, /ariaLabel="字段配置"/)
assert.match(sharedSource, />字段配置<\/span>/)
assert.match(sharedSource, /aria-label="搜索字段配置"/)

console.log('Field configuration copy verification passed.')
