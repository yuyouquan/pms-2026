# Project Management Level-1, Level-3, Configuration Center PRD Production Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce and verify a screenshot-backed Chinese PRD named `项目管理-一级计划+三级计划+配置中心PRD` covering level-1 plans, level-3 plans, configuration center, project list, filtering, project creation, and project-space field adjustments.

**Architecture:** Treat the running implementation as the source of truth, existing approved specs as business-rule references, and screenshots as traceable evidence. Capture deterministic screens with one Playwright script, write the PRD in Markdown with local relative image links, and validate both content coverage and image integrity with a dedicated checker.

**Tech Stack:** Markdown, Playwright, Node.js validation scripts, Next.js local production build.

---

### Task 1: Build the PRD requirement inventory

**Files:**
- Create: `docs/prd/项目管理-一级计划+三级计划+配置中心PRD.md`
- Reference: `docs/superpowers/specs/`
- Reference: `docs/superpowers/plans/2026-08-18-level1-plan-governance.md`
- Reference: `docs/superpowers/plans/2026-08-19-level3-template-config.md`
- Reference: `docs/superpowers/plans/2026-08-29-mr-version-plan.md`
- Reference: `docs/superpowers/plans/2026-08-30-plan-and-project-field-followup.md`
- Reference: `docs/superpowers/plans/2026-08-31-project-list-header-field-order-linkage.md`
- Reference: `docs/superpowers/plans/2026-09-01-project-list-filter-field-plan-unification.md`

- [ ] **Step 1: Create the PRD skeleton**

Use these required chapters:

```markdown
# 项目管理-一级计划+三级计划+配置中心PRD
## 1. 文档信息与范围
## 2. 角色与权限总表
## 3. 一级计划
## 4. 三级计划-MR版本计划
## 5. 配置中心
## 6. 项目列表与筛选
## 7. 新建项目
## 8. 项目空间字段
## 9. 联合项目空间
## 10. 数据联动与异常校验
## 11. 验收标准
```

- [ ] **Step 2: Add a traceability table**

For every requirement record the UI surface, field/rule source, responsible role, screenshot ID, and acceptance item. No requirement may be marked implemented based only on an old spec.

- [ ] **Step 3: Commit the inventory skeleton**

```bash
git add docs/prd/项目管理-一级计划+三级计划+配置中心PRD.md
git commit -m "docs: scaffold project management PRD"
```

### Task 2: Capture deterministic screenshots for every PRD function

**Files:**
- Create: `screenshots/capture-project-management-prd.mjs`
- Create: `docs/prd/project-management-level1-level3-config/`

- [ ] **Step 1: Implement deterministic navigation helpers**

The script must reset relevant local storage, select a known mock user/project, wait for hydration, and capture at 1440x1000. Each screenshot must include the page title or active tab so the image is self-identifying.

- [ ] **Step 2: Capture the required image set**

Capture at least:

```text
01-level1-horizontal.png
02-level1-vertical.png
03-level1-gantt.png
04-level1-revision-validation.png
05-level3-tos-vertical.png
06-level3-tos-horizontal.png
07-level3-machine-market.png
08-level3-joint-normal-error-stop.png
09-config-level1-template.png
10-config-level3-template.png
11-project-list-machine.png
12-project-list-technical.png
13-system-filter-text.png
14-system-filter-enum-multiple.png
15-add-project-machine.png
16-add-project-tos.png
17-add-project-technical.png
18-project-space-machine-fields.png
19-project-space-tos-fields.png
20-project-space-technical-fields.png
```

- [ ] **Step 3: Run screenshot capture**

Run: `PMS_BASE_URL=http://127.0.0.1:3014 node screenshots/capture-project-management-prd.mjs`

Expected: all listed PNG files exist, are non-empty, and contain no loading skeleton or open error toast.

- [ ] **Step 4: Commit capture automation and evidence**

```bash
git add screenshots/capture-project-management-prd.mjs docs/prd/project-management-level1-level3-config
git commit -m "docs: capture project management PRD screens"
```

### Task 3: Write detailed field, restriction, permission, and interaction specifications

**Files:**
- Modify: `docs/prd/项目管理-一级计划+三级计划+配置中心PRD.md`

- [ ] **Step 1: Document every displayed and editable field**

Each function section must contain a field table with these columns:

```markdown
| 字段/控件 | 数据来源 | 类型/枚举 | 默认值 | 必填 | 可编辑角色 | 显示条件 | 校验与错误提示 |
```

- [ ] **Step 2: Document filling restrictions**

Include level-1 hierarchy/edit restrictions, MR/tOS numbering rules, level-3 date boundaries and cross-project 1+N rules, main/non-main market synchronization, stop-release behavior, filter operator/cardinality rules, and project creation required/default/read-only fields.

- [ ] **Step 3: Document permission matrices**

Cover global admin, project manager, version project manager, SPM, main-market/non-main-market behavior, read-only tOS rows, configuration publish permissions, stop-release permissions, and view-only users.

- [ ] **Step 4: Document interaction flows**

For every module describe entry, tab/view switching, add/edit/save/publish/cancel, error states, empty states, drag ordering, persistence, synchronization, and navigation destinations.

- [ ] **Step 5: Embed every screenshot beside the rule it proves**

Use relative links such as:

```markdown
![一级计划横版视图](project-management-level1-level3-config/01-level1-horizontal.png)
```

- [ ] **Step 6: Commit the complete PRD draft**

```bash
git add docs/prd/项目管理-一级计划+三级计划+配置中心PRD.md
git commit -m "docs: write detailed project management PRD"
```

### Task 4: Validate and repair the PRD

**Files:**
- Create: `scripts/verify-project-management-prd.mjs`
- Modify: `docs/prd/项目管理-一级计划+三级计划+配置中心PRD.md`
- Modify: screenshots only when a visual defect is confirmed.

- [ ] **Step 1: Add automated document checks**

Validate required chapters, mandatory role names, rule phrases, field-table headers, at least one screenshot per requested function, unique image links, and that every referenced PNG exists and is larger than 20 KB.

```js
for (const heading of REQUIRED_HEADINGS) assert.match(source, new RegExp(escapeRegExp(heading)))
for (const imagePath of imagePaths) {
  assert.ok(existsSync(resolve(prdDir, imagePath)), `missing ${imagePath}`)
  assert.ok(statSync(resolve(prdDir, imagePath)).size > 20_000, `empty ${imagePath}`)
}
```

- [ ] **Step 2: Run the PRD validator**

Run: `node scripts/verify-project-management-prd.mjs`

Expected: PASS.

- [ ] **Step 3: Perform visual review**

Open every captured image, check cropping, active tabs, visible values, error examples, and readability. Correct the page state or crop and rerun capture for any defective image.

- [ ] **Step 4: Cross-check PRD against implemented UI**

Verify each traceability row against the local application. Correct documentation where implementation and old source documents disagree; do not silently claim unavailable backend behavior.

- [ ] **Step 5: Re-run the validator and repository checks**

Run: `node scripts/verify-project-management-prd.mjs && npx tsc --noEmit && npm run build`

Expected: all pass.

- [ ] **Step 6: Commit reviewed PRD**

```bash
git add docs/prd/项目管理-一级计划+三级计划+配置中心PRD.md docs/prd/project-management-level1-level3-config scripts/verify-project-management-prd.mjs
git commit -m "docs: verify project management PRD"
```
