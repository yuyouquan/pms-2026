export function HrVersionModalTitle({ title, projectName }: { title: string; projectName?: string }) {
  return <div className="pms-hr-version-modal-title">
    <span>{title}</span>
    {projectName && <span className="pms-hr-version-modal-title__project" title={projectName}>{projectName}</span>}
  </div>
}
