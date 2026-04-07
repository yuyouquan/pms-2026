'use client'

import { useState, useMemo } from 'react'
import { Card, Table, Tag, Space, Input, Select, Button, Badge, Tooltip, Modal, DatePicker, message } from 'antd'
import dayjs from 'dayjs'
import {
  SearchOutlined, ClockCircleOutlined,
  EyeOutlined, WarningOutlined, FieldTimeOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'

type WorkItemType = '需求' | '任务' | '风险' | '问题'
type WorkItemStatus = '待办' | '进行中' | '已完成' | '逾期' | '已关闭'

interface WorkItem {
  id: string
  type: WorkItemType
  name: string
  status: WorkItemStatus
  stayDuration: number // 停留时长（天）
  responsible: string
  planStartDate: string
  planEndDate: string
  project: string
  projectId: string
  priority: 'high' | 'medium' | 'low'
  createdBy: string
  createdAt: string
  // 计划来源（任务类型时使用）
  planLevel?: 'level1' | 'level2'
  planType?: string // 二级计划类型名称
  taskName?: string // 计划中的任务名称
}

// Mock 数据
const MOCK_WORK_ITEMS: WorkItem[] = [
  { id: 'w1', type: '任务', name: 'STR2阶段功能开发', status: '进行中', stayDuration: 5, responsible: '张三', planStartDate: '2026-03-20', planEndDate: '2026-04-05', project: 'X6877-D8400_H991', projectId: '1', priority: 'high', createdBy: '李四', createdAt: '2026-03-18', planLevel: 'level1', taskName: 'STR2' },
  { id: 'w2', type: '任务', name: '性能优化方案评审', status: '待办', stayDuration: 3, responsible: '张三', planStartDate: '2026-04-01', planEndDate: '2026-04-10', project: 'X6877-D8400_H991', projectId: '1', priority: 'medium', createdBy: '王五', createdAt: '2026-03-25', planLevel: 'level2', planType: '需求开发计划', taskName: '性能优化方案评审' },
  { id: 'w3', type: '需求', name: 'AI相机功能需求分析', status: '已完成', stayDuration: 0, responsible: '张三', planStartDate: '2026-03-01', planEndDate: '2026-03-15', project: 'X6877-D8400_H991', projectId: '1', priority: 'medium', createdBy: '张三', createdAt: '2026-02-28' },
  { id: 'w4', type: '风险', name: '芯片供应链交期风险', status: '进行中', stayDuration: 12, responsible: '张三', planStartDate: '2026-03-10', planEndDate: '2026-04-15', project: 'X6855_H8917', projectId: '3', priority: 'high', createdBy: '赵六', createdAt: '2026-03-08' },
  { id: 'w5', type: '任务', name: 'tOS16内核适配', status: '逾期', stayDuration: 8, responsible: '张三', planStartDate: '2026-03-15', planEndDate: '2026-03-28', project: 'tOS16.0', projectId: '2', priority: 'high', createdBy: '李四', createdAt: '2026-03-10', planLevel: 'level1', taskName: 'STR3' },
  { id: 'w6', type: '问题', name: '蓝牙模块兼容性问题', status: '待办', stayDuration: 2, responsible: '张三', planStartDate: '2026-04-02', planEndDate: '2026-04-08', project: 'X6877-D8400_H991', projectId: '1', priority: 'high', createdBy: '孙七', createdAt: '2026-04-01' },
  { id: 'w7', type: '任务', name: '测试用例编写', status: '已完成', stayDuration: 0, responsible: '张三', planStartDate: '2026-03-05', planEndDate: '2026-03-20', project: 'tOS16.0', projectId: '2', priority: 'low', createdBy: '张三', createdAt: '2026-03-03', planLevel: 'level2', planType: '在研版本火车计划', taskName: '测试用例编写' },
  { id: 'w8', type: '需求', name: 'NFC功能适配需求', status: '待办', stayDuration: 1, responsible: '张三', planStartDate: '2026-04-05', planEndDate: '2026-04-20', project: 'X6890-D8500_H1001', projectId: '7', priority: 'medium', createdBy: '李白', createdAt: '2026-04-02' },
  { id: 'w9', type: '任务', name: '版本集成测试', status: '逾期', stayDuration: 15, responsible: '张三', planStartDate: '2026-03-01', planEndDate: '2026-03-25', project: 'AI-Engine-V2', projectId: '9', priority: 'high', createdBy: '李四', createdAt: '2026-02-25', planLevel: 'level1', taskName: 'STR5' },
  { id: 'w10', type: '风险', name: '人力资源不足风险', status: '进行中', stayDuration: 6, responsible: '张三', planStartDate: '2026-03-20', planEndDate: '2026-04-30', project: 'DevOps-Platform', projectId: '10', priority: 'medium', createdBy: '孙七', createdAt: '2026-03-18' },
  { id: 'w11', type: '任务', name: '代码评审流程优化', status: '已完成', stayDuration: 0, responsible: '李四', planStartDate: '2026-03-10', planEndDate: '2026-03-30', project: 'DevOps-Platform', projectId: '10', priority: 'low', createdBy: '李四', createdAt: '2026-03-08', planLevel: 'level2', planType: '1+N MR版本火车计划', taskName: '代码评审流程优化' },
  { id: 'w12', type: '任务', name: 'CI/CD流水线搭建', status: '进行中', stayDuration: 4, responsible: '李四', planStartDate: '2026-03-25', planEndDate: '2026-04-15', project: 'DevOps-Platform', projectId: '10', priority: 'high', createdBy: '孙七', createdAt: '2026-03-22', planLevel: 'level1', taskName: 'STR2' },
]

const TYPE_COLORS: Record<WorkItemType, string> = {
  '需求': '#6366f1',
  '任务': '#52c41a',
  '风险': '#faad14',
  '问题': '#ff4d4f',
}

const STATUS_COLORS: Record<WorkItemStatus, string> = {
  '待办': 'default',
  '进行中': 'processing',
  '已完成': 'success',
  '逾期': 'error',
  '已关闭': 'default',
}

interface WorkTrackerProps {
  currentLoginUser: string
  projects: any[]
  onNavigateToProject: (projectId: string, module: string, planLevel?: string, planType?: string) => void
}

export default function WorkTracker({ currentLoginUser, projects, onNavigateToProject }: WorkTrackerProps) {
  const [searchText, setSearchText] = useState('')
  const [actualTimeModal, setActualTimeModal] = useState<{ visible: boolean; item: WorkItem | null; startDate: string; endDate: string }>({ visible: false, item: null, startDate: '', endDate: '' })
  const [filterProject, setFilterProject] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [listFilter, setListFilter] = useState<'all' | 'pending' | 'overdue' | 'completed' | 'created'>('all')

  // 当前用户的工作项
  const userItems = useMemo(() => {
    return MOCK_WORK_ITEMS.filter(item =>
      item.responsible === currentLoginUser || item.createdBy === currentLoginUser
    )
  }, [currentLoginUser])

  // 统计
  const stats = useMemo(() => {
    const responsible = userItems.filter(i => i.responsible === currentLoginUser)
    return {
      total: responsible.length,
      pending: responsible.filter(i => i.status === '待办' || i.status === '进行中').length,
      overdue: responsible.filter(i => i.status === '逾期').length,
      completed: responsible.filter(i => i.status === '已完成').length,
      other: responsible.filter(i => i.status === '已关闭').length,
    }
  }, [userItems, currentLoginUser])

  // 筛选
  const filteredItems = useMemo(() => {
    let result = userItems

    // 列表清单筛选
    if (listFilter === 'pending') {
      result = result.filter(i => i.responsible === currentLoginUser && (i.status === '待办' || i.status === '进行中'))
    } else if (listFilter === 'overdue') {
      result = result.filter(i => i.responsible === currentLoginUser && i.status === '逾期')
    } else if (listFilter === 'completed') {
      result = result.filter(i => i.responsible === currentLoginUser && i.status === '已完成')
    } else if (listFilter === 'created') {
      result = result.filter(i => i.createdBy === currentLoginUser)
    }

    // 全局搜索
    if (searchText) {
      const kw = searchText.toLowerCase()
      result = result.filter(i => i.name.toLowerCase().includes(kw) || i.project.toLowerCase().includes(kw) || i.responsible.includes(kw))
    }
    if (filterProject !== 'all') {
      result = result.filter(i => i.projectId === filterProject)
    }
    if (filterType !== 'all') {
      result = result.filter(i => i.type === filterType)
    }
    if (filterStatus !== 'all') {
      result = result.filter(i => i.status === filterStatus)
    }

    return result
  }, [userItems, searchText, filterProject, filterType, filterStatus, listFilter, currentLoginUser])

  // 项目选项
  const projectOptions = useMemo(() => {
    const projects = [...new Set(userItems.map(i => JSON.stringify({ id: i.projectId, name: i.project })))]
      .map(s => JSON.parse(s))
    return [{ label: '全部项目', value: 'all' }, ...projects.map((p: any) => ({ label: p.name, value: p.id }))]
  }, [userItems])

  // 判断是否临期（3天内到期）
  const isNearDeadline = (item: WorkItem) => {
    if (item.status === '已完成' || item.status === '已关闭') return false
    const now = new Date().getTime()
    const end = new Date(item.planEndDate).getTime()
    const diff = (end - now) / (1000 * 60 * 60 * 24)
    return diff >= 0 && diff <= 3
  }

  const columns: ColumnsType<WorkItem> = [
    {
      title: '类型', dataIndex: 'type', key: 'type', width: 80,
      render: (val: WorkItemType) => (
        <Tag color={TYPE_COLORS[val]} style={{ margin: 0, borderRadius: 4 }}>{val}</Tag>
      ),
    },
    {
      title: '名称', dataIndex: 'name', key: 'name', width: 300, ellipsis: false,
      render: (val: string, record: WorkItem) => {
        // 计划类任务显示来源：一级计划-任务名 或 二级计划-计划类型-任务名
        let planSource = ''
        if (record.type === '任务' && record.planLevel) {
          if (record.planLevel === 'level1') {
            planSource = `一级计划-${record.taskName || val}`
          } else if (record.planLevel === 'level2') {
            planSource = `二级计划-${record.planType || ''}-${record.taskName || val}`
          }
        }
        const displayName = planSource || val
        return (
          <Space size={4}>
            {record.status === '逾期' && <WarningOutlined style={{ color: '#ff4d4f', fontSize: 12 }} />}
            {isNearDeadline(record) && <ClockCircleOutlined style={{ color: '#faad14', fontSize: 12 }} />}
            <span style={{ fontWeight: 500, color: record.status === '逾期' ? '#ff4d4f' : '#111827' }}>{displayName}</span>
          </Space>
        )
      },
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (val: WorkItemStatus) => <Tag color={STATUS_COLORS[val]}>{val}</Tag>,
    },
    {
      title: '停留时长', dataIndex: 'stayDuration', key: 'stayDuration', width: 100, align: 'center',
      render: (val: number, record: WorkItem) => {
        if (record.status === '已完成' || record.status === '已关闭') return <span style={{ color: '#bfbfbf' }}>-</span>
        const color = val > 7 ? '#ff4d4f' : val > 3 ? '#faad14' : '#4b5563'
        return <span style={{ color, fontWeight: val > 7 ? 600 : 400 }}>{val}天</span>
      },
    },
    {
      title: '责任人', dataIndex: 'responsible', key: 'responsible', width: 80,
    },
    {
      title: '计划开始时间', dataIndex: 'planStartDate', key: 'planStartDate', width: 120,
      render: (val: string) => <span style={{ fontSize: 12, color: '#4b5563' }}>{val}</span>,
    },
    {
      title: '计划完成时间', dataIndex: 'planEndDate', key: 'planEndDate', width: 120,
      render: (val: string, record: WorkItem) => {
        const isOverdue = record.status === '逾期'
        const near = isNearDeadline(record)
        return <span style={{ fontSize: 12, color: isOverdue ? '#ff4d4f' : near ? '#faad14' : '#4b5563', fontWeight: isOverdue || near ? 600 : 400 }}>{val}</span>
      },
    },
    {
      title: '归属项目', dataIndex: 'project', key: 'project', width: 180, ellipsis: true,
      render: (val: string) => <span style={{ fontSize: 12 }}>{val}</span>,
    },
    {
      title: '操作', key: 'action', width: 140, fixed: 'right',
      render: (_: any, record: WorkItem) => (
        <Space size={2}>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => {
            if (record.type === '任务' && record.planLevel) {
              onNavigateToProject(record.projectId, 'plan', record.planLevel, record.planType)
            } else {
              onNavigateToProject(record.projectId, 'basic')
            }
          }}>详情</Button>
          {record.type === '任务' && record.planLevel && (
            <Button type="link" size="small" icon={<FieldTimeOutlined />} onClick={() => {
              setActualTimeModal({ visible: true, item: record, startDate: record.planStartDate, endDate: record.planEndDate })
            }}>实际时间</Button>
          )}
        </Space>
      ),
    },
  ]

  const statItems = [
    { label: '全部', value: stats.total, color: '#6366f1', bg: 'linear-gradient(135deg, #eef2ff, #e0e7ff)', borderColor: 'rgba(99,102,241,0.15)', iconBg: 'linear-gradient(135deg, #6366f1, #818cf8)', iconText: '全' },
    { label: '待办', value: stats.pending, color: '#f59e0b', bg: 'linear-gradient(135deg, #fffbeb, #fef3c7)', borderColor: 'rgba(245,158,11,0.15)', iconBg: 'linear-gradient(135deg, #f59e0b, #fbbf24)', iconText: '办' },
    { label: '逾期', value: stats.overdue, color: '#ef4444', bg: 'linear-gradient(135deg, #fef2f2, #fecaca)', borderColor: 'rgba(239,68,68,0.15)', iconBg: 'linear-gradient(135deg, #ef4444, #f87171)', iconText: '期' },
    { label: '已完成', value: stats.completed, color: '#10b981', bg: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', borderColor: 'rgba(16,185,129,0.15)', iconBg: 'linear-gradient(135deg, #10b981, #34d399)', iconText: '完' },
    { label: '其他', value: stats.other, color: '#6b7280', bg: 'linear-gradient(135deg, #f9fafb, #f3f4f6)', borderColor: 'rgba(107,114,128,0.15)', iconBg: 'linear-gradient(135deg, #6b7280, #9ca3af)', iconText: '他' },
  ]

  return (
    <div>
      {/* 统计卡片 */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
        {statItems.map(item => (
          <div
            key={item.label}
            style={{
              flex: 1, padding: '18px 20px', borderRadius: 12,
              background: item.bg, border: `1px solid ${item.borderColor}`,
              backdropFilter: 'blur(6px)',
              display: 'flex', alignItems: 'center', gap: 14,
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              transition: 'all 0.25s ease',
              cursor: 'default',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.02)'
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: item.iconBg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 16, fontWeight: 700,
              boxShadow: `0 3px 8px ${item.borderColor}`,
              flexShrink: 0,
            }}>
              {item.iconText}
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 700, color: item.color, lineHeight: 1, textShadow: `0 1px 2px ${item.borderColor}` }}>{item.value}</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{item.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 筛选工具栏 */}
      <Card
        size="small"
        style={{ borderRadius: 10, marginBottom: 16, border: '1px solid rgba(99,102,241,0.08)', background: 'rgba(249,250,255,0.6)' }}
        styles={{ body: { padding: '12px 20px' } }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          {/* 左侧: 列表清单标签 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {[
              { key: 'all' as const, label: '全部', count: filteredItems.length },
              { key: 'pending' as const, label: '待办', count: stats.pending },
              { key: 'overdue' as const, label: '逾期', count: stats.overdue, color: '#ff4d4f' },
              { key: 'completed' as const, label: '已完成', count: stats.completed },
              { key: 'created' as const, label: '我创建', count: userItems.filter(i => i.createdBy === currentLoginUser).length },
            ].map(f => {
              const isActive = listFilter === f.key
              return (
                <div
                  key={f.key}
                  onClick={() => setListFilter(f.key)}
                  style={{
                    padding: '4px 14px', borderRadius: 20, cursor: 'pointer',
                    fontSize: 13, fontWeight: 500, transition: 'all 0.25s ease',
                    background: isActive ? (f.color ? f.color : 'linear-gradient(135deg, #4338ca, #6366f1)') : 'transparent',
                    color: isActive ? '#fff' : '#4b5563',
                    border: isActive ? '1px solid transparent' : '1px solid transparent',
                    boxShadow: isActive ? (f.color ? `0 4px 12px ${f.color}40` : '0 4px 12px rgba(67,56,202,0.3)') : 'none',
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = '#f3f4f6' }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                >
                  {f.label} <span style={{ fontSize: 11, opacity: 0.85, marginLeft: 2 }}>{f.count}</span>
                </div>
              )
            })}
          </div>
          {/* 右侧: 搜索 + 筛选 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Input
              placeholder="搜索名称/项目..."
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              style={{ width: 200, borderRadius: 20, background: '#f7f8fa' }}
              variant="borderless"
              allowClear
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
            />
            <Select
              value={filterProject}
              onChange={setFilterProject}
              style={{ width: 160 }}
              size="small"
              options={projectOptions}
            />
            <Select
              value={filterType}
              onChange={setFilterType}
              style={{ width: 110 }}
              size="small"
              options={[
                { label: '全部类型', value: 'all' },
                { label: '需求', value: '需求' },
                { label: '任务', value: '任务' },
                { label: '风险', value: '风险' },
                { label: '问题', value: '问题' },
              ]}
            />
            <Select
              value={filterStatus}
              onChange={setFilterStatus}
              style={{ width: 110 }}
              size="small"
              options={[
                { label: '全部状态', value: 'all' },
                { label: '待办', value: '待办' },
                { label: '进行中', value: '进行中' },
                { label: '逾期', value: '逾期' },
                { label: '已完成', value: '已完成' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* 数据表格 */}
      <Card style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(99,102,241,0.08)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }} styles={{ body: { padding: 0 } }}>
        <Table
          className="pms-table"
          columns={columns}
          dataSource={filteredItems}
          rowKey="id"
          size="small"
          scroll={{ x: 1100 }}
          pagination={{ pageSize: 10, size: 'small', showTotal: (t) => `共 ${t} 条` }}
          onRow={(record) => ({
            style: {
              background: record.status === '逾期' ? '#fff2f0' : isNearDeadline(record) ? '#fffbe6' : undefined,
              transition: 'all 0.3s ease',
            },
            onMouseEnter: (e) => {
              if (record.status !== '逾期' && !isNearDeadline(record)) {
                (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.04)'
              }
            },
            onMouseLeave: (e) => {
              if (record.status !== '逾期' && !isNearDeadline(record)) {
                (e.currentTarget as HTMLElement).style.background = ''
              }
            },
          })}
        />
      </Card>

      {/* 实际时间修改弹窗 */}
      <Modal
        title={<Space><FieldTimeOutlined style={{ color: '#6366f1' }} /><span>修改实际时间</span></Space>}
        open={actualTimeModal.visible}
        onCancel={() => setActualTimeModal({ visible: false, item: null, startDate: '', endDate: '' })}
        onOk={() => {
          message.success('实际时间已保存')
          setActualTimeModal({ visible: false, item: null, startDate: '', endDate: '' })
        }}
        okText="保存"
        cancelText="取消"
        width={480}
      >
        {actualTimeModal.item && (
          <div style={{ padding: '12px 0' }}>
            <div style={{ marginBottom: 16, padding: '10px 14px', background: '#f6f8fa', borderRadius: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{actualTimeModal.item.name}</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                {actualTimeModal.item.project} · {actualTimeModal.item.planLevel === 'level1' ? '一级计划' : `二级计划-${actualTimeModal.item.planType}`}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', marginBottom: 6 }}>实际开始时间</div>
                <DatePicker
                  style={{ width: '100%' }}
                  value={actualTimeModal.startDate ? dayjs(actualTimeModal.startDate) : null}
                  onChange={(date) => setActualTimeModal(prev => ({ ...prev, startDate: date ? date.format('YYYY-MM-DD') : '' }))}
                  placeholder="请选择实际开始时间"
                />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', marginBottom: 6 }}>实际完成时间</div>
                <DatePicker
                  style={{ width: '100%' }}
                  value={actualTimeModal.endDate ? dayjs(actualTimeModal.endDate) : null}
                  onChange={(date) => setActualTimeModal(prev => ({ ...prev, endDate: date ? date.format('YYYY-MM-DD') : '' }))}
                  placeholder="请选择实际完成时间"
                />
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
