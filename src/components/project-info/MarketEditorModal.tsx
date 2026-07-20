'use client'

import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Form,
  Modal,
  Radio,
  Row,
  Select,
  Space,
  Typography,
} from 'antd'
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
})

export default function MarketEditorModal({
  open,
  rows,
  canChangeMainMarket,
  onChange,
  onSave,
  onCancel,
  saving = false,
}: MarketEditorModalProps) {
  const updateRow = (rowId: string, patch: Partial<MarketConfigRow>) => {
    const previousMainMarket = getMainMarket(rows)
    let nextRows = rows.map(row => (
      row.id === rowId
        ? {
            ...row,
            ...patch,
            ...(patch.isCancelPaused === '否' ? { cancelPauseDate: '' } : {}),
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

  const addRow = () => {
    const selectedMarkets = new Set(rows.map(row => row.market).filter(Boolean))
    const nextMarket = MARKET_OPTIONS.find(market => !selectedMarkets.has(market))
    if (!nextMarket) return
    onChange(normalizeMarketRows([
      ...rows,
      createMarketRow(nextMarket, rows.length === 0),
    ]))
  }

  const removeRow = (rowId: string) => {
    if (rows.length <= 1) return
    const targetRow = rows.find(row => row.id === rowId)
    if (targetRow?.isMain && !canChangeMainMarket) return
    const previousMainMarket = getMainMarket(rows)
    onChange(normalizeMarketRows(rows.filter(row => row.id !== rowId), previousMainMarket))
  }

  const allMarketsSelected = MARKET_OPTIONS.every(market => rows.some(row => row.market === market))

  return (
    <Modal
      className="pms-modal"
      title={<Space><EditOutlined style={{ color: '#6366f1' }} /><span>市场编辑</span></Space>}
      open={open}
      onCancel={onCancel}
      width={820}
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

      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {rows.map((row, index) => (
          <Card
            key={row.id}
            size="small"
            title={(
              <Space size={8}>
                <Typography.Text strong>{row.market || `市场 ${index + 1}`}</Typography.Text>
                {row.isMain && <Typography.Text type="secondary">主市场</Typography.Text>}
              </Space>
            )}
            extra={(
              <Button
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
                aria-label={`删除${row.market || '当前'}市场`}
                disabled={rows.length <= 1 || (row.isMain && !canChangeMainMarket)}
                onClick={() => removeRow(row.id)}
              />
            )}
          >
            <Form layout="vertical" component={false}>
              <Row gutter={[16, 0]}>
                <Col xs={24} md={8}>
                  <Form.Item label="市场" required>
                    <Select
                      value={row.market || undefined}
                      placeholder="请选择市场"
                      style={{ width: '100%' }}
                      disabled={row.isMain && !canChangeMainMarket}
                      onChange={(market) => updateRow(row.id, { market })}
                      options={MARKET_OPTIONS.map(market => ({
                        label: market,
                        value: market,
                        disabled: rows.some(item => item.id !== row.id && item.market === market),
                      }))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="主市场">
                    <Radio
                      checked={row.isMain}
                      disabled={!canChangeMainMarket}
                      onChange={() => updateRow(row.id, { isMain: true })}
                    >
                      设为主市场
                    </Radio>
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="跟随主市场">
                    <Checkbox
                      checked={!row.isMain && row.followsMain}
                      disabled={row.isMain}
                      onChange={(event) => updateRow(row.id, { followsMain: event.target.checked })}
                    >
                      跟随主市场计划
                    </Checkbox>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={[16, 0]}>
                <Col xs={24} md={8}>
                  <Form.Item label="Google Launch Date">
                    <DatePicker
                      value={row.googleLaunchDate ? dayjs(row.googleLaunchDate) : null}
                      format="YYYY-MM-DD"
                      style={{ width: '100%' }}
                      onChange={(_, dateString) => updateRow(row.id, {
                        googleLaunchDate: Array.isArray(dateString) ? (dateString[0] || '') : dateString,
                      })}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="是否运营商定制">
                    <Select<MarketYesNoValue>
                      allowClear
                      value={row.isCarrierCustomized}
                      placeholder="请选择"
                      style={{ width: '100%' }}
                      options={YES_NO_OPTIONS}
                      onChange={(value) => updateRow(row.id, { isCarrierCustomized: value })}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="是否锁卡">
                    <Select<MarketYesNoValue>
                      allowClear
                      value={row.isSimLocked}
                      placeholder="请选择"
                      style={{ width: '100%' }}
                      options={YES_NO_OPTIONS}
                      onChange={(value) => updateRow(row.id, { isSimLocked: value })}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={[16, 0]}>
                <Col xs={24} md={8}>
                  <Form.Item label="是否取消暂停">
                    <Select<MarketYesNoValue>
                      allowClear
                      value={row.isCancelPaused}
                      placeholder="请选择"
                      style={{ width: '100%' }}
                      options={YES_NO_OPTIONS}
                      onChange={(value) => updateRow(row.id, { isCancelPaused: value })}
                    />
                  </Form.Item>
                </Col>
                {row.isCancelPaused === '是' && (
                  <Col xs={24} md={8}>
                    <Form.Item label="取消暂停时间">
                      <DatePicker
                        value={row.cancelPauseDate ? dayjs(row.cancelPauseDate) : null}
                        format="YYYY-MM-DD"
                        style={{ width: '100%' }}
                        onChange={(_, dateString) => updateRow(row.id, {
                          cancelPauseDate: Array.isArray(dateString) ? (dateString[0] || '') : dateString,
                        })}
                      />
                    </Form.Item>
                  </Col>
                )}
                <Col xs={24} md={8}>
                  <Form.Item label="是否 MADA 管控">
                    <Select<MarketYesNoValue>
                      allowClear
                      value={row.isMadaControlled}
                      placeholder="请选择"
                      style={{ width: '100%' }}
                      options={YES_NO_OPTIONS}
                      onChange={(value) => updateRow(row.id, { isMadaControlled: value })}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Card>
        ))}
      </Space>

      <Button
        type="dashed"
        icon={<PlusOutlined />}
        style={{ width: '100%', marginTop: 12 }}
        disabled={allMarketsSelected}
        onClick={addRow}
      >
        {allMarketsSelected ? '已添加全部可选市场' : '添加市场'}
      </Button>
    </Modal>
  )
}
