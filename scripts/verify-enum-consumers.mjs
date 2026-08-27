#!/usr/bin/env node
import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot, readSource } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const consumers = loadTypeScriptModule(root, 'src/lib/enumConsumers.ts')
const values = loadTypeScriptModule(root, 'src/lib/enumValues.ts')
const legacyTos = loadTypeScriptModule(root, 'src/lib/tosEnumOptions.ts')
const projectTypesSource = readSource(root, 'src/constants/projectTypes.ts')

const rowsByType = values.createInitialEnumRows()
rowsByType['core-value'] = [
  { id: 'core-2', value: '第二项' },
  { id: 'core-1', value: '第一项' },
]
rowsByType['roadmap-tos'] = [
  { id: 'tos-2', value: 'beta' },
  { id: 'tos-1', value: '18.0' },
]
rowsByType['chip-mapping'] = [
  { id: 'chip-a', chipCode: 'D6300', chipModel: 'MT6835', chipPlatform: 'MTK' },
  { id: 'chip-b', chipCode: 'D6300', chipModel: 'MT6789', chipPlatform: 'MTK' },
]
rowsByType['project-category-mapping'] = [
  { id: 'category-1', ipmProjectCategory: ' 整机基线 ', pmsProjectCategory: ' 整机产品项目 ', pmsSecondaryCategory: ' 整机-手机 ' },
  { id: 'category-2', ipmProjectCategory: '技术预研', pmsProjectCategory: '技术项目', pmsSecondaryCategory: '过期的整机二级分类' },
]
rowsByType['tmg-subdomain-mapping'] = [
  { id: 'tmg-1', domain: '系统应用', subdomain: 'AIOS' },
  { id: 'tmg-2', domain: '基础架构TMG', subdomain: '无' },
  { id: 'tmg-3', domain: '系统应用', subdomain: '应用' },
  { id: 'tmg-4', domain: '系统应用', subdomain: 'AIOS' },
  { id: 'tmg-5', domain: '性能TMG', subdomain: '无' },
]

console.log('[enum-consumers] verifying ordered single-value adapters')
assert.deepEqual(consumers.getSingleEnumValues(rowsByType, 'core-value'), ['第二项', '第一项'], 'single values preserve configured row order')
assert.deepEqual(consumers.buildEnumOptions(rowsByType, 'core-value'), [
  { value: '第二项', label: '第二项' },
  { value: '第一项', label: '第一项' },
], 'single options preserve configured row order')
assert.deepEqual(consumers.buildEnumOptions(rowsByType, 'roadmap-tos'), [
  { value: 'beta', label: 'tOSbeta' },
  { value: '18.0', label: 'tOS18.0' },
], 'live tOS option values remain stored bodies and labels receive exactly one prefix')
assert.deepEqual(legacyTos.buildTosEnumOptions('tos-2-part', ['beta', '18.0', '17.2']), [
  { value: 'beta', label: 'tOSbeta' },
  { value: '18.0', label: 'tOS18.0' },
  { value: '17.2', label: 'tOS17.2' },
], 'deprecated tOS adapters preserve arbitrary nonempty configured strings in input order')

console.log('[enum-consumers] verifying historical single-value snapshots')
assert.deepEqual(consumers.buildEnumOptions(rowsByType, 'roadmap-tos', ['17.2', '18.0', 'tOS19.0', '17.2']), [
  { value: 'beta', label: 'tOSbeta' },
  { value: '18.0', label: 'tOS18.0' },
  { value: '17.2', label: 'tOS17.2（已停用）', disabled: true },
  { value: 'tOS19.0', label: 'tOS19.0（已停用）', disabled: true },
], 'missing history appends once, preserves its stored value, and formats one tOS prefix')
assert.deepEqual(consumers.buildEnumOptions(rowsByType, 'roadmap-tos', ['tOS18.0']), [
  { value: 'beta', label: 'tOSbeta' },
  { value: '18.0', label: 'tOS18.0' },
  { value: 'tOS18.0', label: 'tOS18.0（已停用）', disabled: true },
], 'tOS history preserves its raw snapshot value and de-duplicates only exact current values')
assert.deepEqual(legacyTos.buildTosEnumOptions('tos-2-part', ['18.0'], ['tOS18.0']), [
  { value: '18.0', label: 'tOS18.0' },
  { value: 'tOS18.0', label: 'tOS18.0（已停用）', disabled: true },
], 'deprecated adapters also avoid rewriting historical tOS snapshots')
assert.deepEqual(consumers.buildEnumOptions(rowsByType, 'core-value', ['旧值', '第二项', '旧值']), [
  { value: '第二项', label: '第二项' },
  { value: '第一项', label: '第一项' },
  { value: '旧值', label: '旧值（已停用）', disabled: true },
], 'non-tOS history keeps its label and exact current values are not duplicated')

console.log('[enum-consumers] verifying atomic chip snapshots')
const liveChipOptions = consumers.buildChipOptions(rowsByType)
assert.deepEqual(liveChipOptions, [
  { value: 'chip-a', label: 'D6300 / MT6835 / MTK' },
  { value: 'chip-b', label: 'D6300 / MT6789 / MTK' },
], 'rows sharing a chip code remain separate options whose values are stable row IDs')
assert.deepEqual(consumers.resolveChipRow(rowsByType, 'chip-a'), {
  chipCode: 'D6300', chipModel: 'MT6835', chipPlatform: 'MTK',
}, 'resolving a live row ID returns the complete chip tuple atomically')

const retiredChip = { chipCode: 'D6300', chipModel: 'MT9999', chipPlatform: 'MTK' }
const historicalChipOptions = consumers.buildChipOptions(rowsByType, [
  retiredChip,
  retiredChip,
  { chipCode: 'D6300', chipModel: 'MT6835', chipPlatform: 'MTK' },
])
assert.equal(historicalChipOptions.length, 3, 'only absent chip tuples synthesize one history option')
assert.deepEqual(historicalChipOptions.slice(0, 2), liveChipOptions, 'live rows are never synthesized or cross-combined from separate columns')
assert.deepEqual(historicalChipOptions[2], {
  value: consumers.encodeHistoricalChipOptionValue(retiredChip),
  label: 'D6300 / MT9999 / MTK（已停用）',
  disabled: true,
  historical: true,
}, 'retired chip tuples use a stable, explicitly historical option marker')
assert.equal(consumers.isHistoricalChipOptionValue(rowsByType, historicalChipOptions[2].value), true, 'history option values are distinguishable from live row IDs')
assert.deepEqual(consumers.decodeHistoricalChipOptionValue(rowsByType, historicalChipOptions[2].value), retiredChip, 'history markers decode to their original atomic snapshot')
assert.equal(consumers.resolveChipRow(rowsByType, historicalChipOptions[2].value), undefined, 'history markers never resolve as live rows')

const defaultHistoryMarker = consumers.encodeHistoricalChipOptionValue(retiredChip)
const collidingLiveChip = { chipCode: 'LIVE', chipModel: 'MODEL', chipPlatform: 'PLATFORM' }
const collisionRows = values.createInitialEnumRows()
collisionRows['chip-mapping'] = [{ id: defaultHistoryMarker, ...collidingLiveChip }]
const collisionOptions = consumers.buildChipOptions(collisionRows, [retiredChip, retiredChip])
assert.equal(new Set(collisionOptions.map(option => option.value)).size, collisionOptions.length, 'live and historical chip option values remain unique when a persisted row ID occupies the default marker')
assert.equal(collisionOptions.length, 2, 'duplicate historical chip snapshots still append only once after collision handling')
assert.equal(collisionOptions[0].value, defaultHistoryMarker, 'persisted live row IDs remain unchanged')
assert.notEqual(collisionOptions[1].value, defaultHistoryMarker, 'the historical marker is moved out of the live ID namespace collision')
assert.equal(consumers.isHistoricalChipOptionValue(collisionRows, defaultHistoryMarker), false, 'a colliding persisted live ID is not classified as historical')
assert.equal(consumers.decodeHistoricalChipOptionValue(collisionRows, defaultHistoryMarker), undefined, 'a colliding persisted live ID is not decoded as history')
assert.equal(consumers.isHistoricalChipOptionValue(collisionRows, collisionOptions[1].value), true, 'the allocated collision-safe option is classified as historical')
assert.deepEqual(consumers.decodeHistoricalChipOptionValue(collisionRows, collisionOptions[1].value), retiredChip, 'collision-safe history marker suffixes remain decodable')
assert.deepEqual(consumers.resolveChipRow(collisionRows, defaultHistoryMarker), collidingLiveChip, 'live row lookup wins even when its ID resembles a historical marker')

const unicodeChip = { chipCode: '芯片-🚀', chipModel: '型号/甲', chipPlatform: '平台：一' }
const unicodeMarker = consumers.encodeHistoricalChipOptionValue(unicodeChip)
assert.deepEqual(consumers.decodeHistoricalChipOptionValue(rowsByType, unicodeMarker), unicodeChip, 'Unicode chip snapshots round-trip through history markers')
const malformedMarker = `${unicodeMarker.slice(0, unicodeMarker.indexOf('%'))}%E0%A4%A`
assert.equal(consumers.decodeHistoricalChipOptionValue(rowsByType, malformedMarker), undefined, 'malformed marker payloads fail closed')
assert.equal(consumers.isHistoricalChipOptionValue(rowsByType, malformedMarker), false, 'malformed marker payloads are not classified as history')

console.log('[enum-consumers] verifying project category and TMG mappings')
assert.deepEqual(consumers.findProjectCategoryMapping(rowsByType, ' 整机基线 '), {
  pmsProjectCategory: '整机产品项目', pmsSecondaryCategory: '整机-手机',
}, 'project category lookup uses an exact trimmed IPM match and returns its conditional secondary category')
assert.deepEqual(consumers.findProjectCategoryMapping(rowsByType, '技术预研'), {
  pmsProjectCategory: '技术项目',
  pmsSecondaryCategory: '',
}, 'secondary categories are returned only for whole-machine project mappings')
rowsByType['project-category-mapping'].push({
  id: 'category-software', ipmProjectCategory: '软件产品项目', pmsProjectCategory: 'tOS版本项目', pmsSecondaryCategory: '旧二级值',
})
assert.deepEqual(consumers.findProjectCategoryMapping(rowsByType, '软件产品项目'), {
  pmsProjectCategory: 'tOS版本项目',
  pmsSecondaryCategory: '',
}, 'software mappings normalize secondary classification to empty')
rowsByType['project-category-mapping'].push({
  id: 'category-3', ipmProjectCategory: '能力建设', pmsProjectCategory: '能力建设项目', pmsSecondaryCategory: '旧二级值',
})
assert.deepEqual(consumers.findProjectCategoryMapping(rowsByType, '能力建设'), {
  pmsProjectCategory: '能力建设项目',
  pmsSecondaryCategory: '',
}, 'capability mappings normalize secondary classification to empty')
assert.equal(consumers.findProjectCategoryMapping(rowsByType, '整机'), undefined, 'partial category matches are rejected')
assert.equal(consumers.findProjectCategoryMapping(rowsByType, '未配置分类'), undefined, 'unknown exact categories fail closed')

assert.deepEqual(consumers.getTmgDomains(rowsByType, '历史领域'), [
  { value: '系统应用', label: '系统应用' },
  { value: '基础架构TMG', label: '基础架构TMG' },
  { value: '性能TMG', label: '性能TMG' },
  { value: '历史领域', label: '历史领域（已停用）', disabled: true },
], 'TMG domains de-duplicate in first-row order and append absent history')
assert.deepEqual(consumers.getTmgSubdomainState(rowsByType, '系统应用', '历史子领域'), {
  options: [
    { value: 'AIOS', label: 'AIOS' },
    { value: '应用', label: '应用' },
    { value: '历史子领域', label: '历史子领域（已停用）', disabled: true },
  ],
  disabled: false,
}, 'the original three-argument API treats historical subdomain history as belonging to the current domain')
assert.deepEqual(consumers.getTmgSubdomainState(rowsByType, '基础架构TMG', '历史子领域', '基础架构TMG'), {
  options: [
    { value: '无', label: '无' },
    { value: '历史子领域', label: '历史子领域（已停用）', disabled: true },
  ],
  autoValue: '无',
  disabled: true,
}, 'adapter reports live-only sole-无 auto state; consumer UI must guard its application during initial edit hydration')
assert.deepEqual(consumers.getTmgSubdomainState(rowsByType, '基础架构TMG'), {
  options: [{ value: '无', label: '无' }],
  autoValue: '无',
  disabled: true,
}, 'once no orphan snapshot remains, a sole live 无 auto-selects and disables')
assert.deepEqual(consumers.getTmgSubdomainState(rowsByType, '性能TMG', '历史子领域', '基础架构TMG'), {
  options: [{ value: '无', label: '无' }],
  autoValue: '无',
  disabled: true,
}, 'switching domains does not leak a retired subdomain from its original domain')
assert.deepEqual(consumers.getTmgSubdomainState(rowsByType, '不存在'), { options: [], disabled: false }, 'no configured rows exposes an empty selectable state')

const deepFreeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value
}
const frozenRows = deepFreeze(structuredClone(rowsByType))
assert.doesNotThrow(() => {
  consumers.buildEnumOptions(frozenRows, 'roadmap-tos', ['tOS18.0'])
  consumers.buildChipOptions(frozenRows, [retiredChip])
  consumers.findProjectCategoryMapping(frozenRows, '技术预研')
  consumers.getTmgDomains(frozenRows, '历史领域')
  consumers.getTmgSubdomainState(frozenRows, '基础架构TMG', '历史子领域', '基础架构TMG')
}, 'all consumer adapters accept deeply frozen rows without mutation')

console.log('[enum-consumers] verifying thin hook and compatibility contracts')
const hookSource = readSource(root, 'src/hooks/useEnumOptions.ts')
assert.match(hookSource, /useEnumStore\(state\s*=>\s*state\.rowsByType\)/, 'hooks subscribe only to rowsByType')
assert.doesNotMatch(hookSource, /valuesByType/, 'new option hooks do not subscribe to the legacy value projection')
assert.match(hookSource, /export function useEnumHydration\b/, 'one reusable hydration hook owns enum readiness')
assert.match(hookSource, /ensureEnumHydrated/, 'the hydration hook delegates to the store-level deduplicated hydrator')
assert.match(hookSource, /enabled\s*&&\s*!hasHydrated/, 'the hydration hook starts persisted loading only for an enabled consumer that is not hydrated')
assert.match(hookSource, /hasHydrated\s*&&\s*!hydrationError/, 'the hydration hook exposes readiness only after successful persisted loading')
assert.match(hookSource, /if\s*\(\s*!isReady\s*\)\s*return\s*\[\]/, 'single-value options never expose seed rows before persisted hydration')
for (const hook of ['useSingleEnumOptions', 'useChipOptions', 'useProjectCategoryMapping', 'useTmgOptions']) {
  assert.match(hookSource, new RegExp(`export function ${hook}\\b`), `${hook} is exported`)
}
assert.match(
  hookSource,
  /useTmgOptions\(\s*domain[^,]*,\s*historicalSubdomain\?[^,]*,\s*historicalDomain\?[^,]*,/,
  'TMG hook preserves historicalSubdomain as the second positional argument and appends historicalDomain',
)
assert.match(
  hookSource,
  /getTmgSubdomainState\(\s*rowsByType,\s*domain,\s*historicalSubdomain,\s*historicalDomain,?\s*\)/,
  'TMG hook passes the original domain together with its historical subdomain snapshot',
)
const legacyLibSource = readSource(root, 'src/lib/tosEnumOptions.ts')
const legacyHookSource = readSource(root, 'src/hooks/useTosEnumOptions.ts')
assert.match(legacyLibSource, /buildEnumOptions/, 'deprecated tOS option builder delegates to the unified consumer helper')
assert.match(legacyHookSource, /roadmap-tos/, 'legacy two-part hook maps to roadmap tOS rows')
assert.match(legacyHookSource, /first-sale-tos/, 'legacy three-part hook maps to first-sale tOS rows')

const projectInfoModalSource = readSource(root, 'src/components/project-info/ProjectInfoModal.tsx')
assert.match(projectInfoModalSource, /useEnumHydration\(open\)/, 'project information create/edit starts enum hydration only while its modal is relevant')
assert.match(projectInfoModalSource, /handleSubmit[\s\S]*useEnumStore\.getState\(\)[\s\S]*!enumState\.hasHydrated\s*\|\|\s*enumState\.hydrationError[\s\S]*return/, 'project information submit reads current store state and rejects incomplete or failed enum hydration')
assert.match(projectInfoModalSource, /okButtonProps=\{\{[^}]*!enumReady/s, 'project information disables OK until persisted enum configuration is authoritative')
assert.match(projectInfoModalSource, /Skeleton[\s\S]*hydrationError[\s\S]*retryHydration/, 'project information visibly gates loading and exposes hydration retry guidance')

const addProjectModalSource = readSource(root, 'src/components/workspace/AddProjectModal.tsx')
assert.match(addProjectModalSource, /useEnumHydration\(open\)/, 'the create wrapper shares the central hydration state')
assert.match(addProjectModalSource, /handleSubmit[\s\S]*useEnumStore\.getState\(\)[\s\S]*!enumState\.hasHydrated\s*\|\|\s*enumState\.hydrationError[\s\S]*return false/, 'the create wrapper rejects a bypassed submit using current store hydration state')

const subprojectConfigSource = readSource(root, 'src/components/technical-project/SubprojectConfigModal.tsx')
assert.match(subprojectConfigSource, /useEnumHydration\(open\)/, 'standalone technical configuration hydrates when opened')
assert.match(subprojectConfigSource, /save[\s\S]*useEnumStore\.getState\(\)[\s\S]*!enumState\.hasHydrated\s*\|\|\s*enumState\.hydrationError[\s\S]*return/, 'standalone technical configuration defensively blocks save using current hydration state')
assert.match(subprojectConfigSource, /okButtonProps=\{\{[^}]*!enumReady/s, 'standalone technical configuration disables OK before hydration')
assert.match(subprojectConfigSource, /hydrationError[\s\S]*retryHydration/, 'standalone technical configuration exposes hydration recovery')

const projectSpaceSource = readSource(root, 'src/containers/ProjectSpaceContainer.tsx')
assert.match(projectSpaceSource, /useEnumHydration\(true\)/, 'project space starts enum hydration on mount')
assert.match(projectSpaceSource, /saveBasicInfoEdit[\s\S]*useEnumStore\.getState\(\)[\s\S]*!enumState\.hasHydrated\s*\|\|\s*enumState\.hydrationError[\s\S]*return/, 'project-space direct editing cannot save enum fields before hydration')

assert.doesNotMatch(
  projectTypesSource,
  /IPM_PROJECT_CLASSIFICATION_MAP|mapIpmProjectClassification/,
  'runtime project-category mapping has one source in rowsByType rather than a second hard-coded registry',
)
assert.match(
  projectTypesSource,
  /\[PROJECT_CATEGORY_TOS_VERSION\]:\s*\[\]|\[PROJECT_CATEGORY_TOS_VERSION\]:\s*undefined/,
  'non-machine categories do not advertise a synthetic PMS secondary category',
)

console.log('[enum-consumers] all checks passed')
