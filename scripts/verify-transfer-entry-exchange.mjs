import assert from 'node:assert/strict'
import { loadTypeScriptModule } from './lib/source-contract.mjs'
const { parseTransferEntryImport } = loadTypeScriptModule(process.cwd(), 'src/components/transfer/transferEntryImport.ts')
const items = [{ id: 'a', seq: 'V-01', entryContent: '原资料' }, { id: 'b', seq: 'V-01', entryContent: '' }, { id: 'passed', seq: 'V-02', entryContent: '审核已通过' }]
const row = (id, content) => ({ '资料标识': id, '录入内容': content })
const canEdit = item => item.id !== 'passed'
assert.deepEqual(parseTransferEntryImport([row('b', '新资料'), row('a', '原资料'), row('passed', '审核已通过')], items, canEdit), [{ id: 'b', content: '新资料', previousContent: '' }])
assert.deepEqual(parseTransferEntryImport([row('a', ''), row('b', '-'), row('passed', '')], items, canEdit), [])
assert.throws(() => parseTransferEntryImport([row('a', '新'), row('a', '重复')], items, canEdit), /重复/)
assert.throws(() => parseTransferEntryImport([row('other-application', '新')], items, canEdit), /不属于当前列表/)
assert.throws(() => parseTransferEntryImport([row('passed', '覆盖审核结果')], items, canEdit), /不可录入/)
assert.throws(() => parseTransferEntryImport([{ '录入内容': '无资料标识' }], items, canEdit), /保留资料标识/)
assert.throws(() => parseTransferEntryImport([], items, canEdit), /当前列表/)
assert.deepEqual(items[0], { id: 'a', seq: 'V-01', entryContent: '原资料' })
console.log('Transfer entry exchange: duplicate sequence, unchanged/blank rows, duplicate ids, cross-scope rows, permissions and immutable parsing passed')

const { syncTransferPipeline } = loadTypeScriptModule(process.cwd(), 'src/lib/transferWorkflow.ts')
const { MOCK_TRANSFER_APPLICATIONS, MOCK_CHECKLIST_ITEMS, MOCK_REVIEW_ELEMENTS } = loadTypeScriptModule(process.cwd(), 'src/mock/transfer-maintenance.ts')
const legacy = structuredClone(MOCK_TRANSFER_APPLICATIONS[0])
legacy.teamConfig = undefined
legacy.pipeline.roleProgress = legacy.pipeline.roleProgress.filter(row => row.role !== '影像')
const next = syncTransferPipeline(legacy, MOCK_CHECKLIST_ITEMS, MOCK_REVIEW_ELEMENTS)
assert(next.pipeline.roleProgress.some(row => row.role === '影像'), 'legacy team roles without material rows remain visible')
assert.equal(next.pipeline.roleProgress.filter(row => row.role === '测试' || row.role === 'TPM').length, 1, 'legacy TPM alias does not create a duplicate dot')
console.log('Legacy pipeline refresh preserves every team role without duplicate TPM dots')
