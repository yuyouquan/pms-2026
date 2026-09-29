'use client'

import { Segmented, Tabs } from 'antd'
import type { ProjectDataScope } from '@/types/permissionCenter'
import styles from '@/components/permission-center/PermissionCenter.module.css'

interface Props { value: ProjectDataScope; onChange: (scope: ProjectDataScope) => void }

export default function ProjectDataScopeTabs({ value, onChange }: Props) {
  const isTechnical = value === 'technical-tdt' || value === 'technical-subproject'
  return <div className={styles.projectScopeNavigation}>
    <Tabs className={styles.projectScopeTabs} size="small" aria-label="项目类型数据权限" activeKey={isTechnical ? 'technical' : value}
      onChange={key => onChange(key === 'technical' ? 'technical-tdt' : key as ProjectDataScope)}
      items={[{ key: 'machine', label: '整机产品项目' }, { key: 'tos', label: 'tOS版本项目' }, { key: 'technical', label: '技术项目' }, { key: 'capability', label: '能力建设项目' }]} />
    {isTechnical && <div className={styles.technicalScopeRow}><span className={styles.muted}>项目层级</span>
      <Segmented<ProjectDataScope> size="small" aria-label="技术项目层级" value={value} onChange={onChange}
        options={[{ value: 'technical-tdt', label: 'TDT项目' }, { value: 'technical-subproject', label: '子项目' }]} />
    </div>}
  </div>
}
