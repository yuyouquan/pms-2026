# Unified Collapsible Sidebars Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the three configuration-center tabs around one equal-height collapsible sidebar shell and add an independent collapsible sidebar to project space.

**Architecture:** Add one presentation-only shared workspace shell, keep business selection in the existing containers, and split the current generic sidebar flag into configuration-center and project-space layout state. Convert transfer configuration from a card launcher to direct left-nav switching while preserving all existing template operations.

**Tech Stack:** Next.js 14, React 18, TypeScript, Zustand 4, Ant Design 6, global CSS, Node source-contract scripts.

---

## File map

- Create `src/components/shared/CollapsibleWorkspace.tsx`: reusable equal-height workspace and sidebar with fixed bottom-right toggle.
- Create `scripts/verify-collapsible-sidebars.mjs`: source contract for state isolation, shared shell use, navigation mapping, accessibility, and CSS behavior.
- Modify `src/stores/ui.ts`: replace the shared flag with independent configuration and project-space flags/actions.
- Modify `src/containers/ConfigContainer.tsx`: use the shared shell for plan templates and pass configuration layout state to transfer and enum tabs.
- Modify `src/components/transfer/TransferModule.tsx`: replace the home launcher with direct left-nav configuration switching.
- Modify `src/components/config/EnumConfig.tsx`: use the shared shell and render icon/tooltips in collapsed mode.
- Modify `src/containers/ProjectSpaceContainer.tsx`: wrap the existing menu in the shared sidebar without bypassing navigation guards.
- Modify `src/styles/globals.css`: define equal-height, collapsed, responsive, focus, and reduced-motion rules.
- Modify `package.json`: expose the new source-contract command.

### Task 1: Define the failing sidebar contract

**Files:**
- Create: `scripts/verify-collapsible-sidebars.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the source contract**

Create a Node assertion script that checks:

```js
assert.match(uiStore, /configSidebarCollapsed:\s*boolean/)
assert.match(uiStore, /projectSpaceSidebarCollapsed:\s*boolean/)
assert.match(sharedShell, /aria-expanded=\{!collapsed\}/)
assert.match(sharedShell, /pms-collapsible-sidebar__toggle/)
assert.match(configContainer, /<ConfigWorkspaceShell/)
assert.match(transferModule, /转维材料/)
assert.match(transferModule, /评审要素/)
assert.doesNotMatch(transferModule, /管理转维CheckList模板/)
assert.match(enumConfig, /<ConfigWorkspaceShell/)
assert.match(projectSpace, /projectSpaceSidebarCollapsed/)
assert.match(styles, /prefers-reduced-motion:\s*reduce/)
```

Add the package command:

```json
"verify:collapsible-sidebars": "node scripts/verify-collapsible-sidebars.mjs"
```

- [ ] **Step 2: Run the contract and verify failure**

Run: `npm run verify:collapsible-sidebars`

Expected: FAIL because the two isolated states and shared shell do not exist.

- [ ] **Step 3: Commit the failing contract**

```bash
git add package.json scripts/verify-collapsible-sidebars.mjs
git commit -m "test: define collapsible sidebar contract"
```

### Task 2: Add shared layout state and shell

**Files:**
- Create: `src/components/shared/CollapsibleWorkspace.tsx`
- Modify: `src/stores/ui.ts`
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Split UI layout state**

Replace `sidebarCollapsed` with the exact fields and actions:

```ts
configSidebarCollapsed: boolean
projectSpaceSidebarCollapsed: boolean
setConfigSidebarCollapsed: (value: boolean | ((previous: boolean) => boolean)) => void
setProjectSpaceSidebarCollapsed: (value: boolean | ((previous: boolean) => boolean)) => void
```

Both states default to `false`; each setter updates only its own field.

- [ ] **Step 2: Add the shared shell**

Implement:

```tsx
export function CollapsibleSidebarShell({
  collapsed,
  onCollapsedChange,
  title,
  ariaLabel,
  children,
  expandedWidth = 250,
  collapsedWidth = 64,
}: CollapsibleSidebarShellProps) {
  return (
    <aside
      className={`pms-collapsible-sidebar${collapsed ? ' is-collapsed' : ''}`}
      aria-label={ariaLabel}
      style={{ '--pms-sidebar-expanded-width': `${expandedWidth}px`, '--pms-sidebar-collapsed-width': `${collapsedWidth}px` } as React.CSSProperties}
    >
      {!collapsed && <div className="pms-collapsible-sidebar__title">{title}</div>}
      <div className="pms-collapsible-sidebar__content">{children}</div>
      <Tooltip title={collapsed ? '展开侧栏' : '收起侧栏'} placement="right">
        <Button
          className="pms-collapsible-sidebar__toggle"
          type="text"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          aria-label={collapsed ? '展开侧栏' : '收起侧栏'}
          aria-expanded={!collapsed}
          onClick={() => onCollapsedChange(!collapsed)}
        />
      </Tooltip>
    </aside>
  )
}
```

`ConfigWorkspaceShell` renders the sidebar and a `.pms-config-workspace__content` region in one grid.

- [ ] **Step 3: Add stable layout CSS**

Define:

```css
.pms-config-workspace {
  display: grid;
  grid-template-columns: var(--pms-config-sidebar-width, 250px) minmax(0, 1fr);
  gap: 16px;
  min-height: max(520px, calc(100dvh - 176px));
  align-items: stretch;
}

.pms-collapsible-sidebar {
  position: relative;
  min-height: 100%;
  padding-bottom: 64px;
  overflow: hidden;
}

.pms-collapsible-sidebar__content {
  height: 100%;
  overflow-y: auto;
}

.pms-collapsible-sidebar__toggle {
  position: absolute;
  right: 12px;
  bottom: 12px;
  width: 44px;
  height: 44px;
}
```

At `max-width: 767px`, switch configuration workspaces to one column and hide the collapse control. Under `prefers-reduced-motion: reduce`, remove all workspace/sidebar transitions.

- [ ] **Step 4: Run type-check and the expected partially failing contract**

Run: `npx tsc --noEmit && npm run verify:collapsible-sidebars`

Expected: Type-check may fail at old `sidebarCollapsed` consumers; the contract continues to fail until all consumers are migrated.

- [ ] **Step 5: Commit shared infrastructure**

```bash
git add src/components/shared/CollapsibleWorkspace.tsx src/stores/ui.ts src/styles/globals.css
git commit -m "feat: add shared collapsible workspace shell"
```

### Task 3: Unify the three configuration tabs

**Files:**
- Modify: `src/containers/ConfigContainer.tsx`
- Modify: `src/components/transfer/TransferModule.tsx`
- Modify: `src/components/config/EnumConfig.tsx`
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Migrate plan templates**

Read `configSidebarCollapsed` and `setConfigSidebarCollapsed` from the UI Store. Replace the `Row`/`Col` conditional-width plan layout with `ConfigWorkspaceShell`; keep `navigateWithEditGuard`, selected project type, and plan-level selection unchanged.

- [ ] **Step 2: Convert transfer configuration to direct navigation**

Add these props to `TransferModuleProps`:

```ts
configSidebarCollapsed: boolean
setConfigSidebarCollapsed: (value: boolean) => void
```

Render `ConfigWorkspaceShell` for every transfer state. The left nav contains:

```ts
[
  { key: 'checklist', icon: <FileTextOutlined />, label: '转维材料' },
  { key: 'review', icon: <AuditOutlined />, label: '评审要素' },
]
```

Normalize `home` to `checklist` for display, remove the launcher cards, and keep the existing search, import/export, version selection, version comparison modal, columns, and data.

- [ ] **Step 3: Migrate enum configuration**

Change `EnumConfig` to accept:

```ts
interface EnumConfigProps {
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
}
```

Use `ConfigWorkspaceShell`. In collapsed mode render category/type icons with Tooltip and accessible labels; keep the fixed tOS registry, CRUD modal, hydration recovery, and empty HR-pipeline state unchanged.

- [ ] **Step 4: Normalize visual states**

Use the shared classes for card radius, border, shadow, active rows, single-line ellipsis, and bottom padding. Remove the old `.pms-enum-config` grid sizing and the plan-template-specific sticky sidebar width rules that conflict with the shell.

- [ ] **Step 5: Run contracts and type-check**

Run:

```bash
npm run verify:collapsible-sidebars
npm run verify:enum-config
npx tsc --noEmit
```

Expected: all three commands PASS.

- [ ] **Step 6: Commit configuration-center integration**

```bash
git add src/containers/ConfigContainer.tsx src/components/transfer/TransferModule.tsx src/components/config/EnumConfig.tsx src/styles/globals.css
git commit -m "feat: unify configuration workspaces"
```

### Task 4: Add the project-space collapsible sidebar

**Files:**
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `src/styles/globals.css`
- Modify: `scripts/verify-collapsible-sidebars.mjs`

- [ ] **Step 1: Read the independent project-space state**

Destructure:

```ts
projectSpaceSidebarCollapsed,
setProjectSpaceSidebarCollapsed,
```

from `useUiStore()` and remove the unused generic `sidebarCollapsed` destructuring.

- [ ] **Step 2: Wrap the existing menu**

Replace the fixed-width sidebar div with `CollapsibleSidebarShell` using `expandedWidth={200}` and `collapsedWidth={64}`. Configure the Ant Design Menu with `inlineCollapsed={projectSpaceSidebarCollapsed}` and preserve:

```tsx
onClick={({ key }) => navigateWithEditGuard(() => {
  setProjectSpaceModule(key)
  transfer.setTransferView(null)
})}
```

Keep all current menu keys, icons, labels, selected state, and module rendering unchanged.

- [ ] **Step 3: Add project-space layout CSS**

Reserve bottom space for the fixed toggle, keep the menu independently scrollable, preserve the current selected indicator in both widths, and allow the content flex item to use `min-width: 0`.

- [ ] **Step 4: Run project-space regression contracts**

Run:

```bash
npm run verify:collapsible-sidebars
node scripts/verify-project-space-permission-matrix.mjs
node scripts/verify-technical-project.mjs
npx tsc --noEmit
```

Expected: all commands PASS.

- [ ] **Step 5: Commit project-space integration**

```bash
git add src/containers/ProjectSpaceContainer.tsx src/styles/globals.css scripts/verify-collapsible-sidebars.mjs
git commit -m "feat: collapse project space navigation"
```

### Task 5: Full verification and visual acceptance

**Files:**
- Modify only if verification finds a defect.

- [ ] **Step 1: Run focused contracts**

```bash
npm run verify:collapsible-sidebars
npm run verify:enum-config
node scripts/verify-project-space-permission-matrix.mjs
node scripts/verify-technical-project.mjs
```

Expected: all commands PASS.

- [ ] **Step 2: Run repository gates**

```bash
npx tsc --noEmit
npm run build
git diff --check
```

Expected: type-check and build exit 0; diff check has no output.

- [ ] **Step 3: Manually verify in the browser**

Start `npm run dev` and verify:

1. All three configuration tabs use equal-height left/right cards.
2. The configuration sidebar stays collapsed or expanded while switching tabs.
3. Transfer material and review-element navigation switches the existing table and actions directly.
4. Enum category/type selection and enum CRUD still work.
5. Project-space sidebar collapses independently, menu tooltips work, and guarded navigation remains intact.
6. The bottom-right toggle remains visible at short viewport heights.
7. At widths below 768px, the configuration nav stacks without an unusable 64px rail.

- [ ] **Step 4: Commit any verification fixes**

```bash
git add -u src scripts package.json
git commit -m "fix: polish collapsible sidebar interactions"
```
