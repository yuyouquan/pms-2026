# 计划视图节点展开/收起设计

- **日期**: 2026-04-10
- **作用域**: 项目空间（`activeModule === 'projectSpace'`）内的一级计划与二级计划
- **影响文件**: 仅 `src/app/page.tsx`

## 1. 背景与目标

项目空间的一级计划与二级计划表格当前以扁平数组 + `indentLevel` 缩进模拟树结构，没有展开/收起能力；甘特图虽然内置了节点树，但也没有"全部展开/全部收起"的快捷入口。需要为这两种视图添加：

- **单个节点的展开 / 收起**（点击行首 chevron）
- **全部展开 / 全部收起**（工具栏按钮）
- **同项目内跨视图（表格 ↔ 甘特图）状态联动**

**目标**：在不破坏现有拖拽、编辑、添加子项等逻辑的前提下，实现最小侵入的展开/收起能力。

**非目标**：

- 横版表格（`renderHorizontalTable`）的展开/收起（它本身不是层级结构）
- 配置中心的 `renderTaskTable` 调用（超出作用域，保持零影响）
- localStorage 持久化
- 记住"展开到第 N 层"偏好
- 展开/收起快捷键
- 动画（除 chevron 的 rotate transition）

## 2. 功能规格

### 2.1 作用范围

- **表格视图**：项目空间 L1（`projectPlanLevel === 'level1' && projectPlanViewMode === 'table'`）和 L2（`projectPlanLevel === 'level2' && activeLevel2Plan`）
- **甘特图视图**：项目空间 L1 和 L2 的 `projectPlanViewMode === 'gantt'`
- **不生效**：横版表格、配置中心的模板编辑（即使复用了 `renderTaskTable`）

### 2.2 默认状态

首次打开、切换项目、切换 L1/L2、切换表格/甘特图 Tab：**全部展开**（collapsed 集合为空）。

### 2.3 持久化

- 在同一个浏览器会话 + 同一个 project 内的同一个 level/plan 上下文：跨表格 ↔ 甘特图切换**保留**展开状态
- 切换 project、切换 L1/L2、切换 plan（L2 内的不同计划）：天然隔离到不同 scope key，彼此状态独立
- 刷新页面：不持久化到 localStorage，回到默认（全部展开）

### 2.4 交互

- **单节点展开/收起**：在"序号"列第一格内、`DragHandle` 之后、`canAddChild` 按钮之前，渲染一个 ▶/▼ chevron 图标。仅在有子节点的行显示；叶子行渲染一个 14px 宽的占位，保持列宽对齐。
- **全部展开/收起按钮**：项目空间计划工具栏，放在"切换视图"（Radio）旁边；仅在 `getScopeKey() !== null` 时显示。
- **甘特图联动**：双向——表格侧修改 → gantt 实例；gantt 侧点击 → React state。

## 3. 状态模型

```ts
// 顶层新增 state
const [collapsedNodes, setCollapsedNodes] = useState<Record<string, Set<string>>>({})
```

- **key 格式**: `${projectId}::level1` 或 `${projectId}::level2::${planId}`
- **value**: `Set<string>`——折叠起来的节点 id 集合。空集 = 默认（全部展开）。

**选择"折叠集合"而非"展开集合"的理由**：默认状态是全部展开，存差异项（折叠）让 empty state 有自然含义，无需预计算所有可展开 id。

**scope key 生成**：

```ts
const getScopeKey = (): string | null => {
  if (activeModule !== 'projectSpace') return null
  if (!selectedProject) return null
  if (projectPlanLevel === 'level1') return `${selectedProject.id}::level1`
  if (projectPlanLevel === 'level2' && activeLevel2Plan) return `${selectedProject.id}::level2::${activeLevel2Plan}`
  return null
}
```

**清除时机**：无需主动清除。project / level / plan 切换 → key 变化 → 自然拿到新 scope 的状态（可能为空）；旧 scope 的状态保留在 `collapsedNodes` 对象里，下次切回来时复用。

## 4. 辅助函数

放在 `page.tsx` 顶层（其他 `handleXxx` 附近）：

```ts
// 判断某个 id 是否有子节点
const hasChildren = (id: string, allTasks: any[]): boolean =>
  allTasks.some(t => t.parentId === id)

// 过滤扁平数组：如果任一祖先在 collapsedSet 中，则剔除该行
const filterByCollapsed = (flatTasks: any[], collapsedSet: Set<string>): any[] => {
  if (collapsedSet.size === 0) return flatTasks
  const byId = new Map(flatTasks.map(t => [t.id, t]))
  const isHidden = (task: any): boolean => {
    let cur = task
    while (cur.parentId) {
      if (collapsedSet.has(cur.parentId)) return true
      cur = byId.get(cur.parentId)
      if (!cur) return false
    }
    return false
  }
  return flatTasks.filter(t => !isHidden(t))
}

// 所有"有子节点的"id 集合
const getAllExpandableIds = (tasks: any[]): string[] => {
  const parentIds = new Set<string>()
  for (const t of tasks) if (t.parentId) parentIds.add(t.parentId)
  return Array.from(parentIds)
}

// 切换单个节点
const toggleNode = (nodeId: string) => {
  const key = getScopeKey()
  if (!key) return
  setCollapsedNodes(prev => {
    const cur = new Set(prev[key] || [])
    if (cur.has(nodeId)) cur.delete(nodeId); else cur.add(nodeId)
    return { ...prev, [key]: cur }
  })
}

// 全部展开
const expandAll = () => {
  const key = getScopeKey()
  if (!key) return
  setCollapsedNodes(prev => ({ ...prev, [key]: new Set<string>() }))
}

// 全部收起（折叠当前作用域内所有有子节点的行）
const collapseAll = () => {
  const key = getScopeKey()
  if (!key) return
  const scopeTasks = projectPlanLevel === 'level1'
    ? tasks
    : level2PlanTasks.filter(t => t.planId === activeLevel2Plan)
  const allParents = getAllExpandableIds(scopeTasks)
  setCollapsedNodes(prev => ({ ...prev, [key]: new Set(allParents) }))
}
```

## 5. `renderTaskTable` 改造

### 5.1 数据过滤

在 `renderTaskTable` 函数体开头：

```ts
const scopeKey = getScopeKey()
const collapsedSet = scopeKey ? (collapsedNodes[scopeKey] || new Set<string>()) : new Set<string>()
const expandEnabled = scopeKey !== null
```

在现有 `flatTasks` 构建后，加一步过滤：

```ts
const flatTasks = tableTasks.map(task => ({ ...task, indentLevel: getTaskDepth(task, tableTasks) }))
const visibleTasks = expandEnabled ? filterByCollapsed(flatTasks, collapsedSet) : flatTasks
```

Table 的 `dataSource` 和 `SortableContext items` 都改为 `visibleTasks`（前者显示，后者让拖拽只在可见行之间发生）。

### 5.2 序号列 chevron

在序号列（当前 line 1675 附近）的 render 中，在 `DragHandle` 之后、`canAddChild` 按钮之前插入：

```tsx
{expandEnabled && hasChildren(record.id, tableTasks) && (
  <span
    onClick={(e) => { e.stopPropagation(); toggleNode(record.id) }}
    style={{
      cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
      width: 14, height: 14, color: '#9ca3af', transition: 'transform 0.15s',
      transform: collapsedSet.has(record.id) ? 'rotate(-90deg)' : 'rotate(0deg)',
    }}
  >
    <CaretDownOutlined style={{ fontSize: 10 }} />
  </span>
)}
{expandEnabled && !hasChildren(record.id, tableTasks) && (
  <span style={{ display: 'inline-block', width: 14 }} />
)}
```

**不改动**：

- 列定义的其他部分（`visibleColumns` 过滤、paddingLeft 缩进、`isEditMode` 分支）
- 拖拽逻辑 `handleTableDragEnd`（仍基于完整的 `tableTasks`）
- 编辑 / 删除 / 添加子项的处理函数
- `canAddChild` 的可见性规则

## 6. 工具栏按钮

在项目空间计划工具栏（靠近 `projectPlanViewMode` Radio 切换按钮，大约 line 2860 附近）插入：

```tsx
{getScopeKey() !== null && (
  <Space size={4}>
    <Tooltip title="全部展开">
      <Button icon={<PlusSquareOutlined />} size="small" style={{ borderRadius: 6 }} onClick={expandAll} />
    </Tooltip>
    <Tooltip title="全部收起">
      <Button icon={<MinusSquareOutlined />} size="small" style={{ borderRadius: 6 }} onClick={collapseAll} />
    </Tooltip>
  </Space>
)}
```

按钮在表格视图和甘特图视图下都显示（操作同一个 scope 的 `collapsedNodes`，自动被甘特图 effect 感知并同步）。

**新增图标导入**：`PlusSquareOutlined`, `MinusSquareOutlined`, `CaretDownOutlined` from `@ant-design/icons`。

## 7. 甘特图联动

### 7.1 `DHTMLXGantt` 组件扩展

新增两个可选 prop：

```ts
collapsedIds?: Set<string>
onCollapsedChange?: (updater: (prev: Set<string>) => Set<string>) => void
```

新增一个 `useRef<boolean>` 作为防回流标志：

```ts
const suppressFeedback = useRef(false)
```

### 7.2 React state → gantt 实例

在组件内新增一个 effect，监听 `collapsedIds` 变化：

```ts
useEffect(() => {
  if (!ganttContainer.current || !gantt.$container) return
  suppressFeedback.current = true
  gantt.eachTask((task) => {
    const id = String(task.id)
    const shouldOpen = !(collapsedIds && collapsedIds.has(id))
    if (task.$open !== shouldOpen) {
      if (shouldOpen) gantt.open(id)
      else gantt.close(id)
    }
  })
  // 下一 tick 解开防回流
  queueMicrotask(() => { suppressFeedback.current = false })
}, [collapsedIds])
```

### 7.3 gantt 事件 → React state

在 gantt `init` 后、`parse` 前注册事件：

```ts
const openHandler = gantt.attachEvent('onTaskOpened', (id) => {
  if (suppressFeedback.current) return
  onCollapsedChange?.(prev => { const s = new Set(prev); s.delete(String(id)); return s })
})
const closeHandler = gantt.attachEvent('onTaskClosed', (id) => {
  if (suppressFeedback.current) return
  onCollapsedChange?.(prev => { const s = new Set(prev); s.add(String(id)); return s })
})
```

清理时解绑（在 effect cleanup）：

```ts
gantt.detachEvent(openHandler)
gantt.detachEvent(closeHandler)
```

**parse 期间的抑制**：`gantt.parse()` 内部可能也会触发 open/closed 事件。在 parse 调用前后包裹：

```ts
suppressFeedback.current = true
gantt.parse(ganttData)
queueMicrotask(() => { suppressFeedback.current = false })
```

### 7.4 `open_tree_initial`

保留 `gantt.config.open_tree_initial = true` 作为 fallback；上面的 collapsed effect 会在每次 parse + prop 变化后覆盖它。

### 7.5 在 `renderGanttChart` 处接入

```tsx
const renderGanttChart = (customTasks?: any[]) => {
  const ganttTasks = customTasks || filteredTasks
  const key = getScopeKey()
  const collapsedSet = key ? (collapsedNodes[key] || new Set<string>()) : new Set<string>()
  return (
    <div style={{ padding: 16 }}>
      <DHTMLXGantt
        tasks={ganttTasks}
        onTaskClick={handleGanttTaskClick}
        readOnly={!isEditMode}
        collapsedIds={collapsedSet}
        onCollapsedChange={(updater) => {
          if (!key) return
          setCollapsedNodes(prev => {
            const current = prev[key] || new Set<string>()
            const next = updater(current)
            return { ...prev, [key]: next }
          })
        }}
      />
    </div>
  )
}
```

## 8. 边界情况

1. **折叠节点下的隐藏行被编辑**：编辑入口只在可见行显示，不会发生。
2. **拖拽与折叠**：`SortableContext items` 传 `visibleTasks.map(t=>t.id)`；折叠的子树跟随父行整体移动（`collectDescendants` 基于完整的 `tableTasks`）。
3. **编辑模式下折叠仍允许**：进入/退出编辑模式不清状态。
4. **空树 / 无子节点**：`getAllExpandableIds` 返回空；"全部收起"变 no-op；chevron 不渲染。
5. **`visibleTasks` 小于 `tableTasks`**：`renderTaskTable` 内 Table 使用 `pagination={false}`（已确认 line 1825），无分页总数计算问题。
6. **切换 project / level / plan**：scopeKey 变化 → 取到新 scope 的（可能空的）集合；旧 scope 的状态保留。
7. **配置中心的 `renderTaskTable` 调用**：`getScopeKey()` 返回 null → `expandEnabled === false` → 完全同现状，零影响。
8. **DHTMLX gantt 事件重复触发**：`suppressFeedback` ref 保证我方主动调用不回写。

## 9. 改动清单

| 文件 | 改动 | 估计行数 |
|---|---|---|
| `src/app/page.tsx` | 顶层新增 `collapsedNodes` state、`getScopeKey`、`toggleNode`、`expandAll`、`collapseAll` + 辅助函数 | +50 |
| `src/app/page.tsx` | `renderTaskTable`：加 collapsed 过滤 + 序号列 chevron + `visibleTasks` | +30 |
| `src/app/page.tsx` | `renderGanttChart`：传 `collapsedIds` / `onCollapsedChange` prop | +15 |
| `src/app/page.tsx` | `DHTMLXGantt` 组件：两个新 prop、同步 effect、gantt 事件、`suppressFeedback` ref | +40 |
| `src/app/page.tsx` | 项目空间计划工具栏：插入"全部展开/全部收起"两个按钮 | +15 |
| 导入 | `PlusSquareOutlined`, `MinusSquareOutlined`, `CaretDownOutlined` from `@ant-design/icons` | +1 |

**总计**：约 150 行，单文件。

**不需要改动**：CSS、mock 数据、其他组件、`renderHorizontalTable`、config 中心的 `renderTaskTable` 调用。

## 10. 测试 / 验证点

项目没有测试框架，验证 = `npx tsc --noEmit` + `npm run build` + 浏览器手动验证：

- [ ] 进入项目空间 L1 计划，表格视图显示正常（与改动前一致，默认全部展开）
- [ ] 有子节点的行显示 ▶/▼ chevron，叶子行不显示
- [ ] 点击 chevron 折叠该节点，其子孙行被隐藏；再点展开
- [ ] 点击工具栏"全部收起"，所有父节点折叠
- [ ] 点击"全部展开"，恢复全部显示
- [ ] 切到甘特图视图，之前折叠的节点在甘特图里也是收起状态
- [ ] 在甘特图内点击某个节点的折叠按钮，切回表格，该节点也处于折叠状态
- [ ] 切换 L1 ↔ L2，各自状态独立（L2 不受 L1 的折叠影响）
- [ ] 切换 L2 的不同 plan，各 plan 状态独立
- [ ] 切换不同 project，折叠状态独立
- [ ] 编辑模式下折叠仍可用，编辑行的拖拽不受折叠影响
- [ ] 配置中心的模板编辑不显示 chevron、不显示工具栏按钮、行为与现状一致
- [ ] `npx tsc --noEmit` 通过
- [ ] `npm run build` 通过

## 11. YAGNI — 明确不做

- ❌ localStorage 持久化
- ❌ "展开到第 N 层"快捷
- ❌ 键盘快捷键
- ❌ 展开/收起的复杂动画
- ❌ 抽出独立组件文件（改动集中在已有函数内部，不值得为 ~150 行新建文件）
- ❌ 横版表格、配置中心的展开/收起
