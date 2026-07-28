# Project Classification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first- and second-level project classification, IPM-driven auto mapping, tOS roadmap linked classification, and category-aware workbench filters.

**Architecture:** Keep the persisted `type` field as the first-level category for new records and add `secondaryCategory`. Centralize classification definitions, legacy normalization, IPM mapping, and status options in `src/constants/projectTypes.ts`; all UI surfaces consume those helpers instead of duplicating arrays.

**Tech Stack:** Next.js 14, React 18, TypeScript, Ant Design 6, Zustand 4

---

### Task 1: Centralize project classification and IPM mapping

**Files:**
- Modify: `src/constants/projectTypes.ts`
- Modify: `src/types/app.ts`
- Modify: `src/data/externalProjectPool.ts`

- [ ] **Step 1: Add canonical category and second-level category constants**

Add the four first-level categories, category-to-secondary options, IPM mapping, status options, and a resolver that accepts legacy detailed machine values:

```ts
export const PROJECT_CATEGORY_MACHINE = '整机产品项目' as const
export const PROJECT_CATEGORIES = [
  PROJECT_CATEGORY_MACHINE,
  PROJECT_TYPE_TOS_VERSION,
  PROJECT_TYPE_TECH,
  PROJECT_TYPE_CAPABILITY,
] as const

export const PROJECT_SECONDARY_CATEGORIES = {
  [PROJECT_CATEGORY_MACHINE]: [
    '整机-手机',
    '整机-平板',
    '整机-笔电',
    '整机-功能机',
    '整机-AIOT扩品类',
    '整机-基线项目',
    '整机-N+1项目',
    '整机-预研项目',
  ],
  [PROJECT_TYPE_TOS_VERSION]: ['tOS版本项目'],
  [PROJECT_TYPE_TECH]: ['中长期技术', '技术项目'],
  [PROJECT_TYPE_CAPABILITY]: ['能力建设项目'],
} as const

export interface ProjectClassification {
  projectCategory: string
  secondaryCategory: string
}

export function resolveProjectClassification(
  type: string | undefined,
  secondaryCategory?: string,
): ProjectClassification {
  const normalizedType = normalizeMachineProjectType(type)
  if (isMachineProjectType(type)) {
    return {
      projectCategory: PROJECT_CATEGORY_MACHINE,
      secondaryCategory: secondaryCategory || normalizedType,
    }
  }
  return {
    projectCategory: type || '',
    secondaryCategory: secondaryCategory
      || PROJECT_SECONDARY_CATEGORIES[type as keyof typeof PROJECT_SECONDARY_CATEGORIES]?.[0]
      || '',
  }
}
```

- [ ] **Step 2: Add the exact IPM mapping and category status helper**

Create `IPM_PROJECT_CLASSIFICATION_MAP`, `mapIpmProjectClassification(ipmCategoryName)`, and `getProjectStatusOptions(projectCategory)`. The machine category includes `转维`; other categories do not.

- [ ] **Step 3: Extend project and external source types**

Add `secondaryCategory?: string` to `ProjectItem` and add a required `ipmProjectCategoryName: string` to `ExternalProjectEntry`.

- [ ] **Step 4: Refresh Mock IPM records**

Assign representative IPM category names to all `EXTERNAL_PROJECT_POOL` rows so the create modal covers machine, tOS, technology, and capability mappings.

- [ ] **Step 5: Run the type checker**

Run:

```bash
npx tsc --noEmit
```

Expected: Type errors identify every call site that must be updated in the next tasks; no syntax errors in the classification helpers.

### Task 2: Persist classification compatibly

**Files:**
- Modify: `src/stores/project.ts`
- Modify: `src/data/projects.ts`
- Modify: `src/components/workspace/WorkspaceModule.tsx`
- Modify: `src/components/project-info/TargetProjectInformationView.tsx`

- [ ] **Step 1: Add secondary category to store project types and patches**

Extend the store `Project` and `ProjectPatch` types with `secondaryCategory?: string`.

- [ ] **Step 2: Normalize persisted records during hydration**

In `migrateProjectState`, resolve the old `type` and existing `secondaryCategory`, then persist:

```ts
const classification = resolveProjectClassification(rawType, rawSecondaryCategory)
return [{
  ...value,
  id,
  name,
  type: classification.projectCategory,
  secondaryCategory: classification.secondaryCategory,
} as Project]
```

Preserve non-machine legacy values that are not part of the new source mapping rather than deleting records.

- [ ] **Step 3: Seed Mock projects with normalized classifications**

Update machine Mock projects to use `type: PROJECT_CATEGORY_MACHINE` and their matching `secondaryCategory`. Add appropriate second-level values to tOS, technology, and capability records.

- [ ] **Step 4: Update project cards and information summaries**

Use `resolveProjectClassification(project.type, project.secondaryCategory)` so cards show the first-level project category and, where space permits, the second-level category. Replace remaining user-facing “项目类型” labels with “项目分类”.

- [ ] **Step 5: Run the type checker**

Run:

```bash
npx tsc --noEmit
```

Expected: classification and persistence files pass; remaining failures are limited to creation and filter call sites addressed below.

### Task 3: Make workbench project creation IPM-driven and read-only

**Files:**
- Modify: `src/components/project-info/ProjectInfoModal.tsx`
- Modify: `src/components/workspace/AddProjectModal.tsx`
- Modify: `src/lib/projectCreationDraft.ts`

- [ ] **Step 1: Extend form state and submit payload**

Add `secondaryCategory?: string` to `ProjectInfoFormState` and `projectSecondaryCategory: string` to `ProjectInfoSubmitPayload`.

- [ ] **Step 2: Apply classification when the project name changes**

In `handleCandidateChange`, call `mapIpmProjectClassification(entry.ipmProjectCategoryName)`. Set both form fields when found; otherwise clear both and show:

```ts
message.error('该 IPM 项目分类尚未配置映射，请联系管理员维护')
```

Remove manual type inference and manual type-change confirmation from create mode.

- [ ] **Step 3: Render two required, read-only classification fields**

Replace the old editable field with:

```tsx
<Form.Item label="项目分类" name="type" rules={[{ required: true, message: '未匹配项目分类，请联系管理员' }]}>
  <Select disabled options={PROJECT_CATEGORIES.map(value => ({ label: value, value }))} />
</Form.Item>
<Form.Item label="项目二级分类" name="secondaryCategory" rules={[{ required: true, message: '未匹配项目二级分类，请联系管理员' }]}>
  <Select disabled />
</Form.Item>
```

Edit mode also displays both fields read-only.

- [ ] **Step 4: Submit and persist both fields**

Return `projectType: values.type` and `projectSecondaryCategory: values.secondaryCategory`. In `AddProjectModal`, set:

```ts
type: payload.projectType,
secondaryCategory: payload.projectSecondaryCategory,
```

- [ ] **Step 5: Preserve draft compatibility**

Allow old drafts without `secondaryCategory`; selecting the restored project name reapplies the authoritative IPM mapping before submission.

- [ ] **Step 6: Run the type checker**

Run:

```bash
npx tsc --noEmit
```

Expected: no errors in project creation, source mapping, or draft hydration.

### Task 4: Update tOS roadmap planned-project classification

**Files:**
- Modify: `src/components/roadmap/PlannedProjectModal.tsx`
- Modify: `src/types/roadmap.ts`
- Modify: `src/stores/roadmap.ts`
- Modify: `src/lib/roadmapValidation.ts`
- Modify: `src/lib/roadmapProjectAdapter.ts`

- [ ] **Step 1: Keep roadmap storage compatible**

Retain the existing `machineProjectType` property as the stored second-level category to avoid breaking planned project persistence. Update its labels and validation messages to “项目二级分类”.

- [ ] **Step 2: Add the fixed project category field**

Render a disabled field with value `整机产品项目`:

```tsx
<Form.Item label="项目分类">
  <Select
    disabled
    value={PROJECT_CATEGORY_MACHINE}
    options={[{ label: PROJECT_CATEGORY_MACHINE, value: PROJECT_CATEGORY_MACHINE }]}
  />
</Form.Item>
```

- [ ] **Step 3: Convert the existing selector into the second-level selector**

Rename its visible label to “项目二级分类” and source options from `PROJECT_SECONDARY_CATEGORIES[PROJECT_CATEGORY_MACHINE]`. Continue storing the selected value in `machineProjectType`.

- [ ] **Step 4: Update normal project adaptation**

Use `project.secondaryCategory` first and fall back to legacy `normalizeMachineProjectType(project.type)` when adapting formal projects into roadmap rows.

- [ ] **Step 5: Run the type checker**

Run:

```bash
npx tsc --noEmit
```

Expected: no roadmap type, validation, or adapter errors.

### Task 5: Restore four configuration-center categories

**Files:**
- Modify: `src/constants/projectTypes.ts`
- Modify: `src/containers/ConfigContainer.tsx`
- Modify: `src/stores/ui.ts`

- [ ] **Step 1: Set configuration template categories**

Define:

```ts
export const PROJECT_TEMPLATE_TYPES = [
  PROJECT_CATEGORY_MACHINE,
  PROJECT_TYPE_TOS_VERSION,
  PROJECT_TYPE_TECH,
  PROJECT_TYPE_CAPABILITY,
] as const
```

- [ ] **Step 2: Normalize the selected configuration category**

Ensure old persisted detailed machine selections resolve to `整机产品项目`, and default the configuration selection to a valid first-level category.

- [ ] **Step 3: Verify the configuration menu**

Open the configuration center and confirm the menu shows exactly four entries and template editing still targets the correct store key.

### Task 6: Implement workbench three-level linked filters

**Files:**
- Modify: `src/stores/project.ts`
- Modify: `src/containers/WorkspaceContainer.tsx`
- Modify: `src/components/workspace/WorkspaceModule.tsx`

- [ ] **Step 1: Add second-level filter state**

Add:

```ts
projectSecondaryCategoryFilter: string
setProjectSecondaryCategoryFilter: (value: string) => void
```

Initialize it to `all`.

- [ ] **Step 2: Filter by resolved project classification**

For every project, resolve its classification and apply category, secondary category, and status filters. Do not compare the raw legacy `type` directly.

- [ ] **Step 3: Render the project category row**

Place it below the workbench action row with `全部` plus the four canonical project categories. When changed:

```ts
setProjectTypeFilter(nextCategory)
setProjectSecondaryCategoryFilter('all')
setProjectStatusFilter('all')
setProjectCardPage(1)
```

- [ ] **Step 4: Render the conditional second-level category row**

Only render when a concrete project category is selected. Show `全部` and the selected category’s second-level options.

- [ ] **Step 5: Move status tabs below the second-level row**

Use `getProjectStatusOptions(projectTypeFilter)`. The machine category includes `转维`; the other categories omit it. When category is `all`, keep status at `all` and do not render a stale category-specific status.

- [ ] **Step 6: Update status counts**

Calculate counts from projects already restricted to the selected category and second-level category, so each status count reflects the current classification context.

- [ ] **Step 7: Update user-facing labels**

Replace “项目类型筛选” with “项目分类筛选” and change table/card headings from “项目类型” to “项目分类”. Display the second-level category in the list table.

- [ ] **Step 8: Run the type checker**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS with exit code 0.

### Task 7: Final build and browser verification

**Files:**
- Verify only

- [ ] **Step 1: Build the production bundle**

Run:

```bash
npm run build
```

Expected: Next.js production build completes successfully.

- [ ] **Step 2: Start the local app**

Run:

```bash
npm run dev -- --port 3005
```

Expected: local URL responds successfully.

- [ ] **Step 3: Verify workbench creation**

Select one machine, one tOS, one technology, and one capability Mock project. Confirm both classification fields auto-fill, are disabled, and the created project persists after refresh.

- [ ] **Step 4: Verify unmapped IPM behavior**

Temporarily exercise an unmapped Mock source value through browser state or a local edit, confirm creation is blocked with the administrator message, then restore the mapped Mock value.

- [ ] **Step 5: Verify tOS roadmap creation**

Confirm project category is fixed to “整机产品项目”, second-level category is selectable, and saving/editing a planned project retains the selection.

- [ ] **Step 6: Verify workbench filters**

Confirm:

- category defaults to all;
- selecting a category reveals the correct second-level options;
- switching category resets second-level category and status;
- only the machine category includes `转维`;
- card and list views return the same filtered projects.

- [ ] **Step 7: Verify configuration center**

Confirm it shows exactly 整机产品项目、tOS版本项目、技术项目、能力建设项目.

- [ ] **Step 8: Review the diff**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors and only intended classification files are modified.
