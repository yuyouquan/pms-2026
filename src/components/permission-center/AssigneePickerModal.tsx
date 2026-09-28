'use client'

import { useState } from 'react'
import { Alert, Avatar, Button, Checkbox, Empty, Input, Modal, Tree } from 'antd'
import { ApartmentOutlined, CloseOutlined, SearchOutlined } from '@ant-design/icons'
import { PERMISSION_DEPARTMENTS, PERMISSION_USERS, PERMISSION_USER_DEPARTMENTS } from '@/constants/permissionCenter'
import styles from '@/components/permission-center/PermissionCenter.module.css'

export type AssigneeKind = 'users' | 'departments'
interface Props {
  kind: AssigneeKind
  values: string[]
  error: string
  disabled: boolean
  onChange: (values: string[]) => void
  onConfirm: () => void
  onCancel: () => void
}

export default function AssigneePickerModal({ kind, values, error, disabled, onChange, onConfirm, onCancel }: Props) {
  const [search, setSearch] = useState('')
  const people = kind === 'users'
  const query = search.trim().toLocaleLowerCase()
  const candidates = (people ? PERMISSION_USERS : PERMISSION_DEPARTMENTS).filter(name =>
    `${name} ${people ? (PERMISSION_USER_DEPARTMENTS[name] ?? []).join(' ') : ''}`.toLocaleLowerCase().includes(query))
  // AntD sanitizes non-ASCII tree keys into DOM IDs; use stable unique ASCII keys.
  const departmentKey = (name: string) => `department-${PERMISSION_DEPARTMENTS.indexOf(name)}`
  const remove = (name: string) => onChange(values.filter(value => value !== name))
  return <Modal open centered className="pms-modal" width={860} title={people ? '配置授权人员' : '配置授权部门'}
    okText="确定" cancelText="取消" maskClosable={false} onOk={onConfirm} onCancel={onCancel} okButtonProps={{ disabled }}>
    <div className={styles.pickerHint}>{people ? '选择加入此角色的人员，点击确定后生效。' : '仅授权所选部门的直属人员，不自动包含上级或下级部门。'}</div>
    {error && <Alert className={styles.alert} type="error" showIcon message={error} />}
    <div className={styles.pickerGrid}>
      <div className={styles.pickerPane}>
        <Input aria-label={people ? '搜索可选人员' : '搜索可选部门'} placeholder={people ? '搜索姓名或部门' : '搜索部门'}
          prefix={<SearchOutlined />} allowClear value={search} onChange={event => setSearch(event.target.value)} />
        <div className={styles.pickerPaneTitle}>{people ? '可选人员' : '部门列表'}<span>{candidates.length}</span></div>
        <div className={styles.pickerList}>
          {!candidates.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={people ? '未找到人员' : '未找到部门'} />
            : people ? candidates.map(name => <Checkbox key={name} className={styles.pickerCandidate} aria-label={`选择人员 ${name}`}
                checked={values.includes(name)} onChange={event => event.target.checked ? onChange([...values, name]) : remove(name)}>
                <span className={styles.pickerIdentity}><Avatar size={28} className={styles.pickerAvatar}>{name.startsWith('演示用户') ? name.slice(-2) : name.slice(0, 1)}</Avatar>
                  <span className={styles.pickerPerson}><span>{name}</span><small>{(PERMISSION_USER_DEPARTMENTS[name] ?? []).join('、') || '未设置部门'}</small></span>
                </span>
              </Checkbox>)
            : <Tree checkable checkStrictly selectable={false} blockNode defaultExpandAll checkedKeys={values.map(departmentKey)}
                treeData={[{ key: 'all-departments', title: '全部部门', checkable: false, children: candidates.map(name => ({ key: departmentKey(name), title: name })) }]}
                onCheck={checked => {
                  const keys = (Array.isArray(checked) ? checked : checked.checked).map(String)
                  // Search hides nodes; retain checked departments outside the current results.
                  onChange([...new Set([...values.filter(value => !candidates.includes(value)), ...PERMISSION_DEPARTMENTS.filter(name => keys.includes(departmentKey(name)))])])
                }} />}
        </div>
      </div>
      <div className={styles.pickerPane}>
        <div className={styles.pickerSelectedHeading}><strong>已选{people ? '人员' : '部门'} <span>{values.length}</span></strong>
          <Button type="link" size="small" disabled={!values.length} onClick={() => onChange([])}>清空</Button></div>
        <div className={styles.pickerList} aria-label={people ? '已选人员列表' : '已选部门列表'}>
          {values.length ? values.map(name => <div className={styles.pickerSelectedRow} key={name}>
            <span className={styles.pickerIdentity}>{people
              ? <Avatar size={28} className={styles.pickerAvatar}>{name.startsWith('演示用户') ? name.slice(-2) : name.slice(0, 1)}</Avatar>
              : <ApartmentOutlined className={styles.pickerDepartmentIcon} />}
              <span className={styles.pickerPerson}><span>{name}</span>{people && <small>{(PERMISSION_USER_DEPARTMENTS[name] ?? []).join('、') || '未设置部门'}</small>}</span>
            </span>
            <Button type="text" size="small" aria-label={`移除${people ? '人员' : '部门'} ${name}`} icon={<CloseOutlined />} onClick={() => remove(name)} />
          </div>) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={people ? '暂未选择人员' : '暂未选择部门'} />}
        </div>
      </div>
    </div>
  </Modal>
}
