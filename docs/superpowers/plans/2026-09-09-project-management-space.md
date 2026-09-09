# 项目管理空间实施计划

**目标：** 在 Header 的“工作台”和“项目列表”之间增加“项目管理”，点击后内容区为空，提交并推送到 feature 分支。

**实现：** 复用现有 Zustand 模块导航和 Header 菜单，新增 `projectManagement`。页面渲染带有“项目管理”无障碍名称的空白区域，导航继续经过现有离开编辑确认逻辑。

**技术：** Next.js 14、React 18、Ant Design、Zustand、TypeScript。

## 步骤

- [x] 获取远端最新状态，将本地 dev 同步至 `23b8d3c`，从 dev 创建 `codex/feature-project-management-space`；使用独立工作目录保留原有本地改动。
- [x] 在 `src/stores/ui.ts` 的 `MainModule` 中加入 `projectManagement`。
- [x] 在 `src/containers/AppShell.tsx` 的工作台菜单项后加入 `{ key: 'projectManagement', label: '项目管理' }`。
- [x] 在 `src/app/page.tsx` 中加入 `{activeModule === 'projectManagement' && <section aria-label="项目管理" />}`。
- [x] 更新 `scripts/verify-workbench-split.mjs` 中的模块枚举及 Header 排列预期。
- [x] 执行 `npx tsc --noEmit`、`npm run verify:workbench-split`、`npm run build`，全部通过。
- [x] 在本地生产构建中检查菜单排列、选中状态、空白内容，以及与工作台和项目列表之间的切换；浏览器错误和警告日志均为空。

## 交付

仅提交本次相关文件，推送至 `origin/codex/feature-project-management-space`，推送后核对本地 HEAD 与远端分支提交一致。
