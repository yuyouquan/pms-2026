# Project List Fullscreen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add page-level fullscreen presentation to project-list table and calendar views while preserving all current filters and state.

**Architecture:** `ProjectListContainer` owns one fullscreen state and switches the existing content container between normal and full-viewport layouts, so table/calendar component state is never duplicated or remounted. A focused CSS overlay supplies the full-viewport layout, while an effect handles `Esc` and body scroll locking. Existing table, calendar, filtering, and project-opening components remain unchanged.

**Tech Stack:** Next.js 14, React 18, TypeScript, Ant Design 6, CSS, Node source-contract scripts

---

### Task 1: Lock the fullscreen behavior contract

**Files:**
- Create: `scripts/verify-project-list-fullscreen.mjs`
- Modify: `scripts/verify-workbench-project-list.mjs`

- [ ] **Step 1: Write the failing focused contract**

Create a Node assertion script that reads `ProjectListContainer.tsx` and `globals.css` and checks these exact behaviors:

```js
assert.match(source, /const \[isFullscreen, setIsFullscreen\] = useState\(false\)/)
assert.match(source, /projectListView !== 'card'/)
assert.match(source, /FullscreenOutlined/)
assert.match(source, /FullscreenExitOutlined/)
assert.match(source, /event\.key === 'Escape'/)
assert.match(source, /pms-project-list-content.*is-fullscreen/)
assert.match(css, /\.pms-project-list-fullscreen/)
assert.doesNotMatch(source, /requestFullscreen|document\.exitFullscreen/)
```

- [ ] **Step 2: Run the focused contract and verify RED**

Run:

```bash
node scripts/verify-project-list-fullscreen.mjs
```

Expected: FAIL because the fullscreen state and controls do not exist.

- [ ] **Step 3: Add the focused contract to the workbench aggregate**

Add source assertions to `verify-workbench-project-list.mjs` for the visible “全屏” and “退出全屏” labels and the list/calendar-only condition.

- [ ] **Step 4: Commit the RED contract**

```bash
git add scripts/verify-project-list-fullscreen.mjs scripts/verify-workbench-project-list.mjs
git commit -m "test: define project list fullscreen behavior"
```

### Task 2: Implement the shared fullscreen shell

**Files:**
- Modify: `src/containers/ProjectListContainer.tsx`
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Add fullscreen state and lifecycle**

Import `useEffect`, `FullscreenOutlined`, and `FullscreenExitOutlined`, then add:

```tsx
const [isFullscreen, setIsFullscreen] = useState(false)

useEffect(() => {
  if (!isFullscreen) return
  const previousOverflow = document.body.style.overflow
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') setIsFullscreen(false)
  }
  document.body.style.overflow = 'hidden'
  document.addEventListener('keydown', handleKeyDown)
  return () => {
    document.body.style.overflow = previousOverflow
    document.removeEventListener('keydown', handleKeyDown)
  }
}, [isFullscreen])
```

- [ ] **Step 2: Keep one content mount and switch its layout class**

Replace the opening content `<div>` with this section and body wrapper, without changing the capability/list/calendar/card conditional that follows it:

```tsx
<section
  className={`pms-project-list-content ${isFullscreen ? 'is-fullscreen' : ''}`.trim()}
  aria-label={isFullscreen ? `${viewTitle}全屏展示` : undefined}
>
  {isFullscreen && <FullscreenHeader />}
  <div className="pms-project-list-content__body">
```

After the existing conditional's closing `</div>`, close the new body and section:

```tsx
  </div>
</section>
```

This step changes only the surrounding elements, classes, and fullscreen header, leaving every existing branch expression byte-for-byte in place.

- [ ] **Step 3: Add list/calendar fullscreen controls**

Above the normal content, render the button only for supported views:

```tsx
{projectListView !== 'card' && (
  <Button
    size="small"
    aria-label="全屏展示"
    icon={<FullscreenOutlined />}
    onClick={() => setIsFullscreen(true)}
  >全屏</Button>
)}
```

The conditional fullscreen header contains the current title and exit action:

```tsx
{isFullscreen && (
  <header className="pms-project-list-fullscreen__header">
    <strong>{viewTitle}</strong>
    <Button aria-label="退出全屏" icon={<FullscreenExitOutlined />} onClick={() => setIsFullscreen(false)}>
      退出全屏
    </Button>
  </header>
)}
```

- [ ] **Step 4: Add the viewport overlay styles**

Add focused styles to `globals.css`:

```css
.pms-project-list-content.is-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 1300;
  display: flex;
  flex-direction: column;
  background: #f5f7fb;
}
.pms-project-list-fullscreen__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 56px;
  padding: 8px 20px;
  background: rgba(255,255,255,0.96);
  border-bottom: 1px solid rgba(99,102,241,0.14);
  box-shadow: 0 4px 16px rgba(15,23,42,0.08);
}
.pms-project-list-content.is-fullscreen .pms-project-list-content__body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 16px;
}
```

- [ ] **Step 5: Run contracts and verify GREEN**

Run:

```bash
node scripts/verify-project-list-fullscreen.mjs
node scripts/verify-workbench-project-list.mjs
node scripts/verify-project-list-matrix.mjs
```

Expected: all pass.

- [ ] **Step 6: Commit implementation**

```bash
git add src/containers/ProjectListContainer.tsx src/styles/globals.css
git commit -m "feat: add project list fullscreen views"
```

### Task 3: Verify interaction and release

**Files:**
- Verify: `src/containers/ProjectListContainer.tsx`
- Verify: `src/styles/globals.css`

- [ ] **Step 1: Run static gates**

```bash
node scripts/verify-project-list-fullscreen.mjs
node scripts/verify-workbench-project-list.mjs
node scripts/verify-project-list-matrix.mjs
node scripts/verify-project-summary.mjs
npx tsc --noEmit
npm run build
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 2: Verify in browser**

Exercise both supported views:

1. List view shows “全屏”; card view does not.
2. List fullscreen covers Header and retains horizontal table scrolling.
3. “退出全屏” and `Esc` both return to the same list state.
4. Calendar fullscreen renders the same filtered rows and opens projects normally.
5. Entering/exiting does not reset category, status, quick filters, advanced filters, or “关于我的”.
6. Browser console contains no new error caused by this feature.

- [ ] **Step 3: Push feature and promote**

Push `codex/project-list-fullscreen`, merge it into fresh `origin/dev`, rerun the static gates, push dev, merge the verified dev commit into fresh `origin/master`, rerun the gates, push master, and confirm:

```bash
git merge-base --is-ancestor origin/codex/project-list-fullscreen origin/dev
git merge-base --is-ancestor origin/dev origin/master
test "$(git rev-parse origin/dev^{tree})" = "$(git rev-parse origin/master^{tree})"
```

Expected: feature is contained by dev, dev is contained by master, and both remote trees match.
