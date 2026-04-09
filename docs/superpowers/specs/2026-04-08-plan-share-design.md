# Plan Share Feature Design

## Overview

Add a share button to published plans (L1 now, L2 later) that copies a public link. The link opens a standalone read-only page showing the latest published plan with full view capabilities.

## URL Design

```
/share/plan?projectId={id}&level=level1
/share/plan?projectId={id}&level=level2&planType={planTypeName}   # future
```

Single route (`/share/plan/page.tsx`), behavior driven by query parameters.

## Share Button (Main App Changes)

### Location
Next to ActionButtons in the L1 plan toolbar, same row as publish/revision buttons.

### Visibility Conditions
- Current user has `plan:一级计划-查看` permission for the project
- At least one published version exists (`versions.some(v => v.status === '已发布')`)

### Behavior
1. Click `ShareAltOutlined` button
2. Build URL: `${window.location.origin}/share/plan?projectId=${selectedProject.id}&level=level1`
3. Copy to clipboard via `navigator.clipboard.writeText()`
4. Show `message.success('分享链接已复制')`

### Style
- `Button` with `type="default"`, `icon={<ShareAltOutlined />}`, text "分享"
- Matches existing ActionButtons visual style

## Share Page (`/share/plan/page.tsx`)

### Data Loading
- Parse `projectId`, `level`, `planType` from URL search params
- Load project from `initialProjects` by ID
- Load latest published version's L1 tasks
- For 整机产品项目: load `marketPlanData` with all markets
- If project not found or no published version: show Empty state with message

### Page Layout

#### Header Info Bar
```
[TypeTag] ProjectName · 一级计划    V3 已发布  |  发布时间: 2026-03-15  |  SPM: 李白
```

- **Title**: `{projectName} · 一级计划` (L2 future: `{projectName} · {planTypeName}`)
- **Type tag**: Color-coded by project type (purple/blue/orange/green), same as main app
- **Version badge**: Latest published version number + "已发布" tag
- **Metadata**: Publish date, SPM name

#### Toolbar
Left side:
- 整机产品项目: Market tabs (e.g., OP / TR / RU) from `selectedProject.markets`
- Search input (filters by taskName and responsible)
- Column settings button (visible only in vertical table view, opens checkbox modal)

Right side:
- View switcher: 竖版表格 / 横版表格 / 甘特图

#### Content Area
Three view modes, all read-only:

1. **竖版表格 (Vertical Table)** — Reuse `TaskTable` component
   - `isEditMode={false}`
   - Supports `visibleColumns` and `searchText` filtering
   - No drag-and-drop, no add/delete

2. **横版表格 (Horizontal Table)** — Reuse `HorizontalTable` component
   - Shows published versions as rows, milestones as columns
   - Inherently read-only

3. **甘特图 (Gantt Chart)** — Reuse `GanttChart` component
   - `isEditMode={false}`
   - Read-only: no drag-to-reschedule

### Market Switching (整机产品项目 only)
- Show tab bar with project's `markets` array
- Default to first market
- Switching market loads that market's plan data from `marketPlanData[market].tasks`
- Non-整机 projects: no market tabs, use default tasks directly

### No Permission Check
The share page is fully public. No login required, no permission checks.

### Error States
- `projectId` missing or not found: Show Empty with "项目不存在"
- No published version: Show Empty with "该项目暂无已发布的计划"

## Styling
- Same purple glassmorphism theme (imports `globals.css`)
- Page has a clean centered layout with max-width container
- Header uses glass card with gradient, consistent with main app

## Component Reuse
All plan view components are already exported from `PlanModule.tsx`:
- `TaskTable` — vertical table
- `HorizontalTable` — horizontal matrix
- `GanttChart` — Gantt diagram

The share page imports and renders them with read-only props.

## Extensibility for L2 Plans
- Same route, `level=level2&planType=xxx` params
- Page component checks `level` param and renders appropriate view
- L2 share button added to L2 plan's ActionButtons (future work)
- Title changes to `{projectName} · {planTypeName}`
- L2 may have different available views (no horizontal table)

## Files to Create/Modify

### New
- `src/app/share/plan/page.tsx` — Standalone share page

### Modified
- `src/app/page.tsx` — Add share button next to L1 ActionButtons
- `src/components/plan/PlanModule.tsx` — Export `ALL_COLUMNS` constant (currently not exported, needed by share page for column settings)

## Out of Scope
- Link expiration or access tokens
- QR code generation
- L2 plan share implementation (design supports it, implementation is future)
- Backend API integration (mock data only)
