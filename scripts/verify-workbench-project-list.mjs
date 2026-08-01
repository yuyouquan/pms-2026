#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const projectListPath = path.join(root, 'src/containers/ProjectListContainer.tsx')
const source = fs.readFileSync(projectListPath, 'utf8')

assert.match(source, /ProjectSummaryTable/)
assert.match(source, /getWorkbenchListState/)
assert.match(source, /该项目分类暂未配置/)
assert.doesNotMatch(source, /label:\s*'全部',\s*value:\s*'all'\s*\},\s*\.\.\.PROJECT_CATEGORIES/)
assert.match(source, /technicalTypeVisibility/)
assert.match(source, /resolveTechnicalProjectTypeVisibility/)
assert.match(source, /matrixVariant="technical-tdt"/)
assert.match(source, /matrixVariant="technical-subproject"/)
assert.match(source, /technicalFilters/)
assert.match(source, /controlledFilters=\{technicalFilters\}/)
assert.match(source, /projectTypeFilter === PROJECT_CATEGORY_CAPABILITY[\s\S]{0,160}Empty/)
assert.doesNotMatch(source, /columns=\{\[\s*\{\s*title:\s*'项目名称'/)

for (const label of [
  '项目二级分类快捷筛选',
  '状态快捷筛选',
  '卡片视图',
  '列表视图',
]) {
  assert.match(source, new RegExp(`aria-label=["']${label}["']`))
}

assert.match(source, /storageNamespace="workbench-project-list"/)
assert.match(source, /versions=\{versions\}/)
assert.match(source, /currentVersion=\{currentVersion\}/)
assert.match(source, /publishedSnapshots=\{publishedSnapshots\}/)
assert.match(source, /getTemplateTasksForProjectType\(\s*configTemplateTasksByType,\s*projectTypeFilter/)
assert.match(source, /className="pms-project-list"/, 'project list owns a scoped polish shell')
assert.match(source, /className="pms-project-list-toolbar pms-wide-table-toolbar"/, 'wide project list keeps its toolbar visible')
assert.match(source, /<Tooltip\s+title="卡片视图"/, 'card-view icon has a tooltip')
assert.match(source, /<Tooltip\s+title="列表视图"/, 'list-view icon has a tooltip')

const styles = fs.readFileSync(path.join(root, 'src/styles/globals.css'), 'utf8')
assert.match(styles, /\.pms-wide-table-toolbar\s*\{[^}]*position:\s*sticky;[^}]*top:/s)
assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.pms-project-list/s)

console.log('workbench project-list contract passed')
