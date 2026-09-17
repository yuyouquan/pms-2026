'use client'
import { useEffect, useState } from 'react'
import { Alert, App, Button, Empty, Popconfirm, Select, Space, Tag } from 'antd'
import { CopyOutlined, DownloadOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
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
import { exportResourceVersion } from '@/components/project-resources/exportResourceVersion'
import MachineNew from '@/components/hr-machine/NewVersionModal'
import MachineDetail from '@/components/hr-machine/MachineVersionDetailModal'
import TosNew from '@/components/hr-tos/NewVersionModal'
import TosDetail from '@/components/hr-tos/VersionDetailModal'
import TechnicalNew from '@/components/hr-technical/NewVersionModal'
import TechnicalDetail from '@/components/hr-technical/VersionDetailModal'
import CapabilityNew from '@/components/hr-capability/NewVersionModal'
import CapabilityDetail from '@/components/hr-capability/VersionDetailModal'

export default function ResourceVersionWorkspace({ project, category, budgetType }: {
  project: ProjectItem; category: HrProjectCategory; budgetType: ResourceBudgetType
}) {
  const { message } = App.useApp()
  const store = useResourceStore(category)
  useProjectStore(state => state.currentLoginUser)
  usePermissionStore()
  const [selectedId, setSelectedId] = useState<string>()
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view')
  const editing = mode !== 'view'
  useEffect(() => { resourceStore(category).getState().refreshFormalProjects() }, [category, project.id])
  useEffect(() => {
    useUiStore.getState().setIsEditMode(editing)
    return () => { useUiStore.getState().setIsEditMode(false) }
  }, [editing])
  const own = store.projects.find(item => item.pmsProjectId === project.id)
  const visibleProjects = store.projects.filter(item => isHrVersionVisible(item, budgetType, project.id))
  const versions = visibleProjects.flatMap(item => item.versions.filter(version => version.budgetType === budgetType))
    .sort((a, b) => b.minorVersion - a.minorVersion)
  const version = chooseResourceVersion(versions, selectedId)
  const owner = visibleProjects.find(item => item.versions.some(value => value.id === version?.id))
  const canCreate = canCreateHrVersion(own, budgetType)
  const canManage = canEditHrInScope(owner, project.id)
  const canEdit = canManage && isHrVersionEditable(owner, version)
  const active = owner && getActiveHrVersion<ResourceVersion>(owner.versions, budgetType)
  const linked = owner && owner.pmsProjectId !== project.id
  const allowed = getHrAllowedBudgetTypes(own).includes(budgetType)
  const guard = (action: () => void) => useUiStore.getState().navigateWithEditGuard(action, false)
  const finish = () => { setMode('view'); useUiStore.getState().setIsEditMode(false) }
  const saved = () => {
    if (mode === 'create') {
      const current = resourceStore(category).getState().projects.find(item => item.id === own?.id)
      setSelectedId(chooseResourceVersion(current?.versions.filter(item => item.budgetType === budgetType) ?? [])?.id)
    }
    finish()
  }
  const copy = () => {
    if (!owner || !version || !canCreate || !canManage) return
    const before = new Set(owner.versions.map(item => item.id))
    store.copyVersion(owner.id, version.id)
    const created = resourceStore(category).getState().projects.find(item => item.id === owner.id)?.versions.find(item => !before.has(item.id))
    if (created) { setSelectedId(created.id); message.success(`已复制为 ${created.versionNumber}`) }
  }
  const formProps = { open: true, embedded: true, fixedBudgetType: budgetType, onSaved: saved, onCancel: () => guard(finish) }
  const detailProps = { open: true, embedded: true, projectId: owner?.id ?? '', versionId: version?.id ?? null,
    readOnly: mode !== 'edit' || !canEdit, onSaved: saved, onCancel: () => guard(finish) }
  const label = BUDGET_TYPE_LABELS[budgetType]
  return <div className="pms-resource-workspace">
    <div className="pms-resource-version-toolbar">
      <div className="pms-resource-version-select"><h2>{label}</h2>
        <Select aria-label={`${label}版本`} placeholder="暂无版本" value={version?.id} style={{ width: 310, maxWidth: '100%' }}
          onChange={id => guard(() => { finish(); setSelectedId(id) })}
          options={versions.map(item => ({ value: item.id, label: `${item.versionNumber}${item.isActive ? ' · 已激活' : ''}${item.lockState === 'locked' ? ' · 已锁定' : ''}` }))} />
        <span className="pms-resource-caption">共 {versions.length} 个版本</span>
      </div>
      {canCreate && <Button icon={<PlusOutlined />} type="primary" disabled={editing} onClick={() => setMode('create')}>新建版本</Button>}
    </div>
    {linked && <Alert showIcon type="info" title={<Space wrap><span>来源：</span><HrSourceLink project={owner} name={resourceProjectName(owner)} /><span>关联年度预算只读</span></Space>} />}
    {getProjectAttribute(project) === 'budget' && project.boundFormalProjectId && <Alert type="info" showIcon title="已绑定正式项目，当前预算只读；解绑后可新增或修改预算。" />}
    {mode === 'create' && own ? <div key={`create-${budgetType}`}>
      {category === 'machine' ? <MachineNew {...formProps} projectId={own.id} />
        : category === 'tos' ? <TosNew {...formProps} projectId={own.id} />
          : category === 'technical' ? <TechnicalNew {...formProps} projectId={own.id} /> : <CapabilityNew {...formProps} />}
    </div> : version && owner ? <>
      <div className="pms-resource-version-context">
        <div className="pms-resource-section-head"><div className="pms-resource-version-title"><h3>{version.versionNumber}</h3>
          <Tag color={version.isActive ? 'green' : 'default'}>{version.isActive ? '已激活' : '未激活'}</Tag>
          <Tag color={version.lockState === 'locked' ? 'gold' : 'default'}>{version.lockState === 'locked' ? '已锁定' : '未锁定'}</Tag>
        </div><Space wrap>
          {canEdit && <Button icon={<EditOutlined />} disabled={editing} onClick={() => setMode('edit')}>编辑版本</Button>}
          {canManage && canCreate && <Button icon={<CopyOutlined />} disabled={editing} onClick={copy}>复制为新版本</Button>}
          {canManage && <Button disabled={editing} onClick={() => store.setVersionLocked(owner.id, version.id, version.lockState !== 'locked')}>{version.lockState === 'locked' ? '解锁' : '锁定'}</Button>}
          {canManage && <Button disabled={editing} onClick={() => store.setVersionActive(owner.id, version.id, !version.isActive)}>{version.isActive ? '取消激活' : '激活'}</Button>}
          <Button icon={<DownloadOutlined />} disabled={editing} onClick={() => exportResourceVersion(resourceProjectName(owner), version, store.monthlyInvestments)}>导出版本</Button>
          {canEdit && <Popconfirm title={`删除 ${version.versionNumber}？`} description="删除后无法恢复该版本及其月度投入。" okText="删除" cancelText="取消"
            onConfirm={() => store.deleteVersion(owner.id, version.id)}><Button danger disabled={editing}>删除</Button></Popconfirm>}
        </Space></div>
        <div className="pms-resource-version-meta">
          <span>预估投入 <strong>{formatPersonMonth(version.estimatedInvestment)}</strong> 人月</span>
          <span>批次 {canEdit ? <Select aria-label="版本批次" size="small" allowClear placeholder="未设置" value={version.batch ?? undefined} options={HR_BATCH_OPTIONS}
            disabled={editing} style={{ width: 104 }} onChange={batch => store.updateVersion(owner.id, version.id, { batch: batch ?? null })} /> : formatHrBatch(version.batch)}</span>
          <span>创建人 {version.createdBy || '-'}</span><span>创建时间 {dayjs(version.createdAt).isValid() ? dayjs(version.createdAt).format('YYYY-MM-DD HH:mm') : '-'}</span>
          {version.copiedFromVersionNumber && <span>复制自 {version.copiedFromVersionNumber}</span>}
        </div>
        <p className="pms-resource-caption">{active ? `当前汇总使用 ${active.versionNumber}；切换查看不会改变激活版本。` : '当前没有激活版本，本预算类型暂不参与汇总。'}{version.lockState === 'locked' ? ' 已锁定版本的全部内容保持只读。' : ''}</p>
      </div>
      <div key={`${version.id}-${mode}`}>
        {category === 'machine' ? mode === 'edit' && canEdit ? <MachineNew {...formProps} projectId={owner.id} versionId={version.id} /> : <MachineDetail open embedded versionId={version.id} onCancel={finish} />
          : category === 'tos' ? <TosDetail {...detailProps} /> : category === 'technical' ? <TechnicalDetail {...detailProps} /> : <CapabilityDetail {...detailProps} />}
      </div>
      {!editing && <ResourceVersionViews key={version.id} category={category} version={version} rows={store.monthlyInvestments} />}
    </> : <div className="pms-resource-placeholder"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={!allowed ? budgetType === 'annual' ? '暂无关联的年度预算' : '该项目属性不支持此预算类型' : `暂无${label}版本`}>
      {canCreate && <Button type="primary" onClick={() => setMode('create')}>创建第一个版本</Button>}
    </Empty></div>}
  </div>
}
