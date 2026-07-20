import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const repositoryPath = path.join(root, 'src/lib/projectCreationDraft.ts')
const modalPath = path.join(root, 'src/components/project-info/ProjectInfoModal.tsx')
const addProjectModalPath = path.join(root, 'src/components/workspace/AddProjectModal.tsx')

if (!fs.existsSync(repositoryPath)) {
  throw new Error('Missing src/lib/projectCreationDraft.ts')
}

const source = fs.readFileSync(repositoryPath, 'utf8')
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const loadedModule = { exports: {} }
new Function('module', 'exports', output)(loadedModule, loadedModule.exports)

const {
  PROJECT_CREATION_DRAFT_SCHEMA_VERSION,
  LocalStorageProjectCreationDraftRepository,
  defaultProjectCreationDraftRepository,
  isProjectCreationDraftEmpty,
} = loadedModule.exports

const createMemoryStorage = () => {
  const records = new Map()

  return {
    getItem: (key) => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value),
    removeItem: (key) => records.delete(key),
    keys: () => [...records.keys()],
  }
}

assert.equal(PROJECT_CREATION_DRAFT_SCHEMA_VERSION, 1)
assert.ok(defaultProjectCreationDraftRepository)

const storage = createMemoryStorage()
const repository = new LocalStorageProjectCreationDraftRepository(() => storage)
const draft = {
  schemaVersion: PROJECT_CREATION_DRAFT_SCHEMA_VERSION,
  ownerId: '张三',
  values: { bid: 'BID-1', type: '整机产品项目', responsiblePersons: ['张三'] },
  activeGroups: ['basic'],
  updatedAt: '2026-07-20T00:00:00.000Z',
}
const liSiDraft = {
  schemaVersion: PROJECT_CREATION_DRAFT_SCHEMA_VERSION,
  ownerId: '李四',
  values: { bid: 'BID-2', type: '技术项目', responsiblePersons: ['李四'] },
  activeGroups: ['extended'],
  updatedAt: '2026-07-20T01:00:00.000Z',
}

await repository.save(draft)
await repository.save(liSiDraft)
assert.deepEqual(await repository.get('张三'), draft, '张三 should round-trip only their own draft')
assert.deepEqual(await repository.get('李四'), liSiDraft, '李四 should round-trip only their own draft')
assert.equal(storage.keys().length, 2)

const storedKey = storage.keys().find((key) => key.includes(encodeURIComponent('张三')))
assert.ok(storedKey, 'storage key should encode the owner ID')
storage.setItem(storedKey, '{malformed')
assert.equal(await repository.get('张三'), null, 'malformed JSON should be ignored')

storage.setItem(storedKey, JSON.stringify({ ...draft, schemaVersion: 999 }))
assert.equal(await repository.get('张三'), null, 'unsupported schema versions should be ignored')
storage.setItem(storedKey, JSON.stringify({ ...draft, ownerId: '李四' }))
assert.equal(await repository.get('张三'), null, 'records stored under another owner should be ignored')
storage.setItem(storedKey, JSON.stringify({ ...draft, values: [] }))
assert.equal(await repository.get('张三'), null, 'draft values must be a record')
storage.setItem(storedKey, JSON.stringify({ ...draft, activeGroups: ['basic', 1] }))
assert.equal(await repository.get('张三'), null, 'active groups must contain only strings')
storage.setItem(storedKey, JSON.stringify({ ...draft, updatedAt: 123 }))
assert.equal(await repository.get('张三'), null, 'updatedAt must be a string')

await repository.save(draft)
await repository.clear('张三')
assert.equal(await repository.get('张三'), null, 'clear should remove the selected owner draft')
assert.deepEqual(await repository.get('李四'), liSiDraft, 'clearing 张三 must preserve 李四 draft')

assert.equal(isProjectCreationDraftEmpty({}), true)
assert.equal(isProjectCreationDraftEmpty({ healthStatus: 'normal', status: '待立项' }), true)
assert.equal(isProjectCreationDraftEmpty({ healthStatus: 'risk', status: '待立项' }), false)
assert.equal(isProjectCreationDraftEmpty({ healthStatus: 'normal', status: '进行中' }), false)
assert.equal(isProjectCreationDraftEmpty({ healthStatus: 'normal', status: '待立项', name: '项目 A' }), false)

const writeError = new Error('storage write failed')
const failingRepository = new LocalStorageProjectCreationDraftRepository(() => ({
  getItem: () => null,
  setItem: () => { throw writeError },
  removeItem: () => { throw writeError },
}))
await assert.rejects(failingRepository.save(draft), writeError)
await assert.rejects(failingRepository.clear('张三'), writeError)

const modalSource = fs.readFileSync(modalPath, 'utf8')
const addProjectModalSource = fs.readFileSync(addProjectModalPath, 'utf8')

assert.match(modalSource, /export const PROJECT_CREATION_DRAFT_SAVE_DELAY_MS = 300/)
assert.match(modalSource, /mode !== 'create'[\s\S]*draftRepository\.get\(draftOwnerId\)/)
assert.match(modalSource, /draftHydrated[\s\S]*persistCreateDraft/)
assert.match(modalSource, /setTimeout\([\s\S]*PROJECT_CREATION_DRAFT_SAVE_DELAY_MS/)
assert.match(modalSource, /await onSubmit\([\s\S]*draftRepository\.clear\(draftOwnerId\)[\s\S]*resetCreateForm\(\)/)
assert.match(modalSource, /重新填写？/)
assert.match(modalSource, /将清空当前已填写并自动保存的全部内容，此操作不可撤销。/)
assert.match(modalSource, /确认清空/)
assert.match(modalSource, /继续填写/)
assert.match(modalSource, /项目草稿读取失败/)
assert.match(modalSource, /项目草稿自动保存失败/)
assert.match(modalSource, /项目草稿清空失败/)
assert.match(addProjectModalSource, /currentLoginUser/)
assert.match(addProjectModalSource, /draftOwnerId=\{currentLoginUser\}/)

console.log('Project creation draft repository and UI integration verification passed.')
