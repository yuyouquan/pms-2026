'use client'

import { useState, useMemo, useEffect, useRef, type CSSProperties } from 'react'
import { Card, Tabs, Table, Tag, Space, Row, Col, Input, Button, Modal, Checkbox, Radio } from 'antd'
import { SearchOutlined, AppstoreOutlined } from '@ant-design/icons'
import { gantt } from 'dhtmlx-gantt'
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css'
import type { IRRequirement, SRRequirement } from '@/types'

// IR需求Mock数据
const IR_MOCK_DATA: IRRequirement[] = [
  { id: '1', domain: '相机', irNo: 'IR-2026-001', irTitle: '前置相机HDR增强', priority: '高', irStatus: '已验收', testPlanStart: '2026-01-10', testPlanEnd: '2026-01-25', acceptPlanStart: '2026-01-26', acceptPlanEnd: '2026-02-05' },
  { id: '2', domain: '相机', irNo: 'IR-2026-002', irTitle: '后置超广角优化', priority: '中', irStatus: '测试中', testPlanStart: '2026-01-15', testPlanEnd: '2026-02-01', acceptPlanStart: '2026-02-02', acceptPlanEnd: '2026-02-15' },
  { id: '3', domain: '显示', irNo: 'IR-2026-003', irTitle: '120Hz自适应刷新率', priority: '高', irStatus: '开发中', testPlanStart: '2026-02-01', testPlanEnd: '2026-02-20', acceptPlanStart: '2026-02-21', acceptPlanEnd: '2026-03-05' },
  { id: '4', domain: '系统', irNo: 'IR-2026-004', irTitle: '内存管理优化', priority: '中', irStatus: '已验收', testPlanStart: '2026-01-05', testPlanEnd: '2026-01-20', acceptPlanStart: '2026-01-21', acceptPlanEnd: '2026-02-01' },
  { id: '5', domain: '通信', irNo: 'IR-2026-005', irTitle: '5G SA模式稳定性', priority: '高', irStatus: '测试中', testPlanStart: '2026-02-10', testPlanEnd: '2026-03-01', acceptPlanStart: '2026-03-02', acceptPlanEnd: '2026-03-15' },
  { id: '6', domain: '音频', irNo: 'IR-2026-006', irTitle: '通话降噪算法升级', priority: '低', irStatus: '待开发', testPlanStart: '2026-03-01', testPlanEnd: '2026-03-20', acceptPlanStart: '2026-03-21', acceptPlanEnd: '2026-04-05' },
  { id: '7', domain: '电池', irNo: 'IR-2026-007', irTitle: '快充协议兼容性优化', priority: '高', irStatus: '开发中', testPlanStart: '2026-02-15', testPlanEnd: '2026-03-05', acceptPlanStart: '2026-03-06', acceptPlanEnd: '2026-03-20' },
  { id: '8', domain: '安全', irNo: 'IR-2026-008', irTitle: 'TEE安全启动增强', priority: '中', irStatus: '待开发', testPlanStart: '2026-03-10', testPlanEnd: '2026-03-30', acceptPlanStart: '2026-04-01', acceptPlanEnd: '2026-04-15' },
]

// SR需求Mock数据
const SR_MOCK_DATA: SRRequirement[] = [
  { id: '1', srNo: 'SR-2026-001', srTitle: 'HDR拍照模式实现', relatedIR: 'IR-2026-001', devDept: '相机部', srStatus: '已转测', planTestVersion: '16.3.030', actualTestVersion: '16.3.030', testPlanStart: '2026-01-10', testPlanEnd: '2026-01-20', acceptPlanStart: '2026-01-21', acceptPlanEnd: '2026-02-01' },
  { id: '2', srNo: 'SR-2026-002', srTitle: 'HDR视频录制支持', relatedIR: 'IR-2026-001', devDept: '相机部', srStatus: '已转测', planTestVersion: '16.3.030', actualTestVersion: '16.3.031', testPlanStart: '2026-01-15', testPlanEnd: '2026-01-25', acceptPlanStart: '2026-01-26', acceptPlanEnd: '2026-02-05' },
  { id: '3', srNo: 'SR-2026-003', srTitle: '超广角畸变矫正', relatedIR: 'IR-2026-002', devDept: '相机部', srStatus: '开发中', planTestVersion: '16.3.031', actualTestVersion: '', testPlanStart: '2026-02-01', testPlanEnd: '2026-02-15', acceptPlanStart: '2026-02-16', acceptPlanEnd: '2026-02-28' },
  { id: '4', srNo: 'SR-2026-004', srTitle: 'LTPO自适应刷新', relatedIR: 'IR-2026-003', devDept: '显示部', srStatus: '开发中', planTestVersion: '16.3.031', actualTestVersion: '', testPlanStart: '2026-02-10', testPlanEnd: '2026-02-25', acceptPlanStart: '2026-02-26', acceptPlanEnd: '2026-03-10' },
  { id: '5', srNo: 'SR-2026-005', srTitle: '后台进程回收优化', relatedIR: 'IR-2026-004', devDept: '系统部', srStatus: '已验收', planTestVersion: '16.3.030', actualTestVersion: '16.3.030', testPlanStart: '2026-01-08', testPlanEnd: '2026-01-18', acceptPlanStart: '2026-01-19', acceptPlanEnd: '2026-01-28' },
  { id: '6', srNo: 'SR-2026-006', srTitle: 'SA模式频繁断连修复', relatedIR: 'IR-2026-005', devDept: '通信部', srStatus: '测试中', planTestVersion: '16.3.032', actualTestVersion: '', testPlanStart: '2026-02-15', testPlanEnd: '2026-03-01', acceptPlanStart: '2026-03-02', acceptPlanEnd: '2026-03-15' },
  { id: '7', srNo: 'SR-2026-007', srTitle: 'AI降噪模型集成', relatedIR: 'IR-2026-006', devDept: '音频部', srStatus: '待开发', planTestVersion: '16.3.032', actualTestVersion: '', testPlanStart: '2026-03-05', testPlanEnd: '2026-03-20', acceptPlanStart: '2026-03-21', acceptPlanEnd: '2026-04-05' },
  { id: '8', srNo: 'SR-2026-008', srTitle: '快充PD3.1协议适配', relatedIR: 'IR-2026-007', devDept: '电源部', srStatus: '开发中', planTestVersion: '16.3.031', actualTestVersion: '', testPlanStart: '2026-02-20', testPlanEnd: '2026-03-08', acceptPlanStart: '2026-03-09', acceptPlanEnd: '2026-03-22' },
]

// IR所有列定义
const IR_ALL_COLUMNS = [
  { key: 'id', label: '序号', default: true },
  { key: 'domain', label: '领域', default: true },
  { key: 'irNo', label: 'IR编号', default: true },
  { key: 'irTitle', label: 'IR标题', default: true },
  { key: 'priority', label: '优先级', default: true },
  { key: 'irStatus', label: 'IR状态', default: true },
  { key: 'testPlanStart', label: '需求测试计划开始时间', default: true },
  { key: 'testPlanEnd', label: '需求测试计划完成时间', default: true },
  { key: 'acceptPlanStart', label: '需求验收计划开始时间', default: true },
  { key: 'acceptPlanEnd', label: '需求验收计划完成时间', default: true },
]

// SR所有列定义
const SR_ALL_COLUMNS = [
  { key: 'id', label: '序号', default: true },
  { key: 'srNo', label: 'SR编号', default: true },
  { key: 'srTitle', label: 'SR标题', default: true },
  { key: 'relatedIR', label: '关联IR', default: true },
  { key: 'devDept', label: '开发部门', default: true },
  { key: 'srStatus', label: 'SR状态', default: true },
  { key: 'planTestVersion', label: '计划转测版本', default: true },
  { key: 'actualTestVersion', label: '实际转测版本', default: true },
  { key: 'testPlanStart', label: '需求测试计划开始时间', default: true },
  { key: 'testPlanEnd', label: '需求测试计划完成时间', default: true },
  { key: 'acceptPlanStart', label: '需求验收计划开始时间', default: true },
  { key: 'acceptPlanEnd', label: '需求验收计划完成时间', default: true },
]

// 甘特图组件
function RequirementGantt({ data, dimension }: { data: any[]; dimension: 'test' | 'accept' }) {
  const ganttContainer = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ganttContainer.current || data.length === 0) return

    gantt.config.date_format = '%Y-%m-%d'
    gantt.config.columns = [
      { name: 'text', label: '标题', width: 200, tree: false },
      { name: 'domain', label: '领域', width: 70, align: 'center' as const },
      { name: 'no', label: '编号', width: 110, align: 'center' as const },
      { name: 'priority', label: '优先级', width: 60, align: 'center' as const },
      { name: 'statusText', label: '状态', width: 70, align: 'center' as const },
      { name: 'start_date', label: '计划开始', width: 90, align: 'center' as const },
      { name: 'end_date_display', label: '计划完成', width: 90, align: 'center' as const },
    ]
    gantt.config.scale_unit = 'month'
    gantt.config.date_scale = '%Y年%m月'
    gantt.config.subscales = [{ unit: 'day', step: 1, date: '%d日' }]
    gantt.config.row_height = 35
    gantt.config.bar_height = 20
    gantt.config.fit_tasks = true
    gantt.config.readonly = true

    gantt.init(ganttContainer.current)

    const ganttData = {
      data: data.map((item, index) => {
        const startDate = dimension === 'test' ? item.testPlanStart : item.acceptPlanStart
        const endDate = dimension === 'test' ? item.testPlanEnd : item.acceptPlanEnd
        const start = new Date(startDate)
        const end = new Date(endDate)
        const duration = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
        return {
          id: index + 1,
          text: item.irTitle || item.srTitle || '',
          domain: item.domain || item.devDept || '',
          no: item.irNo || item.srNo || '',
          priority: item.priority || '',
          statusText: item.irStatus || item.srStatus || '',
          start_date: startDate,
          end_date_display: endDate,
          duration,
          progress: item.irStatus === '已验收' || item.srStatus === '已验收' ? 1 : item.irStatus === '测试中' || item.srStatus === '测试中' ? 0.6 : 0.3,
        }
      }),
      links: [],
    }

    gantt.parse(ganttData)

    return () => {
      gantt.clearAll()
    }
  }, [data, dimension])

  return <div ref={ganttContainer} style={{ width: '100%', height: '500px' }} />
}

interface RequirementDevPlanProps {
  isEditMode?: boolean
}

export default function RequirementDevPlan({ isEditMode = false }: RequirementDevPlanProps) {
  const [activeTab, setActiveTab] = useState<'ir' | 'sr' | 'fusion'>('ir')
  const [viewMode, setViewMode] = useState<'table' | 'horizontal' | 'gantt'>('table')
  const [searchText, setSearchText] = useState('')
  const [showColumnModal, setShowColumnModal] = useState(false)
  const [irVisibleColumns, setIrVisibleColumns] = useState(IR_ALL_COLUMNS.filter(c => c.default).map(c => c.key))
  const [srVisibleColumns, setSrVisibleColumns] = useState(SR_ALL_COLUMNS.filter(c => c.default).map(c => c.key))
  const [ganttDimension, setGanttDimension] = useState<'test' | 'accept'>('test')

  // 编辑模式下不支持横版表格，自动切回竖版表格
  const effectiveViewMode = isEditMode && viewMode === 'horizontal' ? 'table' : viewMode

  // 搜索过滤
  const filteredIR = useMemo(() => {
    if (!searchText) return IR_MOCK_DATA
    const s = searchText.toLowerCase()
    return IR_MOCK_DATA.filter(r =>
      r.domain?.toLowerCase().includes(s) ||
      r.irNo?.toLowerCase().includes(s) ||
      r.irTitle?.toLowerCase().includes(s) ||
      r.irStatus?.toLowerCase().includes(s) ||
      r.priority?.toLowerCase().includes(s) ||
      r.testPlanStart?.includes(s) ||
      r.testPlanEnd?.includes(s) ||
      r.acceptPlanStart?.includes(s) ||
      r.acceptPlanEnd?.includes(s)
    )
  }, [searchText])

  const filteredSR = useMemo(() => {
    if (!searchText) return SR_MOCK_DATA
    const s = searchText.toLowerCase()
    return SR_MOCK_DATA.filter(r =>
      r.srNo?.toLowerCase().includes(s) ||
      r.srTitle?.toLowerCase().includes(s) ||
      r.relatedIR?.toLowerCase().includes(s) ||
      r.devDept?.toLowerCase().includes(s) ||
      r.srStatus?.toLowerCase().includes(s) ||
      r.planTestVersion?.toLowerCase().includes(s) ||
      r.actualTestVersion?.toLowerCase().includes(s) ||
      r.testPlanStart?.includes(s) ||
      r.testPlanEnd?.includes(s) ||
      r.acceptPlanStart?.includes(s) ||
      r.acceptPlanEnd?.includes(s)
    )
  }, [searchText])

  const priorityColor = (p: string) => p === '高' ? 'red' : p === '中' ? 'orange' : 'blue'
  const irStatusColor = (s: string) => s === '已验收' ? 'success' : s === '测试中' ? 'processing' : s === '开发中' ? 'warning' : 'default'
  const srStatusColor = (s: string) => s === '已验收' ? 'success' : s === '已转测' ? 'processing' : s === '测试中' ? 'cyan' : s === '开发中' ? 'warning' : 'default'

  // IR表格列
  const irColumns = useMemo(() => {
    const allCols: any[] = [
      { title: '序号', dataIndex: 'id', key: 'id', width: 60, align: 'center' as const },
      { title: '领域', dataIndex: 'domain', key: 'domain', width: 80 },
      { title: 'IR编号', dataIndex: 'irNo', key: 'irNo', width: 120 },
      { title: 'IR标题', dataIndex: 'irTitle', key: 'irTitle', width: 200, ellipsis: true },
      { title: '优先级', dataIndex: 'priority', key: 'priority', width: 80, align: 'center' as const, render: (p: string) => <Tag color={priorityColor(p)}>{p}</Tag> },
      { title: 'IR状态', dataIndex: 'irStatus', key: 'irStatus', width: 100, align: 'center' as const, render: (s: string) => <Tag color={irStatusColor(s)}>{s}</Tag> },
      { title: '需求测试计划开始时间', dataIndex: 'testPlanStart', key: 'testPlanStart', width: 160 },
      { title: '需求测试计划完成时间', dataIndex: 'testPlanEnd', key: 'testPlanEnd', width: 160 },
      { title: '需求验收计划开始时间', dataIndex: 'acceptPlanStart', key: 'acceptPlanStart', width: 160 },
      { title: '需求验收计划完成时间', dataIndex: 'acceptPlanEnd', key: 'acceptPlanEnd', width: 160 },
    ]
    return allCols.filter(c => irVisibleColumns.includes(c.key))
  }, [irVisibleColumns])

  // SR表格列
  const srColumns = useMemo(() => {
    const allCols: any[] = [
      { title: '序号', dataIndex: 'id', key: 'id', width: 60, align: 'center' as const },
      { title: 'SR编号', dataIndex: 'srNo', key: 'srNo', width: 120 },
      { title: 'SR标题', dataIndex: 'srTitle', key: 'srTitle', width: 200, ellipsis: true },
      { title: '关联IR', dataIndex: 'relatedIR', key: 'relatedIR', width: 120 },
      { title: '开发部门', dataIndex: 'devDept', key: 'devDept', width: 100 },
      { title: 'SR状态', dataIndex: 'srStatus', key: 'srStatus', width: 100, align: 'center' as const, render: (s: string) => <Tag color={srStatusColor(s)}>{s}</Tag> },
      { title: '计划转测版本', dataIndex: 'planTestVersion', key: 'planTestVersion', width: 120 },
      { title: '实际转测版本', dataIndex: 'actualTestVersion', key: 'actualTestVersion', width: 120, render: (v: string) => v || '-' },
      { title: '需求测试计划开始时间', dataIndex: 'testPlanStart', key: 'testPlanStart', width: 160 },
      { title: '需求测试计划完成时间', dataIndex: 'testPlanEnd', key: 'testPlanEnd', width: 160 },
      { title: '需求验收计划开始时间', dataIndex: 'acceptPlanStart', key: 'acceptPlanStart', width: 160 },
      { title: '需求验收计划完成时间', dataIndex: 'acceptPlanEnd', key: 'acceptPlanEnd', width: 160 },
    ]
    return allCols.filter(c => srVisibleColumns.includes(c.key))
  }, [srVisibleColumns])

  const currentAllColumns = activeTab === 'ir' ? IR_ALL_COLUMNS : SR_ALL_COLUMNS
  const currentVisibleColumns = activeTab === 'ir' ? irVisibleColumns : srVisibleColumns
  const setCurrentVisibleColumns = activeTab === 'ir' ? setIrVisibleColumns : setSrVisibleColumns

  // 横版表格渲染
  const renderHorizontalTable = (type: 'ir' | 'sr') => {
    const data = type === 'ir' ? filteredIR : filteredSR
    const thStyle: CSSProperties = { background: '#f8fafc', fontWeight: 600, fontSize: 13, color: '#4b5563', padding: '10px 14px', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6', whiteSpace: 'nowrap', position: 'sticky', left: 0, zIndex: 1, minWidth: 160, textAlign: 'left' }
    const tdStyle: CSSProperties = { padding: '8px 12px', fontSize: 13, textAlign: 'center', whiteSpace: 'nowrap', minWidth: 120, borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }

    const irFields = [
      { label: '序号', key: 'id' },
      { label: '领域', key: 'domain' },
      { label: 'IR编号', key: 'irNo' },
      { label: 'IR标题', key: 'irTitle' },
      { label: '优先级', key: 'priority' },
      { label: 'IR状态', key: 'irStatus' },
      { label: '需求测试计划开始时间', key: 'testPlanStart' },
      { label: '需求测试计划完成时间', key: 'testPlanEnd' },
      { label: '需求验收计划开始时间', key: 'acceptPlanStart' },
      { label: '需求验收计划完成时间', key: 'acceptPlanEnd' },
    ]
    const srFields = [
      { label: '序号', key: 'id' },
      { label: 'SR编号', key: 'srNo' },
      { label: 'SR标题', key: 'srTitle' },
      { label: '关联IR', key: 'relatedIR' },
      { label: '开发部门', key: 'devDept' },
      { label: 'SR状态', key: 'srStatus' },
      { label: '计划转测版本', key: 'planTestVersion' },
      { label: '实际转测版本', key: 'actualTestVersion' },
      { label: '需求测试计划开始时间', key: 'testPlanStart' },
      { label: '需求测试计划完成时间', key: 'testPlanEnd' },
      { label: '需求验收计划开始时间', key: 'acceptPlanStart' },
      { label: '需求验收计划完成时间', key: 'acceptPlanEnd' },
    ]
    const fields = type === 'ir' ? irFields : srFields

    const renderCellValue = (item: any, key: string) => {
      const val = item[key]
      if (key === 'priority') return <Tag color={priorityColor(val)}>{val}</Tag>
      if (key === 'irStatus') return <Tag color={irStatusColor(val)}>{val}</Tag>
      if (key === 'srStatus') return <Tag color={srStatusColor(val)}>{val}</Tag>
      return val || <span style={{ color: '#bfbfbf' }}>-</span>
    }

    if (data.length === 0) {
      return <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>暂无数据</div>
    }

    return (
      <div style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #f3f4f6' }}>
          <tbody>
            {fields.map((field) => (
              <tr key={field.key}>
                <th style={thStyle}>{field.label}</th>
                {data.map((item: any) => (
                  <td key={item.id} style={{ ...tdStyle, textAlign: field.key === 'irTitle' || field.key === 'srTitle' ? 'left' : 'center' }}>
                    {renderCellValue(item, field.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // 视图模式选项
  const viewModeOptions = isEditMode
    ? [
        { label: '表格', value: 'table' },
        { label: '甘特图', value: 'gantt' },
      ]
    : [
        { label: '竖版表格', value: 'table' },
        { label: '横版表格', value: 'horizontal' },
        { label: '甘特图', value: 'gantt' },
      ]

  return (
    <Card>
      {/* 顶部操作栏 */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Tabs
            activeKey={activeTab}
            onChange={(k) => { setActiveTab(k as 'ir' | 'sr' | 'fusion'); setSearchText('') }}
            style={{ marginBottom: 0 }}
            items={[
              { key: 'ir', label: 'IR需求' },
              { key: 'sr', label: 'SR需求' },
              { key: 'fusion', label: '融合版' },
            ]}
          />
        </Col>
        <Col>
          <Space>
            <Input
              placeholder="搜索..."
              prefix={<SearchOutlined />}
              style={{ width: 220, borderRadius: 6 }}
              allowClear
              onChange={(e) => setSearchText(e.target.value)}
              value={searchText}
            />
            {activeTab !== 'fusion' && (
              <>
                {effectiveViewMode !== 'horizontal' && (
                  <Button icon={<AppstoreOutlined />} style={{ borderRadius: 6 }} onClick={() => setShowColumnModal(true)}>自定义列</Button>
                )}
                <Radio.Group
                  value={effectiveViewMode}
                  onChange={(e) => setViewMode(e.target.value)}
                  optionType="button"
                  buttonStyle="solid"
                  size="small"
                  options={viewModeOptions}
                />
              </>
            )}
          </Space>
        </Col>
      </Row>

      {/* 融合版 - 待定 */}
      {activeTab === 'fusion' && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#9ca3af' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🚧</div>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>融合版 - 敬请期待</div>
          <div style={{ fontSize: 13 }}>该功能正在规划中，即将上线</div>
        </div>
      )}

      {/* IR需求 */}
      {activeTab === 'ir' && (
        effectiveViewMode === 'horizontal' ? (
          renderHorizontalTable('ir')
        ) : effectiveViewMode === 'table' ? (
          <Table
            className="pms-table"
            dataSource={filteredIR}
            columns={irColumns}
            rowKey="id"
            pagination={false}
            scroll={{ x: 1400 }}
            size="middle"
          />
        ) : (
          <div>
            <Row style={{ marginBottom: 12 }}>
              <Radio.Group value={ganttDimension} onChange={(e) => setGanttDimension(e.target.value)} buttonStyle="solid" size="small">
                <Radio.Button value="test">需求测试</Radio.Button>
                <Radio.Button value="accept">需求验收</Radio.Button>
              </Radio.Group>
            </Row>
            <RequirementGantt data={filteredIR} dimension={ganttDimension} />
          </div>
        )
      )}

      {/* SR需求 */}
      {activeTab === 'sr' && (
        effectiveViewMode === 'horizontal' ? (
          renderHorizontalTable('sr')
        ) : effectiveViewMode === 'table' ? (
          <Table
            className="pms-table"
            dataSource={filteredSR}
            columns={srColumns}
            rowKey="id"
            pagination={false}
            scroll={{ x: 1600 }}
            size="middle"
          />
        ) : (
          <div>
            <Row style={{ marginBottom: 12 }}>
              <Radio.Group value={ganttDimension} onChange={(e) => setGanttDimension(e.target.value)} buttonStyle="solid" size="small">
                <Radio.Button value="test">需求测试</Radio.Button>
                <Radio.Button value="accept">需求验收</Radio.Button>
              </Radio.Group>
            </Row>
            <RequirementGantt data={filteredSR} dimension={ganttDimension} />
          </div>
        )
      )}

      {/* 自定义列Modal */}
      <Modal
        title="自定义列配置"
        open={showColumnModal}
        onCancel={() => setShowColumnModal(false)}
        onOk={() => setShowColumnModal(false)}
        className="pms-modal"
        width={400}
      >
        <div style={{ maxHeight: 400, overflow: 'auto' }}>
          {currentAllColumns.map(col => (
            <div key={col.key} style={{ padding: '6px 0' }}>
              <Checkbox
                checked={currentVisibleColumns.includes(col.key)}
                disabled={col.key === 'id'}
                onChange={(e) => {
                  if (e.target.checked) {
                    setCurrentVisibleColumns([...currentVisibleColumns, col.key])
                  } else {
                    setCurrentVisibleColumns(currentVisibleColumns.filter(k => k !== col.key))
                  }
                }}
              >
                {col.label}
              </Checkbox>
            </div>
          ))}
        </div>
      </Modal>
    </Card>
  )
}
