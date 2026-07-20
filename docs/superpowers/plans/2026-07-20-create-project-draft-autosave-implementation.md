# Create Project Draft Autosave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist every new-project form change per login user, restore it after close or refresh, and add a confirmed Header reset action that clears both the form and persisted draft.

**Architecture:** Introduce an async `ProjectCreationDraftRepository` contract with a `localStorage` mock implementation, then integrate it only into `ProjectInfoModal` create mode. `AddProjectModal` supplies the current login user as the draft owner; edit mode keeps its existing behavior. The async contract is the seam for replacing mock storage with a database API later.

**Tech Stack:** Next.js 14, React 18, TypeScript, Ant Design 6 Form/Modal, Zustand user state, localStorage mock persistence, Node verification scripts, Playwright CLI.

---

## File map

- Create `src/lib/projectCreationDraft.ts`: draft model, repository interface, storage key, localStorage mock, empty-draft predicate.
- Create `scripts/verify-project-creation-draft.mjs`: repository round-trip, user isolation, invalid-data, clear, and write-failure checks.
- Modify `src/components/project-info/ProjectInfoModal.tsx`: hydrate, debounce-save, close flush, successful-submit clear, Header reset confirmation.
- Modify `src/components/workspace/AddProjectModal.tsx`: pass `currentLoginUser` as `draftOwnerId`.
- Modify `src/styles/globals.css`: Header title/button layout and responsive treatment.
- Modify `src/lib/projectCreationDraft.ts` in Task 2 only if async submit hardening needs a pure, executable owner-scoped cleanup policy; the policy must remain UI-independent and covered by the repository verification script.

### Task 1: Draft repository and contract

**Files:**
- Create: `src/lib/projectCreationDraft.ts`
- Create: `scripts/verify-project-creation-draft.mjs`

- [ ] **Step 1: Write the failing repository verification**

Create a script that imports/transpiles the repository and asserts the exact contract:

```js
const storage = createMemoryStorage()
const repository = new LocalStorageProjectCreationDraftRepository(() => storage)

await repository.save({
  schemaVersion: 1,
  ownerId: '张三',
  values: { bid: 'BID-1', type: '整机产品项目', responsiblePersons: ['张三'] },
  activeGroups: ['basic'],
  updatedAt: '2026-07-20T00:00:00.000Z',
})

assert.equal((await repository.get('张三'))?.values.bid, 'BID-1')
assert.equal(await repository.get('李四'), null)
await repository.clear('张三')
assert.equal(await repository.get('张三'), null)
```

Also assert malformed JSON returns `null`, `isProjectCreationDraftEmpty` treats only `healthStatus=normal/status=待立项` as empty, and storage write exceptions reject.

- [ ] **Step 2: Run the script and verify RED**

Run:

```bash
node scripts/verify-project-creation-draft.mjs
```

Expected: failure because `src/lib/projectCreationDraft.ts` does not exist.

- [ ] **Step 3: Implement the repository**

Use this public contract:

```ts
export const PROJECT_CREATION_DRAFT_SCHEMA_VERSION = 1

export interface ProjectCreationDraft {
  schemaVersion: number
  ownerId: string
  values: Record<string, unknown>
  activeGroups: string[]
  updatedAt: string
}

export interface ProjectCreationDraftRepository {
  get(ownerId: string): Promise<ProjectCreationDraft | null>
  save(draft: ProjectCreationDraft): Promise<void>
  clear(ownerId: string): Promise<void>
}
```

The mock repository must scope keys by encoded owner ID, validate parsed records, and let save/clear storage exceptions reject. `get` may return `null` for missing or invalid records. Export `defaultProjectCreationDraftRepository` and `isProjectCreationDraftEmpty(values)`.

- [ ] **Step 4: Run the repository verification and type-check**

Run:

```bash
node scripts/verify-project-creation-draft.mjs
npx tsc --noEmit
```

Expected: both commands exit 0.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/lib/projectCreationDraft.ts scripts/verify-project-creation-draft.mjs
git commit -m "feat: add create project draft repository"
```

### Task 2: Create-mode autosave, restore, and Header reset

**Files:**
- Modify: `src/components/project-info/ProjectInfoModal.tsx`
- Modify: `src/components/workspace/AddProjectModal.tsx`
- Modify: `src/styles/globals.css`
- Modify: `src/lib/projectCreationDraft.ts` (owner-scoped submit cleanup policy discovered during async race review)

- [ ] **Step 1: Add a failing static interaction check**

Extend `scripts/verify-project-creation-draft.mjs` to assert that the modal source contains create-only hydration, a debounced save, a confirmed reset, a success clear, and that `AddProjectModal` passes `currentLoginUser`:

```js
assert.match(modalSource, /mode === 'create'/)
assert.match(modalSource, /重新填写？/)
assert.match(modalSource, /PROJECT_CREATION_DRAFT_SAVE_DELAY_MS/)
assert.match(addProjectSource, /draftOwnerId=\{currentLoginUser\}/)
```

Run the script and expect failure before UI integration.

- [ ] **Step 2: Pass the draft owner**

Read `currentLoginUser` from `useProjectStore()` in `AddProjectModal` and pass:

```tsx
<ProjectInfoModal
  mode="create"
  draftOwnerId={currentLoginUser}
  ...
/>
```

Add optional `draftOwnerId` and injectable `draftRepository` props to `ProjectInfoModal`; only create mode uses them.

- [ ] **Step 3: Hydrate safely**

When create mode opens:

```ts
setDraftHydrated(false)
resetCreateForm()
const draft = await draftRepository.get(draftOwnerId)
if (draft?.values.bid && !candidateProjects.some(item => item.bid === draft.values.bid)) {
  await draftRepository.clear(draftOwnerId)
} else if (draft) {
  form.setFieldsValue(draft.values as ProjectInfoFormState)
  setActiveGroups(draft.activeGroups)
}
setDraftHydrated(true)
```

Guard async completion against modal close/unmount. Hydration must finish before autosave starts so default values cannot overwrite an existing draft. A read failure must keep form/create interaction disabled and show a persistent retry action; Header reset remains the explicit clear/start-new recovery.

- [ ] **Step 4: Debounce every form/group change and flush on close**

Build a single `persistCreateDraft` callback using `form.getFieldsValue(true)`. For an empty draft, call `clear`; otherwise save the full values and active groups. Use a 300ms timer for normal changes and clear it during cleanup.

Create-mode `requestClose` must await an immediate flush and then call `onCancel`; it must not show the old “content will be lost” confirmation. Edit-mode `requestClose` keeps the existing touched-form confirmation.

- [ ] **Step 5: Add Header reset and success cleanup**

Render a create-only Header title:

```tsx
<div className="pms-project-info-modal-title-row">
  <span>新增项目</span>
  <Button type="text" danger icon={<ReloadOutlined />} onClick={requestResetCreateDraft}>
    重新填写
  </Button>
</div>
```

`requestResetCreateDraft` opens `Modal.confirm` with the approved title/content. Confirm must first clear the repository; only after success call `resetCreateForm()` so a clear failure leaves the current form intact. After `onSubmit` resolves in create mode, clear the repository and reset the form; submit rejection keeps the draft.

- [ ] **Step 6: Add scoped Header styles**

Add `.pms-project-info-modal-title-row` with flex alignment, right padding for the close button, compact reset button styling, and a narrow-screen rule that keeps the action reachable without overflowing.

- [ ] **Step 7: Run focused verification and commit**

Run:

```bash
node scripts/verify-project-creation-draft.mjs
npx tsc --noEmit
git diff --check
```

Expected: all exit 0.

Commit:

```bash
git add src/components/project-info/ProjectInfoModal.tsx src/components/workspace/AddProjectModal.tsx src/styles/globals.css scripts/verify-project-creation-draft.mjs
git commit -m "feat: autosave create project drafts"
```

### Task 3: Browser and production verification

**Files:**
- No production changes expected unless verification finds a defect.

- [ ] **Step 1: Run the full lightweight gate**

```bash
node scripts/verify-project-creation-draft.mjs
node scripts/verify-project-responsibility-sync.mjs
node scripts/verify-project-field-preferences.mjs
npx tsc --noEmit
npm run build
git diff --check
```

Expected: regression scripts, TypeScript, 7/7 static generation, and diff check all pass.

- [ ] **Step 2: Run the Playwright create-draft path**

Use the repository Playwright wrapper against a temporary dev port and verify:

1. Open new-project Modal as 张三, choose a project/type/responsible person, fill representative basic/extended/team fields, and change expanded groups.
2. Close and reopen; values and expanded groups are restored.
3. Reload the page and reopen; values are still restored.
4. Click “重新填写”, cancel confirmation, and verify values remain.
5. Confirm “重新填写”; verify all values/errors/groups reset and the 张三 storage key is removed.
6. Switch user and verify drafts use a different key.
7. Open edit-project Modal and verify it neither restores nor clears the create draft.
8. Confirm no page overflow or uncaught runtime exception.

- [ ] **Step 3: Final clean-state check**

```bash
git status --short --branch
```

Expected: clean worktree on `codex/project-info-fields`.
