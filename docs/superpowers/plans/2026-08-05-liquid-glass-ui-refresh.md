# PMS Liquid Glass UI Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved structured light-purple liquid-glass visual system to every current PMS interface without changing routes, data, permissions, copy, field order, state transitions, or interaction behavior.

**Architecture:** Add one root Ant Design theme provider and one semantic CSS token layer, then migrate visual literals by interface family. Existing components, Zustand stores, event handlers, table contracts, fixed columns, edit guards, permissions, and version workflows stay intact. A source-contract verifier and browser regression matrix prevent partial theme adoption and behavior regressions.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Ant Design 6, Zustand 4, Tailwind CSS 3, native CSS custom properties, existing Node verification scripts, browser screenshot verification.

---

## File structure and responsibilities

### New files

- `src/theme/pmsTheme.ts`: single source for Ant Design theme values and exported PMS brand constants.
- `src/components/shared/PmsThemeProvider.tsx`: client boundary that applies the shared Ant Design theme to every route.
- `scripts/verify-liquid-glass-theme.mjs`: source contract for tokens, provider wiring, migrated interface groups, reduced-motion and reduced-transparency fallbacks.

### Main modified files

- `src/app/layout.tsx`: wraps all routes with `PmsThemeProvider` and uses the system Chinese font stack.
- `src/app/page.tsx`: removes the page-local provider and adds semantic page-shell classes without changing routing logic.
- `src/styles/globals.css`: owns semantic tokens, material layers, component states, responsive rules, accessibility fallbacks, and Ant Design overrides.
- `src/containers/AppShell.tsx`: applies the approved bright-purple gradient to both header variants and normalizes user-switcher material.

### Interface-family files

- Workbench and project list: `src/containers/{WorkbenchContainer,ProjectListContainer}.tsx`, `src/components/work-tracker/WorkTracker.tsx`, `src/components/workspace/{TodoCenter,WorkspaceModule,AddProjectModal}.tsx`, `src/components/project-summary/ProjectSummaryTable.tsx`, `src/components/project-list/ProjectListCalendar.tsx`.
- Roadmaps: `src/components/roadmap/*.{tsx,ts}`.
- Project space and plans: `src/containers/ProjectSpaceContainer.tsx`, `src/components/project-info/*.tsx`, `src/components/plans/*.tsx`, `src/components/plan/PlanModule.tsx`, `src/components/shared/PlanHelpers.tsx`.
- Technical, transfer, config, permission: `src/components/technical-project/*.tsx`, `src/components/transfer/TransferModule.tsx`, `src/containers/{ConfigContainer,GlobalPermissionContainer}.tsx`, `src/components/config/EnumConfig.tsx`, `src/components/permission/PermissionModule.tsx`.
- Standalone routes: `src/app/config/{level1-template,level2-template}/page.tsx`, `src/app/share/plan/page.tsx`.

## Global invariants for every task

1. Do not modify Zustand store calls, action order, callback bodies, route strings, form field order, permission keys, table row keys, fixed-column settings, market selection, plan version rules, or transfer-view reset behavior.
2. Keep `SortableRow` prop forwarding unchanged in `src/components/shared/PlanHelpers.tsx`.
3. Keep semantic red, amber, green, and blue status colors. Only replace legacy decorative indigo and purple brand literals.
4. Preserve the project-list acceptance checks: category-row actions stay at far right, technical-project list remains visible, and mandatory project-name or whole-product columns remain fixed.
5. Use `var(--pms-*)` for component-level visual values. Do not introduce new raw brand hex values outside `src/theme/pmsTheme.ts` and the `:root` token block.

### Task 1: Add the theme contract and root provider

**Files:**
- Create: `scripts/verify-liquid-glass-theme.mjs`
- Create: `src/theme/pmsTheme.ts`
- Create: `src/components/shared/PmsThemeProvider.tsx`
- Modify: `package.json`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Write the failing theme contract**

Create `scripts/verify-liquid-glass-theme.mjs` with the following complete initial contract:

```js
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const read = file => {
  const absolutePath = path.join(root, file)
  return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, 'utf8') : ''
}
const failures = []

function sourceFiles(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry => {
    const file = path.posix.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(file)
    return /\.(?:ts|tsx)$/.test(entry.name) ? [file] : []
  })
}

function expectIncludes(file, fragments) {
  const source = read(file)
  for (const fragment of fragments) {
    if (!source.includes(fragment)) failures.push(`${file} missing ${fragment}`)
  }
}

expectIncludes('src/theme/pmsTheme.ts', [
  "brandStrong: '#5D49F6'",
  "brandMain: '#7562FF'",
  "brandSoft: '#AD98EE'",
  "brandSurface: '#F5F3FF'",
  'export const pmsTheme',
])
expectIncludes('src/components/shared/PmsThemeProvider.tsx', [
  "'use client'",
  '<ConfigProvider',
  'theme={pmsTheme}',
  'button={{ autoInsertSpace: false }}',
])
expectIncludes('src/app/layout.tsx', [
  "import PmsThemeProvider from '@/components/shared/PmsThemeProvider'",
  '<PmsThemeProvider>{children}</PmsThemeProvider>',
])
expectIncludes('src/styles/globals.css', [
  '--pms-brand-strong: #5d49f6;',
  '--pms-brand: #7562ff;',
  '--pms-brand-soft: #ad98ee;',
  '--pms-brand-surface: #f5f3ff;',
  '--pms-gradient-brand:',
])

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log('Liquid glass core theme contract passed')
```

Add the package script:

```json
"verify:liquid-glass": "node scripts/verify-liquid-glass-theme.mjs"
```

- [ ] **Step 2: Run the contract and verify it fails**

Run: `npm run verify:liquid-glass`

Expected: FAIL because `src/theme/pmsTheme.ts` and `PmsThemeProvider.tsx` do not exist.

- [ ] **Step 3: Create the Ant Design theme source**

Create `src/theme/pmsTheme.ts`:

```ts
import type { ThemeConfig } from 'antd'

export const PMS_COLORS = {
  brandStrong: '#5D49F6',
  brandMain: '#7562FF',
  brandSoft: '#AD98EE',
  brandSurface: '#F5F3FF',
  brandBorder: '#DCD6FF',
  page: '#F4F6FB',
  textPrimary: '#27243A',
  textSecondary: '#625D70',
  textTertiary: '#817B90',
  border: '#E6E3EF',
} as const

export const pmsTheme: ThemeConfig = {
  token: {
    colorPrimary: PMS_COLORS.brandMain,
    colorInfo: PMS_COLORS.brandMain,
    colorBgBase: '#FFFFFF',
    colorBgLayout: PMS_COLORS.page,
    colorText: PMS_COLORS.textPrimary,
    colorTextSecondary: PMS_COLORS.textSecondary,
    colorBorder: PMS_COLORS.border,
    colorBorderSecondary: '#EFEDF4',
    borderRadius: 8,
    borderRadiusLG: 12,
    controlHeight: 32,
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  },
  components: {
    Button: { borderRadius: 8, primaryShadow: '0 5px 14px rgba(96, 76, 226, 0.22)' },
    Card: { borderRadiusLG: 12 },
    Modal: { borderRadiusLG: 16 },
    Table: { headerBg: '#F5F3FF', headerColor: '#514A70', rowHoverBg: '#FAF9FF' },
    Tabs: { inkBarColor: PMS_COLORS.brandMain, itemSelectedColor: PMS_COLORS.brandStrong },
  },
}
```

- [ ] **Step 4: Create and wire the root provider**

Create `src/components/shared/PmsThemeProvider.tsx`:

```tsx
'use client'

import { ConfigProvider } from 'antd'
import { pmsTheme } from '@/theme/pmsTheme'

export default function PmsThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider theme={pmsTheme} button={{ autoInsertSpace: false }}>
      {children}
    </ConfigProvider>
  )
}
```

Update `src/app/layout.tsx` to remove `next/font/google`, import the provider, and render:

```tsx
<html lang="zh-CN">
  <body>
    <PmsThemeProvider>{children}</PmsThemeProvider>
  </body>
</html>
```

Remove the nested `ConfigProvider` import and wrapper from `src/app/page.tsx`; leave all children and callbacks in the same order.

- [ ] **Step 5: Add the semantic core token block**

At the top of `:root` in `src/styles/globals.css`, add:

```css
--pms-brand-strong: #5d49f6;
--pms-brand: #7562ff;
--pms-brand-soft: #ad98ee;
--pms-brand-surface: #f5f3ff;
--pms-brand-border: #dcd6ff;
--pms-gradient-brand: linear-gradient(106deg, #5d49f6 0%, #7562ff 50%, #ad98ee 100%);
--pms-page: #f4f6fb;
--pms-surface-solid: #ffffff;
--pms-surface-glass: rgb(255 255 255 / 76%);
--pms-text-primary: #27243a;
--pms-text-secondary: #625d70;
--pms-text-tertiary: #817b90;
--pms-border: #e6e3ef;
--pms-shadow-glass: 0 12px 32px rgb(75 59 148 / 8%);
--pms-shadow-floating: 0 22px 60px rgb(79 62 158 / 12%);
--pms-glass-filter: blur(14px) saturate(145%);
```

Map existing `--primary`, `--accent`, text, background, border, radius, and shadow variables to these semantic tokens so older selectors inherit the new palette during migration.

- [ ] **Step 6: Run core verification**

Run:

```bash
npm run verify:liquid-glass
npx tsc --noEmit
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit the foundation**

```bash
git add package.json scripts/verify-liquid-glass-theme.mjs src/theme/pmsTheme.ts src/components/shared/PmsThemeProvider.tsx src/app/layout.tsx src/app/page.tsx src/styles/globals.css
git commit -m "feat: add shared liquid glass theme foundation"
```

### Task 2: Build the material, state, and accessibility primitives

**Files:**
- Modify: `scripts/verify-liquid-glass-theme.mjs`
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Extend the contract for shared primitives**

Add these fragments to the `globals.css` expectation in `scripts/verify-liquid-glass-theme.mjs`:

```js
'.pms-page-shell',
'.pms-topbar',
'.pms-glass-surface',
'.pms-solid-surface',
'.pms-toolbar',
'.pms-interactive-surface',
'@media (prefers-reduced-motion: reduce)',
'@media (prefers-reduced-transparency: reduce)',
```

- [ ] **Step 2: Run the contract and verify it fails**

Run: `npm run verify:liquid-glass`

Expected: FAIL listing the missing shared selectors and media queries.

- [ ] **Step 3: Add the shared material classes**

Add a final `PMS structured liquid glass layer` section to `src/styles/globals.css`:

```css
.pms-page-shell {
  min-height: 100dvh;
  background: var(--pms-page);
  color: var(--pms-text-primary);
}

.pms-topbar {
  background: var(--pms-gradient-brand);
  border-bottom: 1px solid rgb(255 255 255 / 24%);
  box-shadow: 0 10px 28px rgb(92 73 214 / 24%);
}

.pms-glass-surface,
.pms-toolbar {
  background: var(--pms-surface-glass);
  border: 1px solid rgb(255 255 255 / 96%);
  backdrop-filter: var(--pms-glass-filter);
  -webkit-backdrop-filter: var(--pms-glass-filter);
  box-shadow: inset 0 1px 0 #fff, var(--pms-shadow-glass);
}

.pms-solid-surface {
  background: var(--pms-surface-solid);
  border: 1px solid var(--pms-border);
  box-shadow: 0 10px 30px rgb(58 45 115 / 6%);
}

.pms-interactive-surface {
  transition: transform 160ms cubic-bezier(.16, 1, .3, 1), box-shadow 180ms cubic-bezier(.16, 1, .3, 1), border-color 160ms ease;
}
.pms-interactive-surface:hover { transform: translateY(-1px); }
.pms-interactive-surface:active { transform: scale(.98); }
```

- [ ] **Step 4: Add reduced-motion and transparency fallbacks**

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
  }
}

@media (prefers-reduced-transparency: reduce) {
  .pms-glass-surface,
  .pms-toolbar,
  .ant-modal-content,
  .ant-popover-inner,
  .ant-dropdown-menu {
    background: rgb(255 255 255 / 98%) !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }
}
```

Also add `:focus-visible` rules using `0 0 0 3px rgb(117 98 255 / 24%)`, keep button labels on one line, and set 1024px compact spacing without changing element order.

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm run verify:liquid-glass
npx tsc --noEmit
git diff --check
```

Expected: PASS.

Commit:

```bash
git add scripts/verify-liquid-glass-theme.mjs src/styles/globals.css
git commit -m "style: add liquid glass material primitives"
```

### Task 3: Migrate the global shell, workbench, and project list

**Files:**
- Modify: `scripts/verify-liquid-glass-theme.mjs`
- Modify: `src/app/page.tsx`
- Modify: `src/containers/AppShell.tsx`
- Modify: `src/containers/WorkbenchContainer.tsx`
- Modify: `src/containers/ProjectListContainer.tsx`
- Modify: `src/components/work-tracker/WorkTracker.tsx`
- Modify: `src/components/workspace/TodoCenter.tsx`
- Modify: `src/components/workspace/WorkspaceModule.tsx`
- Modify: `src/components/workspace/AddProjectModal.tsx`
- Modify: `src/components/project-summary/ProjectSummaryTable.tsx`
- Modify: `src/components/project-list/ProjectListCalendar.tsx`
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Add grouped legacy-color scanning**

Extend `scripts/verify-liquid-glass-theme.mjs`:

```js
const legacyBrand = /#(?:1e1b4b|312e81|3730a3|4338ca|4f46e5|5558e6|5b5cf6|6366f1|818cf8)\b/gi
const groups = {
  shell: ['src/app/page.tsx', 'src/containers/AppShell.tsx'],
  workbench: [
    'src/containers/WorkbenchContainer.tsx',
    'src/containers/ProjectListContainer.tsx',
    'src/components/work-tracker/WorkTracker.tsx',
    'src/components/workspace/TodoCenter.tsx',
    'src/components/workspace/WorkspaceModule.tsx',
    'src/components/workspace/AddProjectModal.tsx',
    'src/components/project-summary/ProjectSummaryTable.tsx',
    'src/components/project-list/ProjectListCalendar.tsx',
  ],
}

function expectNoLegacyBrand(file) {
  const matches = read(file).match(legacyBrand)
  if (matches?.length) failures.push(`${file} still contains ${[...new Set(matches)].join(', ')}`)
}

for (const name of ['shell', 'workbench']) {
  for (const file of groups[name]) expectNoLegacyBrand(file)
}
```

- [ ] **Step 2: Run and capture the expected failure list**

Run: `npm run verify:liquid-glass`

Expected: FAIL with legacy brand literals in the shell and workbench files. Save the list as the exact migration checklist.

- [ ] **Step 3: Migrate the shell without changing navigation**

In `src/app/page.tsx`, change only the visual wrapper:

```tsx
<div className="pms-page-shell">
```

Keep module branching and the 24px content padding unchanged.

In `src/containers/AppShell.tsx`:

- Add `className="pms-topbar"` to both header roots.
- Replace old header gradients with `background: 'var(--pms-gradient-brand)'` or remove the inline background so the class owns it.
- Add `pms-glass-surface pms-interactive-surface` to the user switcher.
- Replace decorative old purple literals with `var(--pms-brand)`, `var(--pms-brand-strong)`, `var(--pms-brand-surface)`, and `var(--pms-brand-border)`.
- Do not change menu keys, click callbacks, edit guard, project search, transfer reset, or user switching.

- [ ] **Step 4: Migrate workbench and todo surfaces**

Apply these exact responsibilities:

- `WorkbenchContainer.tsx`: page toolbar gets `pms-toolbar`; summary container gets `pms-glass-surface`; data region gets `pms-solid-surface`.
- `WorkTracker.tsx`: summary cards use `pms-glass-surface pms-interactive-surface`; table remains `pms-solid-surface pms-table`; semantic overdue and risk colors remain unchanged.
- `TodoCenter.tsx`: shell uses `pms-glass-surface`; todo rows use `pms-solid-surface`; loading, error, retry, and collapse callbacks remain unchanged.

Replace all old decorative purple literals in these files with CSS variables. Do not replace semantic status colors.

- [ ] **Step 5: Migrate project-list views**

Apply:

- `ProjectListContainer.tsx`: classification and view toolbars use `pms-toolbar`; card containers use `pms-glass-surface`; full-screen surface uses `pms-page-shell`.
- `ProjectSummaryTable.tsx`: keep current `fixed`, `scroll`, column keys, selection and row navigation; apply `pms-solid-surface pms-table` to the table shell and `pms-toolbar` to controls.
- `ProjectListCalendar.tsx`: calendar shell is solid, toolbar is glass, date grid stays opaque.
- `WorkspaceModule.tsx`: keep category and status filtering, card/list switch, pagination, todo panel, and project navigation unchanged; migrate only visual literals.
- `AddProjectModal.tsx`: keep form item order, defaults, draft behavior and submission; add `pms-modal` and replace decorative purple values.

Keep the category-row actions at the far right and fixed columns unchanged.

- [ ] **Step 6: Run focused contracts**

```bash
npm run verify:liquid-glass
npm run verify:workbench-list
npm run verify:workbench-split
npm run verify:todo-center
npm run verify:project-summary
npm run verify:project-list-matrix
npm run verify:project-list-refinement
npm run verify:floating-panels
npx tsc --noEmit
git diff --check
```

Expected: PASS with no changed business assertions.

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx src/containers/AppShell.tsx src/containers/WorkbenchContainer.tsx src/containers/ProjectListContainer.tsx src/components/work-tracker/WorkTracker.tsx src/components/workspace src/components/project-summary/ProjectSummaryTable.tsx src/components/project-list/ProjectListCalendar.tsx src/styles/globals.css scripts/verify-liquid-glass-theme.mjs
git commit -m "style: refresh shell and project workspaces"
```

### Task 4: Migrate all roadmap and project-view surfaces

**Files:**
- Modify: `scripts/verify-liquid-glass-theme.mjs`
- Modify: `src/components/roadmap/*.tsx`
- Modify: `src/components/roadmap/utils.ts`
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Add the roadmap group to the source contract**

Add every current roadmap source to `groups.roadmap`:

```js
roadmap: [
  'src/components/roadmap/RoadmapView.tsx',
  'src/components/roadmap/MilestoneView.tsx',
  'src/components/roadmap/MRTrainView.tsx',
  'src/components/roadmap/ProjectPlanSummaryBoard.tsx',
  'src/components/roadmap/ProjectRoadmapModule.tsx',
  'src/components/roadmap/RoadmapEvolutionView.tsx',
  'src/components/roadmap/RoadmapTableView.tsx',
  'src/components/roadmap/RoadmapToolbar.tsx',
  'src/components/roadmap/RoadmapProjectCard.tsx',
  'src/components/roadmap/RoadmapFilterDrawer.tsx',
  'src/components/roadmap/RoadmapColumnSettingsDrawer.tsx',
  'src/components/roadmap/RoadmapConflictDrawer.tsx',
  'src/components/roadmap/RoadmapChangeLogDrawer.tsx',
  'src/components/roadmap/PlannedProjectModal.tsx',
  'src/components/roadmap/TosTargetEditor.tsx',
  'src/components/roadmap/utils.ts',
],
```

Run `expectNoLegacyBrand` for `groups.roadmap`.

- [ ] **Step 2: Verify failure before migration**

Run: `npm run verify:liquid-glass`

Expected: FAIL with the remaining old roadmap brand literals.

- [ ] **Step 3: Migrate roadmap shells, cards, tables, and overlays**

- Toolbars and saved-view controls use `pms-toolbar`.
- Roadmap and evolution cards use `pms-glass-surface pms-interactive-surface`.
- Milestone, MR train, summary and table data areas use `pms-solid-surface pms-table`.
- Drawers, modals, conflicts, logs and filters use the shared modal or popover material.
- Update brand series colors in `utils.ts` to the approved purple family while preserving semantic conflict, success and warning colors.

Do not change view keys, filter logic, saved-view state, snapshot comparison, share parsing, export callbacks, project navigation, conflict calculation, or roadmap mock rules.

- [ ] **Step 4: Run roadmap contracts**

```bash
npm run verify:liquid-glass
node scripts/verify-project-roadmap.mjs
node scripts/verify-roadmap-view-cleared.mjs
node scripts/verify-project-view-requirements.mjs
node scripts/verify-project-view-milestone-mock-rules.mjs
node scripts/verify-project-view-tos-mock-values.mjs
node scripts/verify-tos-roadmap-single-entry.mjs
npx tsc --noEmit
git diff --check
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/roadmap src/styles/globals.css scripts/verify-liquid-glass-theme.mjs
git commit -m "style: unify roadmap visual surfaces"
```

### Task 5: Migrate project space, project information, and plan workspaces

**Files:**
- Modify: `scripts/verify-liquid-glass-theme.mjs`
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `src/components/project-info/*.tsx`
- Modify: `src/components/plans/*.tsx`
- Modify: `src/components/plan/PlanModule.tsx`
- Modify: `src/components/shared/PlanHelpers.tsx`
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Add the project-space group to the source contract**

Add the project-space sources and apply `expectNoLegacyBrand` to the group:

```js
projectSpace: [
  'src/containers/ProjectSpaceContainer.tsx',
  'src/components/plan/PlanModule.tsx',
  'src/components/shared/PlanHelpers.tsx',
  ...sourceFiles('src/components/project-info'),
  ...sourceFiles('src/components/plans'),
],
```

Add these selector expectations to `globals.css`:

```js
'.pms-project-space',
'.pms-project-section',
'.pms-plan-workspace',
'.pms-plan-toolbar',
```

- [ ] **Step 2: Verify failure before migration**

Run: `npm run verify:liquid-glass`

Expected: FAIL with missing project-space selectors and old brand literals.

- [ ] **Step 3: Migrate project-space structure**

In `ProjectSpaceContainer.tsx`:

- Add `pms-project-space` to the top-level workspace.
- Add `pms-glass-surface` to navigation, project summary and non-data overview cards.
- Add `pms-solid-surface pms-project-section` to basic information, requirements, resources, tasks, risks, defects, team, documents and permissions data regions.
- Add `pms-plan-toolbar` to version, view, filter, column, import, export and share toolbars.
- Replace decorative purple literals only.

Do not modify `navigateWithEditGuard`, permission gates, market selection, `selectedProject`, transfer reset, plan levels, publish validation, scroll-to-invalid-cell, version comparison, import/export, sharing, task drag sorting, row keys or table fixed columns.

- [ ] **Step 4: Migrate shared project information**

Apply shared glass headers and solid field grids to every file under `src/components/project-info/`. Keep schema field order, visibility preferences, market matrices, tOS type rules, edit validation, modal callbacks and save payloads intact.

- [ ] **Step 5: Migrate plan components safely**

Apply `pms-plan-workspace`, `pms-plan-toolbar`, `pms-table` and `pms-modal` in `src/components/plans/` and `PlanModule.tsx`. In `PlanHelpers.tsx`, replace visual literals but do not reorder or remove the `<tr {...props}>` forwarding contract, DnD attributes, refs, styles or data-row-key propagation.

- [ ] **Step 6: Run plan, layout, field, and permission contracts**

```bash
npm run verify:liquid-glass
node scripts/verify-plan-workspace-shell.mjs
node scripts/verify-project-core-layout.mjs
node scripts/verify-project-space-permission-matrix.mjs
node scripts/verify-project-info-frame-runtime.mjs
node scripts/verify-project-info-followup-adjustments.mjs
node scripts/verify-project-info-matrix-refresh.mjs
node scripts/verify-market-build-config.mjs
node scripts/verify-market-version-rules.mjs
node scripts/verify-plan-versioning.mjs
npx tsc --noEmit
git diff --check
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/containers/ProjectSpaceContainer.tsx src/components/project-info src/components/plans src/components/plan/PlanModule.tsx src/components/shared/PlanHelpers.tsx src/styles/globals.css scripts/verify-liquid-glass-theme.mjs
git commit -m "style: refresh project space and plans"
```

### Task 6: Migrate technical projects, transfer, config, and permission interfaces

**Files:**
- Modify: `scripts/verify-liquid-glass-theme.mjs`
- Modify: `src/components/technical-project/*.tsx`
- Modify: `src/components/transfer/TransferModule.tsx`
- Modify: `src/containers/ConfigContainer.tsx`
- Modify: `src/containers/GlobalPermissionContainer.tsx`
- Modify: `src/components/config/EnumConfig.tsx`
- Modify: `src/components/permission/PermissionModule.tsx`
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Add the admin-flow group to the source contract**

Add the admin-flow sources and apply `expectNoLegacyBrand`:

```js
adminFlows: [
  'src/components/transfer/TransferModule.tsx',
  'src/containers/ConfigContainer.tsx',
  'src/containers/GlobalPermissionContainer.tsx',
  'src/components/config/EnumConfig.tsx',
  'src/components/permission/PermissionModule.tsx',
  ...sourceFiles('src/components/technical-project'),
],
```

- [ ] **Step 2: Verify failure before migration**

Run: `npm run verify:liquid-glass`

Expected: FAIL with old brand colors in technical, transfer, config and permission sources.

- [ ] **Step 3: Migrate technical project surfaces**

Apply glass to scope tabs, project summary and toolbars; keep plan data, information grids and edit forms solid. Preserve TDT-first scope order, subproject order, active or disabled states, configuration gates, independent versions and technical plan depth limits.

- [ ] **Step 4: Migrate transfer surfaces**

Apply shared material classes to list, application, detail, entry, review, SQA review, team configuration, checklist and log views. Preserve all `setTransferView`, selected application, status pipeline, close confirmation and review callbacks.

- [ ] **Step 5: Migrate config and permission surfaces**

- `ConfigContainer.tsx`: glass page and version toolbars, solid plan tables, shared comparison modal.
- `EnumConfig.tsx`: glass group headers, solid editable rows, unchanged enum operations.
- `PermissionModule.tsx` and `GlobalPermissionContainer.tsx`: solid matrices and rows, glass tabs and toolbars, unchanged role members and permission keys.

Do not reintroduce a hidden global-permission navigation entry.

- [ ] **Step 6: Run focused contracts**

```bash
npm run verify:liquid-glass
npm run verify:enum-config
npm run verify:technical-project
npm run verify:technical-plan
node scripts/verify-technical-plan-operations.mjs
node scripts/verify-global-permission-matrix.mjs
node scripts/verify-project-role-sync.mjs
node scripts/verify-hide-global-permission-entry.mjs
npx tsc --noEmit
git diff --check
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/technical-project src/components/transfer/TransferModule.tsx src/containers/ConfigContainer.tsx src/containers/GlobalPermissionContainer.tsx src/components/config/EnumConfig.tsx src/components/permission/PermissionModule.tsx src/styles/globals.css scripts/verify-liquid-glass-theme.mjs
git commit -m "style: unify technical and admin workflows"
```

### Task 7: Migrate all standalone routes

**Files:**
- Modify: `scripts/verify-liquid-glass-theme.mjs`
- Modify: `src/app/config/level1-template/page.tsx`
- Modify: `src/app/config/level2-template/page.tsx`
- Modify: `src/app/share/plan/page.tsx`
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Add standalone route contracts**

Add `groups.standalone` with the three files and scan for both `legacyBrand` and legacy decorative blue utilities:

```js
const legacyBlueUtility = /(?:text|bg|border|hover:text|hover:bg)-blue-(?:50|100|500|600|700)/g
for (const file of groups.standalone) {
  expectNoLegacyBrand(file)
  const matches = read(file).match(legacyBlueUtility)
  if (matches?.length) failures.push(`${file} still contains ${[...new Set(matches)].join(', ')}`)
}
```

Add `.pms-template-page` and `.pms-share-page` to the required global selectors.

- [ ] **Step 2: Verify failure before migration**

Run: `npm run verify:liquid-glass`

Expected: FAIL with legacy blue utilities and missing route classes.

- [ ] **Step 3: Migrate both template pages**

Apply the shared bright-purple header, glass sidebar and toolbar, solid table, semantic buttons and modal material. Replace decorative blue Tailwind utilities with `pms-*` classes or CSS variables. Preserve local state, template operations, task ordering, edit and publish actions, version compare, leave confirmation, field order and route links.

- [ ] **Step 4: Migrate the plan share page**

Apply `pms-share-page`, shared header material, solid plan table and existing status colors. Preserve query parsing, password or access state, project and plan data, read-only behavior, exports and all displayed copy.

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm run verify:liquid-glass
npx tsc --noEmit
npm run build
git diff --check
```

Expected: PASS.

Commit:

```bash
git add src/app/config/level1-template/page.tsx src/app/config/level2-template/page.tsx src/app/share/plan/page.tsx src/styles/globals.css scripts/verify-liquid-glass-theme.mjs
git commit -m "style: align standalone plan routes"
```

### Task 8: Run full regression and browser verification

**Files:**
- Modify: `scripts/verify-liquid-glass-theme.mjs`
- Create: `screenshots/liquid-glass-ui-refresh/` browser evidence files

- [ ] **Step 1: Make all-group verification the default**

Ensure `scripts/verify-liquid-glass-theme.mjs` scans `shell`, `workbench`, `roadmap`, `projectSpace`, `adminFlows`, and `standalone` in its default execution. Add a final success line:

```js
console.log('Liquid glass theme contract passed for all interface groups')
```

- [ ] **Step 2: Run the complete static and contract gate**

```bash
npm run verify:liquid-glass
npm run verify:column-settings
npm run verify:project-summary
npm run verify:floating-panels
npm run verify:workbench-list
npm run verify:workbench-split
npm run verify:todo-center
npm run verify:enum-config
npm run verify:machine-tos
npm run verify:technical-project
npm run verify:technical-plan
npm run verify:project-list-matrix
npm run verify:project-list-refinement
npm run verify:project-role-sync
node scripts/verify-project-core-layout.mjs
node scripts/verify-project-space-permission-matrix.mjs
node scripts/verify-global-permission-matrix.mjs
node scripts/verify-project-roadmap.mjs
npx tsc --noEmit
npm run build
git diff --check
```

Expected: every command exits 0. Fix source regressions rather than weakening non-visual assertions.

- [ ] **Step 3: Start the local app for browser verification**

Run: `npm run dev -- --port 3004`

Expected: Next.js reports the app ready at `http://localhost:3004`.

- [ ] **Step 4: Capture desktop evidence at three widths**

At 1024, 1440 and 1920px, capture representative screenshots into `screenshots/liquid-glass-ui-refresh/` for:

- Workbench with todo and work tracker.
- Project list in list, card and calendar views.
- Project-list full-screen view.
- Roadmap milestone, MR train and project roadmap.
- Whole-machine project basic information and plan.
- Technical project basic information and plan.
- Plan table, horizontal and Gantt views.
- Transfer list, application, detail, entry, review and SQA review.
- Config center, enum config, project permission and global permission.
- Level-1 template, level-2 template and plan share routes.

Expected: approved gradient on shell surfaces, structured glass on tool surfaces, solid high-contrast data areas, no clipped buttons, no wrapped navigation and no altered information order.

- [ ] **Step 5: Exercise behavior-sensitive interactions**

Verify and record:

- Category switching, technical-project list visibility and far-right project-list actions.
- Fixed project columns during horizontal scroll.
- Advanced filter confirm, cancel, reset, clear and outside click.
- Column visibility, drag order, reset and full-screen behavior.
- Work-tracker tabs, details and actual-time entry.
- Project entry, user switching, permission-disabled actions and edit leave confirmation.
- Market and technical-scope switching.
- Plan revision, edit, date validation, publish blocking, version compare, import, export and share.
- Transfer navigation and transfer-view reset after leaving project space.
- Standalone template and share route controls.

Expected: behavior matches the `eed749d` baseline.

- [ ] **Step 6: Check accessibility and console output**

- Tab through headers, filters, tables, dialogs and standalone routes.
- Verify visible focus, readable placeholders, disabled states and button contrast.
- Emulate reduced motion and reduced transparency.
- Confirm the browser console has no new errors or React warnings.

- [ ] **Step 7: Commit final verification fixes and evidence**

```bash
git add scripts/verify-liquid-glass-theme.mjs screenshots/liquid-glass-ui-refresh src
git commit -m "test: verify liquid glass UI refresh"
```

If no source or evidence files changed after the previous commit, do not create an empty commit.

### Task 9: Final review and branch handoff

**Files:**
- Review: all changed files
- Review: `docs/superpowers/specs/2026-08-05-liquid-glass-ui-refresh-design.md`
- Review: `docs/superpowers/plans/2026-08-05-liquid-glass-ui-refresh.md`

- [ ] **Step 1: Review scope and diff**

Run:

```bash
git status --short --branch
git diff origin/dev...HEAD --stat
git diff origin/dev...HEAD -- src/stores src/lib src/mock
```

Expected: clean status after commits; no unintended store, business library or mock-data changes.

- [ ] **Step 2: Re-run final gates from a clean tree**

```bash
npm run verify:liquid-glass
npx tsc --noEmit
npm run build
git diff --check origin/dev...HEAD
```

Expected: PASS.

- [ ] **Step 3: Prepare handoff summary**

Report:

- Branch and worktree path.
- Commit list.
- Visual-system decisions.
- Static, contract and browser checks run with results.
- Screenshot evidence paths.
- Any explicitly documented pre-existing warnings.

Do not claim deployment, merge or push unless those actions were separately requested and verified.
