# 配置中心计划模板展开/收起设计

- **日期**: 2026-04-10
- **作用域**: 配置中心（`activeModule === 'config'`）的一级/二级计划模板表格
- **影响文件**: 仅 `src/app/page.tsx`
- **基础**: 2026-04-10 的 plan-expand-collapse feature（已合并）

## 1. 背景

已完成的 `plan-expand-collapse` feature 为项目空间的 L1/L2 计划表格和甘特图提供了节点展开/收起能力。根据用户反馈，配置中心的"一级计划模板配置"和"二级计划模板配置"也需要同样的能力。

配置中心只有表格视图（`viewMode` state 默认 `'table'` 且 UI 上没有切换到 `'gantt'` 的按钮，line 3960 的 gantt 分支在实际使用中不可达）。因此本 feature 只关注表格侧。

## 2. 目标

- 配置中心的表格模板编辑页显示行首 chevron（有子节点的行）
- 配置中心的工具栏增加"全部展开 / 全部收起"按钮
- 状态按 (projectType, level, planType) 分作用域隔离
- 不影响其他模块（项目空间、横版表格、转维等）

**非目标**：

- 配置中心甘特图支持（UI 不可达）
- 改变 L2 模板底层数据存储（当前 mock 共享 `tasks` state，属于已存在的约束）
- localStorage 持久化（承袭已有 feature 的选择）

## 3. Scope key 规则

扩展已有的 `getScopeKey()` 函数：

```ts
const getScopeKey = (): string | null => {
  if (activeModule === 'config') {
    if (planLevel === 'level1') return `config::${selectedProjectType}::level1`
    if (planLevel === 'level2') return `config::${selectedProjectType}::level2::${selectedPlanType}`
    return null
  }
  if (activeModule !== 'projectSpace') return null
  if (!selectedProject) return null
  if (projectPlanLevel === 'level1') return `${selectedProject.id}::level1`
  if (projectPlanLevel === 'level2' && activeLevel2Plan) return `${selectedProject.id}::level2::${activeLevel2Plan}`
  return null
}
```

**独立作用域**：

- `config::软件产品项目::level1` / `config::整机产品项目::level1` / ...（按 4 种 projectType 独立）
- `config::软件产品项目::level2::需求开发计划` / `config::软件产品项目::level2::在研版本火车计划` / ...（按 projectType × planType 独立）
- 项目空间的 key 格式 `${projectId}::...` 不含 `config::` 前缀，天然隔离

## 4. `collapseAll()` 改写

当前实现假设项目空间上下文。改写为先分 `activeModule`：

```ts
const collapseAll = () => {
  const key = getScopeKey()
  if (!key) return
  let scopeTasks: any[]
  if (activeModule === 'config') {
    // config 的 L1 和 L2 都使用共享的 tasks state（mock 简化）
    scopeTasks = tasks
  } else if (projectPlanLevel === 'level1') {
    scopeTasks = tasks
  } else {
    scopeTasks = level2PlanTasks.filter(t => t.planId === activeLevel2Plan)
  }
  const allParents = getAllExpandableIds(scopeTasks)
  setCollapsedNodes(prev => ({ ...prev, [key]: new Set(allParents) }))
}
```

## 5. 工具栏按钮

在配置中心工具栏 JSX（`src/app/page.tsx` line 3947-3954 附近），在 `<Col>` → `<Space size={6}>` 内的"自定义列" Tooltip 之后插入：

```tsx
{getScopeKey() !== null && (
  <>
    <Tooltip title="全部展开">
      <Button
        icon={<PlusSquareOutlined />}
        style={{ borderRadius: 6 }}
        onClick={expandAll}
      />
    </Tooltip>
    <Tooltip title="全部收起">
      <Button
        icon={<MinusSquareOutlined />}
        style={{ borderRadius: 6 }}
        onClick={collapseAll}
      />
    </Tooltip>
  </>
)}
```

**注意**：与项目空间工具栏相比，这里**不带 `size="small"`**，因为配置中心现有的"自定义列"按钮是默认 size，保持视觉一致。

## 6. 无需改动的部分

- **`renderTaskTable`**：已基于 `getScopeKey()` 判断 `expandEnabled`，扩展 key 后 chevron 和 `visibleTasks` 过滤自动生效
- **`DHTMLXGantt`**：配置中心无甘特图 UI，`renderGanttChart` 不会被实际调用
- **`toggleNode`, `expandAll`, `getAllExpandableIds`, `hasChildren`, `filterByCollapsed`**：helper 已就绪，无需改动

## 7. 改动清单

| 位置 | 改动 |
|---|---|
| `src/app/page.tsx` `getScopeKey()` | 在函数体最前面加 `if (activeModule === 'config')` 分支 |
| `src/app/page.tsx` `collapseAll()` | 按 `activeModule` 分支选择 scopeTasks |
| `src/app/page.tsx` 配置中心工具栏 (line ~3948) | 插入"全部展开 / 全部收起"按钮 |

**总计**：约 25-30 行新增，单文件单 commit。

## 8. 边界情况

1. **配置中心无 `selectedProject`**：`getScopeKey()` 不依赖 `selectedProject`，直接用 `selectedProjectType`
2. **切换 projectType / level / planType**：scope key 变化 → 拿到新 scope 的状态（可能空 = 全展开）；旧 scope 状态保留在 `collapsedNodes` 对象里
3. **配置中心 + 项目空间同时使用**：key 前缀不同，天然隔离
4. **L2 `selectedPlanType` 未选**：`LEVEL2_PLAN_TYPES[0]` 是默认值（见 line 648），`selectedPlanType` 永远有值
5. **`visibleColumns` 隐藏"序号"列**：chevron 所在的"序号"列被隐藏时，用户会失去单节点展开能力，但工具栏"全部展开/收起"仍可用——这是合理降级

## 9. 测试 / 验证点

手动验证（项目无测试框架）：

- [ ] 进入配置中心 → 选"软件产品项目" → 一级计划 → 表格有 chevron + 工具栏有两个新按钮
- [ ] 点击 chevron 折叠/展开某节点，UI 响应正确
- [ ] 点击"全部收起" / "全部展开"按钮，整个表格联动
- [ ] 切换到"整机产品项目" → 状态独立（全展开，非之前软件项目的折叠态）
- [ ] 切到二级计划 → 同样可用；切换模板类型（如"需求开发计划" ↔ "在研版本火车计划"）状态独立
- [ ] 切到项目空间 → 项目空间的独立状态不受配置中心影响
- [ ] 编辑模式下折叠仍可用
- [ ] `npx tsc --noEmit` 通过
- [ ] `npm run build` 通过

## 10. 明确不做

- ❌ 配置中心甘特图（无 UI）
- ❌ L2 模板数据独立存储
- ❌ 持久化到 localStorage
- ❌ 变更已有 feature 的其他行为
