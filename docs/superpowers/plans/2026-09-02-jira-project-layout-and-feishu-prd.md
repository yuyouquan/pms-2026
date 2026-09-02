# JIRA 项目统一编辑、展示与飞书 PRD 交付实施计划

> **For Codex:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task by task. For implementation tasks use `test-driven-development`; before handoff use `requesting-code-review`, `verification-before-completion`, and `finishing-a-development-branch`.

**Goal:** 统一整机产品项目在新建、编辑和项目空间中的 JIRA 项目编辑能力，按确认稿完成横向展示和条件必填；同步形成带真实截图与飞书画板的《项目管理-一级计划+三级计划+配置中心PRD》，通过本地和线上验收后发布到 `dev`、`master` 与 Vercel Production。

**Architecture:** 保留 `JiraProjectConfig` 作为唯一数据模型，在 `src/lib/jiraProject.ts` 中集中放置默认值、迁移、行更新、复制和校验规则，新建 `JiraProjectEditor` 供三个入口复用。展示态由 `ProjectInfoSections` 使用专属 JIRA 横向布局修饰类；项目新建/编辑沿用 `validateProjectInfoValues`，项目空间快速编辑调用同一行级校验，避免入口分叉。PRD 以仓库内 Markdown 为可审阅源文件，再按飞书 Docx XML 创建工作流发布，截图和四张可编辑画板嵌入对应章节，创建后回读、导出并核对。

**Tech Stack:** Next.js 14、React 18、TypeScript、Ant Design 6、Zustand 4、Node.js 契约脚本、Puppeteer 浏览器验收、`lark-cli` Docx/Whiteboard、`@larksuite/whiteboard-cli`、Vercel CLI。

---

## 执行边界

- 只在隔离工作树 `.worktrees/jira-project-layout-fields` 和后续临时发布工作树中工作；不修改、不清理、不暂存主工作区的用户改动。
- 不接真实 JIRA API，不改变现有服务器、库名、类型和 Affect Projects Mock 选项。
- 不重排整机产品项目的其他字段；`JIRA项目` 仍为扩展信息最后一个字段且作为一个整体被字段配置控制。
- JIRA 配置整体选填；存在一行时才执行该行必填校验。
- 飞书写入、`dev`/`master` 推送和 Vercel 发布均已由用户在本次请求中明确授权；仍需保留命令结果和线上验收证据。

## Task 1：先建立 JIRA 行为契约并观察失败

**Files:**

- Modify: `scripts/verify-whole-machine-project-fields.mjs`
- Create: `scripts/verify-jira-project-rules.mjs`
- Reference: `src/constants/projectInfoSchema.ts`
- Reference: `src/constants/projectBasicFields.ts`
- Reference: `src/lib/jiraProject.ts`
- Reference: `src/components/project-info/ProjectInfoFieldInput.tsx`
- Reference: `src/components/project-info/ProjectInfoSections.tsx`
- Reference: `src/containers/ProjectSpaceContainer.tsx`

### Step 1：修正已经过期的整机字段基线

把 `verify-whole-machine-project-fields.mjs` 的 `WHOLE_MACHINE_BASIC_INFO_FIELDS` 期望值改成当前 `origin/dev` 的真实、完整顺序，保留新增字段，不借本需求删除或移动任何非 JIRA 字段。同步把旧的“容器内联 JIRA 编辑器”标记改为共享组件契约：

- 存在 `JiraProjectEditor`；
- 项目新建/编辑入口使用该组件；
- 项目空间入口使用同一组件；
- 表头严格为 `JIRA服务器 / JIRA库名 / 类型 / 共库 / Affect Projects / 操作`；
- 展示态存在 JIRA 专属横向布局类；
- 不再存在 `renderJiraProjectInlineEditor` 及重复的行增删改函数。

Run: `node scripts/verify-whole-machine-project-fields.mjs`

Expected: 在共享组件尚未实现时失败，并明确指出缺少共享编辑器或仍存在旧内联实现；不是因为旧字段顺序误报。

### Step 2：创建纯规则失败测试

`verify-jira-project-rules.mjs` 动态导入 TypeScript 规则模块，覆盖：

1. 空数组合法，说明 JIRA 整体选填；
2. 只要存在行，服务器、库名、类型为空均分别返回带行号的错误；
3. `shared=true` 且 `affectProjects=''` 返回条件必填错误；
4. `shared=false` 时 Affect Projects 不必填；
5. 更新 `shared` 为 `false` 时立即清空旧 Affect Projects；
6. 复制产生新 ID，但保留其他五个业务字段；
7. 历史行缺少 `shared`/`affectProjects` 时迁移为 `false`/空串；
8. 归一化只清理字符串，不静默丢弃用户已经新增的不完整行。

Run: `node scripts/verify-jira-project-rules.mjs`

Expected: FAIL，提示缺少待新增的规则导出。

### Step 3：提交失败契约

```bash
git add scripts/verify-whole-machine-project-fields.mjs scripts/verify-jira-project-rules.mjs
git commit -m "test: define shared JIRA project behavior"
```

Expected: 提交只包含两份契约脚本；`package-lock.json` 不进入提交。

## Task 2：实现 JIRA 数据迁移、更新、复制与校验

**Files:**

- Modify: `src/lib/jiraProject.ts`
- Modify: `src/lib/projectInfoRules.ts`
- Test: `scripts/verify-jira-project-rules.mjs`
- Test: `scripts/verify-project-info-followup-adjustments.mjs`

### Step 1：集中纯函数

在 `jiraProject.ts` 中增加并导出：

- `JiraProjectValidationError`：至少包含 `rowId`、`rowIndex`、`fieldKey`、`message`；
- `normalizeJiraProjectConfig(row)`：trim 字符串；历史数据缺少 `shared` 时设为 `false`，缺少 Affect Projects 时为空串；`shared=false` 时强制清空 Affect Projects；
- `normalizeJiraProjectRows(rows)`：保留所有已存在行并逐行归一化；
- `patchJiraProjectConfig(row, patch)`：合并字段，并在新值 `shared=false` 时清空 Affect Projects；
- `copyJiraProjectConfig(row)`：保留业务字段、生成唯一 ID；
- `validateJiraProjectRows(rows)`：按 1 开始的行号返回服务器、库名、类型以及共库条件必填错误；空数组返回空错误列表。

`createJiraProjectConfig()` 的新行默认值继续沿用现有产品行为，包括默认服务器、类型和 `shared=true`，避免本需求额外改变新行语义；只有历史数据确实缺少 `shared` 字段时才按 `false` 安全迁移。

### Step 2：把新建/编辑校验接入项目规则

在 `validateProjectInfoValues()` 中，仅对整机产品项目且校验范围包含 `jiraProjects` 时追加 JIRA 行级错误，并映射为：

```ts
{
  fieldKey: 'jiraProjects',
  groupKey: 'extended',
  message: `第 ${rowIndex + 1} 行：${rowError.message}`,
}
```

空数组不报错；不得把 JIRA 整块改成项目必填字段。

### Step 3：运行最小验证

Run:

```bash
node scripts/verify-jira-project-rules.mjs
node scripts/verify-project-info-followup-adjustments.mjs
```

Expected: PASS；既有项目字段必填逻辑不退化。

### Step 4：提交纯规则

```bash
git add src/lib/jiraProject.ts src/lib/projectInfoRules.ts
git commit -m "feat: centralize JIRA project rules"
```

## Task 3：建设三个入口共用的 JIRA 编辑器

**Files:**

- Create: `src/components/project-info/JiraProjectEditor.tsx`
- Modify: `src/components/project-info/ProjectInfoFieldInput.tsx`
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `src/styles/globals.css`
- Test: `scripts/verify-whole-machine-project-fields.mjs`

### Step 1：新增共享组件

组件 props 明确为：

```ts
interface JiraProjectEditorProps {
  rows: JiraProjectConfig[]
  onChange: (rows: JiraProjectConfig[]) => void
  errors?: JiraProjectValidationError[]
  disabled?: boolean
  affectProjectOptions?: Array<{ label: string; value: string }>
}
```

实现以下可观察行为：

- 桌面表头和数据行严格六列：JIRA服务器、JIRA库名、类型、共库、Affect Projects、操作；
- 服务器、库名、类型表头显示红色必填标记；共库开启时 Affect Projects 的表头/行显示条件必填状态；
- 服务器和类型为下拉，库名和 Affect Projects 为可搜索下拉；
- 共库关闭时 Affect Projects 继续渲染但 `disabled`，切换动作通过 `patchJiraProjectConfig` 清空旧值；
- 操作列为复制、删除图标，两者都有 Tooltip 与 `aria-label`；
- 删除最后一行后返回空数组；添加按钮从空状态创建第一行；
- 行错误显示在对应控件下方或行底部，首个错误控件可获得 `data-jira-field` 供表单滚动定位；
- 宽度不足时表格内部横向滚动，不压坏六列。

### Step 2：替换项目新建/编辑入口

`ProjectInfoFieldInput` 的 `inputType === 'jira'` 分支只负责把 `value` 归一为数组并渲染 `JiraProjectEditor`，删除自身重复的 Select/Card/删除实现。

### Step 3：替换项目空间内联入口

从 `ProjectSpaceContainer` 删除：

- 本地 `normalizeJiraProjectRows`；
- `updateJiraProjectRows`、`updateJiraProjectRow`；
- `addJiraProjectRow`、`copyJiraProjectRow`、`removeJiraProjectRow`；
- `renderJiraProjectInlineEditor`。

编辑态直接渲染共享 `JiraProjectEditor`，`onChange` 只更新 `editingProjectFields.jiraProjects`。现有 `basicInfo:编辑` 权限和编辑按钮边界不变。

### Step 4：补齐一致样式

在 `globals.css` 为共享组件增加作用域样式：标题工具栏、六列最小宽度、行高、必填星号、错误文本、禁用态和窄屏横向滚动。不得用页面内联样式重新实现整套布局。

### Step 5：运行静态契约

Run:

```bash
node scripts/verify-whole-machine-project-fields.mjs
node scripts/verify-jira-project-rules.mjs
npx tsc --noEmit
```

Expected: PASS；容器中不再有重复编辑器实现。

### Step 6：提交共享编辑器

```bash
git add src/components/project-info/JiraProjectEditor.tsx src/components/project-info/ProjectInfoFieldInput.tsx src/containers/ProjectSpaceContainer.tsx src/styles/globals.css
git commit -m "feat: reuse JIRA project editor across entry points"
```

## Task 4：接通项目空间保存校验和错误定位

**Files:**

- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `src/components/project-info/ProjectInfoModal.tsx`
- Modify: `src/components/project-info/JiraProjectEditor.tsx`
- Test: `scripts/verify-jira-project-rules.mjs`
- Test: `scripts/verify-project-info-followup-adjustments.mjs`

### Step 1：让表单入口传递具体错误

保留 `ProjectInfoModal` 现有 `validateProjectInfoValues()` 提交流程；当 `fieldKey === 'jiraProjects'` 时把消息数组传给共享编辑器，并继续展开扩展信息、滚动到 JIRA 区域。保存失败不清空用户已经输入的其他行。

### Step 2：让项目空间快速编辑走同一规则

`saveBasicInfoEdit()` 在调用 `updateProject()` 前：

1. 对当前 rows 运行 `normalizeJiraProjectRows`；
2. 对归一化结果运行 `validateJiraProjectRows`；
3. 有错误时 `message.error` 展示首条带行号消息，把完整错误数组交给编辑器并滚到扩展信息 JIRA 行；
4. 无错误时保存完整数组，包括空数组；不再过滤只填了一部分的行。

### Step 3：扩展契约断言并验证

给规则脚本增加源码契约：`ProjectInfoModal` 与 `ProjectSpaceContainer` 均调用同一校验函数，且项目空间保存不包含按 `projectKey` 静默 `filter` 的逻辑。

Run:

```bash
node scripts/verify-jira-project-rules.mjs
node scripts/verify-project-info-followup-adjustments.mjs
npx tsc --noEmit
```

Expected: PASS。

### Step 4：提交保存校验

```bash
git add src/containers/ProjectSpaceContainer.tsx src/components/project-info/ProjectInfoModal.tsx src/components/project-info/JiraProjectEditor.tsx scripts/verify-jira-project-rules.mjs
git commit -m "fix: enforce JIRA row validation on save"
```

## Task 5：完成项目空间 JIRA 展示态横向末行

**Files:**

- Modify: `src/components/project-info/ProjectInfoSections.tsx`
- Modify: `src/styles/globals.css`
- Modify: `scripts/verify-project-field-order-followup.mjs`
- Test: `scripts/verify-whole-machine-project-fields.mjs`

### Step 1：添加 JIRA 专属结构类

`ProjectInfoSections` 为 `jiraProjects` 增加 `pms-project-info-display-item--jira`，结构保持：

```tsx
<div className="pms-project-info-display-item pms-project-info-display-item--full-row pms-project-info-display-item--jira">
  <div className="pms-project-info-display-label">JIRA项目</div>
  <div className="pms-project-info-display-value">…链接标签…</div>
</div>
```

标签仍使用 `formatJiraProjectTag()` 和 `getJiraProjectUrl()`，新窗口打开；空数组显示 `-`。

### Step 2：按确认图实现左右布局

JIRA 专属 CSS 必须满足：

- `grid-column: 1 / -1`；
- `display:flex; flex-direction:row; align-items:center`；
- 标题左侧固定最小宽度并左对齐；
- 内容紧随标题、`margin-top:0`、左对齐、可自动换行；
- 多条 Tag 不居中、不撑成整行；
- 其他普通字段与团队一行四列的现有布局保持不变。

### Step 3：扩展字段顺序契约

`verify-project-field-order-followup.mjs` 同时断言：

- `jiraProjects` 是扩展信息最后字段；
- 只它获得 full-row + jira 两个修饰类；
- 字段配置仍以整块 JIRA 字段为粒度。

Run:

```bash
node scripts/verify-project-field-order-followup.mjs
node scripts/verify-whole-machine-project-fields.mjs
npx tsc --noEmit
```

Expected: PASS。

### Step 4：提交展示布局

```bash
git add src/components/project-info/ProjectInfoSections.tsx src/styles/globals.css scripts/verify-project-field-order-followup.mjs
git commit -m "style: align JIRA projects in a horizontal full row"
```

## Task 6：真实浏览器验收、视觉对照与 PRD 截图

**Files:**

- Create: `screenshots/verify-jira-project-browser.mjs`
- Create: `docs/prd/assets/jira-project-editor.png`
- Create: `docs/prd/assets/jira-project-display.png`
- Create: `design-qa.md`
- Modify: `package.json`

### Step 1：添加浏览器验收脚本

脚本接受 `BASE_URL`，默认本地地址，并通过现有 Mock 用户和页面入口完成：

1. 打开整机产品项目新建弹窗，进入 JIRA 行，检查六列表头顺序；
2. 明确关闭共库，验证 Affect Projects 可见、清空且禁用；
3. 再开启共库，不填 Affect Projects 保存，出现第 1 行条件必填错误；
4. 填满一行，复制后两行 ID/DOM key 不同且值相同；
5. 再关闭共库，Affect Projects 值立即清空且禁用；
6. 删除所有行，确认项目仍允许在其他必填项完成后提交；
7. 打开既有整机项目的项目空间编辑，重复确认同一六列结构和校验；
8. 保存并返回展示态，确认 JIRA 位于扩展信息末行、标题与首个 Tag 在同一水平行，Tag 左对齐；
9. 无权限用户只看到展示链接，不看到编辑入口；
10. 记录 `console.error`、页面异常和失败截图。

把命令加入 `package.json`：

```json
"verify:jira-project-browser": "node screenshots/verify-jira-project-browser.mjs"
```

### Step 2：启动隔离本地服务

```bash
npm run dev -- --hostname 127.0.0.1 --port 3004
```

Expected: 服务在 `http://127.0.0.1:3004` 可访问；若端口被占用，只终止本任务启动且已确认 PID 的旧服务，不使用宽泛进程清理。

### Step 3：运行浏览器验收并保存证据

```bash
BASE_URL=http://127.0.0.1:3004 npm run verify:jira-project-browser
```

脚本在最终状态保存：

- `docs/prd/assets/jira-project-editor.png`：六列表格、共库开启及 Affect Projects 状态；
- `docs/prd/assets/jira-project-display.png`：扩展信息末行的 JIRA 左右布局。

Expected: 所有交互断言通过，无控制台错误，两张截图非空且能清楚辨识标签和控件。

### Step 4：执行同视口视觉 QA

用用户提供的图 1/图 2 作为展示和编辑视觉目标，在同一桌面视口打开参考图与最新页面截图，比较：字段次序、横向关系、表头、间距、边框、对齐、禁用态、必填态。把结果写入根目录 `design-qa.md`；修复所有 P0/P1/P2 后重新截图，直到文件结尾为：

```text
final result: passed
```

P3 仅作为后续建议，不阻塞本次交付。

### Step 5：提交浏览器验收与截图

```bash
git add package.json screenshots/verify-jira-project-browser.mjs docs/prd/assets/jira-project-editor.png docs/prd/assets/jira-project-display.png design-qa.md
git commit -m "test: verify JIRA project editor and display"
```

## Task 7：编写本地完整 PRD 源文档

**Files:**

- Create: `docs/prd/项目管理-一级计划+三级计划+配置中心PRD.md`
- Create/Modify: `docs/prd/assets/*.png`
- Reference: `原始需求.md`
- Reference: `docs/prd/PMS-V1.0-PRD.md`
- Reference: `docs/superpowers/specs/2026-08-18-level1-plan-governance-design.md`
- Reference: `docs/superpowers/specs/2026-08-19-level3-template-config-design.md`
- Reference: `docs/superpowers/specs/2026-09-02-project-list-filter-and-column-resize-design.md`
- Reference: `docs/superpowers/specs/2026-09-02-android-package-mapping-mr-lock-design.md`
- Reference: `docs/superpowers/specs/2026-09-02-jira-project-layout-and-prd-design.md`
- Reference: current implementation under `src/constants/`, `src/lib/`, and `src/stores/`

### Step 1：以当前实现和已确认设计为事实源

逐项核对需求与代码，区分：

- 已实现、此次修改后实现；
- Mock 行为；
- 后端/真实集成非本次范围；
- 仍需产品确认的开放项。

不得把旧截图、旧字段名或历史设计直接写成当前事实。所有状态、枚举、字段顺序、权限键和时间校验规则都从当前代码或已确认设计交叉验证。

### Step 2：按可评审结构写完整 PRD

文档至少包含：

1. 文档信息、版本记录、读者、背景、用户问题、目标、范围、非目标；
2. 术语、项目类型、角色与权限矩阵；
3. 项目列表：四类项目字段、默认显示、隐藏、字段配置、飞书式表头顺序/宽度拖动、快捷筛选与高级筛选；
4. 新建项目：四类项目字段顺序、必填、枚举来源、历史停用值处理、失败态；
5. 项目空间基础信息：展示/编辑/字段配置、整机八列、团队四列、JIRA 最后一整行；
6. 一级计划：市场/类型切换位置、版本生命周期、横/竖/甘特视图顺序、修订中编辑、版本发布时间、校验、权限；
7. 三级计划-MR版本计划：tOS 自动编号、MR 编号、模糊搜索、时间区间和错误提示、正常/错误/禁止 Mock；
8. 联合项目空间 `tOS&整机1+N项目计划`：字段、安卓版本+芯片型号到组包方式映射、锁定/解锁选择与权限、EOS 时间隐藏逻辑；
9. 配置中心：计划模板、枚举、安卓版本、芯片编码/型号/厂商、组包方式映射及维护权限；
10. JIRA 项目：六列字段字典、整体选填、行级必填、共库条件必填、复制/删除、展示链接；
11. 空状态、异常、兼容迁移、审计边界、质量约束；
12. 可执行验收场景和需求追踪矩阵。

每个字段表包含：字段中文名、字段 key（已知时）、项目类型、入口、控件、选项来源、是否必填、默认值、显示规则、编辑规则、校验、权限、异常提示。

### Step 3：为每个一级功能采集实际截图

使用 Task 6 的同一最终代码与浏览器，至少采集并放入 `docs/prd/assets/`：

- `project-list-and-quick-filter.png`；
- `project-list-field-config.png`；
- `project-create-fields.png`；
- `project-space-basic-info.png`；
- `jira-project-editor.png`；
- `jira-project-display.png`；
- `level1-horizontal-plan.png`；
- `level1-vertical-plan.png`；
- `level1-gantt.png`；
- `level3-mr-plan-valid-and-invalid.png`；
- `joint-1n-plan-locking.png`；
- `config-enum-and-package-mapping.png`。

每张图在正文中紧跟相关功能说明并附图注；不把截图集中堆在附录。若一个页面截图同时覆盖同一功能的多个子能力，可复用，但正文必须明确标注它覆盖哪些验收点。

### Step 4：PRD 自检

新增一个轻量脚本或使用现有文本检查，确认：

- 所有 12 个截图引用都存在且文件大小大于 0；
- 章节包含“字段说明、填写限制、权限说明、交互说明、异常与验收”；
- 没有任何未完成占位词、待补截图标记或旧名称 `tOS&整机MR版本计划`；
- 新名称、JIRA 条件规则、版本时间、锁定权限、EOS 隐藏逻辑出现且无互相矛盾表述；
- Markdown 链接均能在仓库内解析。

Expected: 自检零遗漏；发现差异先改正文或重新截图，不带问题进入飞书创建。

### Step 5：提交本地 PRD

```bash
git add docs/prd/项目管理-一级计划+三级计划+配置中心PRD.md docs/prd/assets
git commit -m "docs: complete project management PRD"
```

## Task 8：创建并验证飞书画板

**Files:**

- Create temporarily under CLI workspace: `diagrams/<timestamp>/diagram.mmd` or `diagram.svg`
- Create temporarily under CLI workspace: `diagrams/<timestamp>/diagram.png`
- Reference: `docs/prd/项目管理-一级计划+三级计划+配置中心PRD.md`

### Step 1：验证飞书与画板工具

```bash
lark-cli --version
npx -y @larksuite/whiteboard-cli@^0.2.13 -v
```

Expected: 两个命令都正常返回版本；若遇到身份或 scope 错误，按 `lark-shared` 身份/权限参考修复后重试，不输出任何 token。

### Step 2：设计四张独立图

按 PRD 的实际分支创建四张聚焦画板：

1. `一级计划版本生命周期`：修订中 → 校验 → 发布 → 只读/查看详情，以及新修订版本；
2. `三级计划数据与时间约束`：一级计划边界、三级活动输入、动态校验、标红和带基准日期提示；
3. `联合计划映射与锁定权限`：安卓版本+芯片型号 → 组包方式；SPM、对应版本项目经理、超级管理员的选择/锁定/编辑分支；
4. `项目创建与 JIRA 条件校验`：无 JIRA、普通 JIRA、共库 JIRA、Affect Projects 必填和保存失败分支。

流程/状态图优先使用 Mermaid；权限矩阵与映射关系如果 Mermaid 无法清晰表达，使用完整 SVG。所有图中文字使用中文，术语与 PRD 一致。

### Step 3：渲染、检查并保留源文件

对每张画板执行对应 `whiteboard-cli` 渲染与 `--check`，输出预览 PNG。逐张检查文字溢出、连线交叉、节点重叠、层级和色彩；最多两轮修正，仍失败时按技能规则切换 DSL 重画。

Expected: 四张预览均无 `text-overflow` error，无空白画板，图示内容与正文一致。

## Task 9：创建飞书文档并嵌入截图/画板

**Files:**

- Temporary CLI draft workspace returned by `lark-cli docs +script --command init-draft`
- Source: `docs/prd/项目管理-一级计划+三级计划+配置中心PRD.md`
- Source: `docs/prd/assets/*.png`

### Step 1：初始化合规草稿

使用固定 Presentation Decision：

```json
{
  "audience": "产品、设计、研发、测试和项目管理评审人",
  "reader_task": "核对项目管理范围、字段、权限、交互与验收口径并据此开发验收",
  "genre_contract": "workplace.prd",
  "adapter": null,
  "presentation_mode": "rich",
  "visual_plan": {
    "reason": "需要用实际界面截图提供验收证据，并用画板解释版本状态、时间约束、映射和权限分支",
    "blocks": [
      {"type": "img", "min_count": 12, "purpose": "展示每个一级功能的最终系统界面和关键状态"},
      {"type": "whiteboard", "min_count": 4, "purpose": "解释版本生命周期、时间校验、联合计划权限映射和JIRA条件校验"}
    ]
  }
}
```

Run:

```bash
lark-cli docs +script --command init-draft --presentation-decision '<上述完整JSON>' --format json
```

记录返回的 `workspace` 与 `draft_path`，后续所有相对图片、画板和 XML 文件都在该独占工作区内操作。

### Step 2：生成飞书 Docx XML release candidate

完整读取 `lark-doc-xml.md`，按本地 PRD 生成 XML：

- 文档标题严格为 `项目管理-一级计划+三级计划+配置中心PRD`；
- 使用自动编号标题，不在标题文本中重复手写章节号；
- 字段字典、权限矩阵、筛选条件、验收追踪使用表格；
- 单个规则提醒使用 callout；
- 12 张本地截图使用 `<img path="@./..."/>`，复制到草稿工作区的稳定相对路径；
- 四张图使用 `<whiteboard type="mermaid">` 或 `<whiteboard type="svg">` 嵌入对应章节附近；
- 不在文末重复堆叠资源。

XML 首次写入使用 `apply_patch`，不改 `.presentation-decision.json`。

### Step 3：草稿画像检查

```bash
lark-cli docs +script --command parse --content "@./<draft_path>" --format json
```

Expected: 顶层 `ok=true` 且 `data.assessment.status=passed`；profile 至少包含 12 个图片块和 4 个画板块。任何 diagnostic 都做最小范围修复并重新 parse。

### Step 4：创建飞书文档

完整读取 `lark-doc-create.md`，使用通过检查的同一 `draft_path` 以 `--as user` 创建文档。若遇到高风险确认门禁，向用户展示动作和关键参数后只按 CLI 返回的确认 flag 重试；不得自行绕过。

Expected: 返回 `ok=true`、`doc_id` 和可访问的 `doc_url`，无资源插入 warning。

### Step 5：回读并修复局部问题

完整读取 `lark-doc-fetch.md`，回读新文档并检查：

- 标题唯一且正确；
- 章节结构、字段表、权限表、交互和异常/验收完整；
- 图片块不少于 12，画板块不少于 4；
- 图片和画板位于对应章节，而非文末；
- 所有画板都有非空 token；
- 正文没有旧名称、占位符或截断表格。

对每个画板 token 执行 `whiteboard +export --output-type preview`，目检飞书实际渲染结果。局部失败使用 `docs +update` 修复现有文档，不重复新建。

### Step 6：清理临时工作区

确认文档和画板检查完成后，离开 CLI 草稿目录，精确删除 `init-draft` 返回的那一个 `workspace`。不删除仓库中的 PRD、截图或任何用户文件。

## Task 10：全量回归与代码评审

**Files:**

- Verify entire branch

### Step 1：运行聚焦契约

```bash
node scripts/verify-jira-project-rules.mjs
node scripts/verify-whole-machine-project-fields.mjs
node scripts/verify-project-field-order-followup.mjs
node scripts/verify-project-info-followup-adjustments.mjs
node scripts/verify-project-info-matrix-refresh.mjs
npm run verify:machine-tos
npm run verify:project-surfaces-visual-refresh
```

Expected: 全部 PASS。

### Step 2：运行静态与生产门禁

```bash
npx tsc --noEmit
npm run build
git diff --check origin/dev...HEAD
```

Expected: 类型检查、Next.js 生产构建、空白/冲突检查全部通过；只报告与基线一致的非阻塞警告。

### Step 3：重新运行浏览器验收

```bash
BASE_URL=http://127.0.0.1:3004 npm run verify:jira-project-browser
npm run verify:project-surfaces-visual-refresh-browser
```

Expected: JIRA 主路径和项目空间视觉回归通过，无控制台错误。

### Step 4：请求代码评审并处理问题

使用 `requesting-code-review` 检查：

- 三入口是否真实复用；
- 是否有静默丢行、条件必填遗漏或权限绕过；
- `shared=false` 是否在全部入口清空并禁用 Affect Projects；
- CSS 是否只影响 JIRA full row；
- PRD 是否把 Mock 能力误写成真实后端能力；
- 测试是否验证行为而非只匹配脆弱字符串。

修复 P0/P1/P2 后重跑本 Task 全部门禁。

### Step 5：提交最终修复并清理自身意外改动

仅提交本任务文件。对隔离工作树中由首次依赖安装造成、但本需求不需要的 `package-lock.json` 机械变化，使用精确补丁恢复到 `origin/dev` 内容，不触碰主工作区。

Run:

```bash
git status --short
```

Expected: 工作树干净；不存在未跟踪草稿、临时画板目录、调试截图或依赖锁文件差异。

## Task 11：推送 dev、合并 master、发布并在线复验

**Files:**

- Release only; no product source changes unless online verification finds a real regression

### Step 1：获取远端并验证可合并关系

```bash
git fetch origin --prune
git merge-base --is-ancestor origin/dev HEAD
git status --short
```

Expected: 当前功能分支包含最新 `origin/dev`，工作树干净。若远端 `dev` 已前进，在当前隔离分支合并 `origin/dev`，重新运行 Task 10 后再继续。

### Step 2：推送已验证树到 dev

```bash
git push origin HEAD:dev
git fetch origin dev
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/dev)"
```

Expected: `origin/dev` 精确指向通过验证的功能提交。

### Step 3：在新的临时发布工作树合并 master

从最新 `origin/master` 建立独立临时发布工作树和 `codex/jira-project-layout-release` 分支，执行：

```bash
git merge --no-ff origin/dev -m "merge: release JIRA project layout and PRD"
npx tsc --noEmit
npm run build
node scripts/verify-jira-project-rules.mjs
node scripts/verify-whole-machine-project-fields.mjs
```

Expected: 合并无冲突，合并结果通过关键门禁，`origin/dev` 是当前 HEAD 的祖先。

### Step 4：推送主干

```bash
git push origin HEAD:master
git fetch origin master
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/master)"
git merge-base --is-ancestor origin/dev origin/master
```

Expected: `origin/master` 包含已验证的 `origin/dev`。

### Step 5：发布 Vercel Production

使用仓库现有 Vercel 项目绑定；若当前工作树没有 `.vercel/project.json`，先执行无破坏性的项目链接检查，再运行：

```bash
vercel --prod --yes
```

等待 deployment 为 `Ready`，确认 production alias 指向 `https://pms-transsion.vercel.app/`，并记录 deployment URL、主干提交和状态。部署成功但应用未验收不算完成。

### Step 6：在线浏览器验收

```bash
BASE_URL=https://pms-transsion.vercel.app npm run verify:jira-project-browser
```

另在应用内浏览器打开生产地址，人工检查整机项目新建 JIRA 六列、共库开关/Affect Projects、项目空间最后横向整行、链接点击及无权限展示；检查浏览器控制台无新增错误。

Expected: 自动化和人工抽查均通过。

### Step 7：最终证据核对

最终交付必须包含：

- 功能分支、`origin/dev`、`origin/master` 的精确提交 ID；
- 本地契约、类型检查、构建和浏览器结果；
- Vercel deployment URL、`Ready` 状态和生产抽查结果；
- 飞书文档 URL 和回读/资源检查结果；
- 本地 PRD 路径；
- 对主工作区用户改动未触碰的说明。

只有以上证据都存在，才能使用“已完成、已发布、已验证”。
