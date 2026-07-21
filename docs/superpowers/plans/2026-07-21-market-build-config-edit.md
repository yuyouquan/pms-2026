# 市场级构建配置编辑 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为整机项目的每个市场独立编辑、保存并展示分支信息、Jenkins 构建和版本地址，同时兼容已有项目级数据。

**Architecture:** 扩展 `MarketConfigRow` 作为唯一的市场配置数据模型，`buildMarketRowsFromMarkets` 负责旧数据一次性视图回填，市场编辑 Modal 负责修改草稿，`ProjectSpaceContainer` 根据当前市场行展示配置。Mock 数据继续使用 Zustand Store；正式持久化契约在 PRD 中标注为项目市场配置数据库记录。

**Tech Stack:** Next.js 14、React 18、TypeScript、Ant Design 6、Zustand 4、Node 验证脚本、Playwright。

---

### Task 1: 建立市场构建配置回归验证

**Files:**
- Create: `scripts/verify-market-build-config.mjs`
- Test: `src/lib/marketRules.ts`
- Test: `src/components/project-info/MarketEditorModal.tsx`
- Test: `src/containers/ProjectSpaceContainer.tsx`

- [ ] **Step 1: 编写失败验证**

新增 Node 脚本，使用 TypeScript 的 `transpileModule` 执行真实的 `marketRules.ts`，并断言旧数据回填与显式空值语义：

```js
const fallback = {
  branchInfo: 'feature/global',
  jenkinsUrl: 'https://jenkins.example/job/global',
  buildAddress: 'https://build.example/global',
}
const initialized = buildMarketRowsFromMarkets(['OP', 'TR'], undefined, fallback)
assert.equal(initialized[0].branchInfo, fallback.branchInfo)
assert.equal(initialized[1].jenkinsUrl, fallback.jenkinsUrl)

const preserved = buildMarketRowsFromMarkets(['OP'], [{
  id: 'market-OP', market: 'OP', isMain: true, followsMain: false,
  branchInfo: '', jenkinsUrl: undefined, buildAddress: 'market-build',
}], fallback)[0]
assert.equal(preserved.branchInfo, '')
assert.equal(preserved.jenkinsUrl, fallback.jenkinsUrl)
assert.equal(preserved.buildAddress, 'market-build')
```

脚本同时读取两个 React 源文件，断言 Modal 存在三个 `row` 级控件、整机配置展示读取 `row.branchInfo`、`row.jenkinsUrl`、`row.buildAddress`，新市场显式初始化为空字符串。

- [ ] **Step 2: 运行验证并确认失败**

Run: `node scripts/verify-market-build-config.mjs`

Expected: FAIL，原因是第三个参数尚未生效，初始化市场的 `branchInfo` 为 `undefined`，或界面尚未包含 `row` 级输入框。

- [ ] **Step 3: 提交验证基线**

```bash
git add scripts/verify-market-build-config.mjs
git commit -m "test: cover market-specific build configuration"
```

### Task 2: 扩展市场配置数据与兼容逻辑

**Files:**
- Modify: `src/lib/marketRules.ts:1-220`
- Modify: `src/components/project-info/MarketEditorModal.tsx:1-310`
- Test: `scripts/verify-market-build-config.mjs`

- [ ] **Step 1: 扩展 `MarketConfigRow`**

```ts
export type MarketConfigRow = {
  // existing fields
  branchInfo?: string
  jenkinsUrl?: string
  buildAddress?: string
}

export type LegacyMarketBuildConfig = Pick<
  MarketConfigRow,
  'branchInfo' | 'jenkinsUrl' | 'buildAddress'
>
```

- [ ] **Step 2: 在构造函数中只回填 `undefined` 的旧字段**

将函数签名扩展为：

```ts
export const buildMarketRowsFromMarkets = (
  markets: string[],
  existingRows?: MarketConfigRow[],
  legacyBuildConfig?: LegacyMarketBuildConfig,
): MarketConfigRow[] => {
  // preserve existing source-row creation
  const hydratedRows = legacyBuildConfig
    ? sourceRows.map(row => ({
        ...row,
        branchInfo: row.branchInfo === undefined ? (legacyBuildConfig.branchInfo || '') : row.branchInfo,
        jenkinsUrl: row.jenkinsUrl === undefined ? (legacyBuildConfig.jenkinsUrl || '') : row.jenkinsUrl,
        buildAddress: row.buildAddress === undefined ? (legacyBuildConfig.buildAddress || '') : row.buildAddress,
      }))
    : sourceRows
  return normalizeMarketRows(hydratedRows)
}
```

未提供 `legacyBuildConfig` 时不主动写入空值，使 Store 初始化的旧行仍可在容器层识别为未迁移；空字符串不使用 `||` 判断，从而不会被重新回填。

- [ ] **Step 3: 新市场显式初始化三个空字段**

在 `createMarketRow` 中增加：

```ts
branchInfo: '',
jenkinsUrl: '',
buildAddress: '',
```

- [ ] **Step 4: 在市场卡片增加构建配置输入区域**

从 Ant Design 引入 `Input`，在现有市场字段之后增加三列：

```tsx
<Typography.Text strong>构建配置</Typography.Text>
<Row gutter={[16, 0]}>
  <Col xs={24} md={8}>
    <Form.Item label="分支信息">
      <Input value={row.branchInfo || ''} onChange={event => updateRow(row.id, { branchInfo: event.target.value })} />
    </Form.Item>
  </Col>
  <Col xs={24} md={8}>
    <Form.Item label="Jenkins 构建">
      <Input value={row.jenkinsUrl || ''} onChange={event => updateRow(row.id, { jenkinsUrl: event.target.value })} />
    </Form.Item>
  </Col>
  <Col xs={24} md={8}>
    <Form.Item label="版本地址">
      <Input value={row.buildAddress || ''} onChange={event => updateRow(row.id, { buildAddress: event.target.value })} />
    </Form.Item>
  </Col>
</Row>
```

- [ ] **Step 5: 运行验证**

Run: `node scripts/verify-market-build-config.mjs`

Expected: 数据兼容断言通过；容器展示断言仍可能在 Task 3 前失败。

### Task 3: 按当前市场展示构建配置

**Files:**
- Modify: `src/containers/ProjectSpaceContainer.tsx:410-425`
- Modify: `src/containers/ProjectSpaceContainer.tsx:1100-1125`
- Modify: `src/containers/ProjectSpaceContainer.tsx:2420-2850`
- Test: `scripts/verify-market-build-config.mjs`

- [ ] **Step 1: 所有整机市场行构造都传入项目级兼容值**

```ts
const getLegacyMarketBuildConfig = (project: typeof selectedProject) => ({
  branchInfo: project?.branchInfo,
  jenkinsUrl: project?.jenkinsUrl,
  buildAddress: project?.buildAddress,
})

buildMarketRowsFromMarkets(
  selectedProject.markets || [],
  marketConfigsByProjectId[selectedProject.id],
  getLegacyMarketBuildConfig(selectedProject),
)
```

同样更新派生 `marketConfigRows`、`getCurrentMarketRows` 和 `renderProjectBasicInfo` 的 `marketRows`，确保首次展示和首次打开编辑器一致。

- [ ] **Step 2: 整机配置信息读取市场行**

```tsx
<Descriptions.Item label="分支信息">{row.branchInfo || '-'}</Descriptions.Item>
<Descriptions.Item label="Jenkins构建">
  {row.jenkinsUrl ? <a href={row.jenkinsUrl} target="_blank" rel="noopener noreferrer">{row.jenkinsUrl}</a> : '-'}
</Descriptions.Item>
<Descriptions.Item label="版本地址">
  {row.buildAddress ? <a href={row.buildAddress} target="_blank" rel="noopener noreferrer">{row.buildAddress}</a> : '-'}
</Descriptions.Item>
```

保留非整机项目读取 `p.branchInfo`、`p.jenkinsUrl`、`p.buildAddress` 的现有分支。

- [ ] **Step 3: 运行聚焦验证、类型检查和生产构建**

Run:

```bash
node scripts/verify-market-build-config.mjs
npx tsc --noEmit
npm run build
```

Expected: 全部退出码为 0，Next.js 生产构建完成 7 个静态页面。

- [ ] **Step 4: 提交实现**

```bash
git add src/lib/marketRules.ts src/components/project-info/MarketEditorModal.tsx src/containers/ProjectSpaceContainer.tsx
git commit -m "feat: edit build configuration per market"
```

### Task 4: 浏览器验收、发布与 PRD 同步

**Files:**
- Create: `output/playwright/prd/06-市场纵向编辑-含构建配置.png`（本地产物，不提交）
- Update: 飞书文档 `项目管理-项目创建与字段分类更新需求文档PRD`

- [ ] **Step 1: 浏览器关键路径冒烟**

启动当前工作树的 Next.js 服务，使用 Playwright：打开整机项目，进入市场编辑；确认三个输入框可编辑；给两个市场输入不同内容并保存；切换市场 Tab，确认“配置信息”分别显示对应内容；清空一个值并保存、重开后确认仍为空。

- [ ] **Step 2: 截取更新后的市场编辑界面**

将包含市场基础字段和新增构建配置输入区的视图保存为：

```text
output/playwright/prd/06-市场纵向编辑-含构建配置.png
```

- [ ] **Step 3: 推送并发布**

依次执行并核验远端引用：推送 `codex/project-info-fields`，将其推送到 `dev`；在独立主干工作树将 `origin/dev` 合入 `master` 并推送；等待新的 Vercel Production Deployment 为 `READY`，访问稳定域名确认 HTTP 200。

- [ ] **Step 4: 精确更新飞书 PRD**

使用块级插入、替换、移动和删除：在市场编辑章节补充三个市场级字段与初始化规则，在配置信息章节补充按市场展示规则；上传新截图替换旧市场编辑截图；把现有 9 张截图分别移动到对应功能章节，删除末尾“界面截图”汇总标题与说明，不使用 `replace_all` 或整篇覆盖。

- [ ] **Step 5: 发布后复核**

再次获取飞书文档正文与大纲，检查字段、迁移规则、验收项、提交哈希、生产部署地址、截图数量与插入位置；确认 dev、master 与生产部署指向本轮代码。
