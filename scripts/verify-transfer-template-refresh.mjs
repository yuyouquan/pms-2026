import assert from 'node:assert/strict'
import fs from 'node:fs'
import { loadTypeScriptModule as load } from './lib/source-contract.mjs'
const module = name => load(process.cwd(), name)
const source = module('src/mock/transfer-template-source.ts')
const config = module('src/lib/transferConfig.ts')
const { useTransferStore } = module('src/stores/transfer.ts')
const flow = module('src/lib/transferWorkflow.ts')
const { refreshTransferMockState } = module('src/lib/transferMockRefresh.ts')
const fresh = useTransferStore.getState()
const groups = [
  ['整机产品项目', 'checklist', source.WHOLE_CHECKLIST_SOURCE, 46, 51],
  ['tOS版本项目', 'checklist', source.TOS_CHECKLIST_SOURCE, 26, 26],
  ['整机产品项目', 'review', source.WHOLE_REVIEW_SOURCE, 12, 18],
]
for (const [project, kind, original, sourceCount, count] of groups) {
  const rows = fresh.tmTemplateVersions[project][kind][0].rows
  assert.equal(original.length, sourceCount); assert.equal(rows.length, count)
  assert.equal(new Set(rows.map(row => row.id)).size, count)
  for (const row of original) {
    const split = rows.filter(item => item.seq === row.seq)
    const expected = row.owner === '开发' ? ['底软', '系统'] : row.owner.replace(/tOS /g, '').split(',')
    assert.deepEqual(split.map(item => item.responsibleRole), expected, `${project}/${row.seq}: all source owners survive`)
    for (const item of split) {
      for (const key of kind === 'review' ? ['standard', 'description', 'remark', 'type'] : ['checkItem', 'type']) assert.equal(item[key], row[key].trim())
      assert.equal(item.entryRole, `在研${item.responsibleRole}`); assert.equal(item.reviewRole, `维护${item.responsibleRole}`)
      assert.equal(item.aiCheckRule, '', 'source has no AI check rule; do not invent one')
    }
  }
  const roundtrip = config.parseTransferTemplateRows([config.TRANSFER_TEMPLATE_HEADERS[kind], ...config.transferTemplateMatrix(rows, kind)], kind, fresh.tmTeamConfigs[project])
  assert.equal(config.compareTransferTemplates(rows, roundtrip, kind).length, 0)
  console.log(`PASS ${project}/${kind}: ${sourceCount} source rows -> ${count} rows; field and import/export parity`)
}
const whole = fresh.tmTemplateVersions['整机产品项目'].checklist[0].rows
assert.deepEqual(whole.filter(row => row.seq === 'V-17').map(row => row.responsibleRole), ['测试', '底软', '系统'])
assert.ok(whole.filter(row => /^V-(2[1-9]|3[0-3])$/.test(row.seq)).every(row => row.responsibleRole === 'SPM'), 'G23:G35 merge must expand')
assert.ok(whole.filter(row => /^V-(3[4-9]|4[01])$/.test(row.seq)).every(row => row.responsibleRole === '底软'), 'G36:G43 merge must expand')
assert.ok(whole.filter(row => /^V-4[234]$/.test(row.seq)).every(row => row.responsibleRole === '测试'), 'G44:G46 merge must expand')
assert.equal(config.transferTemplateRowSpans(whole)[whole.findIndex(row => row.seq === 'V-17')], 3)
assert.equal(fresh.tmTemplateVersions['整机产品项目'].review[0].rows.filter(row => row.seq === 'V-013').length, 2)
assert.equal(fresh.tmTemplateVersions['tOS版本项目'].review.length, 0)
console.log('PASS source merge ranges, three-owner split, original V-013 and tOS separation')
for (const app of fresh.transferApplications) {
  const expected = flow.createTransferMaterials(app)
  for (const [key, generated] of [['tmChecklistItems', expected.checklist], ['tmReviewElements', expected.reviewElements]]) {
    const rows = fresh[key].filter(row => row.applicationId === app.id)
    assert.equal(rows.length, generated.length)
    for (const item of generated) {
      const row = rows.find(row => row.id === item.id)
      for (const key of ['seq', 'type', 'checkItem', 'standard', 'description', 'remark', 'entryPersonId', 'reviewPersonId', 'responsibleRole', 'aiCheckRule']) assert.equal(row[key], item[key], `${app.id}/${key}`)
      assert.ok(row.entryPersonId && row.reviewPersonId)
    }
  }
}
console.log('PASS all five demo applications use current templates and valid entry/review owners')
const previousPath = process.argv[2]
if (previousPath) {
  const previous = JSON.parse(fs.readFileSync(previousPath, 'utf8'))
  const upgraded = { ...previous, ...refreshTransferMockState(previous) }
  assert.deepEqual(upgraded.tmTemplateVersions, fresh.tmTemplateVersions)
  assert.deepEqual(upgraded.transferApplications, fresh.transferApplications)
  for (const key of ['tmChecklistItems', 'tmReviewElements', 'tmHistory', 'tmBlockTasks', 'tmLegacyTasks']) assert.deepEqual(upgraded[key], fresh[key])
  assert.equal(refreshTransferMockState(upgraded), null, 'migration is idempotent')
  const customized = structuredClone(previous)
  customized.tmChecklistItems[0].entryContent = '保留用户草稿'
  customized.tmTemplateVersions['整机产品项目'].checklist.push({ ...customized.tmTemplateVersions['整机产品项目'].checklist[0], id: 'user-import', createdBy: '演示用户01' })
  const kept = { ...customized, ...refreshTransferMockState(customized) }
  assert.deepEqual(kept.tmChecklistItems.filter(row => row.applicationId === 'ta001'), customized.tmChecklistItems.filter(row => row.applicationId === 'ta001'))
  assert.deepEqual(kept.transferApplications.find(app => app.id === 'ta001'), customized.transferApplications.find(app => app.id === 'ta001'))
  assert.deepEqual(kept.tmTemplateVersions['整机产品项目'].checklist.slice(0, -1), customized.tmTemplateVersions['整机产品项目'].checklist)
  assert.deepEqual(kept.tmTemplateVersions['整机产品项目'].checklist.at(-1).rows, fresh.tmTemplateVersions['整机产品项目'].checklist[0].rows)
  assert.equal(kept.tmChecklistItems.filter(row => row.applicationId === 'ta002').length, 51)
  console.log('PASS previous-release upgrade, custom imports and edited applications preserved, idempotence')
}
const current = { ...fresh, ...refreshTransferMockState(fresh) }
assert.equal(refreshTransferMockState(current), null)
assert.deepEqual(current.transferApplications, fresh.transferApplications)
const customActive = { ...current, tmMockTemplateRevision: '', transferApplications: structuredClone(current.transferApplications.filter(app => app.id !== 'ta005')) }
customActive.transferApplications.push({ ...fresh.transferApplications.find(app => app.id === 'ta005'), id: 'user-created-tos' })
assert.equal(refreshTransferMockState(customActive).transferApplications.some(app => app.id === 'ta005'), false)
console.log('PASS existing current data remains unchanged and user-created tOS applications are not duplicated')

// Simulate the first refresh already run with a previously imported QA template.
const imported = { ...fresh, tmMockTemplateRevision: source.TRANSFER_TEMPLATE_REVISION, tmTemplateVersions: structuredClone(fresh.tmTemplateVersions) }
imported.tmTemplateVersions['整机产品项目'].checklist = [{ ...imported.tmTemplateVersions['整机产品项目'].checklist[0], id: 'user-import', createdBy: '演示用户01', rows: [{ ...whole[0], checkItem: '验收标准' }] }]
const importedNext = { ...imported, ...refreshTransferMockState(imported) }
assert.deepEqual(importedNext.tmTemplateVersions['整机产品项目'].checklist[0], imported.tmTemplateVersions['整机产品项目'].checklist[0])
assert.equal(importedNext.tmTemplateVersions['整机产品项目'].checklist.at(-1).rows.length, 51)
assert.equal(importedNext.tmTemplateVersions['整机产品项目'].checklist.at(-1).version, 'v2.0')
assert.equal(refreshTransferMockState(importedNext), null)
console.log('PASS source refresh publishes latest version while retaining prior imports in version history')
