'use client'
import { useEffect, useState } from 'react'
import { Alert, App, Button, Empty, Popconfirm, Select, Space, Tabs, Tag, Tooltip } from 'antd'
import { CheckCircleOutlined, CopyOutlined, DeleteOutlined, DownloadOutlined, LockOutlined, PlusOutlined, StopOutlined, UnlockOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { ProjectItem } from '@/types/app'
import type { HrProjectCategory } from '@/lib/hrFormalProjectSource'
import { canCreateHrVersion, getActiveHrVersion, HR_BATCH_OPTIONS, isHrVersionEditable, formatHrBatch } from '@/lib/hrVersionRules'
import { canEditHrInScope, getHrAllowedBudgetTypes, isHrVersionVisible } from '@/lib/hrProjectRegistry'
import { getProjectAttribute } from '@/types/projectRegistry'
import { useProjectStore } from '@/stores/project'
import { usePermissionStore } from '@/stores/permission'
import { useUiStore } from '@/stores/ui'
import { BUDGET_TYPE_LABELS, formatPersonMonth } from '@/constants/hrMachine'
import { chooseResourceVersion, type ResourceBudgetType } from '@/components/project-resources/resourceVersionViewData'
import { resourceStore, useResourceStore, resourceProjectName, type ResourceVersion } from '@/components/project-resources/resourceVersionAdapter'
import HrSourceLink from '@/components/project-resources/HrSourceLink'
import ResourceVersionViews from '@/components/project-resources/ResourceVersionViews'
import ResourceInlineDetail from '@/components/project-resources/ResourceInlineDetail'
import ResourceInlineField from '@/components/project-resources/ResourceInlineField'
import { exportResourceVersion } from '@/components/project-resources/exportResourceVersion'

export default function ResourceVersionWorkspace({ project, category, budgetType }: {
  project: ProjectItem; category: HrProjectCategory; budgetType: ResourceBudgetType
}) {
  const { message } = App.useApp()
  const store = useResourceStore(category)
  useProjectStore(state => state.currentLoginUser)
  usePermissionStore()
  const [selectedId, setSelectedId] = useState<string>()
  useEffect(() => { resourceStore(category).getState().refreshFormalProjects() }, [category, project.id])
  const own = store.projects.find(item => item.pmsProjectId === project.id)
  const visibleProjects = store.projects.filter(item => isHrVersionVisible(item, budgetType, project.id))
  const versions = visibleProjects.flatMap(item => item.versions.filter(version => version.budgetType === budgetType)).sort((a, b) => b.minorVersion - a.minorVersion)
  const version = chooseResourceVersion(versions, selectedId)
  const owner = visibleProjects.find(item => item.versions.some(value => value.id === version?.id))
  const canCreate = canCreateHrVersion(own, budgetType)
  const canManage = canEditHrInScope(owner, project.id)
  const canEdit = canManage && isHrVersionEditable(owner, version)
  const active = owner && getActiveHrVersion<ResourceVersion>(owner.versions, budgetType)
  const linked = owner && owner.pmsProjectId !== project.id
  const allowed = getHrAllowedBudgetTypes(own).includes(budgetType)
  const guard = (action: () => void) => useUiStore.getState().navigateWithEditGuard(action, false)
  const create = () => guard(() => {
    if (!own || !canCreate) return
    try { setSelectedId(store.createVersionInline(own.id, budgetType, project.id)); message.success('版本已创建，可直接填写') }
    catch (error) { message.warning(error instanceof Error ? error.message : '版本创建失败') }
  })
  const copy = () => guard(() => {
    if (!owner || !version || !canCreate || !canManage) return
    const before = new Set(owner.versions.map(item => item.id))
    store.copyVersion(owner.id, version.id)
    const created = resourceStore(category).getState().projects.find(item => item.id === owner.id)?.versions.find(item => !before.has(item.id))
    if (created) { setSelectedId(created.id); message.success(`已复制为 ${created.versionNumber}`) }
  })
  const label = BUDGET_TYPE_LABELS[budgetType]
  return <div className="pms-resource-workspace">
    <div className="pms-resource-version-toolbar"><h2>{label}</h2>{canCreate && <Button icon={<PlusOutlined />} type="primary" onClick={create}>新建版本</Button>}</div>
    {versions.length > 0 && <Tabs className="pms-resource-version-tabs" type="card" activeKey={version?.id} onChange={id => guard(() => setSelectedId(id))}
      items={versions.map(item => ({ key: item.id, label: <Space size={6}><span>{item.versionNumber}</span><Tag color={item.isActive ? 'green' : 'default'}>{item.isActive ? '已激活' : '未激活'}</Tag><Tag color={item.lockState === 'locked' ? 'gold' : 'default'}>{item.lockState === 'locked' ? '已锁定' : '未锁定'}</Tag></Space> }))} />}
    {linked && <Alert showIcon type="info" title={<Space wrap><span>来源：</span><HrSourceLink project={owner} name={resourceProjectName(owner)} /><span>关联年度预算只读</span></Space>} />}
    {getProjectAttribute(project) === 'budget' && project.boundFormalProjectId && <Alert type="info" showIcon title="已绑定正式项目，当前预算只读；解绑后可新增或修改预算。" />}
    {version && owner ? <>
      <div className="pms-resource-version-context"><div className="pms-resource-section-head">
        <div className="pms-resource-version-meta"><span>预估投入 <strong>{formatPersonMonth(version.estimatedInvestment)}</strong> 人月</span>
          <span className="pms-resource-batch-field">批次 <ResourceInlineField key={`${version.id}-batch`} label="版本批次" value={version.batch ?? null} display={version.batch ? formatHrBatch(version.batch) : '待填写'} readOnly={!canEdit}
            onSave={value => store.updateVersionInline(owner.id, version.id, { type: 'batch', value: value == null ? null : Number(value) }, project.id)}
            renderEditor={(value, change, popup) => <Select autoFocus aria-label="版本批次" size="small" allowClear placeholder="未设置" value={value ?? undefined} options={HR_BATCH_OPTIONS} getPopupContainer={popup} style={{ width: 104 }} onChange={value => change(value ?? null)} />} /></span>
          <span>创建人 {version.createdBy || '-'}</span><span>创建时间 {dayjs(version.createdAt).isValid() ? dayjs(version.createdAt).format('YYYY-MM-DD HH:mm') : '-'}</span>
          {version.copiedFromVersionNumber && <span>复制自 {version.copiedFromVersionNumber}</span>}
        </div><Space size={4} wrap>
          {canManage && canCreate && <Tooltip title="复制为新版本"><Button type="text" aria-label="复制为新版本" icon={<CopyOutlined />} onClick={copy} /></Tooltip>}
          {canManage && <Tooltip title={version.lockState === 'locked' ? '解锁' : '锁定'}><Button type="text" aria-label={version.lockState === 'locked' ? '解锁' : '锁定'} icon={version.lockState === 'locked' ? <UnlockOutlined /> : <LockOutlined />} onClick={() => guard(() => store.setVersionLocked(owner.id, version.id, version.lockState !== 'locked'))} /></Tooltip>}
          {canManage && <Tooltip title={version.isActive ? '取消激活' : '激活'}><Button type="text" aria-label={version.isActive ? '取消激活' : '激活'} icon={version.isActive ? <StopOutlined /> : <CheckCircleOutlined />} onClick={() => guard(() => store.setVersionActive(owner.id, version.id, !version.isActive))} /></Tooltip>}
          <Tooltip title="导出版本"><Button type="text" aria-label="导出版本" icon={<DownloadOutlined />} onClick={() => guard(() => exportResourceVersion(resourceProjectName(owner), version, store.monthlyInvestments))} /></Tooltip>
          {canEdit && <Popconfirm title={`删除 ${version.versionNumber}？`} description="删除后无法恢复该版本及其月度投入。" okText="删除" cancelText="取消" onConfirm={() => guard(() => store.deleteVersion(owner.id, version.id))}><Tooltip title="删除"><Button type="text" danger aria-label="删除" icon={<DeleteOutlined />} /></Tooltip></Popconfirm>}
        </Space></div>
        <p className="pms-resource-caption">{active ? `当前汇总使用 ${active.versionNumber}；切换查看不会改变激活版本。` : '当前没有激活版本，本预算类型暂不参与汇总。'}{version.lockState === 'locked' ? ' 已锁定版本的全部内容保持只读。' : ''}</p>
      </div>
      <ResourceInlineDetail key={`detail-${version.id}`} category={category} project={owner} version={version} scopeId={project.id} readOnly={!canEdit} />
      <ResourceVersionViews key={`monthly-${version.id}`} category={category} version={version} rows={store.monthlyInvestments} />
    </> : <div className="pms-resource-placeholder"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={!allowed ? budgetType === 'annual' ? '暂无关联的年度预算' : '该项目属性不支持此预算类型' : `暂无${label}版本`}>
      {canCreate && <Button type="primary" onClick={create}>创建第一个版本</Button>}
    </Empty></div>}
  </div>
}
