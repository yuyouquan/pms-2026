import { Tag } from 'antd'

export function HrVersionModalTitle({ title, projectName, versionNumber, versionLabel = '版本号' }: {
  title: string
  projectName?: string
  versionNumber?: string
  versionLabel?: string
}) {
  return <div className="pms-hr-version-modal-title">
    <span className="pms-hr-version-modal-title__heading">
      <span>{title}</span>
      {versionNumber && <Tag color="purple" className="pms-hr-version-modal-title__version" aria-label={`${versionLabel} ${versionNumber}`} title={`${versionLabel}：${versionNumber}`}>{versionNumber}</Tag>}
    </span>
    {projectName && <span className="pms-hr-version-modal-title__project" title={projectName}>{projectName}</span>}
  </div>
}
