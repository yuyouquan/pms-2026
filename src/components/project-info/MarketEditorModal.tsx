'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Alert,
  Button,
  Checkbox,
  DatePicker,
  Input,
  Modal,
  Radio,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  MARKET_OPTIONS,
  getMainMarket,
  normalizeMarketRows,
  type MarketConfigRow,
  type MarketYesNoValue,
} from '@/lib/marketRules'

const YES_NO_OPTIONS: Array<{ label: MarketYesNoValue; value: MarketYesNoValue }> = [
  { label: '是', value: '是' },
  { label: '否', value: '否' },
]

const MARKET_MATRIX_FIELDS = [
  { key: 'isMain', label: '主市场' },
  { key: 'followsMain', label: '跟随主市场' },
  { key: 'googleLaunchDate', label: 'Google Launch Date' },
  { key: 'isCarrierCustomized', label: '是否运营商定制' },
  { key: 'isSimLocked', label: '是否锁卡' },
  { key: 'isCancelPaused', label: '是否取消暂停' },
  { key: 'cancelPauseDate', label: '取消暂停时间' },
  { key: 'isMadaControlled', label: '是否 MADA 管控' },
  { key: 'branchInfo', label: '分支信息' },
  { key: 'jenkinsUrl', label: 'Jenkins 构建' },
  { key: 'buildAddress', label: '版本地址' },
] as const

type MarketMatrixFieldKey = typeof MARKET_MATRIX_FIELDS[number]['key']
type MarketMatrixField = typeof MARKET_MATRIX_FIELDS[number]

export interface MarketEditorModalProps {
  open: boolean
  rows: MarketConfigRow[]
  canChangeMainMarket: boolean
  onChange: (rows: MarketConfigRow[]) => void
  onSave: () => void
  onCancel: () => void
  saving?: boolean
}

const createMarketRow = (market: string, isMain: boolean): MarketConfigRow => ({
  id: `market-${Date.now()}-${market}`,
  market,
  isMain,
  followsMain: false,
  googleLaunchDate: '',
  isCarrierCustomized: undefined,
  isSimLocked: undefined,
  isCancelPaused: undefined,
  cancelPauseDate: '',
  isMadaControlled: undefined,
  branchInfo: '',
  jenkinsUrl: '',
  buildAddress: '',
})

const normalizeDateString = (value: string | string[] | null) => (
  Array.isArray(value) ? (value[0] || '') : (value || '')
)

export default function MarketEditorModal({
  open,
  rows,
  canChangeMainMarket,
  onChange,
  onSave,
  onCancel,
  saving = false,
}: MarketEditorModalProps) {
  const [selectedMarket, setSelectedMarket] = useState<string>()
  const availableMarkets = useMemo(() => MARKET_OPTIONS.filter(market => (
    !rows.some(row => row.market === market)
  )), [rows])

  useEffect(() => {
    if (!availableMarkets.length) {
      setSelectedMarket(undefined)
      return
    }
    if (!selectedMarket || !availableMarkets.includes(selectedMarket)) {
      setSelectedMarket(availableMarkets[0])
    }
  }, [availableMarkets, selectedMarket])

  const updateRow = (rowId: string, patch: Partial<MarketConfigRow>) => {
    const previousMainMarket = getMainMarket(rows)
    let nextRows = rows.map(row => (
      row.id === rowId
        ? {
            ...row,
            ...patch,
            ...(patch.isCancelPaused !== undefined && patch.isCancelPaused !== '是'
              ? { cancelPauseDate: '' }
              : {}),
          }
        : { ...row }
    ))

    if (patch.isMain) {
      nextRows = nextRows.map(row => ({
        ...row,
        isMain: row.id === rowId,
        followsMain: row.id === rowId ? false : row.followsMain,
      }))
    }

    onChange(normalizeMarketRows(nextRows, previousMainMarket))
  }

  const addMarket = () => {
    if (!selectedMarket) return
    onChange(normalizeMarketRows([
      ...rows,
      createMarketRow(selectedMarket, rows.length === 0),
    ]))
  }

  const removeRow = (rowId: string) => {
    if (rows.length <= 1) return
    const targetRow = rows.find(row => row.id === rowId)
    if (targetRow?.isMain) return
    const previousMainMarket = getMainMarket(rows)
    onChange(normalizeMarketRows(rows.filter(row => row.id !== rowId), previousMainMarket))
  }

  const renderYesNo = (
    value: MarketYesNoValue | undefined,
    onValueChange: (nextValue: MarketYesNoValue | undefined) => void,
  ) => (
    <Select<MarketYesNoValue>
      allowClear
      value={value}
      placeholder="请选择"
      options={YES_NO_OPTIONS}
      onChange={onValueChange}
    />
  )

  const renderMarketControl = (fieldKey: MarketMatrixFieldKey, row: MarketConfigRow): ReactNode => {
    switch (fieldKey) {
      case 'isMain':
        return (
          <Radio
            checked={row.isMain}
            disabled={!canChangeMainMarket}
            onChange={() => updateRow(row.id, { isMain: true })}
          >
            {row.isMain ? '当前主市场' : '设为主市场'}
          </Radio>
        )
      case 'followsMain':
        return (
          <Checkbox
            checked={!row.isMain && row.followsMain}
            disabled={row.isMain}
            onChange={event => updateRow(row.id, { followsMain: event.target.checked })}
          >
            跟随主市场计划
          </Checkbox>
        )
      case 'googleLaunchDate':
        return (
          <DatePicker
            value={row.googleLaunchDate ? dayjs(row.googleLaunchDate) : null}
            format="YYYY-MM-DD"
            onChange={(_, value) => updateRow(row.id, { googleLaunchDate: normalizeDateString(value) })}
          />
        )
      case 'isCarrierCustomized':
        return renderYesNo(row.isCarrierCustomized, value => updateRow(row.id, { isCarrierCustomized: value }))
      case 'isSimLocked':
        return renderYesNo(row.isSimLocked, value => updateRow(row.id, { isSimLocked: value }))
      case 'isCancelPaused':
        return renderYesNo(row.isCancelPaused, value => updateRow(row.id, { isCancelPaused: value }))
      case 'cancelPauseDate': {
        const enabled = row.isCancelPaused === '是'
        return (
          <div className="pms-market-matrix-date">
            <DatePicker
              disabled={!enabled}
              status={enabled && !row.cancelPauseDate ? 'error' : undefined}
              value={enabled && row.cancelPauseDate ? dayjs(row.cancelPauseDate) : null}
              format="YYYY-MM-DD"
              onChange={(_, value) => updateRow(row.id, { cancelPauseDate: normalizeDateString(value) })}
            />
            {enabled && !row.cancelPauseDate && <span>请选择取消暂停时间</span>}
          </div>
        )
      }
      case 'isMadaControlled':
        return renderYesNo(row.isMadaControlled, value => updateRow(row.id, { isMadaControlled: value }))
      case 'branchInfo':
        return (
          <Input
            value={row.branchInfo || ''}
            placeholder="请输入分支信息"
            onChange={event => updateRow(row.id, { branchInfo: event.target.value })}
          />
        )
      case 'jenkinsUrl':
        return (
          <Input
            value={row.jenkinsUrl || ''}
            placeholder="请输入 Jenkins 构建地址"
            onChange={event => updateRow(row.id, { jenkinsUrl: event.target.value })}
          />
        )
      case 'buildAddress':
        return (
          <Input
            value={row.buildAddress || ''}
            placeholder="请输入版本地址"
            onChange={event => updateRow(row.id, { buildAddress: event.target.value })}
          />
        )
      default:
        return null
    }
  }

  const columns: ColumnsType<MarketMatrixField> = [
    {
      title: '字段',
      dataIndex: 'label',
      key: 'label',
      fixed: 'left',
      width: 168,
      render: label => <strong className="pms-market-matrix-field-label">{label}</strong>,
    },
    ...rows.map(row => ({
      title: (
        <div className="pms-market-matrix-market-header">
          <span>{row.market}</span>
          {row.isMain && <Tag color="blue">主市场</Tag>}
          <Tooltip title={row.isMain ? '请先指定其他主市场后再删除' : '删除市场'}>
            <span>
              <Button
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
                aria-label={`删除${row.market}市场`}
                disabled={rows.length <= 1 || row.isMain}
                onClick={() => removeRow(row.id)}
              />
            </span>
          </Tooltip>
        </div>
      ),
      dataIndex: row.id,
      key: row.id,
      width: 228,
      render: (_value: unknown, field: MarketMatrixField) => renderMarketControl(field.key, row),
    })),
  ]

  return (
    <Modal
      className="pms-modal pms-market-matrix-modal"
      title={<Space><EditOutlined style={{ color: '#6366f1' }} /><span>市场编辑</span></Space>}
      open={open}
      onCancel={onCancel}
      width={1200}
      footer={[
        <Button key="cancel" onClick={onCancel} disabled={saving}>取消</Button>,
        <Button key="save" type="primary" onClick={onSave} loading={saving} disabled={rows.length === 0}>
          保存
        </Button>,
      ]}
    >
      {!canChangeMainMarket && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title="现有主市场存在修订版本，不可变更主市场"
          description="可以继续新增、删除非主市场或调整跟随主市场；如需变更主市场，请先发布或取消当前修订版本。"
        />
      )}

      <div className="pms-market-matrix-toolbar">
        <Select
          value={selectedMarket}
          placeholder="请选择新增市场"
          options={availableMarkets.map(market => ({ label: market, value: market }))}
          onChange={setSelectedMarket}
          disabled={!availableMarkets.length}
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          disabled={!selectedMarket}
          onClick={addMarket}
        >
          {availableMarkets.length ? '增加市场' : '已添加全部市场'}
        </Button>
      </div>

      <Table<MarketMatrixField>
        className="pms-market-matrix"
        rowKey="key"
        bordered
        size="small"
        pagination={false}
        dataSource={[...MARKET_MATRIX_FIELDS]}
        columns={columns}
        scroll={{ x: 168 + rows.length * 228 }}
      />
    </Modal>
  )
}
