#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { loadTypeScriptModule } from './lib/source-contract.mjs'

const root = process.cwd()
const appShellSource = fs.readFileSync(path.join(root, 'src/containers/AppShell.tsx'), 'utf8')
const roadmapViewSource = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapView.tsx'), 'utf8')

const { PERMISSION_MAIN_NAV } = loadTypeScriptModule(root, 'src/components/permission-center/navigation.ts')
assert.deepEqual(PERMISSION_MAIN_NAV.filter(item => item.key === 'roadmap'), [{ key: 'roadmap', label: 'tOS路标' }],
  'shared header directory exposes exactly one correctly named tOS roadmap destination')
assert.equal(PERMISSION_MAIN_NAV.filter(item => item.label === 'tOS路标').length, 1,
  'another navigation key cannot duplicate the roadmap destination')
assert.match(appShellSource, /items=\{PERMISSION_MAIN_NAV\.filter\(item => canAccessMainModule\(permissionCenter, currentLoginUser, item\.key\)\)\}/,
  'main header consumes the shared ordered directory through access filtering')
assert.match(appShellSource, /返回tOS路标/, 'project-space return copy uses the same destination name')
assert.equal(PERMISSION_MAIN_NAV.some(item => item.key === 'roadmap' && item.label === '项目视图'), false,
  'main header no longer calls the destination project view')
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
