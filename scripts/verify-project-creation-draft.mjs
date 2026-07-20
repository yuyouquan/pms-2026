import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const repositoryPath = path.join(root, 'src/lib/projectCreationDraft.ts')

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

await repository.save(draft)
assert.deepEqual(await repository.get('张三'), draft, 'saved draft should round-trip')
assert.equal(await repository.get('李四'), null, 'drafts should be isolated by owner')
assert.equal(storage.keys().length, 1)
assert.match(storage.keys()[0], new RegExp(encodeURIComponent('张三')), 'storage key should encode the owner ID')

const storedKey = storage.keys()[0]
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
assert.equal(await repository.get('张三'), null, 'clear should remove only the owner draft')

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

console.log('Project creation draft repository verification passed.')
