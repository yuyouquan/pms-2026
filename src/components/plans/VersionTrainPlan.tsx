'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { Card, Table, Tag, Space, Row, Col, Input, Button, Modal, Form, Select, DatePicker, Upload, Popconfirm, Checkbox, message, Tooltip } from 'antd'
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined, AppstoreOutlined, DownloadOutlined, UploadOutlined, PaperClipOutlined, LinkOutlined, ExportOutlined, BarChartOutlined, UnorderedListOutlined } from '@ant-design/icons'
import { gantt } from 'dhtmlx-gantt'
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css'
import type { VersionTrainRecord, VersionTrainStatus, VersionCategory } from '@/types'
import dayjs from 'dayjs'

const { TextArea } = Input
const { Option } = Select

// 主测机型选项
const TEST_MODEL_OPTIONS = ['Model A Pro', 'Model A', 'Model B Pro', 'Model B', 'Model C', 'Model D']

// Mock数据
const INITIAL_DATA: VersionTrainRecord[] = [
  {
    id: '1', versionNo: '16.3.030', versionCategory: '主干版本', status: '已完成',
    planCompileTime: '2026-01-05', planTestTransferTime: '2026-01-08', planTestStartTime: '2026-01-09', planTestEndTime: '2026-01-20',
    mainTestModel: 'Model A Pro', versionGoal: '基础功能验证版本，完成核心模块集成',
    actualCompileTime: '2026-01-05', actualTestTransferTime: '2026-01-08', actualTestStartTime: '2026-01-09', actualTestEndTime: '2026-01-19',
    relatedRequirements: [
      { id: 'r1', no: 'SR-2026-001', title: 'HDR拍照模式实现', status: '已转测' },
      { id: 'r2', no: 'SR-2026-002', title: 'HDR视频录制支持', status: '已转测' },
      { id: 'r3', no: 'SR-2026-005', title: '后台进程回收优化', status: '已验收' },
    ],
    relatedDefects: [
      { id: 'd1', no: 'BUG-001', title: 'HDR模式偶现崩溃', severity: '严重', status: '已修复' },
      { id: 'd2', no: 'BUG-002', title: '内存泄漏问题', severity: '一般', status: '已修复' },
    ],
    attachments: [{ name: '测试报告_16.3.030.pdf', url: '#' }],
  },
  {
    id: '2', versionNo: '16.3.031', versionCategory: '主干版本', status: '测试中',
    planCompileTime: '2026-01-25', planTestTransferTime: '2026-01-28', planTestStartTime: '2026-01-29', planTestEndTime: '2026-02-15',
    mainTestModel: 'Model A Pro', versionGoal: '新增超广角和LTPO功能，性能优化',
    actualCompileTime: '2026-01-26', actualTestTransferTime: '2026-01-29', actualTestStartTime: '2026-01-30', actualTestEndTime: '',
    relatedRequirements: [
      { id: 'r4', no: 'SR-2026-003', title: '超广角畸变矫正', status: '开发中' },
      { id: 'r5', no: 'SR-2026-004', title: 'LTPO自适应刷新', status: '开发中' },
    ],
    relatedDefects: [
      { id: 'd3', no: 'BUG-003', title: '超广角边缘模糊', severity: '一般', status: '修复中' },
    ],
    attachments: [],
  },
  {
    id: '3', versionNo: '16.3.032', versionCategory: '主干版本', status: '未开始',
    planCompileTime: '2026-02-15', planTestTransferTime: '2026-02-18', planTestStartTime: '2026-02-19', planTestEndTime: '2026-03-05',
    mainTestModel: 'Model B Pro', versionGoal: '5G SA稳定性修复，AI降噪集成',
    actualCompileTime: '', actualTestTransferTime: '', actualTestStartTime: '', actualTestEndTime: '',
    relatedRequirements: [
      { id: 'r6', no: 'SR-2026-006', title: 'SA模式频繁断连修复', status: '测试中' },
      { id: 'r7', no: 'SR-2026-007', title: 'AI降噪模型集成', status: '待开发' },
    ],
    relatedDefects: [],
    attachments: [],
  },
  {
    id: '4', versionNo: '16.3.100', versionCategory: '量产版本', status: '未开始',
    planCompileTime: '2026-03-10', planTestTransferTime: '2026-03-13', planTestStartTime: '2026-03-14', planTestEndTime: '2026-03-30',
    mainTestModel: 'Model A Pro', versionGoal: '量产候选版本，全功能集成验证',
    actualCompileTime: '', actualTestTransferTime: '', actualTestStartTime: '', actualTestEndTime: '',
    relatedRequirements: [],
    relatedDefects: [],
    attachments: [],
  },
]

// 所有列定义
const ALL_COLUMNS_DEF = [
  { key: 'index', label: '序号', default: true },
  { key: 'versionNo', label: '版本号', default: true },
  { key: 'versionCategory', label: '版本分类', default: true },
  { key: 'status', label: '状态', default: true },
  { key: 'planCompileTime', label: '计划编译时间', default: true },
  { key: 'planTestTransferTime', label: '计划转测时间', default: true },
  { key: 'planTestStartTime', label: '计划测试开始时间', default: true },
  { key: 'planTestEndTime', label: '计划测试完成时间', default: true },
  { key: 'mainTestModel', label: '主测机型', default: true },
  { key: 'versionGoal', label: '版本目标', default: true },
  { key: 'actualCompileTime', label: '实际编译时间', default: true },
  { key: 'actualTestTransferTime', label: '实际转测时间', default: true },
  { key: 'actualTestStartTime', label: '实际测试开始时间', default: true },
  { key: 'actualTestEndTime', label: '实际测试完成时间', default: true },
  { key: 'relatedRequirements', label: '关联需求清单', default: true },
  { key: 'relatedDefects', label: '关联缺陷清单', default: true },
  { key: 'attachments', label: '附件', default: true },
  { key: 'action', label: '操作', default: true },
]

const statusColors: Record<string, string> = {
  '已完成': 'success',
  '自检中': 'warning',
  '测试中': 'processing',
  '未开始': 'default',
}

const categoryColors: Record<string, string> = {
  '主干版本': 'blue',
  '量产版本': 'purple',
}

// 甘特图子组件
function VersionTrainGantt({ data }: { data: VersionTrainRecord[] }) {
  const ganttContainer = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ganttContainer.current || data.length === 0) return

    gantt.config.date_format = '%Y-%m-%d'
    gantt.config.columns = [
      { name: 'text', label: '版本号', width: 120, tree: false },
      { name: 'category', label: '分类', width: 80, align: 'center' as const },
      { name: 'statusText', label: '状态', width: 70, align: 'center' as const },
      { name: 'model', label: '主测机型', width: 100, align: 'center' as const },
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
        const startDate = item.planTestStartTime || item.planCompileTime
        const endDate = item.planTestEndTime || item.planTestTransferTime
        const start = new Date(startDate)
        const end = new Date(endDate)
        const duration = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
        return {
          id: index + 1,
          text: item.versionNo,
          category: item.versionCategory,
          statusText: item.status,
          model: item.mainTestModel,
          start_date: startDate,
          end_date_display: endDate,
          duration,
          progress: item.status === '已完成' ? 1 : item.status === '测试中' ? 0.5 : item.status === '自检中' ? 0.3 : 0,
        }
      }),
      links: [],
    }

    gantt.parse(ganttData)

    return () => { gantt.clearAll() }
  }, [data])

  if (data.length === 0) return <div style={{ textAlign: 'center', padding: 40, color: '#8c8c8c' }}>暂无数据</div>
  return <div ref={ganttContainer} style={{ width: '100%', height: '500px' }} />
}

export default function VersionTrainPlan() {
  const [data, setData] = useState<VersionTrainRecord[]>(INITIAL_DATA)
  const [searchText, setSearchText] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'gantt'>('table')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingRecord, setEditingRecord] = useState<VersionTrainRecord | null>(null)
  const [showReqModal, setShowReqModal] = useState(false)
  const [showDefectModal, setShowDefectModal] = useState(false)
  const [currentViewRecord, setCurrentViewRecord] = useState<VersionTrainRecord | null>(null)
  const [showColumnModal, setShowColumnModal] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState(ALL_COLUMNS_DEF.filter(c => c.default).map(c => c.key))
  const [form] = Form.useForm()

  // 搜索过滤
  const filteredData = useMemo(() => {
    let result = [...data]
    if (searchText) {
      const s = searchText.toLowerCase()
      result = result.filter(r =>
        r.versionNo.toLowerCase().includes(s) ||
        r.versionCategory.toLowerCase().includes(s) ||
        r.status.toLowerCase().includes(s) ||
        r.mainTestModel.toLowerCase().includes(s) ||
        r.versionGoal.toLowerCase().includes(s) ||
        r.planCompileTime.includes(s) ||
        r.planTestTransferTime.includes(s) ||
        r.planTestStartTime.includes(s) ||
        r.planTestEndTime.includes(s)
      )
    }
    // 按版本号升序
    result.sort((a, b) => a.versionNo.localeCompare(b.versionNo, undefined, { numeric: true }))
    return result
  }, [data, searchText])

  // 创建记录
  const handleCreate = (values: any) => {
    const newRecord: VersionTrainRecord = {
      id: `${Date.now()}`,
      versionNo: values.versionNo,
      versionCategory: values.versionCategory,
      status: values.status,
      planCompileTime: values.planCompileTime?.format('YYYY-MM-DD') || '',
      planTestTransferTime: values.planTestTransferTime?.format('YYYY-MM-DD') || '',
      planTestStartTime: values.planTestStartTime?.format('YYYY-MM-DD') || '',
      planTestEndTime: values.planTestEndTime?.format('YYYY-MM-DD') || '',
      mainTestModel: values.mainTestModel,
      versionGoal: values.versionGoal || '',
      actualCompileTime: '',
      actualTestTransferTime: '',
      actualTestStartTime: '',
      actualTestEndTime: '',
      relatedRequirements: [],
      relatedDefects: [],
      attachments: (values.attachments?.fileList || []).map((f: any) => ({ name: f.name, url: '#' })),
    }
    setData([...data, newRecord])
    setShowCreateModal(false)
    form.resetFields()
    message.success('创建成功')
  }

  // 编辑记录
  const handleEdit = (record: VersionTrainRecord) => {
    setEditingRecord(record)
    form.setFieldsValue({
      versionNo: record.versionNo,
      versionCategory: record.versionCategory,
      status: record.status,
      mainTestModel: record.mainTestModel,
      versionGoal: record.versionGoal,
      planCompileTime: record.planCompileTime ? dayjs(record.planCompileTime) : null,
      planTestTransferTime: record.planTestTransferTime ? dayjs(record.planTestTransferTime) : null,
      planTestStartTime: record.planTestStartTime ? dayjs(record.planTestStartTime) : null,
      planTestEndTime: record.planTestEndTime ? dayjs(record.planTestEndTime) : null,
    })
    setShowEditModal(true)
  }

  const handleEditSave = (values: any) => {
    if (!editingRecord) return
    const updated = data.map(r => {
      if (r.id !== editingRecord.id) return r
      return {
        ...r,
        versionNo: values.versionNo,
        versionCategory: values.versionCategory,
        status: values.status,
        mainTestModel: values.mainTestModel,
        versionGoal: values.versionGoal || '',
        planCompileTime: values.planCompileTime?.format('YYYY-MM-DD') || '',
        planTestTransferTime: values.planTestTransferTime?.format('YYYY-MM-DD') || '',
        planTestStartTime: values.planTestStartTime?.format('YYYY-MM-DD') || '',
        planTestEndTime: values.planTestEndTime?.format('YYYY-MM-DD') || '',
        attachments: values.attachments?.fileList
          ? (values.attachments.fileList).map((f: any) => ({ name: f.name, url: '#' }))
          : r.attachments,
      }
    })
    setData(updated)
    setShowEditModal(false)
    setEditingRecord(null)
    form.resetFields()
    message.success('修改成功')
  }

  // 删除记录
  const handleDelete = (id: string) => {
    setData(data.filter(r => r.id !== id))
    message.success('删除成功')
  }

  // 导出数据
  const handleExport = () => {
    const headers = ['序号', '版本号', '版本分类', '状态', '计划编译时间', '计划转测时间', '计划测试开始时间', '计划测试完成时间', '主测机型', '版本目标', '实际编译时间', '实际转测时间', '实际测试开始时间', '实际测试完成时间']
    const rows = filteredData.map((r, i) => [
      i + 1, r.versionNo, r.versionCategory, r.status,
      r.planCompileTime, r.planTestTransferTime, r.planTestStartTime, r.planTestEndTime,
      r.mainTestModel, r.versionGoal,
      r.actualCompileTime || '-', r.actualTestTransferTime || '-', r.actualTestStartTime || '-', r.actualTestEndTime || '-',
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `在研版本火车计划_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    message.success('导出成功')
  }

  // 表格列
  const columns = useMemo(() => {
    const allCols: any[] = [
      { title: '序号', key: 'index', width: 60, align: 'center' as const, render: (_: any, __: any, index: number) => index + 1 },
      { title: '版本号', dataIndex: 'versionNo', key: 'versionNo', width: 110, sorter: (a: VersionTrainRecord, b: VersionTrainRecord) => a.versionNo.localeCompare(b.versionNo, undefined, { numeric: true }) },
      { title: '版本分类', dataIndex: 'versionCategory', key: 'versionCategory', width: 100, align: 'center' as const, render: (v: string) => <Tag color={categoryColors[v]}>{v}</Tag> },
      { title: '状态', dataIndex: 'status', key: 'status', width: 90, align: 'center' as const, render: (s: string) => <Tag color={statusColors[s]}>{s}</Tag> },
      { title: '计划编译时间', dataIndex: 'planCompileTime', key: 'planCompileTime', width: 120 },
      { title: '计划转测时间', dataIndex: 'planTestTransferTime', key: 'planTestTransferTime', width: 120 },
      { title: '计划测试开始时间', dataIndex: 'planTestStartTime', key: 'planTestStartTime', width: 130 },
      { title: '计划测试完成时间', dataIndex: 'planTestEndTime', key: 'planTestEndTime', width: 130 },
      { title: '主测机型', dataIndex: 'mainTestModel', key: 'mainTestModel', width: 110 },
      { title: '版本目标', dataIndex: 'versionGoal', key: 'versionGoal', width: 200, ellipsis: true },
      { title: '实际编译时间', dataIndex: 'actualCompileTime', key: 'actualCompileTime', width: 120, render: (v: string) => v || <span style={{ color: '#bfbfbf' }}>-</span> },
      { title: '实际转测时间', dataIndex: 'actualTestTransferTime', key: 'actualTestTransferTime', width: 120, render: (v: string) => v || <span style={{ color: '#bfbfbf' }}>-</span> },
      { title: '实际测试开始时间', dataIndex: 'actualTestStartTime', key: 'actualTestStartTime', width: 130, render: (v: string) => v || <span style={{ color: '#bfbfbf' }}>-</span> },
      { title: '实际测试完成时间', dataIndex: 'actualTestEndTime', key: 'actualTestEndTime', width: 130, render: (v: string) => v || <span style={{ color: '#bfbfbf' }}>-</span> },
      {
        title: '关联需求清单', key: 'relatedRequirements', width: 120, align: 'center' as const,
        render: (_: any, record: VersionTrainRecord) => (
          <Button
            type="link"
            size="small"
            icon={<LinkOutlined />}
            onClick={() => { setCurrentViewRecord(record); setShowReqModal(true) }}
          >
            {record.relatedRequirements.length}条
          </Button>
        ),
      },
      {
        title: '关联缺陷清单', key: 'relatedDefects', width: 120, align: 'center' as const,
        render: (_: any, record: VersionTrainRecord) => (
          <Button
            type="link"
            size="small"
            icon={<LinkOutlined />}
            onClick={() => { setCurrentViewRecord(record); setShowDefectModal(true) }}
          >
            {record.relatedDefects.length}条
          </Button>
        ),
      },
      {
        title: '附件', key: 'attachments', width: 100, align: 'center' as const,
        render: (_: any, record: VersionTrainRecord) =>
          record.attachments.length > 0 ? (
            <Space direction="vertical" size={2}>
              {record.attachments.map((a, i) => (
                <Button key={i} type="link" size="small" icon={<DownloadOutlined />} onClick={() => message.info(`下载: ${a.name}`)}>
                  {a.name.length > 10 ? a.name.slice(0, 10) + '...' : a.name}
                </Button>
              ))}
            </Space>
          ) : <span style={{ color: '#bfbfbf' }}>-</span>,
      },
      {
        title: '操作', key: 'action', width: 120, align: 'center' as const, fixed: 'right' as const,
        render: (_: any, record: VersionTrainRecord) => (
          <Space size={4}>
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>修改</Button>
            <Popconfirm title="确认删除该版本记录？" onConfirm={() => handleDelete(record.id)} okText="确认" cancelText="取消">
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          </Space>
        ),
      },
    ]
    return allCols.filter(c => visibleColumns.includes(c.key))
  }, [visibleColumns, data])

  // Modal表单内容
  const renderFormContent = () => (
    <>
      <Form.Item label="版本号" name="versionNo" rules={[{ required: true, message: '请输入版本号' }]}>
        <Input placeholder="例如: 16.3.033" />
      </Form.Item>
      <Form.Item label="版本分类" name="versionCategory" rules={[{ required: true, message: '请选择版本分类' }]}>
        <Select placeholder="请选择版本分类">
          <Option value="主干版本">主干版本</Option>
          <Option value="量产版本">量产版本</Option>
        </Select>
      </Form.Item>
      <Form.Item label="主测机型" name="mainTestModel" rules={[{ required: true, message: '请选择主测机型' }]}>
        <Select placeholder="请选择主测机型">
          {TEST_MODEL_OPTIONS.map(m => <Option key={m} value={m}>{m}</Option>)}
        </Select>
      </Form.Item>
      <Form.Item label="状态" name="status" initialValue="未开始" rules={[{ required: true }]}>
        <Select>
          <Option value="未开始">未开始</Option>
          <Option value="自检中">自检中</Option>
          <Option value="测试中">测试中</Option>
          <Option value="已完成">已完成</Option>
        </Select>
      </Form.Item>
      <Form.Item label="版本目标" name="versionGoal">
        <TextArea rows={3} placeholder="请输入版本目标" />
      </Form.Item>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item label="计划编译时间" name="planCompileTime">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="计划转测时间" name="planTestTransferTime">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item label="计划测试开始时间" name="planTestStartTime">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="计划测试完成时间" name="planTestEndTime">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item label="附件" name="attachments">
        <Upload beforeUpload={() => false} multiple>
          <Button icon={<UploadOutlined />}>上传附件</Button>
        </Upload>
      </Form.Item>
    </>
  )

  return (
    <Card>
      {/* 顶部操作栏 */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space>
            <Button type="primary" icon={<PlusOutlined />} style={{ borderRadius: 6 }} onClick={() => { form.resetFields(); setShowCreateModal(true) }}>
              添加版本
            </Button>
            <Button icon={<ExportOutlined />} style={{ borderRadius: 6 }} onClick={handleExport}>
              导出
            </Button>
          </Space>
        </Col>
        <Col>
          <Space>
            <Input
              placeholder="搜索版本号/分类/状态/机型..."
              prefix={<SearchOutlined />}
              style={{ width: 260, borderRadius: 6 }}
              allowClear
              onChange={(e) => setSearchText(e.target.value)}
              value={searchText}
            />
            {viewMode === 'table' && (
              <Button icon={<AppstoreOutlined />} style={{ borderRadius: 6 }} onClick={() => setShowColumnModal(true)}>
                自定义列
              </Button>
            )}
            <Tooltip title={viewMode === 'table' ? '切换甘特图' : '切换表格'}>
              <Button
                icon={viewMode === 'table' ? <BarChartOutlined /> : <UnorderedListOutlined />}
                style={{ borderRadius: 6 }}
                onClick={() => setViewMode(viewMode === 'table' ? 'gantt' : 'table')}
              >
                {viewMode === 'table' ? '甘特图' : '表格'}
              </Button>
            </Tooltip>
          </Space>
        </Col>
      </Row>

      {/* 表格视图 */}
      {viewMode === 'table' ? (
        <Table
          className="pms-table"
          dataSource={filteredData}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 10, showSizeChanger: true, showQuickJumper: true, showTotal: (total) => `共 ${total} 条` }}
          scroll={{ x: 2200 }}
          size="middle"
        />
      ) : (
        <VersionTrainGantt data={filteredData} />
      )}

      {/* 新建Modal */}
      <Modal
        title="新建在研版本火车"
        open={showCreateModal}
        onCancel={() => { setShowCreateModal(false); form.resetFields() }}
        onOk={() => form.submit()}
        width={600}
        className="pms-modal"
        okText="确认"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          {renderFormContent()}
        </Form>
      </Modal>

      {/* 编辑Modal */}
      <Modal
        title="修改在研版本火车"
        open={showEditModal}
        onCancel={() => { setShowEditModal(false); setEditingRecord(null); form.resetFields() }}
        onOk={() => form.submit()}
        width={600}
        className="pms-modal"
        okText="确认"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" onFinish={handleEditSave}>
          {renderFormContent()}
        </Form>
      </Modal>

      {/* 关联需求清单Modal */}
      <Modal
        title={`关联需求清单 - ${currentViewRecord?.versionNo || ''}`}
        open={showReqModal}
        onCancel={() => { setShowReqModal(false); setCurrentViewRecord(null) }}
        footer={null}
        width={700}
        className="pms-modal"
      >
        <Table
          className="pms-table"
          dataSource={currentViewRecord?.relatedRequirements || []}
          columns={[
            { title: '序号', key: 'index', width: 60, align: 'center' as const, render: (_: any, __: any, i: number) => i + 1 },
            { title: '需求编号', dataIndex: 'no', key: 'no', width: 130 },
            { title: '需求标题', dataIndex: 'title', key: 'title' },
            { title: '状态', dataIndex: 'status', key: 'status', width: 100, align: 'center' as const, render: (s: string) => <Tag color={s === '已验收' ? 'success' : s === '已转测' ? 'processing' : 'default'}>{s}</Tag> },
          ]}
          rowKey="id"
          pagination={false}
          size="small"
          locale={{ emptyText: '暂无关联需求' }}
        />
      </Modal>

      {/* 关联缺陷清单Modal */}
      <Modal
        title={`关联缺陷清单 - ${currentViewRecord?.versionNo || ''}`}
        open={showDefectModal}
        onCancel={() => { setShowDefectModal(false); setCurrentViewRecord(null) }}
        footer={null}
        width={700}
        className="pms-modal"
      >
        <Table
          className="pms-table"
          dataSource={currentViewRecord?.relatedDefects || []}
          columns={[
            { title: '序号', key: 'index', width: 60, align: 'center' as const, render: (_: any, __: any, i: number) => i + 1 },
            { title: '缺陷编号', dataIndex: 'no', key: 'no', width: 120 },
            { title: '缺陷标题', dataIndex: 'title', key: 'title' },
            { title: '严重程度', dataIndex: 'severity', key: 'severity', width: 90, align: 'center' as const, render: (s: string) => <Tag color={s === '严重' ? 'red' : s === '一般' ? 'orange' : 'blue'}>{s}</Tag> },
            { title: '状态', dataIndex: 'status', key: 'status', width: 90, align: 'center' as const, render: (s: string) => <Tag color={s === '已修复' ? 'success' : s === '修复中' ? 'processing' : 'default'}>{s}</Tag> },
          ]}
          rowKey="id"
          pagination={false}
          size="small"
          locale={{ emptyText: '暂无关联缺陷' }}
        />
      </Modal>

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
          {ALL_COLUMNS_DEF.map(col => (
            <div key={col.key} style={{ padding: '6px 0' }}>
              <Checkbox
                checked={visibleColumns.includes(col.key)}
                disabled={col.key === 'index' || col.key === 'action'}
                onChange={(e) => {
                  if (e.target.checked) {
                    setVisibleColumns([...visibleColumns, col.key])
                  } else {
                    setVisibleColumns(visibleColumns.filter(k => k !== col.key))
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
