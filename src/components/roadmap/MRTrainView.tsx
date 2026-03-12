'use client'

import { useState, useMemo } from 'react'
import { Table, Tag, Tabs, Button, Space, Empty } from 'antd'
import { EyeOutlined } from '@ant-design/icons'

// ======================== Mock Data ========================

// 一级活动结构（聚合自所有项目的 1+N MR版本火车计划）
const ACTIVITY_STRUCTURE = [
  {
    name: '版本规划',
    children: ['需求收集', '计划评审'],
  },
  {
    name: '版本开发',
    children: ['代码开发', '集成编译'],
  },
]

// Mock MR版本火车数据（按 tOS版本号 + 芯片厂商 分组）
const MR_TRAIN_DATA = [
  // tOS16.3.50 - 高通
  {
    key: '1', tosVersion: 'tOS16.3.50', chipPlatform: '高通', productLine: '高端系列', market: 'OP',
    projectName: 'X6877-D8400_H991', projectId: '1', isMada: '是', madaMarket: 'GMS',
    spm: '李白', contact: '张三', tpm: '王五', mrType: 'FR', projectVersion: '16.3.050.01', crossTestType: '标准',
    act_版本规划_需求收集_start: '2026-01-02', act_版本规划_需求收集_end: '2026-01-10',
    act_版本规划_计划评审_start: '2026-01-11', act_版本规划_计划评审_end: '2026-01-18',
    act_版本开发_代码开发_start: '2026-01-20', act_版本开发_代码开发_end: '2026-02-15',
    act_版本开发_集成编译_start: '2026-02-16', act_版本开发_集成编译_end: '2026-02-28',
  },
  {
    key: '2', tosVersion: 'tOS16.3.50', chipPlatform: '高通', productLine: '高端系列', market: 'TR',
    projectName: 'X6877-D8400_H991', projectId: '1', isMada: '否', madaMarket: '-',
    spm: '李白', contact: '张三', tpm: '王五', mrType: 'MR1', projectVersion: '16.3.050.02', crossTestType: '标准',
    act_版本规划_需求收集_start: '2026-02-01', act_版本规划_需求收集_end: '2026-02-08',
    act_版本规划_计划评审_start: '2026-02-09', act_版本规划_计划评审_end: '2026-02-15',
    act_版本开发_代码开发_start: '2026-02-18', act_版本开发_代码开发_end: '2026-03-10',
    act_版本开发_集成编译_start: '2026-03-11', act_版本开发_集成编译_end: '2026-03-20',
  },
  {
    key: '3', tosVersion: 'tOS16.3.50', chipPlatform: '高通', productLine: '中端系列', market: 'RU',
    projectName: 'X6801_TBD', projectId: '2', isMada: '否', madaMarket: '-',
    spm: '张三', contact: '李四', tpm: '赵六', mrType: 'MR4', projectVersion: '16.3.050.03', crossTestType: '跨测',
    act_版本规划_需求收集_start: '', act_版本规划_需求收集_end: '',
    act_版本规划_计划评审_start: '', act_版本规划_计划评审_end: '',
    act_版本开发_代码开发_start: '', act_版本开发_代码开发_end: '',
    act_版本开发_集成编译_start: '', act_版本开发_集成编译_end: '',
  },
  {
    key: '4', tosVersion: 'tOS16.3.50', chipPlatform: '高通', productLine: '中端系列', market: 'OP',
    projectName: 'X6801_TBD', projectId: '2', isMada: '否', madaMarket: '-',
    spm: '张三', contact: '李四', tpm: '赵六', mrType: 'MR2', projectVersion: '16.3.050.04', crossTestType: '标准',
    act_版本规划_需求收集_start: '', act_版本规划_需求收集_end: '',
    act_版本规划_计划评审_start: '', act_版本规划_计划评审_end: '',
    act_版本开发_代码开发_start: '', act_版本开发_代码开发_end: '',
    act_版本开发_集成编译_start: '', act_版本开发_集成编译_end: '',
  },
  // tOS16.3.50 - MTK
  {
    key: '5', tosVersion: 'tOS16.3.50', chipPlatform: 'MTK', productLine: '高端系列', market: 'OP',
    projectName: 'X6855_H8917', projectId: '3', isMada: '是', madaMarket: 'GMS',
    spm: '赵六', contact: '王五', tpm: '孙七', mrType: 'MR1', projectVersion: '16.3.050.05', crossTestType: '标准',
    act_版本规划_需求收集_start: '2026-01-05', act_版本规划_需求收集_end: '2026-01-12',
    act_版本规划_计划评审_start: '2026-01-13', act_版本规划_计划评审_end: '2026-01-20',
    act_版本开发_代码开发_start: '2026-01-22', act_版本开发_代码开发_end: '2026-02-20',
    act_版本开发_集成编译_start: '2026-02-21', act_版本开发_集成编译_end: '2026-03-05',
  },
  {
    key: '6', tosVersion: 'tOS16.3.50', chipPlatform: 'MTK', productLine: '高端系列', market: 'TR',
    projectName: 'X6855_H8917', projectId: '3', isMada: '否', madaMarket: '-',
    spm: '赵六', contact: '王五', tpm: '孙七', mrType: 'MR1', projectVersion: '16.3.050.06', crossTestType: '跨测',
    act_版本规划_需求收集_start: '2026-02-05', act_版本规划_需求收集_end: '2026-02-12',
    act_版本规划_计划评审_start: '', act_版本规划_计划评审_end: '',
    act_版本开发_代码开发_start: '', act_版本开发_代码开发_end: '',
    act_版本开发_集成编译_start: '', act_版本开发_集成编译_end: '',
  },
  {
    key: '7', tosVersion: 'tOS16.3.50', chipPlatform: 'MTK', productLine: '中端系列', market: 'OP',
    projectName: 'X6890_H100', projectId: '6', isMada: '否', madaMarket: '-',
    spm: '李四', contact: '赵六', tpm: '周八', mrType: 'MR1', projectVersion: '16.3.050.07', crossTestType: '标准',
    act_版本规划_需求收集_start: '', act_版本规划_需求收集_end: '',
    act_版本规划_计划评审_start: '', act_版本规划_计划评审_end: '',
    act_版本开发_代码开发_start: '', act_版本开发_代码开发_end: '',
    act_版本开发_集成编译_start: '', act_版本开发_集成编译_end: '',
  },
  {
    key: '8', tosVersion: 'tOS16.3.50', chipPlatform: 'MTK', productLine: '中端系列', market: 'IN',
    projectName: 'X6890_H100', projectId: '6', isMada: '是', madaMarket: 'GMS',
    spm: '李四', contact: '赵六', tpm: '周八', mrType: 'MR1', projectVersion: '16.3.050.08', crossTestType: '标准',
    act_版本规划_需求收集_start: '', act_版本规划_需求收集_end: '',
    act_版本规划_计划评审_start: '', act_版本规划_计划评审_end: '',
    act_版本开发_代码开发_start: '', act_版本开发_代码开发_end: '',
    act_版本开发_集成编译_start: '', act_版本开发_集成编译_end: '',
  },
  // tOS16.3.50 - SPRD
  {
    key: '9', tosVersion: 'tOS16.3.50', chipPlatform: 'SPRD', productLine: '入门系列', market: 'OP',
    projectName: 'X6873_H972', projectId: '5', isMada: '否', madaMarket: '-',
    spm: '王五', contact: '周八', tpm: '吴九', mrType: 'MR1', projectVersion: '16.3.050.09', crossTestType: '标准',
    act_版本规划_需求收集_start: '', act_版本规划_需求收集_end: '',
    act_版本规划_计划评审_start: '', act_版本规划_计划评审_end: '',
    act_版本开发_代码开发_start: '', act_版本开发_代码开发_end: '',
    act_版本开发_集成编译_start: '', act_版本开发_集成编译_end: '',
  },
  {
    key: '10', tosVersion: 'tOS16.3.50', chipPlatform: 'SPRD', productLine: '入门系列', market: 'BR',
    projectName: 'X6873_H972', projectId: '5', isMada: '否', madaMarket: '-',
    spm: '王五', contact: '周八', tpm: '吴九', mrType: 'MR1', projectVersion: '16.3.050.10', crossTestType: '跨测',
    act_版本规划_需求收集_start: '', act_版本规划_需求收集_end: '',
    act_版本规划_计划评审_start: '', act_版本规划_计划评审_end: '',
    act_版本开发_代码开发_start: '', act_版本开发_代码开发_end: '',
    act_版本开发_集成编译_start: '', act_版本开发_集成编译_end: '',
  },
  {
    key: '11', tosVersion: 'tOS16.3.50', chipPlatform: 'SPRD', productLine: '入门系列', market: 'IN',
    projectName: 'X6880_H200', projectId: '7', isMada: '否', madaMarket: '-',
    spm: '孙七', contact: '吴九', tpm: '李四', mrType: 'MR1', projectVersion: '16.3.050.11', crossTestType: '标准',
    act_版本规划_需求收集_start: '', act_版本规划_需求收集_end: '',
    act_版本规划_计划评审_start: '', act_版本规划_计划评审_end: '',
    act_版本开发_代码开发_start: '', act_版本开发_代码开发_end: '',
    act_版本开发_集成编译_start: '', act_版本开发_集成编译_end: '',
  },
]

// ======================== RowSpan 计算 ========================

function computeRowSpans(data: any[], key: string, groupKeys?: string[]) {
  const spans: number[] = new Array(data.length).fill(0)
  let i = 0
  while (i < data.length) {
    let j = i + 1
    while (j < data.length) {
      let same = data[j][key] === data[i][key]
      if (groupKeys) {
        same = same && groupKeys.every(gk => data[j][gk] === data[i][gk])
      }
      if (!same) break
      j++
    }
    spans[i] = j - i
    for (let k = i + 1; k < j; k++) spans[k] = 0
    i = j
  }
  return spans
}

// ======================== Component ========================

const marketColors: Record<string, string> = {
  'OP': '#1890ff', 'TR': '#52c41a', 'RU': '#faad14',
  'FR': '#722ed1', 'IN': '#eb2f96', 'BR': '#13c2c2',
}

interface MRTrainViewProps {
  onViewProject: (projectId: string, market?: string) => void
}

export default function MRTrainView({ onViewProject }: MRTrainViewProps) {
  const [dimension, setDimension] = useState('tosVersion')

  // 按 tOS版本号 + 芯片厂商 排序
  const sortedData = useMemo(() => {
    return [...MR_TRAIN_DATA].sort((a, b) => {
      if (a.tosVersion !== b.tosVersion) return a.tosVersion.localeCompare(b.tosVersion)
      if (a.chipPlatform !== b.chipPlatform) return a.chipPlatform.localeCompare(b.chipPlatform)
      return 0
    })
  }, [])

  // 计算 rowSpan
  const tosSpans = useMemo(() => computeRowSpans(sortedData, 'tosVersion'), [sortedData])
  const chipSpans = useMemo(() => computeRowSpans(sortedData, 'chipPlatform', ['tosVersion']), [sortedData])

  // 构建列
  const columns = useMemo(() => {
    // 固定信息列
    const infoCols: any[] = [
      {
        title: 'tOS·市场版本号',
        dataIndex: 'tosVersion',
        key: 'tosVersion',
        fixed: 'left',
        width: 130,
        onCell: (_: any, index: number) => ({ rowSpan: tosSpans[index ?? 0] }),
        render: (val: string) => <span style={{ fontWeight: 600, fontSize: 13 }}>{val}</span>,
      },
      {
        title: '芯片厂商',
        dataIndex: 'chipPlatform',
        key: 'chipPlatform',
        fixed: 'left',
        width: 90,
        onCell: (_: any, index: number) => ({ rowSpan: chipSpans[index ?? 0] }),
        render: (val: string) => <span style={{ fontWeight: 500 }}>{val}</span>,
      },
      { title: '产品线', dataIndex: 'productLine', key: 'productLine', width: 90 },
      {
        title: '市场名',
        dataIndex: 'market',
        key: 'market',
        width: 70,
        render: (val: string) => val ? <Tag color={marketColors[val] || 'default'} style={{ margin: 0 }}>{val}</Tag> : '-',
      },
      {
        title: '项目名称',
        dataIndex: 'projectName',
        key: 'projectName',
        width: 180,
        render: (val: string) => <span style={{ fontWeight: 500, fontSize: 13 }}>{val}</span>,
      },
      { title: '是否MADA', dataIndex: 'isMada', key: 'isMada', width: 80, align: 'center' as const },
      { title: 'MADA市场', dataIndex: 'madaMarket', key: 'madaMarket', width: 90 },
      { title: '项目SPM', dataIndex: 'spm', key: 'spm', width: 80 },
      { title: '对接人', dataIndex: 'contact', key: 'contact', width: 70 },
      { title: '项目TPM', dataIndex: 'tpm', key: 'tpm', width: 80 },
      {
        title: 'MR版本类型',
        dataIndex: 'mrType',
        key: 'mrType',
        width: 100,
        render: (val: string) => {
          const color = val === 'FR' ? 'blue' : val === 'MR1' ? 'green' : val === 'MR2' ? 'orange' : 'purple'
          return <Tag color={color} style={{ margin: 0 }}>{val}</Tag>
        },
      },
      { title: '项目版本号', dataIndex: 'projectVersion', key: 'projectVersion', width: 120 },
      { title: '1+N跨测类型', dataIndex: 'crossTestType', key: 'crossTestType', width: 100 },
    ]

    // 动态一级活动/二级活动分组列（黄色头部）
    const activityCols: any[] = ACTIVITY_STRUCTURE.map((act, actIdx) => ({
      title: <span style={{ fontWeight: 600 }}>{act.name}</span>,
      key: `act_group_${actIdx}`,
      className: 'mr-train-activity-header',
      children: act.children.flatMap((sub) => [
        {
          title: `${sub}-计划开始时间`,
          dataIndex: `act_${act.name}_${sub}_start`,
          key: `act_${act.name}_${sub}_start`,
          width: 130,
          align: 'center' as const,
          className: 'mr-train-activity-cell',
          render: (val: string) => (
            <span style={{ fontSize: 12, color: val ? '#595959' : '#bfbfbf' }}>{val || '-'}</span>
          ),
        },
        {
          title: `${sub}-计划结束时间`,
          dataIndex: `act_${act.name}_${sub}_end`,
          key: `act_${act.name}_${sub}_end`,
          width: 130,
          align: 'center' as const,
          className: 'mr-train-activity-cell',
          render: (val: string) => (
            <span style={{ fontSize: 12, color: val ? '#595959' : '#bfbfbf' }}>{val || '-'}</span>
          ),
        },
      ]),
    }))

    // 操作列
    const actionCol = {
      title: '操作',
      key: 'action',
      fixed: 'right' as const,
      width: 90,
      render: (_: any, record: any) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => onViewProject(record.projectId, record.market)}
        >
          查看
        </Button>
      ),
    }

    return [...infoCols, ...activityCols, actionCol]
  }, [tosSpans, chipSpans, onViewProject])

  return (
    <div>
      {/* 活动分组列的黄色背景样式 */}
      <style>{`
        .mr-train-table .ant-table-thead > tr:first-child > th.mr-train-activity-header,
        .mr-train-table .ant-table-thead > tr:first-child > td.mr-train-activity-header {
          background: #fffbe6 !important;
          border-bottom: 2px solid #ffe58f !important;
        }
        .mr-train-table .ant-table-thead > tr > th.mr-train-activity-cell,
        .mr-train-table .ant-table-thead > tr > td.mr-train-activity-cell {
          background: #fffef5 !important;
          font-size: 12px !important;
        }
        .mr-train-table .ant-table-thead > tr > th {
          white-space: nowrap;
        }
      `}</style>

      <Tabs
        activeKey={dimension}
        onChange={setDimension}
        size="small"
        style={{ marginBottom: 12 }}
        items={[
          { key: 'tosVersion', label: 'tOS版本号维度' },
          { key: 'chipPlatform', label: '芯片厂商维度', disabled: true },
          { key: 'productLine', label: '产品线维度', disabled: true },
        ]}
      />

      {dimension === 'tosVersion' && (
        <Table
          className="pms-table mr-train-table"
          columns={columns}
          dataSource={sortedData}
          scroll={{ x: 'max-content' }}
          size="small"
          bordered
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total) => `共 ${total} 条`,
          }}
          locale={{ emptyText: <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        />
      )}
    </div>
  )
}
