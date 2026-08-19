import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8')
const rulesPath = path.join(root, 'src/lib/level3TemplateRules.ts')

assert.equal(fs.existsSync(rulesPath), true, 'level3 template rules module exists')

const rulesSource = fs.readFileSync(rulesPath, 'utf8')
const rulesOutput = ts.transpileModule(rulesSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  fileName: rulesPath,
}).outputText
const rules = await import(`data:text/javascript;base64,${Buffer.from(rulesOutput).toString('base64')}`)

assert.equal(rules.supportsLevel3Template('整机产品项目'), true)
assert.equal(rules.supportsLevel3Template('整机-手机'), true)
assert.equal(rules.supportsLevel3Template('tOS版本项目'), true)
assert.equal(rules.supportsLevel3Template('能力建设项目'), false)
assert.equal(rules.supportsLevel3Template('技术项目'), false)

assert.deepEqual(
  rules.getLevel3TemplateMilestoneOptions([
    { id: 'stage', taskName: '阶段', order: 0 },
    { id: 'node-a', parentId: 'stage', taskName: ' 节点A ', order: 0 },
    { id: 'node-b', parentId: 'stage', taskName: '节点B', order: 1 },
    { id: 'node-b', parentId: 'stage', taskName: '重复节点', order: 2 },
  ]),
  [
    { value: 'node-a', label: '节点A' },
    { value: 'node-b', label: '节点B' },
  ],
)

const template = [
  { id: 'parent', parentId: null, order: 0, activityName: '父活动', milestoneId: '', milestoneName: '', source: 'template' },
  { id: 'child', parentId: 'parent', order: 0, activityName: '子活动', milestoneId: 'node-a', milestoneName: '节点A', source: 'template' },
]
const initialized = rules.materializeLevel3Template(template, {
  actor: '系统管理员',
  initializedAt: '2026-08-19 09:00:00',
  projectMilestones: [{ id: 'node-a', name: '节点A', planEndDate: '2026-10-01' }],
})
assert.equal(initialized[0].status, '待启动')
assert.equal(initialized[0].risk, '无')
assert.equal(initialized[0].responsible, '')
assert.equal(initialized[1].milestonePlanEndDate, '2026-10-01')
assert.throws(() => rules.normalizeLevel3TemplateActivities([
  ...template,
  { id: 'third', parentId: 'child', order: 0, activityName: '第三级', milestoneId: '', milestoneName: '', source: 'custom' },
]), /最多支持两级活动/)
assert.throws(() => rules.normalizeLevel3TemplateActivities([
  { ...template[1], parentId: 'missing' },
]), /父活动不存在/)
assert.deepEqual(rules.getAddedDimensionValues(['OP'], ['OP', 'TR', 'TR']), ['TR'])
assert.deepEqual(rules.resolveTemplateVersionScopeForMigration(
  'config::整机产品项目::level3',
  undefined,
  { versions: [{ id: 'v3', status: '已发布' }], currentVersion: 'v3' },
  { versions: [{ id: 'v5', status: '已发布' }], currentVersion: 'v5' },
), { versions: [{ id: 'v3', status: '已发布' }], currentVersion: 'v3' })
assert.deepEqual(rules.resolveTemplateVersionScopeForMigration(
  'config::整机产品项目::level3',
  { versions: [{ id: 'v6', status: '已发布' }], currentVersion: 'v6' },
  { versions: [{ id: 'v3', status: '已发布' }], currentVersion: 'v3' },
  { versions: [{ id: 'v5', status: '已发布' }], currentVersion: 'v5' },
), { versions: [{ id: 'v6', status: '已发布' }], currentVersion: 'v6' })
assert.deepEqual(rules.validateLevel3TemplateForPublish(template, [{ value: 'node-a', label: '节点A' }]), [])
assert.deepEqual(rules.validateLevel3TemplateForPublish([{ ...template[1], activityName: ' ' }], []), ['父活动不存在：parent'])
assert.deepEqual(rules.validateLevel3TemplateForPublish([{ ...template[0], activityName: ' ' }], []), ['活动名称不能为空'])
assert.deepEqual(rules.validateLevel3TemplateForPublish(template, []), ['活动“子活动”的关键节点已失效'])

const expectedColumnKeys = [
  'number', 'activityName', 'responsible', 'responsibleDepartment', 'planStartDate',
  'planEndDate', 'estimatedDays', 'milestoneName', 'actualStartDate', 'actualEndDate',
  'actualDays', 'status', 'risk', 'remark', 'creator',
]
const level3TypesSource = read('src/types/level3Plan.ts')
for (const key of expectedColumnKeys) assert.match(level3TypesSource, new RegExp(`['\"]${key}['\"]`))

const planStoreSource = read('src/stores/plan.ts')
const level3StoreSource = read('src/stores/level3Plan.ts')
const configSource = read('src/containers/ConfigContainer.tsx')
const projectSpaceSource = read('src/containers/ProjectSpaceContainer.tsx')
const level3ModuleSource = read('src/components/plans/Level3PlanModule.tsx')
const planHelpersSource = read('src/components/shared/PlanHelpers.tsx')
const stylesSource = read('src/styles/globals.css')

assert.match(planStoreSource, /level3TemplateTasksByType/, 'plan store persists level3 templates')
assert.match(planStoreSource, /getTemplateSnapshotKey\([^\n]+['\"]level3['\"]\)/, 'level3 published snapshots are isolated')
assert.match(level3StoreSource, /initializeScopeFromTemplate/, 'level3 store exposes idempotent initialization')
assert.match(level3StoreSource, /hasOwnProperty\.call\([^\n]+activitiesByScope/, 'empty initialized scopes remain idempotent')
assert.match(configSource, /Level3TemplateTable/, 'config center renders the level3 template table')
assert.match(configSource, /toComparableTasks/, 'level3 history comparison maps activity names')
assert.match(configSource, /validateLevel3TemplateForPublish/, 'level3 drafts are validated before publish')
assert.match(configSource, /useHasGlobalPermission/, 'config plan actions use global permission grants')
assert.match(configSource, /canEditPlanTemplate && canEditPlanTemplate|isCurrentDraft && canEditPlanTemplate/, 'level3 draft editing is permission gated')
assert.match(configSource, /canPublishPlanTemplate/, 'level3 publishing is permission gated')
assert.match(configSource, /selectedLevel3PublishedSnapshot/, 'published level3 versions render their own snapshots')
assert.match(configSource, /level3DraftKey/, 'level3 draft content is isolated per version')
assert.match(configSource, /task\.milestoneName/, 'level3 history comparison includes milestone changes')
assert.match(configSource, /Number\(task\.order/, 'level3 history comparison includes sibling order changes')
assert.match(planStoreSource, /resolveTemplateVersionScopeForMigration/, 'plan migration uses isolated level3 version fallback')
assert.match(configSource, /supportsLevel3Template/, 'level3 tab is restricted by project type')
assert.match(projectSpaceSource, /getAddedDimensionValues/, 'new dimensions are detected explicitly')
assert.match(projectSpaceSource, /initializeScopeFromTemplate/, 'new dimensions initialize level3 data')
assert.match(level3ModuleSource, /PlanViewModeSwitcher/, 'level3 supports shared view switching')
assert.match(level3ModuleSource, /DHTMLXGantt/, 'level3 supports gantt view')
assert.match(level3ModuleSource, /horizontalDisabled/, 'level3 disables unsupported horizontal view')
assert.match(level3ModuleSource, /actualStartDate[\s\S]{0,180}actualEndDate/, 'gantt mapping includes actual dates')
assert.match(planHelpersSource, /actualStartDate/, 'shared gantt data preserves actual start')
assert.match(planHelpersSource, /actualEndDate/, 'shared gantt data preserves actual end')
for (const className of [
  'pms-config-template-header-card', 'pms-config-template-tabs',
  'pms-config-template-toolbar', 'pms-config-template-content-card',
]) assert.match(stylesSource, new RegExp(`\\.${className}`), `${className} has scoped layout styles`)

console.log('Level3 template configuration verification passed')
