# 项目管理系统

## 项目状态：开发中

### 部署信息
- **URL**: https://project-management-system-virid-beta.vercel.app ✅

### 已完成功能

| 模块 | 功能 | 状态 |
|------|------|------|
| 主页 | 项目卡片 | ✅ |
| 主页 | 项目看板(4维度) | ✅ |
| 主页 | 代办中心 | ✅ |
| 配置管理 | 一级计划模板 | ✅ |
| 配置管理 | 二级计划模板 | ✅ |
| 项目空间 | 基础信息 | ✅ |
| 项目空间 | 计划管理 | ✅ |
| 项目空间 | 需求开发计划(IR/SR) | ✅ |
| 项目空间 | 1+N MR版本火车计划 | ✅ |
| 项目空间 | 概况 | ✅ |
| 项目空间 | 资源管理 | ✅ |
| 项目空间 | 任务管理 | ✅ |
| 项目空间 | 风险管理 | ✅ |
| 项目空间 | 缺陷管理 | ✅ |
| 项目空间 | 团队管理 | ✅ |
| 项目空间 | 项目文档 | ✅ |
| 项目空间 | MR版本火车计划 | ✅ |

### 页面结构
- `/` - 主页
- `/config/plan` - 一级计划模板
- `/config/plan/second` - 二级计划模板
- `/project/[id]/space` - 项目空间
- `/project/[id]/space/requirement` - 需求开发计划
- `/project/[id]/space/mr` - MR版本火车计划

### 技术栈
- Next.js 14 + React 18 + TypeScript
- Tailwind CSS + Ant Design
- Zustand (状态管理)
- Vercel 部署
