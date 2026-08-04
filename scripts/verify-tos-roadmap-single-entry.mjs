#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const appShellSource = fs.readFileSync(path.join(root, 'src/containers/AppShell.tsx'), 'utf8')
const roadmapViewSource = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapView.tsx'), 'utf8')

assert.match(
  appShellSource,
  /key:\s*'roadmap',\s*label:\s*'tOS路标'/,
  'main header exposes one tOS roadmap destination',
)
assert.match(appShellSource, /返回tOS路标/, 'project-space return copy uses the same destination name')
assert.doesNotMatch(
  appShellSource,
  /key:\s*'roadmap',\s*label:\s*'项目视图'/,
  'main header no longer calls the destination project view',
)
assert.match(roadmapViewSource, />\s*tOS路标\s*</, 'roadmap shell has a fixed tOS roadmap title')
assert.match(
  roadmapViewSource,
  /<ProjectRoadmapModule\s+projects=\{projects\}\s+onViewProject=\{onViewProject\}\s*\/>/,
  'roadmap shell directly mounts the tOS roadmap module',
)
for (const hiddenSurface of [
  'ProjectPlanSummaryBoard',
  'activeProjectView',
  'PROJECT_VIEW_OPTIONS',
  '项目计划汇总看板',
  'tOS 路标视图',
]) {
  assert.doesNotMatch(
    roadmapViewSource,
    new RegExp(hiddenSurface),
    `roadmap shell no longer exposes ${hiddenSurface}`,
  )
}
assert.match(roadmapViewSource, /className="pms-roadmap-view-card"/)
assert.match(roadmapViewSource, /overflow:\s*'visible'/)

console.log('tOS roadmap single-entry contract passed')
