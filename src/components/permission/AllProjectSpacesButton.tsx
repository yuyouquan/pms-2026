'use client'

import { useEffect, useState } from 'react'
import { Button, Input, Modal, Table, Tag } from 'antd'
import { ProjectOutlined, SearchOutlined } from '@ant-design/icons'
import { canViewAllProjectSpaces } from '@/lib/allProjectSpaceAccess'
import { useActivateProject } from '@/hooks/useActivateProject'
import { hasAllProjectSpaceView, usePermissionStore } from '@/stores/permission'
import { useProjectStore } from '@/stores/project'
import { useUiStore } from '@/stores/ui'
import { getProjectAttribute, PROJECT_ATTRIBUTE_LABELS } from '@/types/projectRegistry'

/** Dedicated discovery keeps project-list data policies independent of global space viewing. */
export default function AllProjectSpacesButton() {
  const { projects, currentLoginUser } = useProjectStore()
  const model = usePermissionStore(state => state.permissionCenter)
  const allowed = canViewAllProjectSpaces(model, currentLoginUser)
  const activateProject = useActivateProject()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  useEffect(() => { setOpen(false); setSearch('') }, [currentLoginUser, allowed])
  if (!allowed) return null
  const query = search.trim().toLocaleLowerCase()
  const rows = projects.filter(project => [project.name, project.projectCode, project.code, project.type, PROJECT_ATTRIBUTE_LABELS[getProjectAttribute(project)]]
    .some(value => String(value ?? '').toLocaleLowerCase().includes(query)))
  const enter = (id: string) => {
    const actor = currentLoginUser
    useUiStore.getState().navigateWithEditGuard(() => {
      const live = useProjectStore.getState()
      const target = live.projects.find(project => project.id === id)
      if (!target || live.currentLoginUser !== actor || !hasAllProjectSpaceView(actor)) return
      const ui = useUiStore.getState()
      const origin = ui.activeModule === 'projectSpace' ? ui.projectSpaceOrigin ?? { module: 'workbench' as const } : { module: ui.activeModule }
      activateProject(target)
      ui.setIsEditMode(false)
      ui.enterProjectSpace(origin)
      setOpen(false)
    }, false)
  }
  return <>
    <Button className="pms-user-switcher" type="text" icon={<ProjectOutlined />} style={{ color: '#fff' }} onClick={() => { setSearch(''); setOpen(true) }}>所有项目空间</Button>
    <Modal className="pms-modal" title="所有项目空间" open={open} width={760} centered footer={null} onCancel={() => setOpen(false)} styles={{ body: { maxHeight: 'min(540px, calc(100dvh - 180px))', overflowY: 'auto' } }}>
      <Input aria-label="搜索所有项目空间" placeholder="搜索项目名称、编码或类型" prefix={<SearchOutlined />} value={search} onChange={event => setSearch(event.target.value)} allowClear style={{ marginBottom: 12 }} />
      <Table className="pms-table" size="small" rowKey="id" dataSource={rows} pagination={{ pageSize: 8, showSizeChanger: false, hideOnSinglePage: true, showTotal: total => `共 ${total} 个项目` }} columns={[
        { title: '项目名称', key: 'name', render: (_, project) => <Button type="link" onClick={() => enter(project.id)} style={{ padding: 0, maxWidth: '100%', height: 'auto', whiteSpace: 'normal', textAlign: 'left' }}>{project.name}</Button> },
        { title: '项目类型', dataIndex: 'type', width: 132 },
        { title: '项目属性', key: 'attribute', width: 100, render: (_, project) => <Tag>{PROJECT_ATTRIBUTE_LABELS[getProjectAttribute(project)]}</Tag> },
      ]} />
    </Modal>
  </>
}
