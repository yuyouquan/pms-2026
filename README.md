# 项目管理系统

## 项目介绍
项目管理系统是一个企业级项目管理平台，支持工作台和配置中心两大模块。

## 技术栈
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Prisma (ORM)
- PostgreSQL (数据库)

## 功能模块

### 配置中心
- 一级计划模板管理
- 二级计划模板管理

### 工作台
- 项目卡片
- 项目空间
- 计划管理
- 项目看板
- 代办中心

## 快速开始

```bash
# 安装依赖
npm install

# 初始化数据库
npx prisma generate
npx prisma db push

# 启动开发服务器
npm run dev
```

## 目录结构

```
├── src/
│   ├── app/              # Next.js App Router
│   ├── components/       # React组件
│   ├── lib/              # 工具函数
│   ├── types/            # TypeScript类型
│   └── styles/           # 全局样式
├── prisma/               # Prisma schema
└── public/               # 静态资源
```
