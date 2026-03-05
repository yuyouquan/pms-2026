# 项目管理系统

## 项目状态：开发中

### 部署信息
- **URL**: https://project-management-system-virid-beta.vercel.app (需手动部署)
- **部署状态**: ⚠️ Vercel认证令牌失效，需要重新运行 `vercel login`
- **最近更新**: 2026-03-06

### 本次迭代完成内容
- **概况页面实现**：
  - 创建项目概况页面 (overview/page.tsx)
  - 显示项目统计卡片（总任务、已完成、进行中、逾期任务）
  - 显示整体完成率、风险数量、缺陷数量、团队人数
  - 里程碑进度表格展示
  - 最近活动记录列表

- **主空间页面优化**：
  - 修复各模块链接，现在可以正确跳转到详情页面
  - 移除不必要的占位符显示

### 已完成功能

| 模块 | 功能 | 状态 |
|------|------|------|
| 主页 | 项目卡片 | ✅ |
| 主页 | 项目看板(4维度) | ✅ |
| 主页 | 代办中心 | ✅ |
| 配置管理 | 一级计划模板 | ✅ |
| 配置管理 | 二级计划模板 | ✅ |
| 项目空间 | 基础信息 | ✅ |
| 项目空间 | 概况 | ✅ (本次迭代新增) |
| 项目空间 | 计划管理 | ✅ |
| 项目空间 | 需求开发计划(IR/SR) | ✅ |
| 项目空间 | 1+N MR版本火车计划 | ✅ |
| 项目空间 | 资源管理 | ✅ |
| 项目空间 | 任务管理 | ✅ |
| 项目空间 | 风险管理 | ✅ |
| 项目空间 | 缺陷管理 | ✅ |
| 项目空间 | 团队管理 | ✅ |
| 项目空间 | 项目文档 | ✅ |

### 页面结构
- `/` - 主页
- `/config/plan` - 一级计划模板
- `/config/plan/second` - 二级计划模板
- `/project/[id]/space` - 项目空间主页
- `/project/[id]/space/overview` - 概况 (新增)
- `/project/[id]/space/plan` - 计划管理
- `/project/[id]/space/requirement` - 需求开发计划
- `/project/[id]/space/mr` - MR版本火车计划
- `/project/[id]/space/resource` - 资源管理
- `/project/[id]/space/task` - 任务管理
- `/project/[id]/space/risk` - 风险管理
- `/project/[id]/space/bug` - 缺陷管理
- `/project/[id]/space/team` - 团队管理
- `/project/[id]/space/doc` - 项目文档

### 技术栈
- Next.js 14 + React 18 + TypeScript
- Tailwind CSS + Ant Design
- Zustand (状态管理)
- Vercel 部署

### 待实现功能 (原需求标注为"待定")
- 融合版需求展示
- 在研版本火车计划
- 粉丝版本计划
- 基础体验计划
- WBS计划
- 计划总览（高级视图）

### 部署步骤
```bash
cd code
npm run build
npx vercel login  # 需要重新登录
npx vercel --prod
```
