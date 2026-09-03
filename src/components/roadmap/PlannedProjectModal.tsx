'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Flex,
  Form,
  Input,
  Modal,
  Row,
  Col,
  Select,
  Skeleton,
  Table,
  message,
  type TableColumnsType,
} from 'antd'
import {
  PROJECT_CATEGORY_MACHINE,
  PROJECT_SECONDARY_CATEGORIES,
} from '@/constants/projectTypes'
import {
  findRoadmapHistoryMatches,
} from '@/lib/roadmapProjectAdapter'
import { buildChipOptions, resolveChipRow } from '@/lib/enumConsumers'
import { buildRoadmapDuplicateKey, formatRoadmapTosValue, getProductLineOptions } from '@/lib/roadmapValidation'
import { useEnumHydration, useSingleEnumOptions } from '@/hooks/useEnumOptions'
import { useEnumStore } from '@/stores/enums'
import { useRoadmapStore } from '@/stores/roadmap'
import type {
  PlannedRoadmapProject,
  PlannedRoadmapProjectInput,
  RoadmapAndroidVersion,
  RoadmapBrand,
  RoadmapDevelopMode,
  RoadmapProductType,
  RoadmapProjectRow,
  RoadmapRam,
  RoadmapVersionType,
  TosVersionConfig,
} from '@/types/roadmap'

const ANDROID_VERSIONS: readonly RoadmapAndroidVersion[] = ['Android 16', 'Android 17', 'Android 18']
const BRANDS: readonly RoadmapBrand[] = ['TECNO', 'Infinix', 'itel', '待定', '其他品牌']
const PRODUCT_TYPES: readonly RoadmapProductType[] = ['新品', '老品']

const sectionStyle: CSSProperties = {
  background: 'var(--bg-purple-tint)',
  borderColor: 'var(--border-purple)',
  borderRadius: 'var(--radius-lg)',
}

type PlannedProjectFormValues = Omit<PlannedRoadmapProjectInput, 'str5Date' | 'launchDate'> & {
  str5Date: Dayjs
  launchDate: Dayjs
}

interface PlannedProjectModalProps {
  open: boolean
  onCancel: () => void
  editingProject?: PlannedRoadmapProject | null
  allRows: readonly RoadmapProjectRow[]
  tosVersions: readonly TosVersionConfig[]
  currentUser: string
  canEdit: boolean
  onDeletePlannedProject: (projectId: string) => void
  onChanged?: () => void
}

function getFirstErrorField(error: unknown): (string | number)[] | null {
  if (typeof error !== 'object' || error === null || !('errorFields' in error)) return null
  const errorFields = (error as { errorFields?: Array<{ name?: (string | number)[] }> }).errorFields
  return errorFields?.[0]?.name ?? null
}

export default function PlannedProjectModal({
  open,
  onCancel,
  editingProject,
  allRows,
  tosVersions,
  currentUser,
  canEdit,
  onDeletePlannedProject,
  onChanged,
}: PlannedProjectModalProps) {
  const [form] = Form.useForm<PlannedProjectFormValues>()
  const [submitting, setSubmitting] = useState(false)
  const submitLockRef = useRef(false)
  const discardConfirmOpenRef = useRef(false)
  const dirtyRef = useRef(false)
  const createPlannedProject = useRoadmapStore(state => state.createPlannedProject)
  const updatePlannedProject = useRoadmapStore(state => state.updatePlannedProject)

  const projectCode = Form.useWatch('projectCode', form) || ''
  const androidVersion = Form.useWatch('androidVersion', form)
  const productType = Form.useWatch('productType', form)
  const brand = Form.useWatch('brand', form)
  const chipCode = Form.useWatch('chipCode', form) || editingProject?.chipCode || ''

  const tosVersionOptions = useSingleEnumOptions(
    'first-sale-tos',
    editingProject?.firstSaleTosVersionId ? [editingProject.firstSaleTosVersionId] : [],
    open,
  )
  const ramOptions = useSingleEnumOptions('memory-size', editingProject?.startRam ? [editingProject.startRam] : [], open)
  const versionTypeOptions = useSingleEnumOptions('version-type', editingProject?.versionType ? [editingProject.versionType] : [], open)
  const productSeriesOptions = useSingleEnumOptions('product-series', editingProject?.productSeries ? [editingProject.productSeries] : [], open)
  const developModeOptions = useSingleEnumOptions('machine-development-mode', editingProject?.developMode ? [editingProject.developMode] : [], open)
  const { hasHydrated, hydrationError, isReady: enumReady, retryHydration } = useEnumHydration(open)
  const rowsByType = useEnumStore(state => state.rowsByType)
  const liveChipRow = useMemo(
    () => rowsByType['chip-mapping'].find(row => row.chipCode.trim() === chipCode.trim()),
    [chipCode, rowsByType],
  )
  const chipOptions = useMemo(() => {
    if (!enumReady) return []
    const historical = editingProject?.chipCode && !liveChipRow
      ? [{ chipCode: editingProject.chipCode, chipModel: '', chipPlatform: '' }]
      : []
    return buildChipOptions(rowsByType, historical)
  }, [editingProject?.chipCode, enumReady, liveChipRow, rowsByType])
  const selectedChipOptionId = liveChipRow?.id ?? chipOptions.find(option => option.historical)?.value
  const hasActiveChipCodes = enumReady && rowsByType['chip-mapping'].some(row => Boolean(row.chipCode.trim()))
  const hasInactiveChipCode = Boolean(editingProject?.chipCode && !liveChipRow)
  const preservesHistoricalChipCode = Boolean(
    editingProject?.chipCode.trim()
    && chipCode.trim() === editingProject.chipCode.trim(),
  )
  const hasInactiveTosVersion = Boolean(tosVersionOptions.find(option => (
    option.value === editingProject?.firstSaleTosVersionId && option.disabled
  )))
  const productLineOptions = brand ? getProductLineOptions(brand) : []
  const historyMatches = useMemo(
    () => findRoadmapHistoryMatches([...allRows], projectCode, editingProject?.id),
    [allRows, editingProject?.id, projectCode],
  )
  const duplicateExists = useMemo(() => {
    if (!projectCode.trim() || !androidVersion || !productType) return false
    const candidateKey = buildRoadmapDuplicateKey(projectCode, androidVersion, productType)
    return allRows.some(row => (
      !(row.source === 'planned' && row.id === editingProject?.id)
      && buildRoadmapDuplicateKey(row.projectCode, row.androidVersion, row.productType) === candidateKey
    ))
  }, [allRows, androidVersion, editingProject?.id, projectCode, productType])

  useEffect(() => {
    if (!open) {
      dirtyRef.current = false
      form.resetFields()
      return
    }
    dirtyRef.current = false
    form.resetFields()
    const nextValues: Partial<PlannedProjectFormValues> = editingProject
      ? {
        ...editingProject,
        str5Date: dayjs(editingProject.str5Date),
        str5Estimated: editingProject.str5Estimated === true,
        launchDate: dayjs(editingProject.launchDate),
        launchEstimated: editingProject.launchEstimated === true,
      }
      : {
          machineProjectType: PROJECT_SECONDARY_CATEGORIES[PROJECT_CATEGORY_MACHINE][0],
          productType: '新品',
          str5Estimated: false,
          launchEstimated: false,
          remark: '',
        }
    form.setFieldsValue(nextValues)
    form.setFields(Object.keys(nextValues).map(name => ({
      name: name as keyof PlannedProjectFormValues,
      touched: false,
      errors: [],
    })))
  }, [editingProject, form, open])

  useEffect(() => {
    form.setFields([{
      name: 'projectCode',
      errors: duplicateExists
        ? ['已存在相同项目：项目名、安卓版本和产品类型均相同，请修改后再保存']
        : [],
    }])
  }, [duplicateExists, form])

  const historyColumns: TableColumnsType<RoadmapProjectRow> = [
    { title: '项目名称', dataIndex: 'displayName', key: 'displayName' },
    { title: '项目名', dataIndex: 'projectCode', key: 'projectCode' },
    { title: '安卓版本', dataIndex: 'androidVersion', key: 'androidVersion' },
    { title: '产品类型', dataIndex: 'productType', key: 'productType' },
  ]

  const focusField = (firstErrorField: (string | number)[]) => {
    form.scrollToField(firstErrorField, { block: 'center' })
    requestAnimationFrame(() => {
      const control = form.getFieldInstance(firstErrorField) as { focus?: () => void } | undefined
      control?.focus?.()
    })
  }

  const handleBrandChange = (nextBrand: RoadmapBrand) => {
    const nextOptions = getProductLineOptions(nextBrand)
    const currentLine = form.getFieldValue('productLine')
    if (!nextOptions.some(option => option === currentLine)) form.setFieldValue('productLine', undefined)
    if (nextOptions.length === 1) form.setFieldValue('productLine', nextOptions[0])
  }

  const handleSubmit = async () => {
    if (submitLockRef.current) return
    submitLockRef.current = true
    try {
      const enumState = useEnumStore.getState()
      if (!canEdit || duplicateExists || !enumState.hasHydrated || enumState.hydrationError) {
        if (!enumState.hasHydrated || enumState.hydrationError) {
          message.error(enumState.hydrationError || '枚举配置正在加载，请稍后重试')
        }
        return
      }
      const submittedChipCode = String(form.getFieldValue('chipCode') ?? '').trim()
      const preservesExistingChipCode = Boolean(
        editingProject?.chipCode.trim()
        && submittedChipCode === editingProject.chipCode.trim(),
      )
      if (!enumState.rowsByType['chip-mapping'].some(row => Boolean(row.chipCode.trim()))
        && !preservesExistingChipCode) {
        const chipConfigMessage = '请先在配置中心维护芯片编码'
        form.setFields([{ name: 'chipCode', errors: [chipConfigMessage] }])
        message.error(chipConfigMessage)
        focusField(['chipCode'])
        return
      }
      let values: PlannedProjectFormValues
      try {
        values = await form.validateFields()
      } catch (error) {
        const firstErrorField = getFirstErrorField(error)
        if (firstErrorField) focusField(firstErrorField)
        return
      }

      setSubmitting(true)
      const input = {
        ...values,
        projectCode: values.projectCode.trim(),
        productSeries: values.productSeries.trim(),
        marketName: values.marketName.trim(),
        chipCode: values.chipCode.trim(),
        remark: values.remark?.trim() ?? '',
        str5Date: values.str5Date.format('YYYY-MM-DD'),
        launchDate: values.launchDate.format('YYYY-MM-DD'),
        actor: currentUser,
      }
      const comparison = { allRows }
      const result = editingProject
        ? updatePlannedProject(editingProject.id, input, comparison)
        : createPlannedProject(input, comparison)

      if (!result.ok) {
        if (result.reason === 'duplicate') {
          form.setFields([{
            name: 'projectCode',
            errors: ['已存在相同项目：项目名、安卓版本和产品类型均相同，请修改后再保存'],
          }])
          focusField(['projectCode'])
          return
        }
        if (result.reason === 'invalid') {
          form.setFields(Object.entries(result.errors).map(([name, error]) => ({
            name: name as keyof PlannedProjectFormValues,
            errors: [error],
          })))
          const firstInvalidField = Object.keys(result.errors)[0]
          if (firstInvalidField) focusField([firstInvalidField])
          return
        }
        message.error('待规划项目不存在，请刷新后重试')
        return
      }
      message.success(editingProject ? '待规划项目已更新' : '待规划项目已创建')
      onChanged?.()
      clearDraftAndClose()
    } finally {
      setSubmitting(false)
      submitLockRef.current = false
    }
  }

  const clearDraftAndClose = () => {
    dirtyRef.current = false
    form.resetFields()
    onCancel()
  }

  const requestClose = () => {
    if (submitLockRef.current || submitting || discardConfirmOpenRef.current) return
    const hasTouchedDraft = dirtyRef.current && form.isFieldsTouched()
    if (!hasTouchedDraft) {
      clearDraftAndClose()
      return
    }
    discardConfirmOpenRef.current = true
    Modal.confirm({
      title: '放弃未保存的修改？',
      content: '当前表单内容尚未保存，放弃后本次修改将不会保留。',
      okText: '放弃修改',
      cancelText: '继续编辑',
      okButtonProps: { danger: true },
      onOk: () => {
        clearDraftAndClose()
      },
      afterClose: () => {
        discardConfirmOpenRef.current = false
      },
    })
  }

  const handleDelete = () => {
    if (!canEdit || !editingProject) return
    onDeletePlannedProject(editingProject.id)
  }

  return (
    <Modal
      className="pms-modal"
      classNames={{ header: 'pms-glass-surface', body: 'pms-solid-surface', footer: 'pms-glass-surface' }}
      title={editingProject ? '编辑待规划项目' : '创建待规划项目'}
      open={open}
      onCancel={requestClose}
      width={960}
      forceRender
      destroyOnHidden
      mask={{ closable: false }}
      styles={{ body: { maxHeight: '68vh', overflowY: 'auto', paddingInlineEnd: 8 } }}
      footer={(
        <Flex justify="space-between" align="center" gap={16} wrap>
          <div>
            {editingProject && canEdit ? (
              <Button danger onClick={handleDelete} disabled={submitting}>
                删除待规划项目
              </Button>
            ) : null}
          </div>
          <Flex gap={8}>
            <Button onClick={requestClose}>取消</Button>
            {canEdit ? (
              <Button
                type="primary"
                onClick={handleSubmit}
                loading={submitting}
                disabled={!enumReady || (!hasActiveChipCodes && !preservesHistoricalChipCode) || duplicateExists || submitting}
              >
                {editingProject ? '保存修改' : '创建项目'}
              </Button>
            ) : null}
          </Flex>
        </Flex>
      )}
    >
      <Form
        className="pms-roadmap-overlay-body pms-solid-surface"
        form={form}
        layout="vertical"
        preserve={false}
        disabled={!canEdit || !enumReady}
        requiredMark
        onValuesChange={() => {
          dirtyRef.current = true
        }}
      >
        <Flex vertical gap={16}>
          {!hasHydrated ? <Skeleton active paragraph={{ rows: 4 }} /> : hydrationError ? (
            <Alert
              type="error"
              showIcon
              message="加载枚举配置失败"
              description={hydrationError}
              action={<Button size="small" onClick={() => void retryHydration()}>重试</Button>}
            />
          ) : null}
          {enumReady && !hasActiveChipCodes ? (
            <Alert
              type="warning"
              showIcon
              message="暂无可用芯片编码"
              description={preservesHistoricalChipCode
                ? '可保留当前历史芯片编码并修改其他字段；新建或更换芯片编码前需先完善配置。'
                : '请先在配置中心维护芯片编码后再保存。'}
            />
          ) : null}
          <Card size="small" title="项目分类与识别" style={sectionStyle}>
            <Row gutter={[16, 0]}>
              <Col xs={24} md={8}>
                <Form.Item label="项目分类">
                  <Input value={PROJECT_CATEGORY_MACHINE} disabled />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="项目二级分类" name="machineProjectType" rules={[{ required: true, message: '请选择项目二级分类' }]}>
                  <Select
                    options={PROJECT_SECONDARY_CATEGORIES[PROJECT_CATEGORY_MACHINE].map(value => ({ label: value, value }))}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="项目名" name="projectCode" rules={[{ required: true, whitespace: true, message: '请输入项目名' }]}>
                  <Input placeholder="例如 X6877" maxLength={80} autoComplete="off" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="安卓版本" name="androidVersion" rules={[{ required: true, message: '请选择安卓版本' }]}>
                  <Select options={ANDROID_VERSIONS.map(value => ({ label: value, value }))} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="产品类型" name="productType" rules={[{ required: true, message: '请选择产品类型' }]}>
                  <Select options={PRODUCT_TYPES.map(value => ({ label: value, value }))} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="tOS 版本" name="firstSaleTosVersionId" rules={[{ required: true, message: '请选择 tOS 版本' }]}>
                  <Select
                    placeholder="请选择版本"
                    options={tosVersionOptions}
                  />
                </Form.Item>
                {hasInactiveTosVersion ? (
                  <Alert
                    type="warning"
                    showIcon
                    title={`${formatRoadmapTosValue(editingProject?.firstSaleTosVersionId)}（已停用）`}
                    description="当前历史值仅用于显示；重新选择时只能使用配置中心仍启用的 tOS 版本。"
                  />
                ) : null}
              </Col>
            </Row>
            {projectCode.trim() ? (
              <div aria-live="polite">
                <Flex justify="space-between" align="center" gap={8} style={{ marginBottom: 8 }}>
                  <strong>历史同名项目</strong>
                  <span style={{ color: 'var(--text-secondary)' }}>{historyMatches.length} 条</span>
                </Flex>
                <Table<RoadmapProjectRow>
                  className="pms-table"
                  size="small"
                  rowKey={row => `${row.source}:${row.id}`}
                  columns={historyColumns}
                  dataSource={historyMatches}
                  pagination={false}
                  locale={{ emptyText: '未找到历史同名项目' }}
                  scroll={{ x: 560 }}
                />
                {duplicateExists ? (
                  <Alert
                    style={{ marginTop: 8 }}
                    type="error"
                    showIcon
                    message="已存在相同项目"
                    description="项目名、安卓版本和产品类型均相同，不能重复创建或保存。"
                  />
                ) : null}
              </div>
            ) : null}
          </Card>

          <Card size="small" title="产品与版本" style={sectionStyle}>
            <Row gutter={[16, 0]}>
              <Col xs={24} md={8}>
                <Form.Item label="品牌" name="brand" rules={[{ required: true, message: '请选择品牌' }]}>
                  <Select
                    placeholder="请选择品牌"
                    onChange={handleBrandChange}
                    options={BRANDS.map(value => ({ label: value, value }))}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="产品线" name="productLine" rules={[{ required: true, message: '请选择产品线' }]}>
                  <Select
                    placeholder={brand ? '请选择产品线' : '请先选择品牌'}
                    options={productLineOptions.map(value => ({ label: value, value }))}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="产品系列" name="productSeries" rules={[{ required: true, whitespace: true, message: '请输入产品系列' }]}>
                  <Select showSearch optionFilterProp="label" placeholder="请选择产品系列" options={productSeriesOptions} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="市场名" name="marketName" rules={[{ required: true, whitespace: true, message: '请输入市场名' }]}>
                  <Input placeholder="请输入市场名" maxLength={80} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  label="芯片编码"
                  name="chipCode"
                  getValueProps={() => ({ value: selectedChipOptionId })}
                  getValueFromEvent={(rowId: string) => resolveChipRow(rowsByType, rowId)?.chipCode || ''}
                  rules={[{ required: true, message: '请选择芯片编码' }]}
                >
                  <Select
                    showSearch
                    optionFilterProp="label"
                    options={chipOptions}
                    placeholder={hasActiveChipCodes ? '请选择芯片编码' : '请先在配置中心维护芯片编码'}
                  />
                </Form.Item>
                {hasInactiveChipCode ? (
                  <Alert
                    type="warning"
                    showIcon
                    title={`${editingProject?.chipCode}（已停用）`}
                    description="当前历史值仅用于展示；重新选择时只能使用配置中心仍启用的芯片编码。"
                  />
                ) : null}
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="起步 RAM" name="startRam" rules={[{ required: true, message: '请选择起步 RAM' }]}>
                  <Select options={ramOptions} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="版本类型" name="versionType" rules={[{ required: true, message: '请选择版本类型' }]}>
                  <Select options={versionTypeOptions} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="开发模式" name="developMode" rules={[{ required: true, message: '请选择开发模式' }]}>
                  <Select options={developModeOptions} />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          <Card size="small" title="时间与备注" style={sectionStyle}>
            <Row gutter={[16, 0]}>
              <Col xs={24} md={8}>
                <Form.Item label="STR5 时间" required>
                  <Flex align="center" gap={8} wrap={false}>
                    <Form.Item name="str5Date" noStyle rules={[{ required: true, message: '请选择 STR5 时间' }]}>
                      <DatePicker format="YYYY-MM-DD" style={{ flex: 1, minWidth: 0 }} placeholder="请选择具体日期" />
                    </Form.Item>
                    <Form.Item name="str5Estimated" valuePropName="checked" noStyle>
                      <Checkbox>预估</Checkbox>
                    </Form.Item>
                  </Flex>
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="上市时间" required>
                  <Flex align="center" gap={8} wrap={false}>
                    <Form.Item name="launchDate" noStyle rules={[{ required: true, message: '请选择上市时间' }]}>
                      <DatePicker format="YYYY-MM-DD" style={{ flex: 1, minWidth: 0 }} placeholder="请选择具体日期" />
                    </Form.Item>
                    <Form.Item name="launchEstimated" valuePropName="checked" noStyle>
                      <Checkbox>预估</Checkbox>
                    </Form.Item>
                  </Flex>
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item label="备注" name="remark">
                  <Input.TextArea placeholder="可补充规划背景或风险" rows={3} maxLength={500} showCount />
                </Form.Item>
              </Col>
            </Row>
          </Card>
        </Flex>
      </Form>
    </Modal>
  )
}
