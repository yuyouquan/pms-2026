# Project Card & Basic Info Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Differentiate project cards by type, add IPM status mapping, expand basic info with IPM/SCM fields, add plan info section, refine permissions, and optimize workspace/todo center.

**Architecture:** All changes in the existing single-file architecture. Extend `src/types/index.ts` for new types, update `initialProjects` mock data in `page.tsx`, modify `renderProjectCard()`, `renderProjectBasicInfo()`, `renderTodoList()`, `renderPermissionConfig()`, and `renderGlobalPermissionConfig()` functions. Add new `renderProjectPlanInfo()` function.

**Tech Stack:** Next.js 14, React 18, Ant Design 6.3.1, TypeScript, Tailwind CSS

---

### Task 1: Extend Type Definitions & Status Mapping

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add project status types and extend Project interface**

Add after the existing `ProjectType` definition (line 4):

```typescript
// 项目状态映射 - IPM原始状态 → PMS展示状态
export const IPM_STATUS_MAP: Record<string, string> = {
  '筹备中': '待立项',
  '进行中': '进行中',
  '已完成': '已完成',
  '已取消': '已取消',
  '维护期': '维护',
}

// 各项目类型的状态枚举
export type SoftwareProjectStatus = '待立项' | '进行中' | '已完成' | '维护' | '暂停' | '已取消'
export type HardwareProjectStatus = '待立项' | '进行中' | '已上市' | '维护' | '暂停' | '已取消'
export type TechProjectStatus = '待立议' | '进行中' | '已完成' | '待验' | '已取消'
export type CapabilityProjectStatus = '待立项' | '进行中' | '已完成' | '已取消'

// 项目健康状态
export type ProjectHealthStatus = 'normal' | 'risk' | 'warning'
```

- [ ] **Step 2: Extend the Project interface with new fields**

Replace the existing `Project` interface (lines 52-63) with:

```typescript
export interface Project {
  id: string;
  name: string;
  projectType: ProjectType;
  androidVersion: string;
  chipPlatform: string;
  status: string;
  spm: string;
  markets?: string[];
  createdAt: Date;
  updatedAt: Date;
  // 新增字段
  projectCategory?: string;
  marketName?: string;
  brand?: string;
  productLine?: string;
  developMode?: string;
  planStartDate?: string;
  planEndDate?: string;
  developCycle?: number;
  projectManager?: string;
  progress?: number;
  healthStatus?: ProjectHealthStatus;
  // 基本信息扩展 (IPM/SCM)
  model?: string;
  mainboard?: string;
  born?: string;
  cpu?: string;
  memory?: string;
  lcd?: string;
  frontCamera?: string;
  primaryCamera?: string;
  operatingSystem?: string;
  version?: string;
  market?: string;
  area?: string;
  buildAddress?: string;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/shswyuyouquan/Documents/work/pms-2026 && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors (existing code uses `typeof initialProjects[0]` not the `Project` interface directly, so no breaking changes)

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: extend type definitions with project status mapping and expanded fields"
```

---

### Task 2: Update Mock Data - Extend initialProjects

**Files:**
- Modify: `src/app/page.tsx` (lines 469-476, the `initialProjects` array)

- [ ] **Step 1: Replace initialProjects with type-differentiated data**

Replace the existing `initialProjects` array (lines 469-476) with expanded data that includes new fields per project type:

```typescript
const initialProjects = [
  // 整机产品项目 - 显示: 市场名、品牌、产品线、开发模式
  {
    id: '1', name: 'X6877-D8400_H991', type: '整机产品项目' as const,
    status: '进行中', progress: 65, leader: '张三',
    markets: ['OP', 'TR', 'RU'], androidVersion: 'Android 16', chipPlatform: 'MTK',
    spm: '李白', updatedAt: '2小时前', productLine: 'NOTE', tosVersion: 'tOS 16.3',
    // 新增字段
    marketName: 'NOTE 50 Pro', brand: 'TECNO', developMode: 'ODC',
    planStartDate: '2026-01-01', planEndDate: '2026-06-30',
    developCycle: 120, healthStatus: 'normal' as const,
    model: 'X6877', mainboard: 'H991', born: 'B2026Q1',
    cpu: 'MT6877', memory: '8GB+256GB', lcd: '6.78" FHD+',
    frontCamera: '32MP', primaryCamera: '108MP+8MP+2MP',
    operatingSystem: 'Android 16', version: 'V1.0.0',
    buildAddress: 'https://build.example.com/X6877',
  },
  // 整机产品项目2
  {
    id: '3', name: 'X6855_H8917', type: '整机产品项目' as const,
    status: '进行中', progress: 45, leader: '王五',
    markets: ['OP', 'TR'], androidVersion: 'Android 16', chipPlatform: 'MTK',
    spm: '赵六', updatedAt: '3天前', productLine: 'SPARK', tosVersion: 'tOS 16.3',
    marketName: 'SPARK 30 Pro', brand: 'TECNO', developMode: 'JDM',
    planStartDate: '2026-02-01', planEndDate: '2026-08-31',
    developCycle: 140, healthStatus: 'warning' as const,
    model: 'X6855', mainboard: 'H8917', born: 'B2026Q1',
    cpu: 'MT6855', memory: '6GB+128GB', lcd: '6.67" HD+',
    frontCamera: '16MP', primaryCamera: '64MP+2MP+2MP',
    operatingSystem: 'Android 16', version: 'V1.0.0',
    buildAddress: 'https://build.example.com/X6855',
  },
  // 产品项目(软件) - 显示: 项目名称、状态
  {
    id: '2', name: 'tOS16.0', type: '产品项目' as const,
    status: '进行中', progress: 55, leader: '李四',
    markets: [], androidVersion: 'Android 15', chipPlatform: 'MTK',
    spm: '张三', updatedAt: '1天前', productLine: 'tOS', tosVersion: 'tOS 16.0',
    planStartDate: '2026-01-15', planEndDate: '2026-05-30',
    developCycle: 95, healthStatus: 'normal' as const,
    operatingSystem: 'Android 15', version: 'tOS16.0-V2',
    buildAddress: 'https://build.example.com/tOS16',
  },
  {
    id: '6', name: 'tOS17.1', type: '产品项目' as const,
    status: '筹备中', progress: 15, leader: '赵六',
    markets: [], androidVersion: 'Android 16', chipPlatform: 'QCOM',
    spm: '李四', updatedAt: '3小时前', productLine: 'tOS', tosVersion: 'tOS 17.1',
    planStartDate: '2026-03-01', planEndDate: '2026-09-30',
    developCycle: 140, healthStatus: 'normal' as const,
    operatingSystem: 'Android 16', version: 'tOS17.1-V1',
    buildAddress: 'https://build.example.com/tOS17',
  },
  // 技术项目 - 显示: 项目名称、状态
  {
    id: '4', name: 'X6876_H786', type: '技术项目' as const,
    status: '已完成', progress: 100, leader: '孙七',
    markets: [], androidVersion: 'Android 15', chipPlatform: 'QCOM',
    spm: '李四', updatedAt: '5天前', productLine: '平台技术', tosVersion: 'tOS 15.0',
    planStartDate: '2025-10-01', planEndDate: '2026-02-28',
    developCycle: 100, healthStatus: 'normal' as const,
    operatingSystem: 'Android 15',
    buildAddress: 'https://build.example.com/X6876',
  },
  // 能力建设项目
  {
    id: '5', name: 'X6873_H972', type: '能力建设项目' as const,
    status: '进行中', progress: 30, leader: '周八',
    markets: [], androidVersion: 'Android 16', chipPlatform: 'UNISOC',
    spm: '王五', updatedAt: '1周前', productLine: '基础能力', tosVersion: 'tOS 16.2',
    planStartDate: '2026-02-15', planEndDate: '2026-07-31',
    developCycle: 110, healthStatus: 'risk' as const,
    operatingSystem: 'Android 16',
    buildAddress: 'https://build.example.com/X6873',
  },
]
```

- [ ] **Step 2: Add status mapping helper and status color config**

Add right before the `initialProjects` array (around line 468):

```typescript
// IPM状态 → PMS展示状态 映射
const mapIpmStatus = (ipmStatus: string, projectType: string): string => {
  const mapping: Record<string, string> = {
    '筹备中': '待立项',
    '进行中': '进行中',
    '已完成': '已完成',
    '已取消': '已取消',
    '维护期': '维护',
  }
  // 整机产品项目特有: 已上市
  if (projectType === '整机产品项目' && ipmStatus === '已上市') return '已上市'
  // 技术项目特有: 待立议、待验
  if (projectType === '技术项目' && ipmStatus === '待立议') return '待立议'
  if (projectType === '技术项目' && ipmStatus === '待验') return '待验'
  return mapping[ipmStatus] || ipmStatus
}

// 项目状态颜色配置
const PROJECT_STATUS_CONFIG: Record<string, { color: string; tagColor: string }> = {
  '待立项': { color: '#faad14', tagColor: 'warning' },
  '待立议': { color: '#faad14', tagColor: 'warning' },
  '进行中': { color: '#1890ff', tagColor: 'processing' },
  '已完成': { color: '#52c41a', tagColor: 'success' },
  '已上市': { color: '#722ed1', tagColor: 'purple' },
  '维护': { color: '#13c2c2', tagColor: 'cyan' },
  '暂停': { color: '#d9d9d9', tagColor: 'default' },
  '已取消': { color: '#ff4d4f', tagColor: 'error' },
  '待验': { color: '#faad14', tagColor: 'warning' },
  '筹备中': { color: '#faad14', tagColor: 'warning' },
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/shswyuyouquan/Documents/work/pms-2026 && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: expand mock data with type-specific fields and status mapping"
```

---

### Task 3: Redesign Project Cards by Type

**Files:**
- Modify: `src/app/page.tsx` (lines 1302-1352, the `renderProjectCard` function)

- [ ] **Step 1: Replace renderProjectCard with type-differentiated card**

Replace the entire `renderProjectCard` function (lines 1302-1352) with:

```typescript
  const renderProjectCard = (project: typeof initialProjects[0]) => {
    const statusConf = PROJECT_STATUS_CONFIG[project.status] || { color: '#8c8c8c', tagColor: 'default' }
    const isWholeMachine = project.type === '整机产品项目'
    const isTech = project.type === '技术项目'
    const isSoftware = project.type === '产品项目'

    return (
      <Card
        hoverable
        className="pms-card-hover"
        style={{ borderRadius: 10, border: '1px solid #f0f0f0' }}
        styles={{ body: { padding: '16px 20px' } }}
        onClick={() => { setSelectedProject(project); setActiveModule('projectSpace') }}
      >
        {/* 头部: 项目名 + 状态 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#262626', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isWholeMachine && project.marketName ? project.marketName : project.name}
            </div>
            {isWholeMachine && project.marketName && (
              <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</div>
            )}
            <Space size={4} wrap>
              <Tag color="default" style={{ fontSize: 11, borderRadius: 3, margin: 0 }}>{project.type}</Tag>
              {isWholeMachine && project.markets && project.markets.length > 0 && (
                <Tag color="blue" style={{ fontSize: 11, borderRadius: 3, margin: 0 }}>{project.markets.join(' / ')}</Tag>
              )}
            </Space>
          </div>
          <Tag color={statusConf.tagColor} style={{ margin: 0, borderRadius: 4, flexShrink: 0 }}>{project.status}</Tag>
        </div>

        {/* 中间: 类型差异化字段 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {isWholeMachine && (
            <>
              {project.brand && (
                <div style={{ fontSize: 12, color: '#8c8c8c', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ color: '#bfbfbf' }}>品牌</span> <span style={{ color: '#595959', fontWeight: 500 }}>{project.brand}</span>
                </div>
              )}
              {project.productLine && (
                <div style={{ fontSize: 12, color: '#8c8c8c', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ color: '#bfbfbf' }}>产品线</span> <span style={{ color: '#595959', fontWeight: 500 }}>{project.productLine}</span>
                </div>
              )}
              {project.developMode && (
                <div style={{ fontSize: 12, color: '#8c8c8c', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ color: '#bfbfbf' }}>模式</span> <span style={{ color: '#595959', fontWeight: 500 }}>{project.developMode}</span>
                </div>
              )}
            </>
          )}
          {(isSoftware || isTech) && (
            <>
              <div style={{ fontSize: 12, color: '#8c8c8c', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: '#bfbfbf' }}>Android</span> <span style={{ color: '#595959', fontWeight: 500 }}>{project.androidVersion.replace('Android ', '')}</span>
              </div>
              <div style={{ fontSize: 12, color: '#8c8c8c', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: '#bfbfbf' }}>芯片</span> <span style={{ color: '#595959', fontWeight: 500 }}>{project.chipPlatform}</span>
              </div>
            </>
          )}
          {project.type === '能力建设项目' && (
            <div style={{ fontSize: 12, color: '#8c8c8c', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: '#bfbfbf' }}>方向</span> <span style={{ color: '#595959', fontWeight: 500 }}>{project.productLine}</span>
            </div>
          )}
        </div>

        {/* 计划时间 */}
        {(project.planStartDate || project.planEndDate) && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 10, fontSize: 12, color: '#8c8c8c' }}>
            {project.planStartDate && (
              <span><CalendarOutlined style={{ marginRight: 4, color: '#bfbfbf' }} />{project.planStartDate}</span>
            )}
            {project.planEndDate && (
              <span>→ {project.planEndDate}</span>
            )}
          </div>
        )}

        {/* 进度条 */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: '#8c8c8c' }}>进度</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: statusConf.color }}>{project.progress}%</span>
          </div>
          <Progress percent={project.progress} size="small" showInfo={false} strokeColor={statusConf.color} trailColor="#f0f0f0" />
        </div>

        {/* 底部: SPM + 更新时间 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space size={6}>
            <Avatar size={20} style={{ background: statusConf.color, fontSize: 10 }}>{project.spm[0]}</Avatar>
            <span style={{ fontSize: 12, color: '#595959' }}>{project.spm}</span>
          </Space>
          <span style={{ fontSize: 11, color: '#bfbfbf' }}>{project.updatedAt}</span>
        </div>
      </Card>
    )
  }
```

- [ ] **Step 2: Verify TypeScript compiles and check the UI**

Run: `cd /Users/shswyuyouquan/Documents/work/pms-2026 && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: differentiate project cards by type with status mapping"
```

---

### Task 4: Expand Basic Info with IPM/SCM Fields

**Files:**
- Modify: `src/app/page.tsx` (lines 2023-2279, the `renderProjectBasicInfo` function)

- [ ] **Step 1: Replace renderProjectBasicInfo with expanded version**

Replace the entire `renderProjectBasicInfo` function with a version that:
1. Shows project overview card with data from the project object (not hardcoded)
2. Adds a "项目基础信息" section with IPM/SCM sourced fields in a Descriptions component
3. Keeps the existing market project info tabs for 整机产品项目
4. Marks each field with its data source (IPM/SCM/平台自定义)

Replace lines 2023-2279:

```typescript
  const renderProjectBasicInfo = () => {
    const markets = selectedProject?.markets || ['OP', 'TR', 'RU']
    const isWholeMachine = selectedProject?.type === '整机产品项目'
    const p = selectedProject!

    const sectionTitleStyle: CSSProperties = {
      fontSize: 13,
      fontWeight: 600,
      color: '#8c8c8c',
      textTransform: 'uppercase' as const,
      letterSpacing: 1,
      marginBottom: 12,
      paddingBottom: 8,
      borderBottom: '1px solid #f0f0f0',
    }

    const descLabelStyle: CSSProperties = {
      fontWeight: 500,
      color: '#8c8c8c',
      fontSize: 13,
      background: '#fafbfc',
    }
    const descContentStyle: CSSProperties = {
      color: '#262626',
      fontSize: 13,
    }

    const sourceTag = (source: 'IPM' | 'SCM' | '平台自定义') => {
      const colors = { IPM: '#1890ff', SCM: '#52c41a', '平台自定义': '#faad14' }
      return <Tag color={colors[source]} style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0, marginLeft: 6 }}>{source}</Tag>
    }

    const statusConf = PROJECT_STATUS_CONFIG[p.status] || { color: '#8c8c8c', tagColor: 'default' }

    return (
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* 项目概要卡片 */}
        <Card
          style={{ marginBottom: 20, borderRadius: 8, overflow: 'hidden' }}
          styles={{
            header: { background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)', borderBottom: 'none', padding: '16px 24px' },
            body: { padding: 0 },
          }}
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ProjectOutlined style={{ color: '#fff', fontSize: 18 }} />
              </div>
              <div>
                <div style={{ color: '#fff', fontSize: 16, fontWeight: 600, lineHeight: 1.3 }}>
                  {isWholeMachine && p.marketName ? p.marketName : p.name}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>
                  {[p.model || p.name, p.mainboard, p.tosVersion].filter(Boolean).join(' · ')}
                </div>
              </div>
            </div>
          }
          extra={
            <Space size={8}>
              <Tag color={statusConf.tagColor} style={{ margin: 0, borderRadius: 4, fontWeight: 500 }}>{p.status}</Tag>
              {p.healthStatus && (
                <Tag style={{ margin: 0, borderRadius: 4, background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff' }}>
                  {p.healthStatus === 'normal' ? '健康' : p.healthStatus === 'warning' ? '关注' : '风险'}
                </Tag>
              )}
              <Button type="primary" icon={<SendOutlined />} style={{ background: '#4338ca', borderColor: '#4338ca' }} onClick={() => setTransferView('apply')}>申请转维</Button>
            </Space>
          }
        >
          {/* 关键信息摘要行 */}
          <div style={{ display: 'flex', background: '#f8fafc', borderBottom: '1px solid #f0f0f0' }}>
            {[
              { label: '产品线', value: p.productLine || '-' },
              { label: isWholeMachine ? '开发模式' : '芯片平台', value: isWholeMachine ? (p.developMode || '-') : (p.chipPlatform || '-') },
              { label: '安卓版本', value: p.androidVersion?.replace('Android ', '') || '-' },
              { label: '主板名', value: p.mainboard || '-' },
            ].map((item, i) => (
              <div key={i} style={{ flex: 1, padding: '14px 20px', borderRight: i < 3 ? '1px solid #f0f0f0' : 'none', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4, fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>{item.label}</div>
                <div style={{ fontSize: 14, color: '#262626', fontWeight: 600 }}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* 详细信息 */}
          <div style={{ padding: '20px 24px' }}>
            <Row gutter={[48, 16]}>
              <Col span={12}>
                <div style={sectionTitleStyle}>项目信息</div>
                <Row gutter={[16, 10]}>
                  {[
                    { label: '项目名', value: p.name },
                    { label: '芯片', value: p.cpu || p.chipPlatform },
                    { label: 'OS版本', value: p.tosVersion || p.operatingSystem },
                    ...(isWholeMachine ? [{ label: '市场名', value: p.marketName || '-' }] : []),
                  ].map((item, i) => (
                    <Col span={12} key={i}>
                      <div style={{ display: 'flex', lineHeight: '28px' }}>
                        <span style={{ color: '#8c8c8c', fontSize: 13, minWidth: 70, flexShrink: 0 }}>{item.label}</span>
                        <span style={{ color: '#262626', fontSize: 13, fontWeight: 500 }}>{item.value}</span>
                      </div>
                    </Col>
                  ))}
                </Row>
              </Col>
              <Col span={12}>
                <div style={sectionTitleStyle}>团队成员</div>
                <Row gutter={[16, 12]}>
                  {[
                    { role: 'SPM', name: p.spm, color: '#1890ff' },
                    { role: '负责人', name: p.leader, color: '#87d068' },
                  ].map((member, i) => (
                    <Col span={12} key={i}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #f0f0f0' }}>
                        <Avatar size={32} style={{ background: member.color, fontSize: 14, flexShrink: 0 }}>{member.name[0]}</Avatar>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#262626', lineHeight: 1.3 }}>{member.name}</div>
                          <div style={{ fontSize: 11, color: '#8c8c8c' }}>{member.role}</div>
                        </div>
                      </div>
                    </Col>
                  ))}
                </Row>
              </Col>
            </Row>
          </div>
        </Card>

        {/* 项目基础信息 - 数据来源标记 */}
        <Card
          style={{ marginBottom: 20, borderRadius: 8 }}
          title={<Space><DatabaseOutlined style={{ color: '#1890ff' }} /><span style={{ fontWeight: 600 }}>项目基础信息</span></Space>}
        >
          <Descriptions
            bordered
            size="small"
            column={{ xs: 1, sm: 2, md: 3 }}
            labelStyle={descLabelStyle}
            contentStyle={descContentStyle}
          >
            <Descriptions.Item label={<span>型号名称 {sourceTag('IPM')}</span>}>{p.model || p.name}</Descriptions.Item>
            <Descriptions.Item label={<span>主板名 {sourceTag('IPM')}</span>}>{p.mainboard || '-'}</Descriptions.Item>
            <Descriptions.Item label={<span>Born {sourceTag('SCM')}</span>}>{p.born || '-'}</Descriptions.Item>
            <Descriptions.Item label={<span>市场名 {sourceTag('IPM')}</span>}>{p.marketName || '-'}</Descriptions.Item>
            <Descriptions.Item label={<span>公共型号 {sourceTag('SCM')}</span>}>{p.cpu || p.chipPlatform || '-'}</Descriptions.Item>
            <Descriptions.Item label={<span>内存 {sourceTag('SCM')}</span>}>{p.memory || '-'}</Descriptions.Item>
            <Descriptions.Item label={<span>液晶 {sourceTag('SCM')}</span>}>{p.lcd || '-'}</Descriptions.Item>
            <Descriptions.Item label={<span>前摄像头 {sourceTag('SCM')}</span>}>{p.frontCamera || '-'}</Descriptions.Item>
            <Descriptions.Item label={<span>后摄像头 {sourceTag('SCM')}</span>}>{p.primaryCamera || '-'}</Descriptions.Item>
            <Descriptions.Item label={<span>安卓版本 {sourceTag('IPM')}</span>}>{p.operatingSystem || p.androidVersion || '-'}</Descriptions.Item>
            <Descriptions.Item label={<span>品牌 {sourceTag('IPM')}</span>}>{p.brand || '-'}</Descriptions.Item>
            <Descriptions.Item label={<span>产品线 {sourceTag('IPM')}</span>}>{p.productLine || '-'}</Descriptions.Item>
            <Descriptions.Item label={<span>版本编号 {sourceTag('SCM')}</span>}>{p.version || '-'}</Descriptions.Item>
            <Descriptions.Item label={<span>版本构建地址 {sourceTag('平台自定义')}</span>}>
              {p.buildAddress ? <a href={p.buildAddress} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12 }}>{p.buildAddress}</a> : '-'}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* 转维信息模块 */}
        {currentProjectTransferApps.length > 0 && (
          <Card style={{ marginBottom: 20, borderRadius: 8 }} title={<Space><DeploymentUnitOutlined style={{ color: '#4338ca' }} /><span style={{ fontWeight: 600 }}>转维信息</span></Space>}>
            <Table
              dataSource={currentProjectTransferApps}
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ x: 900 }}
              rowClassName={(r) => r.status === 'cancelled' ? 'tm-row-cancelled' : ''}
              columns={[
                {
                  title: '项目名称', dataIndex: 'projectName', width: 200,
                  render: (_: unknown, r: TransferApplication) => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar size={32} style={{ background: `linear-gradient(135deg, ${ROLE_COLORS[r.team.research[0]?.role] || '#4338ca'} 0%, #6366f1 100%)`, fontSize: 12, flexShrink: 0 }}>{r.applicant.slice(-1)}</Avatar>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{r.projectName}</div>
                        <div style={{ fontSize: 11, color: '#8c8c8c' }}>{r.applicant} · {r.createdAt.slice(0, 10)}</div>
                      </div>
                    </div>
                  ),
                },
                {
                  title: '流水线进度', width: 180,
                  render: (_: unknown, r: TransferApplication) => <MiniPipeline app={r} />,
                },
                { title: '计划评审日期', dataIndex: 'plannedReviewDate', width: 110 },
                {
                  title: '角色进度', width: 180,
                  render: (_: unknown, r: TransferApplication) => (
                    <Space size={4} wrap>
                      {r.pipeline.roleProgress.map(rp => {
                        const color = rp.entryStatus === 'completed' && rp.reviewStatus === 'completed' ? 'success' : rp.reviewStatus === 'rejected' ? 'error' : rp.entryStatus === 'in_progress' || rp.reviewStatus === 'in_progress' ? 'processing' : 'default'
                        return <Tag key={rp.role} color={color} style={{ margin: 0, fontSize: 11, lineHeight: '18px', padding: '0 6px' }}>{rp.role}</Tag>
                      })}
                    </Space>
                  ),
                },
                {
                  title: '操作', width: 220,
                  render: (_: unknown, r: TransferApplication) => (
                    <Space size={4}>
                      <Button size="small" type="text" icon={<FileTextOutlined />} style={{ color: '#666' }} onClick={() => { setSelectedTransferAppId(r.id); setTransferView('detail'); }}>详情</Button>
                      {r.status === 'in_progress' && r.pipeline.dataEntry !== 'success' && <Button size="small" type="text" icon={<EditOutlined />} style={{ color: '#1677ff' }} onClick={() => { setSelectedTransferAppId(r.id); setTransferView('entry'); }}>录入</Button>}
                      {r.status === 'in_progress' && r.pipeline.maintenanceReview === 'in_progress' && <Button size="small" type="text" icon={<AuditOutlined />} style={{ color: '#52c41a' }} onClick={() => { setSelectedTransferAppId(r.id); setTransferView('review'); }}>评审</Button>}
                      {r.status === 'in_progress' && r.pipeline.sqaReview === 'in_progress' && <Button size="small" type="text" icon={<SafetyOutlined />} style={{ color: '#faad14' }} onClick={() => { setSelectedTransferAppId(r.id); setTransferView('sqa-review'); }}>SQA审核</Button>}
                      {r.status === 'in_progress' && <Button size="small" type="text" danger icon={<CloseCircleOutlined />} onClick={() => { setTmCloseAppId(r.id); setTmCloseReason(''); setTmCloseModalVisible(true); }}>关闭</Button>}
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        )}

        {/* 市场项目信息 - 仅整机产品项目显示 */}
        {isWholeMachine && (
          <Card
            style={{ borderRadius: 8 }}
            styles={{
              header: { background: '#fafbfc', borderBottom: '2px solid #52c41a', padding: '12px 24px' },
              body: { padding: '4px 0 0 0' },
            }}
            title={
              <Space size={8}>
                <TeamOutlined style={{ color: '#52c41a', fontSize: 16 }} />
                <span style={{ fontSize: 15, fontWeight: 600 }}>市场项目信息</span>
                <Tag color="default" style={{ marginLeft: 4, fontSize: 11 }}>{markets.length} 个市场</Tag>
              </Space>
            }
          >
            <Tabs
              activeKey={selectedMarketTab}
              onChange={setSelectedMarketTab}
              type="card"
              style={{ padding: '0 16px' }}
              items={markets.map(m => {
                const marketColor = m === 'OP' ? '#1890ff' : m === 'TR' ? '#52c41a' : '#faad14'
                return {
                  key: m,
                  label: <Space size={6}><Badge color={marketColor} /><span style={{ fontWeight: 500 }}>{m}</span></Space>,
                  children: (
                    <div style={{ padding: '8px 8px 16px' }}>
                      {/* 市场基础信息 */}
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ ...sectionTitleStyle, color: '#1890ff', borderBottomColor: '#e6f4ff' }}>市场项目基础信息</div>
                        <Descriptions
                          bordered
                          size="small"
                          column={{ xs: 1, sm: 2, md: 3 }}
                          labelStyle={descLabelStyle}
                          contentStyle={descContentStyle}
                        >
                          <Descriptions.Item label="市场项目名"><span style={{ fontWeight: 500 }}>{`${p.model || p.name}-${m}`}</span></Descriptions.Item>
                          <Descriptions.Item label="编译选项"><code style={{ padding: '1px 6px', background: '#f5f5f5', borderRadius: 3, fontSize: 12 }}>{(p.model || p.name).toLowerCase()}</code></Descriptions.Item>
                          <Descriptions.Item label="运营商定制"><Tag color="default">否</Tag></Descriptions.Item>
                          <Descriptions.Item label="市场名称">{`${m} Market`}</Descriptions.Item>
                          <Descriptions.Item label="编译市场"><code style={{ padding: '1px 6px', background: '#f5f5f5', borderRadius: 3, fontSize: 12 }}>{m.toLowerCase()}</code></Descriptions.Item>
                          <Descriptions.Item label="是否锁卡"><Tag color="default">否</Tag></Descriptions.Item>
                          <Descriptions.Item label="内存"><span style={{ fontWeight: 500 }}>{p.memory || '8GB'}</span></Descriptions.Item>
                          <Descriptions.Item label="软件项目等级"><Tag color="blue">A</Tag></Descriptions.Item>
                          <Descriptions.Item label="是否保密"><Tag color="default">否</Tag></Descriptions.Item>
                          <Descriptions.Item label="SQA审计策略"><Tag color="blue">全审</Tag></Descriptions.Item>
                          <Descriptions.Item label="是否支持VILTE"><Tag color="default">否</Tag></Descriptions.Item>
                          <Descriptions.Item label="运营商版本标识">-</Descriptions.Item>
                          <Descriptions.Item label="BOM"><span style={{ fontWeight: 500 }}>BOM-001</span></Descriptions.Item>
                          <Descriptions.Item label="软件版本号"><span style={{ fontWeight: 500 }}>{p.version || 'XOS16.2.0'}</span></Descriptions.Item>
                          <Descriptions.Item label="备注">-</Descriptions.Item>
                          <Descriptions.Item label="是否取消暂停"><Tag color="default">否</Tag></Descriptions.Item>
                          <Descriptions.Item label="取消暂停时间">-</Descriptions.Item>
                        </Descriptions>
                      </div>

                      {/* 市场维护信息 */}
                      <div>
                        <div style={{ ...sectionTitleStyle, color: '#52c41a', borderBottomColor: '#f6ffed' }}>市场项目维护信息</div>
                        <Descriptions
                          bordered
                          size="small"
                          column={{ xs: 1, sm: 2, md: 3 }}
                          labelStyle={descLabelStyle}
                          contentStyle={descContentStyle}
                        >
                          <Descriptions.Item label="维护类型"><Tag color="processing">常规维护</Tag></Descriptions.Item>
                          <Descriptions.Item label="维护原因">版本升级</Descriptions.Item>
                          <Descriptions.Item label="已触发MADA"><Tag color="default">否</Tag></Descriptions.Item>
                          <Descriptions.Item label="维护周期"><span style={{ fontWeight: 500 }}>6个月</span></Descriptions.Item>
                          <Descriptions.Item label="Launch Date"><CalendarOutlined style={{ marginRight: 6, color: '#8c8c8c' }} />2026-06-01</Descriptions.Item>
                          <Descriptions.Item label="EOS"><CalendarOutlined style={{ marginRight: 6, color: '#8c8c8c' }} />2028-06-01</Descriptions.Item>
                          <Descriptions.Item label="是否转维护组"><Tag color="default">否</Tag></Descriptions.Item>
                          <Descriptions.Item label="是否MADA管控"><Tag color="default">否</Tag></Descriptions.Item>
                        </Descriptions>
                      </div>
                    </div>
                  ),
                }
              })}
            />
          </Card>
        )}
      </div>
    )
  }
```

- [ ] **Step 2: Add DatabaseOutlined import if not present**

Check and add `DatabaseOutlined` to the `@ant-design/icons` import at the top of page.tsx.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/shswyuyouquan/Documents/work/pms-2026 && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: expand basic info with IPM/SCM data source fields"
```

---

### Task 5: Add Plan Info Section

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add renderProjectPlanInfo function**

Add a new `renderProjectPlanInfo` function after `renderProjectBasicInfo`. This shows plan start/end dates, development cycle, and a milestone summary.

```typescript
  const renderProjectPlanInfo = () => {
    const p = selectedProject!

    // 开发周期计算说明: 概念启动到最后STR阶段结束，去掉节假日和周末
    const planTasks = LEVEL1_TASKS
    const firstTask = planTasks.find(t => !t.parentId && t.order === 1)
    const lastTask = [...planTasks].filter(t => !t.parentId).sort((a, b) => b.order - a.order)[0]

    return (
      <Card
        style={{ marginBottom: 20, borderRadius: 8 }}
        title={<Space><CalendarOutlined style={{ color: '#1890ff' }} /><span style={{ fontWeight: 600 }}>计划信息</span></Space>}
      >
        <Row gutter={[24, 16]}>
          <Col span={6}>
            <Statistic
              title={<span style={{ fontSize: 12, color: '#8c8c8c' }}>计划开始时间</span>}
              value={p.planStartDate || '-'}
              valueStyle={{ fontSize: 16, fontWeight: 600 }}
              prefix={<CalendarOutlined style={{ color: '#1890ff', fontSize: 14 }} />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={<span style={{ fontSize: 12, color: '#8c8c8c' }}>计划结束时间</span>}
              value={p.planEndDate || '-'}
              valueStyle={{ fontSize: 16, fontWeight: 600 }}
              prefix={<CalendarOutlined style={{ color: '#faad14', fontSize: 14 }} />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={<span style={{ fontSize: 12, color: '#8c8c8c' }}>开发周期（工作日）</span>}
              value={p.developCycle || '-'}
              valueStyle={{ fontSize: 16, fontWeight: 600 }}
              suffix={p.developCycle ? <span style={{ fontSize: 12, color: '#8c8c8c' }}>天</span> : undefined}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={<span style={{ fontSize: 12, color: '#8c8c8c' }}>健康状态</span>}
              value={p.healthStatus === 'normal' ? '健康' : p.healthStatus === 'warning' ? '关注' : p.healthStatus === 'risk' ? '风险' : '-'}
              valueStyle={{
                fontSize: 16, fontWeight: 600,
                color: p.healthStatus === 'normal' ? '#52c41a' : p.healthStatus === 'warning' ? '#faad14' : p.healthStatus === 'risk' ? '#ff4d4f' : '#8c8c8c',
              }}
            />
          </Col>
        </Row>

        <Divider style={{ margin: '16px 0' }} />

        {/* 里程碑摘要 */}
        <div style={{ fontSize: 13, fontWeight: 600, color: '#8c8c8c', marginBottom: 12, textTransform: 'uppercase' as const, letterSpacing: 1 }}>里程碑计划</div>
        <div style={{ display: 'flex', gap: 0, position: 'relative' }}>
          {planTasks.filter(t => !t.parentId).map((task, i, arr) => {
            const statusColor = task.status === '已完成' ? '#52c41a' : task.status === '进行中' ? '#1890ff' : '#d9d9d9'
            const statusBg = task.status === '已完成' ? '#f6ffed' : task.status === '进行中' ? '#e6f4ff' : '#fafafa'
            return (
              <div key={task.id} style={{ flex: 1, textAlign: 'center', position: 'relative' }}>
                {i < arr.length - 1 && (
                  <div style={{ position: 'absolute', top: 12, left: '50%', right: '-50%', height: 2, background: task.status === '已完成' ? '#52c41a' : '#e8e8e8', zIndex: 0 }} />
                )}
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: statusColor, margin: '0 auto 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {task.status === '已完成' ? (
                      <CheckOutlined style={{ color: '#fff', fontSize: 12 }} />
                    ) : (
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />
                    )}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#262626', marginBottom: 2 }}>{task.taskName}</div>
                  <div style={{ fontSize: 11, color: '#8c8c8c' }}>{task.planStartDate} → {task.planEndDate}</div>
                  <Tag color={task.status === '已完成' ? 'success' : task.status === '进行中' ? 'processing' : 'default'} style={{ marginTop: 4, fontSize: 10 }}>{task.status}</Tag>
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    )
  }
```

- [ ] **Step 2: Wire renderProjectPlanInfo into renderProjectBasicInfo**

Insert the plan info card call in `renderProjectBasicInfo`, after the project overview card and before the 项目基础信息 card. Add this line after the closing `</Card>` of the project overview card:

```typescript
        {/* 计划信息 */}
        {renderProjectPlanInfo()}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/shswyuyouquan/Documents/work/pms-2026 && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add plan info section with milestones and dev cycle"
```

---

### Task 6: Enhance Permission Config

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Extend PERMISSION_MODULES with more granular permissions**

Replace the existing `PERMISSION_MODULES` definition (line 739-747) with:

```typescript
  const PERMISSION_MODULES = [
    { key: 'basicInfo', name: '基础信息', permissions: ['查看', '编辑'] },
    { key: 'requirements', name: '需求', permissions: ['查看', '编辑', '导入/导出'] },
    { key: 'plan', name: '计划', permissions: ['一级计划-查看', '一级计划-编辑', '一级计划-审核', '二级计划-查看', '二级计划-编辑', '视图模式', '计划基线与变更', '导入/导出'] },
    { key: 'resources', name: '资源', permissions: ['查看', '编辑'] },
    { key: 'tasks', name: '任务', permissions: ['查看', '编辑', '分配'] },
    { key: 'risks', name: '风险', permissions: ['查看', '编辑'] },
    { key: 'bugs', name: '缺陷', permissions: ['查看', '编辑'] },
    { key: 'docs', name: '项目文档', permissions: ['查看', '上传', '下载', '删除'] },
    { key: 'team', name: '团队', permissions: ['查看', '编辑'] },
    { key: 'transfer', name: '转维', permissions: ['查看', '申请', '录入', '评审'] },
  ]
```

- [ ] **Step 2: Extend GLOBAL_PERM_OPTIONS with roadmap baseline permissions**

Replace the existing `GLOBAL_PERM_OPTIONS` definition (around line 783-786) with:

```typescript
  const GLOBAL_PERM_OPTIONS = [
    { key: 'roadmap:view', module: '项目路标', name: '查看' },
    { key: 'roadmap:edit', module: '项目路标', name: '编辑' },
    { key: 'roadmap:export', module: '项目路标', name: '导出' },
    { key: 'roadmap:baseline', module: '项目路标', name: '打基线' },
    { key: 'roadmap:milestone:view', module: '项目路标视图', name: '里程碑视图查看' },
    { key: 'roadmap:mrTrain:view', module: '项目路标视图', name: 'MR版本火车视图查看' },
  ]
```

- [ ] **Step 3: Update default permissions for system admin role**

Update the `defaultPerms` object inside the `rolePermissions` useState initializer to include the new permission keys. The `系统管理员` entry already uses `PERMISSION_MODULES.flatMap(...)` so it automatically picks up new modules. No change needed for that, but add default permissions for other roles:

In the `defaultPerms` object, update the `项目经理` entry to add the new module keys:

```typescript
      '项目经理': ['basicInfo:查看', 'basicInfo:编辑', 'requirements:查看', 'requirements:编辑', 'requirements:导入/导出', 'plan:一级计划-查看', 'plan:一级计划-编辑', 'plan:二级计划-查看', 'plan:二级计划-编辑', 'plan:视图模式', 'plan:计划基线与变更', 'plan:导入/导出', 'resources:查看', 'resources:编辑', 'tasks:查看', 'tasks:编辑', 'tasks:分配', 'risks:查看', 'risks:编辑', 'bugs:查看', 'bugs:编辑', 'docs:查看', 'docs:上传', 'docs:下载', 'team:查看', 'team:编辑', 'transfer:查看', 'transfer:申请', 'transfer:录入', 'transfer:评审'],
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /Users/shswyuyouquan/Documents/work/pms-2026 && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: enhance permission config with granular modules and baseline"
```

---

### Task 7: Optimize Workspace - Project List View & Search

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add project search and filter state**

Add new state variables after the existing `projectView` state (around line 553):

```typescript
  const [projectSearchText2, setProjectSearchText2] = useState('')
  const [projectStatusFilter, setProjectStatusFilter] = useState<string>('all')
  const [projectListView, setProjectListView] = useState<'card' | 'list'>('card')
```

- [ ] **Step 2: Add filtered projects memo**

Add a `useMemo` after the new state variables:

```typescript
  const workspaceFilteredProjects = useMemo(() => {
    let result = projects
    if (projectSearchText2) {
      const keyword = projectSearchText2.toLowerCase()
      result = result.filter(p => p.name.toLowerCase().includes(keyword) || (p.marketName && p.marketName.toLowerCase().includes(keyword)))
    }
    if (projectStatusFilter !== 'all') {
      result = result.filter(p => p.status === projectStatusFilter)
    }
    return result
  }, [projects, projectSearchText2, projectStatusFilter])
```

- [ ] **Step 3: Update workspace projects section with search, filter, and list view**

Find the workspace project list area (around lines 4076-4090). Replace the project list title and card grid with:

```typescript
                  {/* 项目列表标题 + 筛选 */}
                  <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space size={8}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: '#262626' }}>项目列表</span>
                      <Tag color="default" style={{ fontSize: 11, borderRadius: 4 }}>{workspaceFilteredProjects.length} 个</Tag>
                    </Space>
                    <Space size={8}>
                      <Select
                        value={projectStatusFilter}
                        onChange={setProjectStatusFilter}
                        style={{ width: 120 }}
                        size="small"
                        options={[
                          { label: '全部状态', value: 'all' },
                          { label: '进行中', value: '进行中' },
                          { label: '筹备中', value: '筹备中' },
                          { label: '已完成', value: '已完成' },
                        ]}
                      />
                      <Input
                        placeholder="搜索项目..."
                        prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                        style={{ width: 200, borderRadius: 6 }}
                        allowClear
                        value={projectSearchText2}
                        onChange={e => setProjectSearchText2(e.target.value)}
                      />
                      <Segmented
                        size="small"
                        value={projectListView}
                        onChange={(v) => setProjectListView(v as 'card' | 'list')}
                        options={[
                          { label: <AppstoreOutlined />, value: 'card' },
                          { label: <UnorderedListOutlined />, value: 'list' },
                        ]}
                      />
                    </Space>
                  </div>

                  {/* 项目卡片/列表 */}
                  {projectListView === 'card' ? (
                    <Row gutter={[16, 16]}>
                      {workspaceFilteredProjects.map(p => (
                        <Col xs={24} sm={12} lg={todoCollapsed ? 6 : 8} key={p.id}>{renderProjectCard(p)}</Col>
                      ))}
                    </Row>
                  ) : (
                    <Table
                      dataSource={workspaceFilteredProjects}
                      rowKey="id"
                      size="small"
                      pagination={false}
                      className="pms-table"
                      onRow={(record) => ({
                        style: { cursor: 'pointer' },
                        onClick: () => { setSelectedProject(record); setActiveModule('projectSpace') },
                      })}
                      columns={[
                        { title: '项目名称', dataIndex: 'name', width: 200, render: (name: string, r: typeof initialProjects[0]) => (
                          <div>
                            <div style={{ fontWeight: 500 }}>{r.type === '整机产品项目' && r.marketName ? r.marketName : name}</div>
                            {r.type === '整机产品项目' && r.marketName && <div style={{ fontSize: 11, color: '#8c8c8c' }}>{name}</div>}
                          </div>
                        )},
                        { title: '类型', dataIndex: 'type', width: 120, render: (t: string) => <Tag color="default" style={{ fontSize: 11 }}>{t}</Tag> },
                        { title: '状态', dataIndex: 'status', width: 80, render: (s: string) => {
                          const conf = PROJECT_STATUS_CONFIG[s] || { tagColor: 'default' }
                          return <Tag color={conf.tagColor}>{s}</Tag>
                        }},
                        { title: '进度', dataIndex: 'progress', width: 120, render: (v: number) => <Progress percent={v} size="small" style={{ marginBottom: 0 }} /> },
                        { title: '计划开始', dataIndex: 'planStartDate', width: 110 },
                        { title: '计划结束', dataIndex: 'planEndDate', width: 110 },
                        { title: 'SPM', dataIndex: 'spm', width: 80 },
                        { title: '更新', dataIndex: 'updatedAt', width: 80, render: (t: string) => <span style={{ color: '#8c8c8c', fontSize: 12 }}>{t}</span> },
                      ]}
                    />
                  )}
```

- [ ] **Step 4: Add AppstoreOutlined and UnorderedListOutlined imports**

Check and add `AppstoreOutlined, UnorderedListOutlined` to the `@ant-design/icons` import if not already present.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd /Users/shswyuyouquan/Documents/work/pms-2026 && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add project list view, search, and status filter to workspace"
```

---

### Task 8: Optimize Todo Center

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Extend initialTodos with overdue/deadline logic**

Replace the existing `initialTodos` array (lines 487-493) with data that includes category and overdue state:

```typescript
const initialTodos = [
  { id: '1', projectId: '1', projectName: 'X6877-D8400_H991', planLevel: 'level1' as const, planType: '一级计划', planTabKey: '', versionNo: 'V2', versionId: 'v2', market: 'OP', responsible: '张三', priority: 'high', deadline: '2026-03-10', status: '进行中', taskDesc: '计划阶段任务待处理', category: 'overdue' as const },
  { id: '2', projectId: '3', projectName: 'X6855_H8917', planLevel: 'level2' as const, planType: '在研版本火车计划', planTabKey: 'plan1', versionNo: 'V2', versionId: 'v2', market: 'OP', responsible: '李四', priority: 'medium', deadline: '2026-04-05', status: '待处理', taskDesc: 'STR2 任务审核', category: 'pending' as const },
  { id: '3', projectId: '1', projectName: 'X6877-D8400_H991', planLevel: 'level2' as const, planType: '需求开发计划', planTabKey: 'plan0', versionNo: 'V2', versionId: 'v2', market: 'TR', responsible: '张三', priority: 'low', deadline: '2026-04-03', status: '待处理', taskDesc: '开发验证阶段安排', category: 'upcoming' as const },
  { id: '4', projectId: '2', projectName: 'tOS16.0', planLevel: 'level1' as const, planType: '一级计划', planTabKey: '', versionNo: 'V1', versionId: 'v1', market: '', responsible: '张三', priority: 'high', deadline: '2026-03-12', status: '进行中', taskDesc: '里程碑STR1待确认', category: 'overdue' as const },
  { id: '5', projectId: '1', projectName: 'X6877-D8400_H991', planLevel: 'level2' as const, planType: '1+N MR版本火车计划', planTabKey: 'plan2', versionNo: 'V1', versionId: 'v1', market: 'OP', responsible: '李四', priority: 'medium', deadline: '2026-04-18', status: '待处理', taskDesc: 'FR版本转测安排', category: 'pending' as const },
  { id: '6', projectId: '3', projectName: 'X6855_H8917', planLevel: 'level1' as const, planType: '一级计划', planTabKey: '', versionNo: 'V1', versionId: 'v1', market: 'OP', responsible: '张三', priority: 'low', deadline: '2026-02-28', status: '已完成', taskDesc: '概念阶段已完成', category: 'completed' as const },
]
```

- [ ] **Step 2: Add todo filter state and replace renderTodoList**

Add state after the existing todo state:

```typescript
  const [todoFilter, setTodoFilter] = useState<'all' | 'overdue' | 'upcoming' | 'pending' | 'completed'>('all')
```

Replace the entire `renderTodoList` function (lines 1418-1503) with:

```typescript
  const renderTodoList = () => {
    const priorityConfig: Record<string, { color: string; text: string; dotColor: string }> = {
      high: { color: 'red', text: '高', dotColor: '#ff4d4f' },
      medium: { color: 'orange', text: '中', dotColor: '#faad14' },
      low: { color: 'blue', text: '低', dotColor: '#1890ff' },
    }

    const filteredTodos = todoFilter === 'all' ? todos : todos.filter(t => t.category === todoFilter)
    const overdueCount = todos.filter(t => t.category === 'overdue').length
    const upcomingCount = todos.filter(t => t.category === 'upcoming').length

    return (
      <div>
        {/* 分类筛选 */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
          {[
            { key: 'all', label: '全部', count: todos.length },
            { key: 'overdue', label: '逾期', count: overdueCount, color: '#ff4d4f' },
            { key: 'upcoming', label: '即将到期', count: upcomingCount, color: '#faad14' },
            { key: 'pending', label: '待办', count: todos.filter(t => t.category === 'pending').length },
            { key: 'completed', label: '已完成', count: todos.filter(t => t.category === 'completed').length },
          ].map(f => (
            <Tag
              key={f.key}
              color={todoFilter === f.key ? (f.color ? f.color : 'blue') : 'default'}
              style={{ cursor: 'pointer', borderRadius: 4, fontSize: 11, margin: 0 }}
              onClick={() => setTodoFilter(f.key as any)}
            >
              {f.label} {f.count > 0 && <span style={{ fontWeight: 600 }}>{f.count}</span>}
            </Tag>
          ))}
        </div>

        {/* 待办列表 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredTodos.length === 0 ? (
            <Empty description="暂无待办" style={{ padding: '20px 0' }} image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            filteredTodos.map(todo => {
              const pc = priorityConfig[todo.priority] || priorityConfig.low
              const isOverdue = todo.category === 'overdue'
              const isUpcoming = todo.category === 'upcoming'
              const borderColor = isOverdue ? '#ff4d4f' : isUpcoming ? '#faad14' : '#f0f0f0'
              const bgColor = isOverdue ? '#fff2f0' : isUpcoming ? '#fffbe6' : '#fff'

              return (
                <div
                  key={todo.id}
                  style={{
                    padding: '12px 14px',
                    background: bgColor,
                    borderRadius: 6,
                    border: `1px solid ${borderColor}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none' }}
                  onClick={() => {
                    const proj = projects.find(p => p.id === todo.projectId)
                    if (!proj) return
                    setSelectedProject(proj)
                    setActiveModule('projectSpace')
                    setProjectSpaceModule('plan')
                    setCurrentVersion(todo.versionId || 'v2')
                    setProjectPlanLevel(todo.planLevel)
                    setProjectPlanViewMode('table')
                    setIsEditMode(true)
                    if (todo.planLevel === 'level2' && todo.planTabKey) {
                      setActiveLevel2Plan(todo.planTabKey)
                    }
                    if (proj.type === '整机产品项目' && todo.market) {
                      setSelectedMarketTab(todo.market)
                    }
                    setTimeout(() => {
                      const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row')
                      for (let i = 0; i < rows.length; i++) {
                        const cells = rows[i].querySelectorAll('td')
                        for (let j = 0; j < cells.length; j++) {
                          if (cells[j].textContent?.trim() === CURRENT_USER) {
                            rows[i].scrollIntoView({ behavior: 'smooth', block: 'center' })
                            const row = rows[i] as HTMLElement
                            row.style.transition = 'background 0.3s'
                            row.style.background = '#e6f7ff'
                            setTimeout(() => { row.style.background = '' }, 2000)
                            return
                          }
                        }
                      }
                    }, 800)
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    {isOverdue && <WarningOutlined style={{ color: '#ff4d4f', fontSize: 14, marginTop: 2, flexShrink: 0 }} />}
                    {isUpcoming && <ClockCircleOutlined style={{ color: '#faad14', fontSize: 14, marginTop: 2, flexShrink: 0 }} />}
                    {!isOverdue && !isUpcoming && <div style={{ width: 6, height: 6, borderRadius: '50%', background: pc.dotColor, marginTop: 7, flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: isOverdue ? '#ff4d4f' : '#262626', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{todo.projectName}</div>
                      <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {todo.planLevel === 'level1' ? '一级计划' : '二级计划'}
                        {todo.planLevel === 'level2' && todo.planType && <> · {todo.planType}</>}
                        {' · '}<span style={{ color: '#1890ff', fontWeight: 500 }}>{todo.versionNo}</span>
                        {todo.market && <> · <span style={{ color: '#13c2c2' }}>{todo.market}</span></>}
                      </div>
                      <div style={{ fontSize: 12, color: '#595959', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{todo.taskDesc}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Space size={4}>
                          <Tag color={pc.color} style={{ fontSize: 10, borderRadius: 3, margin: 0, lineHeight: '16px', padding: '0 4px' }}>{pc.text}</Tag>
                          <Tag color={todo.status === '进行中' ? 'processing' : todo.status === '已完成' ? 'success' : 'default'} style={{ fontSize: 10, borderRadius: 3, margin: 0, lineHeight: '16px', padding: '0 4px' }}>{todo.status}</Tag>
                          {isOverdue && <Tag color="error" style={{ fontSize: 10, borderRadius: 3, margin: 0, lineHeight: '16px', padding: '0 4px' }}>已逾期</Tag>}
                          {isUpcoming && <Tag color="warning" style={{ fontSize: 10, borderRadius: 3, margin: 0, lineHeight: '16px', padding: '0 4px' }}>即将到期</Tag>}
                        </Space>
                        <span style={{ fontSize: 11, color: isOverdue ? '#ff4d4f' : '#bfbfbf', fontWeight: isOverdue ? 500 : 400 }}>{todo.deadline}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    )
  }
```

- [ ] **Step 3: Add ClockCircleOutlined import if not present**

Check and add `ClockCircleOutlined` to the icons import.

- [ ] **Step 4: Update todo badge in the header to show overdue count**

Find the todo header badge (around line 4144) and update to show overdue specifically:

Replace:
```typescript
<Badge count={todos.length} style={{ backgroundColor: '#1890ff' }} size="small" />
```
With:
```typescript
<Badge count={todos.filter(t => t.category === 'overdue').length} style={{ backgroundColor: '#ff4d4f' }} size="small" overflowCount={99} />
```

And similarly update the collapsed badge (around line 4119):
Replace:
```typescript
<Badge count={todos.length} size="small" style={{ marginBottom: 8 }} />
```
With:
```typescript
<Badge count={todos.filter(t => t.category === 'overdue').length} size="small" style={{ marginBottom: 8 }} />
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd /Users/shswyuyouquan/Documents/work/pms-2026 && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: optimize todo center with overdue/upcoming highlighting and filters"
```

---

### Task 9: Update Project Statistics in Workspace

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Update status statistics to use mapped statuses**

Find the project statistics section (around lines 4058-4073) and replace with:

```typescript
                  <Row gutter={16} style={{ marginBottom: 20 }}>
                    {[
                      { label: '全部项目', value: projects.length, color: '#1890ff', bg: '#e6f7ff' },
                      { label: '进行中', value: projects.filter(p => p.status === '进行中').length, color: '#1890ff', bg: '#e6f7ff' },
                      { label: '待立项', value: projects.filter(p => p.status === '筹备中' || p.status === '待立项').length, color: '#faad14', bg: '#fff7e6' },
                      { label: '已完成', value: projects.filter(p => p.status === '已完成').length, color: '#52c41a', bg: '#f6ffed' },
                    ].map((stat, i) => (
                      <Col span={6} key={i}>
                        <div
                          style={{
                            background: '#fff', borderRadius: 8, padding: '14px 16px',
                            border: projectStatusFilter === (i === 0 ? 'all' : stat.label) ? `1px solid ${stat.color}` : '1px solid #f0f0f0',
                            display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'all 0.2s',
                          }}
                          onClick={() => setProjectStatusFilter(i === 0 ? 'all' : stat.label === '待立项' ? '筹备中' : stat.label)}
                        >
                          <div style={{ width: 40, height: 40, borderRadius: 8, background: stat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: 18, fontWeight: 700, color: stat.color }}>{stat.value}</span>
                          </div>
                          <span style={{ fontSize: 13, color: '#8c8c8c' }}>{stat.label}</span>
                        </div>
                      </Col>
                    ))}
                  </Row>
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/shswyuyouquan/Documents/work/pms-2026 && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add clickable project stats with status filter integration"
```

---

### Task 10: Final Build Verification

**Files:**
- All modified files

- [ ] **Step 1: Run full TypeScript check**

Run: `cd /Users/shswyuyouquan/Documents/work/pms-2026 && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run build**

Run: `cd /Users/shswyuyouquan/Documents/work/pms-2026 && npm run build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 3: Visual verification**

Run: `cd /Users/shswyuyouquan/Documents/work/pms-2026 && npm run dev`
Check:
1. Workspace shows cards with type-differentiated fields
2. Card/List toggle works
3. Status filter and search work
4. Stats cards are clickable
5. Todo center shows overdue (red), upcoming (yellow), completed items
6. Project space > Basic Info shows expanded IPM/SCM fields with source tags
7. Plan info section shows milestones
8. Permission config shows expanded modules
9. Global permission shows baseline option

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address build issues from project card redesign"
```
