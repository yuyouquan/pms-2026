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
  shouldClearSubmittedProjectCreationDraft,
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

const submittedSession = { generation: 4, ownerId: '张三' }
assert.equal(
  shouldClearSubmittedProjectCreationDraft(submittedSession, { generation: 5, ownerId: '张三' }),
  false,
  'a newer session for the same owner must preserve the new same-key draft',
)
assert.equal(
  shouldClearSubmittedProjectCreationDraft(submittedSession, { generation: 5, ownerId: '李四' }),
  true,
  'a newer session for another owner must still clear the submitted owner key',
)

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

const extractBlock = (sourceText, marker) => {
  const markerIndex = sourceText.indexOf(marker)
  assert.notEqual(markerIndex, -1, `Missing block marker: ${marker}`)
  const openingBraceIndex = sourceText.indexOf('{', markerIndex + marker.length)
  assert.notEqual(openingBraceIndex, -1, `Missing opening brace after: ${marker}`)

  let depth = 0
  for (let index = openingBraceIndex; index < sourceText.length; index += 1) {
    if (sourceText[index] === '{') depth += 1
    if (sourceText[index] === '}') depth -= 1
    if (depth === 0) return sourceText.slice(openingBraceIndex + 1, index)
  }
  throw new Error(`Missing closing brace after: ${marker}`)
}

const assertOrdered = (sourceText, markers, description) => {
  let previousIndex = -1
  for (const marker of markers) {
    const markerIndex = sourceText.indexOf(marker, previousIndex + 1)
    assert.ok(markerIndex > previousIndex, `${description}: expected ${marker} after the prior gate`)
    previousIndex = markerIndex
  }
}

const hydrateDraftBlock = extractBlock(modalSource, 'const hydrateDraft = async () =>')
const persistCreateDraftBlock = extractBlock(modalSource, 'const persistCreateDraft = useCallback(async')
const requestCloseBlock = extractBlock(modalSource, 'const requestClose = async () =>')
const clearAndResetBlock = extractBlock(modalSource, 'const clearAndResetCreateDraft = useCallback(async')
const clearSubmittedDraftBlock = extractBlock(modalSource, 'const clearSubmittedCreateDraft = useCallback(async')
const handleSubmitBlock = extractBlock(modalSource, 'const handleSubmit = async () =>')
const startSessionBlock = extractBlock(modalSource, 'const startCreateDraftSession = useCallback(')
const sessionGuardBlock = extractBlock(modalSource, 'const isCurrentCreateDraftSession = useCallback(')
const readFailureBlock = extractBlock(hydrateDraftBlock, 'catch')
const unreadCloseBlock = extractBlock(requestCloseBlock, "if (draftReadStatusRef.current !== 'ready' || !draftOwnerId)")

assert.match(modalSource, /export const PROJECT_CREATION_DRAFT_SAVE_DELAY_MS = 300/)
assert.match(modalSource, /createDraftSessionGenerationRef/)
assert.match(modalSource, /currentCreateDraftSessionRef/)
assert.match(modalSource, /draftReadStatus !== 'ready'/)
assert.match(modalSource, /draftReadStatusRef\.current !== 'ready'/)
assert.match(modalSource, /const isDraftHydrating =/)
assert.match(modalSource, /setTimeout\([\s\S]*PROJECT_CREATION_DRAFT_SAVE_DELAY_MS/)
assertOrdered(startSessionBlock, [
  'createDraftSessionGenerationRef.current + 1',
  'currentCreateDraftSessionRef.current = session',
], 'starting a session must advance and install its generation')
assert.match(sessionGuardBlock, /currentContext\.open/)
assert.match(sessionGuardBlock, /currentContext\.ownerId === session\.ownerId/)
assert.match(sessionGuardBlock, /currentSession\?\.generation === session\.generation/)
assertOrdered(hydrateDraftBlock, [
  'draftRepository.get(session.ownerId)',
  'isCurrentCreateDraftSession(session)',
  'form.setFieldsValue',
  "setDraftReadStatus('ready')",
], 'hydration must gate restored values by the current session')
assert.match(readFailureBlock, /项目草稿读取失败/)
assert.match(readFailureBlock, /setDraftReadStatus\('failed'\)/)
assert.doesNotMatch(readFailureBlock, /setDraftReadStatus\('ready'\)|draftRepository\.(save|clear)/)
assert.doesNotMatch(hydrateDraftBlock, /finally[\s\S]*setDraftReadStatus\('ready'\)/)
assertOrdered(persistCreateDraftBlock, [
  "draftReadStatusRef.current !== 'ready'",
  'isCurrentCreateDraftSession(session)',
  'form.getFieldsValue(true)',
], 'persistence must require a successful read and current session')
assert.equal((persistCreateDraftBlock.match(/draftReadStatusRef\.current !== 'ready'/g) || []).length, 2)
assert.equal((persistCreateDraftBlock.match(/isCurrentCreateDraftSession\(session\)/g) || []).length, 2)
assertOrdered(requestCloseBlock, [
  "draftReadStatusRef.current === 'loading'",
  "startCreateDraftSession(draftOwnerId || '')",
  "draftReadStatusRef.current !== 'ready'",
  'onCancel()',
], 'close must invalidate the prior session and bypass persistence after read failure')
assert.match(requestCloseBlock, /if \(draftReadStatusRef\.current === 'loading' \|\| draftReadStatusRef\.current === 'idle'\) \{\s*return\s*\}/)
assert.match(unreadCloseBlock, /onCancel\(\)/)
assert.doesNotMatch(unreadCloseBlock, /persistCreateDraft|draftRepository\.(save|clear)/)
assertOrdered(clearAndResetBlock, [
  'startCreateDraftSession(draftOwnerId)',
  'draftRepository.clear(session.ownerId)',
  'isCurrentCreateDraftSession(session)',
  'resetCreateForm()',
], 'reset must invalidate hydration before clearing and resetting')
assertOrdered(clearSubmittedDraftBlock, [
  'currentCreateDraftSessionRef.current',
  'shouldClearSubmittedProjectCreationDraft(session, currentSession)',
  'draftRepository.clear(session.ownerId)',
], 'submit clear must skip only a newer same-owner session and remain owner scoped')
assertOrdered(handleSubmitBlock, [
  'const submitSession =',
  'await onSubmit(',
  'await clearSubmittedCreateDraft(submitSession)',
  'isCurrentCreateDraftSession(submitSession)',
  'resetCreateForm()',
], 'submit must capture its session before submit and gate post-clear UI changes')
const postSubmitBlock = handleSubmitBlock.slice(handleSubmitBlock.indexOf('await onSubmit('))
assert.doesNotMatch(postSubmitBlock, /startCreateDraftSession/)
assert.match(postSubmitBlock, /catch\s*{\s*message\.error\('项目草稿清空失败'\)/)
assert.match(modalSource, /closable={!isDraftHydrating}/)
assert.match(modalSource, /maskClosable={!isDraftHydrating}/)
assert.match(modalSource, /keyboard={!isDraftHydrating}/)
assert.match(modalSource, /cancelButtonProps={{ disabled: isDraftHydrating }}/)
assert.match(modalSource, /okButtonProps={{ disabled: isDraftHydrating }}/)
assert.match(modalSource, /<Spin spinning={isDraftHydrating}/)
assert.match(modalSource, /<Form[\s\S]*disabled={isDraftHydrating}/)
assert.match(modalSource, /disabled={isDraftHydrating}[\s\S]*重新填写/)
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
