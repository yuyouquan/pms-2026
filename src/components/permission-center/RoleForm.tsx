'use client'

import { useState } from 'react'
import { Alert, Button, Form, Input, Modal, Select } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { normalizePermissionName } from '@/lib/permissionCenter'
import type { CenterRoleInput, PermissionCenterModel, PermissionCenterRole, PermissionMutationResult } from '@/types/permissionCenter'

interface Props {
  model: PermissionCenterModel
  role?: PermissionCenterRole
  onSubmit: (input: CenterRoleInput) => PermissionMutationResult
  onClose: () => void
  onDirty: () => void
}

export default function RoleForm({ model, role, onSubmit, onClose, onDirty }: Props) {
  const [form] = Form.useForm<CenterRoleInput>()
  const [groupSearch, setGroupSearch] = useState('')
  const [localGroups, setLocalGroups] = useState<string[]>([])
  const [error, setError] = useState('')
  const groupNames = [...model.groups.map(group => group.name), ...localGroups]
  const canCreate = groupSearch.trim() && !groupNames.some(name => normalizePermissionName(name) === normalizePermissionName(groupSearch))
  return <Modal className="pms-modal" title={role ? '编辑角色' : '添加角色'} open width={480} onCancel={onClose}
    okText={role ? '确定' : '添加'} cancelText="取消" onOk={() => form.submit()}>
    <Form form={form} layout="vertical" onValuesChange={onDirty}
      initialValues={{ groupName: model.groups.find(group => group.id === role?.groupId)?.name, name: role?.name, description: role?.description }}
      onFinish={values => { const result = onSubmit(values); if (!result.ok) setError(result.error) }}>
      <Form.Item label="分组" name="groupName" rules={[{ required: true, whitespace: true, message: '请选择或新增分组' }]}>
        <Select showSearch placeholder="选择或新增分组" options={groupNames.map(value => ({ value, label: value }))}
          onSearch={setGroupSearch} optionFilterProp="label" popupRender={menu => <>{menu}{canCreate && <Button type="text" block icon={<PlusOutlined />}
            onMouseDown={event => event.preventDefault()} onClick={() => {
              const name = groupSearch.trim(); setLocalGroups(groups => [...groups, name]); form.setFieldValue('groupName', name); setGroupSearch(''); onDirty()
            }}>新增分组“{groupSearch.trim()}”</Button>}</>} />
      </Form.Item>
      <Form.Item label="角色名称" name="name" rules={[{ required: true, whitespace: true, message: '请输入角色名称' }, { validator: (_, value) => {
        return model.roles.some(item => item.id !== role?.id && normalizePermissionName(item.name) === normalizePermissionName(value ?? ''))
          ? Promise.reject(new Error('角色名称不能重复')) : Promise.resolve()
      } }]}>
        <Input placeholder="请输入角色名称" maxLength={100} />
      </Form.Item>
      <Form.Item label="角色定位/范围" name="description"><Input.TextArea placeholder="选填，说明角色职责或适用范围" rows={3} maxLength={500} /></Form.Item>
      {error && <Alert type="error" showIcon message={error} />}
    </Form>
  </Modal>
}
