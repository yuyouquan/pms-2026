'use client'

import React, { useState } from 'react'
import {
  Card,
  Tag,
  Space,
  Row,
  Col,
  Badge,
  Select,
  Avatar,
  Empty,
  Progress,
} from 'antd'
import { CalendarOutlined } from '@ant-design/icons'

const { Option } = Select

// ========== Type Definitions ==========

// Project type derived from initialProjects shape
export type ProjectType = {
  id: string
  name: string
  type: '整机产品项目' | '产品项目' | '技术项目' | '能力建设项目'
  status: string
  progress: number
  leader: string
  markets: string[]
  androidVersion: string
  chipPlatform: string
  spm: string
  updatedAt: string
  productLine: string
  tosVersion: string
  marketName?: string
  brand?: string
  developMode?: string
  planStartDate?: string
  planEndDate?: string
  developCycle?: number
  healthStatus?: 'normal' | 'warning' | 'risk'
  [key: string]: any
}

export type TodoType = {
  id: string
  projectId: string
  projectName: string
  planLevel: 'level1' | 'level2'
  planType: string
  planTabKey: string
  versionNo: string
  versionId: string
  market: string
  responsible: string
  priority: string
  deadline: string
  status: string
  taskDesc: string
  category: 'overdue' | 'upcoming' | 'pending' | 'completed'
}

export type KanbanColumn = {
  title: string
  key: string
  color: string
}

// ========== ProjectCard ==========

export interface ProjectCardProps {
  project: ProjectType
  setSelectedProject: (project: ProjectType) => void
  setProjectSpaceModule: (module: string) => void
  setActiveModule: (module: string) => void
  PROJECT_STATUS_CONFIG: Record<string, { color: string; tagColor: string }>
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  setSelectedProject,
  setProjectSpaceModule,
  setActiveModule,
  PROJECT_STATUS_CONFIG,
}) => {
  const [hovered, setHovered] = useState(false)
  const statusConf = PROJECT_STATUS_CONFIG[project.status] || { color: '#8c8c8c', tagColor: 'default' }
  const isWholeMachine = project.type === '整机产品项目'
  const isCapability = project.type === '能力建设项目'

  // Status tag gradient styles
  const statusTagStyle: Record<string, React.CSSProperties> = {
    '进行中': { background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)', color: '#4338ca', border: 'none' },
    '已完成': { background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', color: '#065f46', border: 'none' },
    '筹备中': { background: 'linear-gradient(135deg, #fffbeb, #fef3c7)', color: '#92400e', border: 'none' },
  }

  const fieldItem = (label: string, value: string | undefined) => value ? (
    <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ color: '#bfbfbf' }}>{label}</span> <span style={{ color: '#595959', fontWeight: 500 }}>{value}</span>
    </div>
  ) : null

  return (
    <Card
      hoverable
      className="pms-card-hover"
      style={{
        borderRadius: 10,
        border: '1px solid #f0f0f0',
        height: '100%',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.9) 100%)',
        borderLeft: hovered ? '3px solid #6366f1' : '1px solid #f0f0f0',
        boxShadow: hovered ? '0 12px 28px rgba(99,102,241,0.12)' : '0 2px 8px rgba(0,0,0,0.04)',
        transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
      }}
      styles={{ body: { padding: '16px 20px', height: '100%', display: 'flex', flexDirection: 'column' as const } }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => { setSelectedProject(project); setProjectSpaceModule('basic'); setActiveModule('projectSpace') }}
    >
      {/* 头部: 项目名 + 状态 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#262626', letterSpacing: 0.3, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {project.name}
          </div>
          {isWholeMachine && project.marketName && (
            <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>市场名: {project.marketName}</div>
          )}
          <Tag color="default" style={{ fontSize: 11, borderRadius: 3, margin: 0, background: 'rgba(99,102,241,0.08)', color: '#6366f1', border: 'none' }}>{project.type}</Tag>
        </div>
        <Tag
          color={statusConf.tagColor}
          style={{ margin: 0, borderRadius: 4, flexShrink: 0, ...(statusTagStyle[project.status] || {}) }}
        >{project.status}</Tag>
      </div>

      {/* 中间: 类型差异化字段 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {isWholeMachine && (
          <>
            {fieldItem('品牌', project.brand)}
            {fieldItem('产品线', project.productLine)}
            {fieldItem('开发模式', project.developMode)}
          </>
        )}
      </div>

      {/* 计划时间 - 软件产品/整机产品/技术项目显示 */}
      {!isCapability && (project.planStartDate || project.planEndDate) && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 10, fontSize: 12, color: '#8c8c8c' }}>
          {project.planStartDate && (
            <span><CalendarOutlined style={{ marginRight: 4, color: '#6366f1' }} />{project.planStartDate}</span>
          )}
          {project.planEndDate && (
            <span>→ {project.planEndDate}</span>
          )}
        </div>
      )}

      {/* 底部: 项目经理 + 更新时间 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
        <Space size={6}>
          <Avatar size={20} style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)', fontSize: 10 }}>{project.spm[0]}</Avatar>
          <span style={{ fontSize: 12, color: '#595959' }}>{project.spm}</span>
        </Space>
        <span style={{ fontSize: 11, color: '#bfbfbf' }}>{project.updatedAt}</span>
      </div>
    </Card>
  )
}

// ========== TodoList ==========

export interface TodoListProps {
  todos: TodoType[]
  projects: ProjectType[]
  todoFilter: 'all' | 'overdue' | 'upcoming' | 'pending' | 'completed'
  currentLoginUser: string
  setSelectedProject: (project: ProjectType) => void
  setActiveModule: (module: string) => void
  setProjectSpaceModule: (module: string) => void
  setCurrentVersion: (version: string) => void
  setProjectPlanLevel: (level: string) => void
  setProjectPlanViewMode: (mode: 'table' | 'horizontal' | 'gantt') => void
  setIsEditMode: (mode: boolean) => void
  setActiveLevel2Plan: (plan: string) => void
  setSelectedMarketTab: (tab: string) => void
}

export const TodoList: React.FC<TodoListProps> = ({
  todos,
  projects,
  todoFilter,
  currentLoginUser,
  setSelectedProject,
  setActiveModule,
  setProjectSpaceModule,
  setCurrentVersion,
  setProjectPlanLevel,
  setProjectPlanViewMode,
  setIsEditMode,
  setActiveLevel2Plan,
  setSelectedMarketTab,
}) => {
  const priorityConfig: Record<string, { color: string; text: string; dotColor: string; gradientBg: string }> = {
    high: { color: 'red', text: '高', dotColor: '#ff4d4f', gradientBg: 'linear-gradient(135deg, #fff1f0, #ffccc7)' },
    medium: { color: 'orange', text: '中', dotColor: '#faad14', gradientBg: 'linear-gradient(135deg, #fffbe6, #ffe58f)' },
    low: { color: 'blue', text: '低', dotColor: '#6366f1', gradientBg: 'linear-gradient(135deg, #eef2ff, #e0e7ff)' },
  }

  // 按 项目+计划级别+计划类型+版本 去重合并
  const mergeTodos = (list: typeof todos) => {
    const groupMap = new Map<string, typeof todos>()
    list.forEach(t => {
      const key = `${t.projectId}|${t.planLevel}|${t.planType}|${t.versionNo}`
      if (!groupMap.has(key)) groupMap.set(key, [])
      groupMap.get(key)!.push(t)
    })
    const merged: (typeof todos[0] & { mergedCount?: number })[] = []
    groupMap.forEach((group) => {
      // 取优先级最高的（overdue > upcoming > pending > completed）和最早的截止日期
      const priorityOrder: Record<string, number> = { overdue: 0, upcoming: 1, pending: 2, completed: 3 }
      const sorted = [...group].sort((a, b) => (priorityOrder[a.category] ?? 9) - (priorityOrder[b.category] ?? 9))
      const rep = { ...sorted[0], mergedCount: group.length }
      merged.push(rep)
    })
    return merged
  }

  const userTodos = todos.filter(t => t.responsible === currentLoginUser)
  const allMerged = mergeTodos(userTodos)
  const filteredTodos = todoFilter === 'all' ? allMerged : allMerged.filter(t => t.category === todoFilter)

  return (
    <div>
      {/* 待办列表 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {allMerged.length === 0 ? (
          <Empty description="暂无待办" style={{ padding: '20px 0' }} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          allMerged.map(todo => {
            const pc = priorityConfig[todo.priority] || priorityConfig.low

            return (
              <div
                key={todo.id}
                style={{
                  padding: '12px 14px',
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(248,250,252,0.85) 100%)',
                  borderRadius: 6,
                  border: '1px solid #f0f0f0',
                  cursor: 'pointer',
                  transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(99,102,241,0.08)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.15)' }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = '#f0f0f0' }}
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
                        if (cells[j].textContent?.trim() === currentLoginUser) {
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
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: pc.dotColor, boxShadow: `0 0 6px ${pc.dotColor}66`, marginTop: 7, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#262626', letterSpacing: 0.3, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{todo.projectName}</div>
                    <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {todo.planLevel === 'level1' ? '一级计划' : '二级计划'}
                      {todo.planLevel === 'level2' && todo.planType && <> · {todo.planType}</>}
                      {' · '}<span style={{ color: '#6366f1', fontWeight: 500 }}>{todo.versionNo}</span>
                      {todo.market && <> · <span style={{ color: '#13c2c2' }}>{todo.market}</span></>}
                    </div>
                    {(todo as any).mergedCount > 1 && <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>共 {(todo as any).mergedCount} 项待处理</div>}
                    <Space size={4}>
                      <Tag style={{ fontSize: 10, borderRadius: 3, margin: 0, lineHeight: '16px', padding: '0 4px', background: pc.gradientBg, color: pc.dotColor, border: 'none' }}>{pc.text}</Tag>
                      <Tag style={{
                        fontSize: 10, borderRadius: 3, margin: 0, lineHeight: '16px', padding: '0 4px', border: 'none',
                        ...(todo.status === '进行中' ? { background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)', color: '#4338ca' } :
                           todo.status === '已完成' ? { background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', color: '#065f46' } :
                           { background: 'linear-gradient(135deg, #f5f5f5, #e8e8e8)', color: '#595959' })
                      }}>{todo.status}</Tag>
                    </Space>
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

// ========== KanbanBoard ==========

export interface KanbanBoardProps {
  visibleProjects: ProjectType[]
  kanbanDimension: 'stage' | 'type' | 'status'
  setKanbanDimension: (dimension: 'stage' | 'type' | 'status') => void
  kanbanColumns: KanbanColumn[]
  PROJECT_TYPES: string[]
  setSelectedProject: (project: ProjectType) => void
  setProjectSpaceModule: (module: string) => void
  setActiveModule: (module: string) => void
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  visibleProjects,
  kanbanDimension,
  setKanbanDimension,
  kanbanColumns,
  PROJECT_TYPES,
  setSelectedProject,
  setProjectSpaceModule,
  setActiveModule,
}) => {
  const getKanbanColumns = () => {
    if (kanbanDimension === 'type') {
      return PROJECT_TYPES.map((t, i) => ({ title: t, key: t, color: ['#1890ff', '#52c41a', '#faad14', '#722ed1'][i] }))
    }
    if (kanbanDimension === 'status') {
      return [
        { title: '筹备中', key: '筹备中', color: '#faad14' },
        { title: '进行中', key: '进行中', color: '#1890ff' },
        { title: '已完成', key: '已完成', color: '#52c41a' },
        { title: '上市', key: '上市', color: '#722ed1' },
      ]
    }
    return kanbanColumns
  }

  const getKanbanFilter = (col: { key: string }) => {
    if (kanbanDimension === 'type') {
      return (p: ProjectType) => p.type === col.key
    }
    if (kanbanDimension === 'status') {
      return (p: ProjectType) => p.status === col.key
    }
    return (p: ProjectType) => {
      if (col.key === 'concept') return p.progress === 0
      if (col.key === 'planning') return p.progress > 0 && p.progress < 30
      if (col.key === 'developing') return p.progress >= 30 && p.progress < 100
      return p.progress === 100
    }
  }

  return (
    <div>
      <Row justify="end" style={{ marginBottom: 16 }}>
        <Col>
          <Space>
            <span style={{ color: '#666' }}>分组维度:</span>
            <Select value={kanbanDimension} onChange={setKanbanDimension} style={{ width: 120 }}>
              <Option value="stage">阶段</Option>
              <Option value="type">项目类型</Option>
              <Option value="status">项目状态</Option>
            </Select>
          </Space>
        </Col>
      </Row>
      <Row gutter={16}>
        {getKanbanColumns().map(col => (
          <Col span={Math.floor(24 / getKanbanColumns().length)} key={col.key}>
            <Card title={<Space><Badge color={col.color} />{col.title}</Space>} style={{ background: '#fafafa', minHeight: 300 }} bodyStyle={{ padding: 12 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                {visibleProjects.filter(getKanbanFilter(col)).map(project => (
                    <Card key={project.id} size="small" hoverable onClick={() => { setSelectedProject(project); setProjectSpaceModule('basic'); setActiveModule('projectSpace') }}>
                    <Space direction="vertical" style={{ width: '100%' }}><div style={{ fontWeight: 500 }}>{project.name}</div><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><Tag>{project.type}</Tag><Progress percent={project.progress} size="small" style={{ width: 60 }} /></div></Space>
                  </Card>
                ))}
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  )
}
