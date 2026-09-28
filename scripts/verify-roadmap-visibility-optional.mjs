#!/usr/bin/env node
import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'

const load = createTypeScriptModuleLoader()
const get = file => load(path.resolve(file))
const React = get('node_modules/react/index.js')
const { renderToStaticMarkup } = get('node_modules/react-dom/server.js')
const adapter = get('src/lib/roadmapProjectAdapter.ts')
const validation = get('src/lib/roadmapValidation.ts')
const completion = get('src/lib/projectInfoCompletion.ts')
const evolution = get('src/components/roadmap/RoadmapEvolutionView.tsx')
const { RESOURCE_REGISTRY_PROJECTS } = get('src/mock/projectRegistry.ts')
const source = RESOURCE_REGISTRY_PROJECTS.find(project => project.id === 'mock-roadmap-incomplete')
assert.ok(source)
assert.deepEqual(completion.getMissingProjectInfoFields(source), [], 'roadmap completion uses only the four required fields')
assert.deepEqual(completion.getMissingProjectInfoFields({ ...source, fieldValues: { ...source.fieldValues, fanTrialEnabled: '是', fanTrialCountries: [] } }), [],
  'roadmap completion does not introduce fan-trial requirements absent from its editor')
assert.deepEqual(completion.buildProjectInfoTodos({ projects: [source], currentUser: '演示用户01', canEditProjectInfo: () => true }), [],
  'optional blank dates do not create a basic-info task')
const minimal = {
  ...source,
  id: 'minimal',
  status: '待立项',
  brand: '', productLine: '', productSeries: '', marketName: '', startRam: '', versionType: '', developMode: '',
  str5Date: '', launchDate: '', fieldValues: { ...source.fieldValues, chipCode: '' },
}
const eligible = adapter.adaptRegistryRoadmapProject(minimal)
assert.ok(eligible, 'four required attributes admit a roadmap registry project with optional fields blank')
assert.equal(eligible.brand, '')
for (const [key, value] of [
  ['secondaryCategory', ''], ['androidVersion', ''], ['productType', ''], ['firstSaleTosVersionId', ''],
]) {
  assert.equal(adapter.adaptRegistryRoadmapProject({ ...minimal, [key]: value }), null, `${key} is required for all roadmap views`)
}
for (const status of ['已取消', '已暂停']) {
  assert.equal(adapter.adaptRegistryRoadmapProject({ ...minimal, status }), null, `${status} is hidden`)
  assert.equal(adapter.adaptNormalProject({ ...source, projectAttribute: 'formal', status }, []), null, `${status} formal row is hidden`)
}
const hiddenFormal = { ...source, projectAttribute: 'formal', status: '已暂停', productType: '老品', currentTosVersionId: '18.0' }
assert.equal(adapter.adaptNormalProject(hiddenFormal, []), null)
assert.equal(adapter.adaptNormalProject(hiddenFormal, [], { includeHidden: true })?.firstSaleTosVersionId, '18.0',
  'mutation validation can read a hidden old product with its current tOS version')
assert.equal(adapter.adaptNormalProject({ ...hiddenFormal, secondaryCategory: '' }, [], { includeHidden: true, includeIncomplete: true })?.id, source.id,
  'audit can project incomplete canonical records')
const clearedFormalChip = {
  ...source, id: 'formal-cleared-chip', projectAttribute: 'formal', name: 'DEMO017-DEMOCHIP001_DEMOBOARD016',
  fieldValues: { ...source.fieldValues, chipCode: '' },
}
assert.equal(adapter.adaptNormalProject(clearedFormalChip, [])?.chipCode, '',
  'an explicitly cleared chip remains blank even if the historical project name contains a chip code')
assert.equal(adapter.adaptNormalProject({ ...clearedFormalChip, fieldValues: { ...source.fieldValues, firstSaleTosVersion: '' } }, []), null,
  'an explicitly cleared required tOS value is not revived from a stale root field')
const candidate = {
  machineProjectType: '整机-手机', projectCode: 'Demo', androidVersion: 'Android 17', productType: '新品', firstSaleTosVersionId: '17.2',
  brand: '', productLine: '', productSeries: '', marketName: '', chipCode: '', startRam: '', versionType: '', developMode: '', str5Date: '', launchDate: '',
  str5Estimated: false, launchEstimated: false,
}
assert.deepEqual(validation.validatePlannedProject(candidate, [], undefined, new Set(['17.2'])), {}, 'optional empty values validate')
assert.equal(validation.validatePlannedProject({ ...candidate, str5Date: '2027-02-30' }, [], undefined, new Set(['17.2'])).str5Date, '日期格式必须为 YYYY-MM-DD')
assert.equal(validation.validatePlannedProject({ ...candidate, brand: '示例品牌A', productLine: '错误产品线' }, [], undefined, new Set(['17.2'])).productLine, '产品线不属于所选品牌')
const missingBrand = evolution.groupEvolutionRows([eligible], '17.2', '新品')
assert.equal(missingBrand[0]?.brand, '未填写品牌')
assert.equal(missingBrand[0]?.rows[0]?.id, 'minimal')
assert.equal(evolution.countEvolutionRows([eligible], '17.2'), 1)
const version = id => ({ id, name: `tOS ${id}`, major: Number(id.split('.')[0]), minor: Number(id.split('.')[1]), periodStartDate: '', periodEndDate: '', targets: ['目标'], createdAt: '', updatedAt: '' })
const props = {
  rows: [eligible], conflicts: [], versions: [version('17.2'), version('18.0')], selectedTosVersionIds: [],
  columnOrder: [], visibleColumns: [], canEdit: false, collapsedTargetVersionIds: new Set(),
  onToggleTarget() {}, onOpenProjectHistory() {}, onOpenProjectDetails() {}, onOpenConflict() {}, onEditPlannedProject() {}, onDeletePlannedProject() {},
}
const originalError = console.error
const renderWarnings = []
console.error = (...parts) => { renderWarnings.push(String(parts[0])) }
let html, emptyHtml
try {
  html = renderToStaticMarkup(React.createElement(evolution.default, props))
  emptyHtml = renderToStaticMarkup(React.createElement(evolution.default, { ...props, rows: [] }))
} finally {
  console.error = originalError
}
assert.ok(renderWarnings.every(warning => /non-boolean attribute/.test(warning)), `unexpected SSR warnings: ${renderWarnings.join(' | ')}`)
assert.ok(html.includes('tOS17.2'))
assert.ok(!html.includes('tOS18.0'), 'empty version header, target and body are absent')
assert.match(emptyHtml, /当前筛选条件下暂无路标项目/, 'all-filtered evolution gives a useful empty state')
console.log('PASS roadmap visibility, optional fields and evolution version pruning')
