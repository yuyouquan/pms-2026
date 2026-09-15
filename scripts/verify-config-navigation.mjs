import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot, readSource } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const { CONFIG_MENU_GROUPS, filterConfigMenu } = loadTypeScriptModule(root, 'src/lib/configNavigation.ts')
const enums = loadTypeScriptModule(root, 'src/lib/enumValues.ts')
const { migrateEnumState, ENUM_STORE_VERSION } = loadTypeScriptModule(root, 'src/stores/enums.ts')

assert.deepEqual(CONFIG_MENU_GROUPS.map(group => [group.key, group.children.length]), [
  ['plan', 4], ['transfer', 2], ['enum', 25], ['hrPipeline', 2],
])
const leaves = CONFIG_MENU_GROUPS.flatMap(group => group.children)
assert.equal(new Set(leaves.map(leaf => leaf.key)).size, 33)
assert.ok(leaves.every(leaf => !leaf.children && leaf.target))
assert.deepEqual(filterConfigMenu('  '), CONFIG_MENU_GROUPS)
assert.deepEqual(filterConfigMenu('粉丝').map(group => [group.label, group.children.map(leaf => leaf.label)]), [
  ['枚举值配置', ['粉丝试用国家']],
])
assert.equal(filterConfigMenu('枚举值配置')[0].children.length, 25)
assert.deepEqual(filterConfigMenu('计划 模板 TOS')[0].children.map(leaf => leaf.label), ['tOS版本项目'])
assert.deepEqual(filterConfigMenu('整机人力')[0].children.map(leaf => leaf.key), ['hrPipeline:hrModel'])
assert.deepEqual(filterConfigMenu('非人力 科目')[0].children.map(leaf => leaf.key), ['hrPipeline:nonLaborSubject'])
assert.deepEqual(filterConfigMenu('不存在的菜单'), [])
assert.equal(CONFIG_MENU_GROUPS[2].children.length, 25, 'search must not mutate the complete menu')

const seeds = enums.createInitialEnumRows()
for (const type of enums.ENUM_TYPE_KEYS) {
  assert.ok(seeds[type].length >= 2, `${type} has multiple usable mock cases`)
  const seen = []
  for (const row of seeds[type]) {
    assert.equal(enums.validateAndNormalizeEnumRow(type, row, seen).ok, true, `${type}: valid distinct mock row`)
    seen.push(row)
  }
}
for (const row of seeds['package-mode-mapping']) {
  assert.ok(seeds['android-version'].some(android => android.value === row.androidVersion))
  assert.ok(seeds['chip-mapping'].some(chip => chip.chipModel === row.chipModel))
}
const oldRows = Object.fromEntries(enums.ENUM_TYPE_KEYS.map(type => [type, []]))
oldRows['chip-mapping'] = [{ id: 'user-chip', chipCode: 'CUSTOM', chipModel: 'User model', chipPlatform: 'User platform' }]
oldRows['core-value'] = [{ id: 'user-value', value: '自定义价值' }]
const original = structuredClone(oldRows)
const upgraded = migrateEnumState({ rowsByType: oldRows }, 4)
assert.deepEqual(oldRows, original, 'migration leaves its input untouched')
assert.deepEqual(upgraded.rowsByType['chip-mapping'], oldRows['chip-mapping'], 'keep existing mappings and IDs')
assert.deepEqual(upgraded.rowsByType['core-value'], oldRows['core-value'], 'keep custom values')
assert.ok(enums.ENUM_TYPE_KEYS.every(type => upgraded.rowsByType[type].length > 0))
assert.deepEqual(migrateEnumState(upgraded, ENUM_STORE_VERSION), upgraded, 'rehydration is idempotent')
upgraded.rowsByType['product-series'] = []
assert.deepEqual(migrateEnumState(upgraded, ENUM_STORE_VERSION).rowsByType['product-series'], [], 'later user deletions stay deleted')

const container = readSource(root, 'src/containers/ConfigContainer.tsx')
assert.equal((container.match(/<ConfigWorkspaceShell\b/g) ?? []).length, 1, 'all modules share one sidebar')
assert.doesNotMatch(container, /pms-config-center-switch|pms-config-center-header/)
assert.match(container, /title="配置分类"/)
assert.match(container, /handleConfigMenuSelect[\s\S]*navigateWithEditGuard/)
for (const file of ['src/components/config/EnumConfig.tsx', 'src/components/transfer/TransferModule.tsx']) {
  assert.doesNotMatch(readSource(root, file), /<ConfigWorkspaceShell\b/, 'embedded modules do not add duplicate sidebars')
}
console.log('PASS: 33 menu destinations, fuzzy search, 25 mock categories, safe one-time migration')
