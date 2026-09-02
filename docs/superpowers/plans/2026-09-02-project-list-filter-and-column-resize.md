# Project List Filter and Column Resize Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 精简项目列表快捷筛选和 tOS 列表字段，并增加与现有表头整块排序兼容的飞书式列宽拖动。

**Architecture:** 字段与筛选范围继续由 `projectListMatrix` 统一定义；新增纯函数模块负责列宽归一化和范围限制；表格保存宽度偏好并向表头注入拖动回调；表头右缘手势通过阻止事件传播与 dnd-kit 排序隔离。

**Tech Stack:** Next.js 14、React 18、Ant Design 6、dnd-kit、TypeScript、Node 源码契约测试、Playwright 浏览器验收。

---

### Task 1: 锁定筛选和 tOS 字段矩阵

**Files:**
- Modify: `scripts/verify-project-list-matrix.mjs`
- Modify: `src/lib/projectListMatrix.ts`
- Modify: `src/components/project-summary/ProjectSummaryTable.tsx`

- [ ] **Step 1: Write the failing test**

将矩阵断言更新为：

```js
assert.deepEqual(matrix.PROJECT_LIST_QUICK_FILTERS.machine.map(item => item.label), ['项目名称', '首销tOS版本', '芯片编码', '研发模式'])
assert.deepEqual(matrix.PROJECT_LIST_QUICK_FILTERS.technicalTdt.map(item => item.label), ['项目名称', '技术赛道', 'TMG及技术领域'])
assert.deepEqual(matrix.PROJECT_LIST_QUICK_FILTERS.technicalSubproject.map(item => item.label), ['子任务名称', '所属TDT项目名称'])
assert.deepEqual(matrix.getProjectListFieldDefinitions('tos', [], 'tOS版本项目').map(item => item.label), ['tOS版本', '版本项目经理'])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/verify-project-list-matrix.mjs`

Expected: FAIL，现有快捷筛选仍包含品牌/产品系列/产品类型，tOS 静态列仍包含版本类型与项目状态。

- [ ] **Step 3: Write minimal implementation**

在矩阵中改为以下定义，并让表格按当前 `matrixVariant` 生成控件：

```ts
export const PROJECT_LIST_QUICK_FILTERS = {
  machine: [projectName, firstSaleTosVersion, chipCode, researchMode],
  tos: [projectName],
  technicalTdt: [projectName, technicalTrack, tmg],
  technicalSubproject: [projectNameAsSubtaskName, parentProjectName],
} as const
```

tOS 静态列只保留 `tosVersion` 与 `spm`，将 `spm` 标签改为“版本项目经理”；动态模板列仍由 `buildProjectListColumnUnits` 汇总成“里程碑”。

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/verify-project-list-matrix.mjs`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add scripts/verify-project-list-matrix.mjs src/lib/projectListMatrix.ts src/components/project-summary/ProjectSummaryTable.tsx
git commit -m "feat: refine project list filters and tos columns"
```

### Task 2: 增加可持久化列宽模型

**Files:**
- Create: `src/lib/projectListColumnWidth.ts`
- Modify: `scripts/verify-project-list-header-reorder.mjs`
- Modify: `src/components/project-summary/ProjectSummaryTable.tsx`

- [ ] **Step 1: Write the failing test**

```js
const widths = widthModel.normalizeProjectListColumnWidths(
  [{ key: 'projectName', width: 200 }, { key: 'milestone::STR1', width: 132 }],
  { projectName: 40, 'milestone::STR1': 1000, removed: 120 },
)
assert.deepEqual(widths, { projectName: 80, 'milestone::STR1': 600 })
assert.equal(widthModel.resizeProjectListColumnWidth(200, 45), 245)
```

同时增加源码契约：偏好结构包含 `columnWidths`，列宽参与 `scrollWidth`，新增模板字段使用默认宽度。

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/verify-project-list-header-reorder.mjs`

Expected: FAIL，列宽模块和偏好字段尚不存在。

- [ ] **Step 3: Write minimal implementation**

```ts
export const PROJECT_LIST_COLUMN_WIDTH_MIN = 80
export const PROJECT_LIST_COLUMN_WIDTH_MAX = 600
export const clampProjectListColumnWidth = (width: number) => Math.min(MAX, Math.max(MIN, Math.round(width)))
export function normalizeProjectListColumnWidths(definitions, stored) { /* 仅保留当前字段并限制范围 */ }
export const resizeProjectListColumnWidth = (startWidth: number, deltaX: number) => clampProjectListColumnWidth(startWidth + deltaX)
```

表格状态保存 `Record<string, number>`，水合时兼容旧偏好；构造列时用保存宽度覆盖定义宽度，滚动宽度使用最终宽度。

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/verify-project-list-header-reorder.mjs`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/lib/projectListColumnWidth.ts scripts/verify-project-list-header-reorder.mjs src/components/project-summary/ProjectSummaryTable.tsx
git commit -m "feat: persist project list column widths"
```

### Task 3: 实现飞书式末级表头宽度拖动

**Files:**
- Modify: `src/components/project-summary/SortableProjectListHeader.tsx`
- Modify: `src/components/project-summary/ProjectSummaryTable.tsx`
- Modify: `src/styles/globals.css`
- Modify: `scripts/verify-project-list-header-reorder.mjs`

- [ ] **Step 1: Write the failing test**

新增源码契约断言：表头提供 `projectListResizable`、`onProjectListResize` 和右缘 handle；handle 的 pointer 事件调用 `stopPropagation`；表格壳使用 `data-column-resize-active` 和 CSS 变量；CSS 命中区 8px、贯穿线 1px。

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/verify-project-list-header-reorder.mjs`

Expected: FAIL，尚无 resize handle 和贯穿线。

- [ ] **Step 3: Write minimal implementation**

表头末级单元格渲染：

```tsx
<span
  className="pms-project-list-column-resize-handle"
  role="separator"
  aria-label={`调整${unitLabel}列宽`}
  onPointerDown={event => {
    event.preventDefault()
    event.stopPropagation()
    startResize({ key: leafKey, clientX: event.clientX, width: currentWidth })
  }}
/>
```

窗口级 `pointermove` 实时上报宽度和贯穿线位置，`pointerup` 提交并清理；表格向末级列 `onHeaderCell` 注入回调，组表头不显示 handle。

```css
.pms-project-list-column-resize-handle { right: -4px; width: 8px; cursor: col-resize; }
.pms-project-list-column-resize-handle::after { width: 1px; opacity: 0; }
.pms-project-list-column-resize-handle:hover::after { opacity: 1; }
.pms-project-summary-table-shell[data-column-resize-active="true"]::before { width: 1px; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/verify-project-list-header-reorder.mjs`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/components/project-summary/SortableProjectListHeader.tsx src/components/project-summary/ProjectSummaryTable.tsx src/styles/globals.css scripts/verify-project-list-header-reorder.mjs
git commit -m "feat: resize project list columns from headers"
```

### Task 4: 更新需求文档并完成自动验证

**Files:**
- Modify: `docs/prd/项目管理-一级计划+三级计划+配置中心PRD.md`

- [ ] **Step 1: Update PRD**

更新快捷筛选矩阵、tOS 列表字段及表头列宽拖动规则，删除与本次范围冲突的旧字段描述。

- [ ] **Step 2: Run source contracts**

Run:

```bash
node scripts/verify-project-list-matrix.mjs
node scripts/verify-project-list-header-reorder.mjs
node scripts/verify-project-summary.mjs
node scripts/verify-workbench-project-list.mjs
```

Expected: 全部 PASS。

- [ ] **Step 3: Run project verification**

Run: `npx tsc --noEmit && npm run build`

Expected: 类型检查和 Next.js 生产构建成功，无新增警告。

- [ ] **Step 4: Commit**

```bash
git add docs/prd/项目管理-一级计划+三级计划+配置中心PRD.md
git commit -m "docs: update project list filter and resize rules"
```

### Task 5: 浏览器回归与发布

**Files:**
- Modify: `screenshots/verify-project-list-header-reorder-browser.mjs`

- [ ] **Step 1: Extend browser verifier**

覆盖：三类快捷筛选标签、tOS 三字段配置、列宽拖动前后宽度差、顺序未变、1px 蓝线、刷新后宽度保留、原表头排序仍生效。

- [ ] **Step 2: Run browser verification**

Run: `node screenshots/verify-project-list-header-reorder-browser.mjs`

Expected: PASS，并生成验收截图。

- [ ] **Step 3: Push dev and deploy**

```bash
git push origin HEAD:dev
vercel --prod --yes
```

Expected: `origin/dev` 指向当前交付提交，生产别名更新。

- [ ] **Step 4: Verify production**

在线重复快捷筛选、tOS 字段和列宽拖动关键路径，确认线上构建与本地一致。
