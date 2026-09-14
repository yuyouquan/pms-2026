'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { App, Button, Input, Modal, Select, Space, Table, Tag, Tooltip } from 'antd'
import { ClearOutlined, DeleteOutlined, EditOutlined, HistoryOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { PROJECT_TYPES } from '@/constants/projectTypes'
import type { ColumnsType } from 'antd/es/table'
import { resolvePermissionProjectId, usePermissionStore } from '@/stores/permission'
import { useProjectStore } from '@/stores/project'
import { useUiStore } from '@/stores/ui'
import { useActivateProject } from '@/hooks/useActivateProject'
import { canEnterProjectSpace } from '@/lib/projectListFilters'
import {
  canManageProjectRegistry,
  deleteConfiguredProject,
  getBindableFormalProjects,
  getLinkedRegistryProjects,
  updateConfiguredProject,
} from '@/lib/projectRegistry'
import {
  normalizeConfigurationCellValue,
  shouldConfirmConfigurationChange,
  buildProjectRegistryHistoryRows,
  filterConfigurationProjects,
} from '@/lib/projectManagementUi'
import { getProjectAttribute, isFormalProject, PROJECT_ATTRIBUTE_LABELS } from '@/types/projectRegistry'
import type { ProjectItem } from '@/types/app'
import NewProjectModal from '@/components/project-management/NewProjectModal'

type EditableField = 'name' | 'projectCode' | 'boundFormalProjectId'
interface EditingCell {
  projectId: string
  field: EditableField
  original: string | null
  value: string | null
}

export default function ProjectConfiguration() {
  const { message } = App.useApp()
  const [modal, modalContextHolder] = Modal.useModal()
  const projects = useProjectStore(state => state.projects)
  const registryHistory = useProjectStore(state => state.registryHistory)
  const currentLoginUser = useProjectStore(state => state.currentLoginUser)
  const { globalRoles, rolesByProject } = usePermissionStore()
  const {
    enterProjectSpace,
    navigateWithEditGuard,
    projectConfigurationPage,
    setProjectConfigurationPage,
    projectConfigurationFilters: filters,
    setProjectConfigurationFilters: setFilters,
    resetProjectConfigurationFilters: resetFilters,
    setProjectSpaceModule,
  } = useUiStore()
  const activateProject = useActivateProject()
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [historyProjectId, setHistoryProjectId] = useState<string | null>(null)
  const [editing, setEditing] = useState<EditingCell | null>(null)
  const editingRef = useRef<EditingCell | null>(null)
  const confirmingRef = useRef(false)
  const canManage = canManageProjectRegistry(currentLoginUser)
  const isAdmin = globalRoles.some(role => role.name === '管理组' && role.members.includes(currentLoginUser))
  const filteredProjects = useMemo(() => filterConfigurationProjects(projects, filters), [projects, filters])
  const hasFilters = Boolean(filters.name || filters.projectCode || filters.boundFormalProjectName || filters.projectTypes.length || filters.projectAttributes.length)
  const currentPage = Math.min(Math.max(1, projectConfigurationPage), Math.max(1, Math.ceil(filteredProjects.length / 15)))

  useEffect(() => {
    if (projectConfigurationPage !== currentPage) setProjectConfigurationPage(currentPage)
  }, [currentPage, projectConfigurationPage, setProjectConfigurationPage])

  const setCurrentEditing = (next: EditingCell | null) => {
    editingRef.current = next
    setEditing(next)
  }

  const beginEdit = (project: ProjectItem, field: EditableField) => {
    if (!canManage || isFormalProject(project) || confirmingRef.current) return
    const rawValue = project[field]
    setCurrentEditing({
      projectId: project.id,
      field,
      original: typeof rawValue === 'string' ? rawValue : null,
      value: typeof rawValue === 'string' ? rawValue : null,
    })
  }

  const changeEditing = (value: string | null) => {
    const current = editingRef.current
    if (!current) return
    setCurrentEditing({ ...current, value })
  }

  const requestConfirmation = () => {
    const current = editingRef.current
    if (!current || confirmingRef.current) return
    if (!shouldConfirmConfigurationChange(current.original, current.value)) {
      setCurrentEditing(null)
      return
    }
    confirmingRef.current = true
    modal.confirm({
      title: '确认修改',
      content: '确认保存本次修改吗？',
      okText: '确认',
      cancelText: '取消',
      onOk: () => {
        const pending = editingRef.current
        if (!pending) {
          confirmingRef.current = false
          return
        }
        const normalized = normalizeConfigurationCellValue(pending.value)
        const result = updateConfiguredProject(pending.projectId, {
          [pending.field]: pending.field === 'boundFormalProjectId' ? (normalized || null) : normalized,
        }, currentLoginUser)
        confirmingRef.current = false
        if (!result.ok) {
          message.error(result.message)
          return
        }
        setCurrentEditing(null)
        message.success('修改已保存')
      },
      onCancel: () => {
        confirmingRef.current = false
        setCurrentEditing(null)
      },
    })
  }

  const canEnter = (project: ProjectItem) => canEnterProjectSpace(
    resolvePermissionProjectId(project.id),
    currentLoginUser,
    rolesByProject,
    isAdmin,
  )

  const openProject = (project: ProjectItem) => {
    if (editingRef.current) {
      requestConfirmation()
      return
    }
    if (!canEnter(project)) {
      message.warning('当前用户未配置该项目空间角色，无法进入项目空间')
      return
    }
    navigateWithEditGuard(() => {
      activateProject(project)
      setProjectSpaceModule('basic')
      enterProjectSpace({ module: 'projectManagement', projectManagementTab: 'configuration' })
    }, false)
  }

  const confirmDelete = (project: ProjectItem) => {
    const linked = isFormalProject(project) ? getLinkedRegistryProjects(projects, project.id) : []
    modal.confirm({
      title: '确认删除项目',
      content: linked.length
        ? `删除后将解除以下项目的绑定：${linked.map(item => item.name).join('、')}。项目历史仍会保留。`
        : `确认删除“${project.name}”吗？项目历史仍会保留。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => {
        const result = deleteConfiguredProject(project.id, currentLoginUser)
        if (!result.ok) {
          message.error(result.message)
          return
        }
        message.success('项目已删除')
      },
    })
  }

  const renderTextEditor = (project: ProjectItem, field: 'name' | 'projectCode') => {
    const isEditing = editing?.projectId === project.id && editing.field === field
    const value = normalizeConfigurationCellValue(project[field])
    if (isEditing) {
      return (
        <Input
          autoFocus
          className="pms-edit-input"
          value={editing.value ?? ''}
          placeholder={field === 'projectCode' ? '可留空' : undefined}
          onChange={event => changeEditing(event.target.value)}
          onBlur={requestConfirmation}
          onPressEnter={event => event.currentTarget.blur()}
        />
      )
    }
    if (field === 'name') {
      return (
        <div className="pms-project-config__cell-value">
          <Tooltip title={project.name}><Button type="link" className="pms-project-config__name" onClick={() => openProject(project)}>{project.name}</Button></Tooltip>
          {!isFormalProject(project) && canManage ? (
            <Tooltip title="编辑项目名称"><Button type="text" size="small" className="pms-project-config__edit-trigger" aria-label={`编辑${project.name}的项目名称`} icon={<EditOutlined />} onClick={() => beginEdit(project, field)} /></Tooltip>
          ) : null}
        </div>
      )
    }
    return (
      <div className="pms-project-config__cell-value">
        <Tooltip title={value || '—'}>{!isFormalProject(project) && canManage ? (
          <Button
            type="text"
            size="small"
            className="pms-project-config__editable-value"
            aria-label={`编辑${project.name}的项目编码`}
            onClick={() => beginEdit(project, field)}
          >
            {value || '—'}
          </Button>
        ) : <span>{value || '—'}</span>}</Tooltip>
        {!isFormalProject(project) && canManage ? (
          <Tooltip title="编辑项目编码"><Button type="text" size="small" className="pms-project-config__edit-trigger" aria-label={`编辑${project.name}的项目编码`} icon={<EditOutlined />} onClick={() => beginEdit(project, field)} /></Tooltip>
        ) : null}
      </div>
    )
  }

  const columns: ColumnsType<ProjectItem> = [
    { title: '项目名称', dataIndex: 'name', width: 230, fixed: 'left', render: (_, project) => renderTextEditor(project, 'name') },
    { title: '项目类型', dataIndex: 'type', width: 150 },
    { title: '项目属性', dataIndex: 'projectAttribute', width: 110, render: (_, project) => <Tag>{PROJECT_ATTRIBUTE_LABELS[getProjectAttribute(project)]}</Tag> },
    { title: '项目编码', dataIndex: 'projectCode', width: 170, render: (_, project) => renderTextEditor(project, 'projectCode') },
    { title: '创建人', dataIndex: 'createdBy', width: 120, render: value => value || '—' },
    { title: '创建时间', dataIndex: 'createdAt', width: 180, render: value => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—' },
    {
      title: '绑定正式项目', dataIndex: 'boundFormalProjectId', width: 220,
      render: (_, project) => {
        if (isFormalProject(project)) return '—'
        const isEditing = editing?.projectId === project.id && editing.field === 'boundFormalProjectId'
        const boundName = projects.find(item => item.id === project.boundFormalProjectId)?.name
        if (isEditing) {
          return (
            <Select
              autoFocus
              allowClear
              showSearch
              optionFilterProp="label"
              style={{ width: '100%' }}
              value={editing.value || undefined}
              placeholder="选择同类型正式项目"
              options={getBindableFormalProjects(projects, project).map(item => ({ value: item.id, label: item.name }))}
              onChange={value => changeEditing(value ?? null)}
              onBlur={requestConfirmation}
            />
          )
        }
        return (
          <div className="pms-project-config__cell-value">
            <Tooltip title={boundName || '—'}>{canManage ? (
              <Button
                type="text"
                size="small"
                className="pms-project-config__editable-value"
                aria-label={`编辑${project.name}的绑定正式项目`}
                onClick={() => beginEdit(project, 'boundFormalProjectId')}
              >
                {boundName || '—'}
              </Button>
            ) : <span>{boundName || '—'}</span>}</Tooltip>
            {canManage ? (
              <Tooltip title="编辑绑定正式项目"><Button type="text" size="small" className="pms-project-config__edit-trigger" aria-label={`编辑${project.name}的绑定正式项目`} icon={<EditOutlined />} onClick={() => beginEdit(project, 'boundFormalProjectId')} /></Tooltip>
            ) : null}
          </div>
        )
      },
    },
    {
      title: '操作', key: 'actions', width: 130, fixed: 'right',
      render: (_, project) => (
        <Space size={2}>
          <Button type="link" size="small" icon={<HistoryOutlined />} onClick={() => setHistoryProjectId(project.id)}>历史</Button>
          {canManage ? <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => confirmDelete(project)}>删除</Button> : null}
        </Space>
      ),
    },
  ]

  const history = useMemo(
    () => registryHistory.filter(entry => entry.projectId === historyProjectId),
    [historyProjectId, registryHistory],
  )
  const historyRows = useMemo(
    () => buildProjectRegistryHistoryRows(history, projects),
    [history, projects],
  )
  const historyProject = projects.find(project => project.id === historyProjectId)
    ?? history.find(entry => entry.before || entry.after)?.before
    ?? history.find(entry => entry.before || entry.after)?.after

  return (
    <section className="pms-project-config" aria-label="项目配置">
      {modalContextHolder}
      <div className="pms-project-config__toolbar">
        <div>
          <div className="pms-project-config__title">项目配置</div>
          <div className="pms-project-config__description">统一管理正式项目、预算项目与路标项目。</div>
        </div>
        {canManage ? <Button type="primary" icon={<PlusOutlined />} onClick={() => setNewProjectOpen(true)}>新项目</Button> : null}
      </div>
      <div className="pms-project-config__filters" role="search" aria-label="项目配置筛选">
        <div className="pms-project-config__filter">
          <label htmlFor="project-config-name-filter">项目名称</label>
          <Input id="project-config-name-filter" aria-label="筛选项目名称" allowClear prefix={<SearchOutlined />}
            placeholder="模糊搜索项目名称" value={filters.name} onChange={event => setFilters({ name: event.target.value })} />
        </div>
        <div className="pms-project-config__filter">
          <label htmlFor="project-config-type-filter">项目类型</label>
          <Select id="project-config-type-filter" aria-label="筛选项目类型" mode="multiple" allowClear showSearch maxTagCount="responsive"
            placeholder="全部项目类型" value={filters.projectTypes} options={PROJECT_TYPES.map(value => ({ value, label: value }))}
            onChange={projectTypes => setFilters({ projectTypes })} />
        </div>
        <div className="pms-project-config__filter">
          <label htmlFor="project-config-attribute-filter">项目属性</label>
          <Select id="project-config-attribute-filter" aria-label="筛选项目属性" mode="multiple" allowClear showSearch maxTagCount="responsive"
            placeholder="全部项目属性" value={filters.projectAttributes} optionFilterProp="label"
            options={Object.entries(PROJECT_ATTRIBUTE_LABELS).map(([value, label]) => ({ value, label }))}
            onChange={projectAttributes => setFilters({ projectAttributes })} />
        </div>
        <div className="pms-project-config__filter">
          <label htmlFor="project-config-code-filter">项目编码</label>
          <Input id="project-config-code-filter" aria-label="筛选项目编码" allowClear prefix={<SearchOutlined />}
            placeholder="模糊搜索项目编码" value={filters.projectCode} onChange={event => setFilters({ projectCode: event.target.value })} />
        </div>
        <div className="pms-project-config__filter">
          <label htmlFor="project-config-binding-filter">绑定正式项目</label>
          <Input id="project-config-binding-filter" aria-label="筛选绑定正式项目" allowClear prefix={<SearchOutlined />}
            placeholder="模糊搜索正式项目名称" value={filters.boundFormalProjectName} onChange={event => setFilters({ boundFormalProjectName: event.target.value })} />
        </div>
        <Button icon={<ClearOutlined />} disabled={!hasFilters} onClick={resetFilters}>清空筛选</Button>
      </div>
      <Table<ProjectItem>
        className="pms-table"
        rowKey="id"
        columns={columns}
        dataSource={filteredProjects}
        locale={{ emptyText: hasFilters ? '未找到符合条件的项目' : '暂无项目' }}
        scroll={{ x: 1320 }}
        pagination={{
          current: currentPage,
          pageSize: 15,
          showSizeChanger: false,
          total: filteredProjects.length,
          showTotal: total => `共 ${total} 个项目`,
          onChange: setProjectConfigurationPage,
        }}
      />
      <NewProjectModal
        open={newProjectOpen}
        onCancel={() => setNewProjectOpen(false)}
        onCreated={projectId => {
          setNewProjectOpen(false)
          resetFilters()
          const index = useProjectStore.getState().projects.findIndex(project => project.id === projectId)
          setProjectConfigurationPage(Math.floor(Math.max(0, index) / 15) + 1)
        }}
      />
      <Modal
        className="pms-modal"
        title={`${historyProject?.name ?? '项目'} · 历史`}
        open={Boolean(historyProjectId)}
        footer={null}
        width={860}
        onCancel={() => setHistoryProjectId(null)}
      >
        <Table
          rowKey="key"
          size="small"
          pagination={false}
          locale={{ emptyText: '暂无历史记录' }}
          dataSource={historyRows}
          columns={[
            { title: '时间', dataIndex: 'timestamp', width: 180, render: value => new Date(value).toLocaleString('zh-CN', { hour12: false }) },
            { title: '操作人', dataIndex: 'actor', width: 110 },
            { title: '操作', dataIndex: 'action', width: 80 },
            { title: '字段', dataIndex: 'field', width: 130 },
            { title: '修改前', dataIndex: 'before' },
            { title: '修改后', dataIndex: 'after' },
          ]}
        />
      </Modal>
    </section>
  )
}
