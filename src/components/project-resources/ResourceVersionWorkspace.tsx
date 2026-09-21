'use client'
import { useEffect, useState } from 'react'
import { Alert, App, Button, Empty, Popconfirm, Space, Tabs, Tooltip } from 'antd'
import { FlagFilled, FlagOutlined, HistoryOutlined, DeleteOutlined, DownloadOutlined, LockOutlined, PlusOutlined, UnlockOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { ProjectItem } from '@/types/app'
import type { HrProjectCategory } from '@/lib/hrFormalProjectSource'
import { canCreateHrVersion, isHrVersionEditable } from '@/lib/hrVersionRules'
import { canResourceAction, getHrAllowedBudgetTypes, isHrVersionVisible, type ResourcePermissionAction } from '@/lib/hrProjectRegistry'
import { getProjectAttribute } from '@/types/projectRegistry'
import { useProjectStore } from '@/stores/project'
import { usePermissionStore } from '@/stores/permission'
import { useUiStore } from '@/stores/ui'
import { BUDGET_TYPE_LABELS, formatPersonMonth } from '@/constants/hrMachine'
import { chooseResourceVersion, type ResourceBudgetType } from '@/components/project-resources/resourceVersionViewData'
import { resourceStore, useResourceStore, resourceProjectName, type ResourceProject, type ResourceVersion, type ResourceStoreView } from '@/components/project-resources/resourceVersionAdapter'
import HrSourceLink from '@/components/project-resources/HrSourceLink'
import ResourceVersionViews from '@/components/project-resources/ResourceVersionViews'
import ResourceInlineDetail from '@/components/project-resources/ResourceInlineDetail'
import { ResourceVersionCreateDialog, ResourceOperationLogDialog } from '@/components/project-resources/ResourceVersionDialogs'
import { exportResourceVersion } from '@/components/project-resources/exportResourceVersion'

export default function ResourceVersionWorkspace({ project, category, budgetType, initialVersionId }: {
  project: ProjectItem; category: HrProjectCategory; budgetType: ResourceBudgetType; initialVersionId?: string
}) {
  const { message } = App.useApp()
  const store = useResourceStore(category)
  useProjectStore(state => state.currentLoginUser)
  const boundFormalProject = useProjectStore(state => getProjectAttribute(project) === 'budget'
    ? state.projects.find(item => item.id === project.boundFormalProjectId && getProjectAttribute(item) === 'formal') : undefined)
  usePermissionStore()
  const [createSource, setCreateSource] = useState<string | null>(null)
  const [logFilter, setLogFilter] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | undefined>(initialVersionId)
  useEffect(() => { resourceStore(category).getState().refreshFormalProjects() }, [category, project.id])
  const own = store.projects.find(item => item.pmsProjectId === project.id)
  const visibleProjects = store.projects.filter(item => isHrVersionVisible(item, budgetType, project.id))
  const versions = visibleProjects.flatMap(item => item.versions.filter(version => version.budgetType === budgetType)).sort((a, b) => b.minorVersion - a.minorVersion)
  const version = chooseResourceVersion(versions, selectedId)
  const owner = visibleProjects.find(item => item.versions.some(value => value.id === version?.id))
  const canCreate = canResourceAction(own, 'createVersion', project.id) && canCreateHrVersion(own, budgetType)
  const canLock = canResourceAction(owner, 'lockVersion', project.id)
  const canSetOfficial = canResourceAction(owner, 'setOfficialVersion', project.id)
  const canDelete = canResourceAction(owner, 'deleteVersion', project.id) && version?.lockState !== 'locked'
  const canExport = canResourceAction(owner, 'export', project.id)
  const canEdit = (action: 'laborEdit' | 'nonLaborEdit' | 'createVersion') => canResourceAction(owner, action, project.id) && isHrVersionEditable(owner, version, action)
  const linked = owner && owner.pmsProjectId !== project.id
  const allowed = getHrAllowedBudgetTypes(own).includes(budgetType)
  const guard = (action: () => void) => useUiStore.getState().navigateWithEditGuard(action, false)
  const create = () => guard(() => {
    const current = resourceStore(category).getState().projects.find(item => item.pmsProjectId === project.id)
    if (!canResourceAction(current, 'createVersion', project.id) || !canCreateHrVersion(current, budgetType)) {
      message.warning('当前项目新建版本权限已变化')
      return
    }
    setCreateSource('')
  })
  const openLogs = () => guard(() => {
    if (!canResourceAction({ pmsProjectId: project.id }, 'view', project.id)) {
      message.warning('当前项目资源查看权限已变化')
      return
    }
    setLogFilter('all')
  })
  const act = (action: ResourcePermissionAction, callback: (state: ResourceStoreView, currentOwner: ResourceProject, currentVersion: ResourceVersion) => void) => guard(() => {
    try {
      const state = resourceStore(category).getState()
      const currentOwner = state.projects.find(item => item.id === owner?.id)
      const currentVersion = currentOwner?.versions.find(item => item.id === version?.id && item.budgetType === budgetType)
      if (!currentOwner || !currentVersion || !isHrVersionVisible(currentOwner, budgetType, project.id) || !canResourceAction(currentOwner, action, project.id)) throw new Error('当前版本或操作权限已变化')
      if (action === 'deleteVersion' && currentVersion.lockState === 'locked') throw new Error('已锁定版本不能删除')
      callback(state, currentOwner, currentVersion)
    } catch (error) { message.warning(error instanceof Error ? error.message : '操作失败') }
  })
  const logs = visibleProjects.flatMap(item => {
    const saved = item.resourceOperationLogs ?? []
    return [...saved, ...item.versions.filter(value => !saved.some(log => log.versionId === value.id && /创建|复制/.test(log.action))).map(value => ({
      id: `created-${value.id}`, versionId: value.id, versionNumber: value.versionNumber, budgetType: value.budgetType,
      operator: value.createdBy || '未知', timestamp: value.createdAt, action: '创建版本', changes: [{ field: '版本号', before: '', after: value.versionNumber }],
    }))]
  }).filter(log => log.budgetType === budgetType)
  const label = BUDGET_TYPE_LABELS[budgetType]
  return <div className="pms-resource-workspace">

    <Tabs className="pms-resource-version-tabs" type="card" tabBarExtraContent={<Space size={6}><Tooltip title="查看操作日志"><Button aria-label="查看操作日志" icon={<HistoryOutlined />} onClick={openLogs} /></Tooltip>{canCreate && <Button icon={<PlusOutlined />} type="primary" onClick={create}>新建版本</Button>}</Space>} activeKey={version?.id} onChange={id => guard(() => setSelectedId(id))}
      items={versions.map(item => ({ key: item.id, label: <Space size={6}><span>{item.versionNumber}</span>{item.isActive && <Tooltip title="正式版本"><FlagFilled aria-label="正式版本" className="pms-resource-version-active-icon" /></Tooltip>}<Tooltip title={item.lockState === 'locked' ? '已锁定' : '未锁定'}>{item.lockState === 'locked' ? <LockOutlined aria-label="已锁定" /> : <UnlockOutlined aria-label="未锁定" />}</Tooltip></Space> }))} />
    {linked && <Alert showIcon type="info" title={<Space wrap><span>来源：</span><HrSourceLink project={owner} name={resourceProjectName(owner)} /><span>关联年度预算只读</span></Space>} />}
    {getProjectAttribute(project) === 'budget' && project.boundFormalProjectId && <Alert type="info" showIcon title="已绑定正式项目，当前预算只读；解绑后可新增或修改预算。" />}
    {version && owner ? <>
      <div className="pms-resource-version-context"><div className="pms-resource-section-head">
        <div className="pms-resource-version-meta"><span>预估投入 <strong>{formatPersonMonth(version.estimatedInvestment)}</strong> 人月</span>
          <span>创建人 {version.createdBy || '-'}</span><span>创建时间 {dayjs(version.createdAt).isValid() ? dayjs(version.createdAt).format('YYYY-MM-DD HH:mm') : '-'}</span>
          {boundFormalProject && <div className="pms-resource-bound-project"><span>绑定正式项目</span><HrSourceLink project={{ pmsProjectId: boundFormalProject.id }} name={boundFormalProject.name} /></div>}
          {version.copiedFromVersionNumber && <span>复制自 {version.copiedFromVersionNumber}</span>}
        </div><Space key={`${version.id}-${version.lockState}-${version.isActive}`} size={4} wrap>
          {canLock && <Tooltip title={version.lockState === 'locked' ? '解锁' : '锁定'}><Button type="text" aria-label={version.lockState === 'locked' ? '解锁' : '锁定'} icon={version.lockState === 'locked' ? <UnlockOutlined /> : <LockOutlined />} onClick={() => act('lockVersion', (state, currentOwner, currentVersion) => state.setVersionLocked(currentOwner.id, currentVersion.id, currentVersion.lockState !== 'locked'))} /></Tooltip>}
          {canSetOfficial && <Tooltip title={version.isActive ? '取消设置为正式版本' : '设置为正式版本'}><Button type="text" aria-label={version.isActive ? '取消设置为正式版本' : '设置为正式版本'} icon={version.isActive ? <FlagFilled /> : <FlagOutlined />} onClick={() => act('setOfficialVersion', (state, currentOwner, currentVersion) => state.setVersionActive(currentOwner.id, currentVersion.id, !currentVersion.isActive))} /></Tooltip>}
          <Tooltip title="版本操作日志"><Button type="text" aria-label="版本操作日志" icon={<HistoryOutlined />} onClick={() => act('view', (_state, _owner, currentVersion) => setLogFilter(currentVersion.id))} /></Tooltip>
          {canExport && <Tooltip title="导出版本"><Button type="text" aria-label="导出版本" icon={<DownloadOutlined />} onClick={() => act('export', (state, currentOwner, currentVersion) => exportResourceVersion(resourceProjectName(currentOwner), currentVersion, state.monthlyInvestments, '元'))} /></Tooltip>}
          {canDelete && <Popconfirm title={`删除 ${version.versionNumber}？`} description="删除后无法恢复该版本及其月度投入。" okText="删除" cancelText="取消" onConfirm={() => act('deleteVersion', (state, currentOwner, currentVersion) => state.deleteVersion(currentOwner.id, currentVersion.id))}><Tooltip title="删除"><Button type="text" danger aria-label="删除" icon={<DeleteOutlined />} /></Tooltip></Popconfirm>}
        </Space></div>

      </div>
      <ResourceInlineDetail key={`detail-${version.id}`} category={category} project={owner} version={version} scopeId={project.id} laborReadOnly={!canEdit('laborEdit')} nonLaborReadOnly={!canEdit('nonLaborEdit')} setupReadOnly={!canEdit('createVersion')} />
      <ResourceVersionViews key={`monthly-${version.id}`} category={category} version={version} rows={store.monthlyInvestments} readOnly={!canEdit('laborEdit')} onSaveMonth={(rowId, month, value) => resourceStore(category).getState().updateResourceMonthlyInvestment(owner.id, version.id, rowId, month, value, project.id)} />
    </> : <div className="pms-resource-placeholder"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={!allowed ? budgetType === 'annual' ? '暂无关联的年度预算' : '该项目属性不支持此预算类型' : `暂无${label}版本`}>
      {canCreate && <Button type="primary" onClick={create}>创建第一个版本</Button>}
    </Empty></div>}
    {createSource !== null && own && <ResourceVersionCreateDialog versions={versions.filter(item => own.versions.some(ownVersion => ownVersion.id === item.id))} sourceId={createSource || undefined} onCancel={() => setCreateSource(null)} onCreate={options => {
      const id = resourceStore(category).getState().createResourceVersion(own.id, budgetType, project.id, { ...options, sourceVersionId: options.sourceVersionId || undefined })
      setSelectedId(id); setCreateSource(null); message.success('版本已创建，可直接填写')
    }} />}
    {logFilter !== null && <ResourceOperationLogDialog logs={logs} budgetLabel={label} versionId={logFilter === 'all' ? undefined : logFilter} onCancel={() => setLogFilter(null)} />}
  </div>
}
