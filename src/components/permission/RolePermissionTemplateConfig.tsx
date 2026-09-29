'use client'

import { useRef, useState } from 'react'
import { Alert, Button, Card, Empty, Form, Input, Modal, Space, Table, message } from 'antd'
import ProjectFunctionalPermissions from '@/components/permission/ProjectFunctionalPermissions'
import { canRunGlobalMenuAction } from '@/lib/globalMenuPermissions'
import { useRolePermissionTemplateStore } from '@/stores/rolePermissionTemplates'
import type { RolePermissionTemplate, RoleTemplateInput, RoleTemplateProjectType } from '@/types/rolePermissionTemplate'
import type { ProjectItem } from '@/types/app'
import type { PermissionMutationResult } from '@/types/permissionCenter'

interface Props { actor: string; projectType: RoleTemplateProjectType }
const blank: RoleTemplateInput = { roleName: '', pmsRoleCode: '', ipmRoleCode: '' }

export default function RolePermissionTemplateConfig({ actor, projectType }: Props) {
  const rows = useRolePermissionTemplateStore(state => state.templatesByType[projectType] ?? [])
  const [editing, setEditing] = useState<RolePermissionTemplate | 'new' | null>(null)
  const [input, setInput] = useState<RoleTemplateInput>(blank)
  const [permissionId, setPermissionId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const retry = useRef<(() => PermissionMutationResult) | null>(null)
  const menuId = `config.rolePermission:${projectType}` as const
  const canView = canRunGlobalMenuAction(actor, menuId, 'view')
  const canEdit = canRunGlobalMenuAction(actor, menuId, 'edit')
  const selected = rows.find(row => row.id === permissionId)
  const run = (action: () => PermissionMutationResult) => {
    const result = !canRunGlobalMenuAction(actor, menuId, 'edit') ? { ok: false as const, error: '当前用户无权编辑此模板，请重新打开配置。' } : action()
    setError(result.ok ? '' : result.error)
    retry.current = result.ok ? null : action
    if (!result.ok) message.error(result.error)
    return result
  }
  if (!canView) return <Empty description="无角色权限模板查看权限" />
  return <Card className="pms-config-workspace-card pms-solid-surface" size="small" title={`${projectType} · 角色权限配置模板`} extra={canEdit && <Button type="primary" onClick={() => { setInput(blank); setEditing('new'); setError('') }}>新增角色模板</Button>}>
    <p style={{ color: '#717680', fontSize: 12 }}>模板用于新同步角色的初始权限；已同步角色保留项目内配置。</p>
    {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} action={retry.current && <Button onClick={() => run(retry.current!)}>重试</Button>} />}
    <Table<RolePermissionTemplate> className="pms-table" size="small" rowKey="id" dataSource={rows} pagination={false} scroll={{ x: 660 }} columns={[
      { title: '角色名称', dataIndex: 'roleName', key: 'roleName' },
      { title: 'PMS角色编码', dataIndex: 'pmsRoleCode', key: 'pmsRoleCode' },
      { title: 'IPM角色编码', dataIndex: 'ipmRoleCode', key: 'ipmRoleCode' },
      { title: '操作', key: 'operations', render: (_, row) => <Space className="pms-role-template-actions" size={4}>
        <Button type="link" size="small" onClick={() => { setPermissionId(row.id); setError('') }}>配置权限</Button>
        {canEdit && <><Button type="link" size="small" onClick={() => { setEditing(row); setInput({ roleName: row.roleName, pmsRoleCode: row.pmsRoleCode, ipmRoleCode: row.ipmRoleCode }); setError('') }}>编辑</Button><Button type="link" size="small" danger onClick={() => Modal.confirm({ title: `删除角色模板“${row.roleName}”？`, okText: '删除', okButtonProps: { danger: true }, onOk: () => { const result = run(() => useRolePermissionTemplateStore.getState().deleteTemplate(actor, projectType, row.id)); if (!result.ok) return Promise.reject(new Error(result.error)) } })}>删除</Button></>}
      </Space> },
    ]} />
    <Modal className="pms-modal" title={editing === 'new' ? '新增角色模板' : '编辑角色模板'} open={!!editing && canEdit} okText="保存" onCancel={() => { setEditing(null); setError('') }} onOk={() => {
      if (!editing) return
      const result = run(() => editing === 'new' ? useRolePermissionTemplateStore.getState().createTemplate(actor, projectType, input) : useRolePermissionTemplateStore.getState().updateTemplate(actor, projectType, editing.id, input))
      if (result.ok) setEditing(null)
    }}>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} action={retry.current && <Button onClick={() => run(retry.current!)}>重试</Button>} />}
      <Form layout="vertical">
        {([['roleName', '角色名称'], ['pmsRoleCode', 'PMS角色编码'], ['ipmRoleCode', 'IPM角色编码']] as const).map(([key, label]) => <Form.Item key={key} label={label} required><Input aria-label={label} value={input[key]} maxLength={80} onChange={event => setInput(previous => ({ ...previous, [key]: event.target.value }))} /></Form.Item>)}
      </Form>
    </Modal>
    <Modal className="pms-modal" title={`${projectType} · ${selected?.roleName ?? ''} · 配置权限`} open={!!selected && canView} width={980} footer={null} onCancel={() => { setPermissionId(null); setError('') }} destroyOnClose>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} action={retry.current && <Button onClick={() => run(retry.current!)}>重试</Button>} />}
      {selected && <ProjectFunctionalPermissions key={selected.id} project={{ type: projectType, projectAttribute: 'formal' } as ProjectItem} grants={selected.grants} disabled={!canEdit}
        onChange={(key, enabled) => { run(() => useRolePermissionTemplateStore.getState().updateTemplateGrants(actor, projectType, selected.id, [key], enabled)) }}
        onBulkChange={(keys, enabled) => { run(() => useRolePermissionTemplateStore.getState().updateTemplateGrants(actor, projectType, selected.id, keys, enabled)) }} />}
    </Modal>
  </Card>
}
