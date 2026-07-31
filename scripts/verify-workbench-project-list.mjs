#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const projectListPath = path.join(root, 'src/containers/ProjectListContainer.tsx')
const source = fs.readFileSync(projectListPath, 'utf8')

assert.match(source, /ProjectSummaryTable/)
assert.match(source, /getWorkbenchListState/)
assert.match(source, /请选择项目分类/)
assert.match(source, /该项目分类的列表视图暂未配置/)
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

console.log('workbench project-list contract passed')
