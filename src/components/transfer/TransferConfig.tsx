'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Empty, Input, Modal, Select, Space, Table, Upload, message } from 'antd'
import { DeleteOutlined, DiffOutlined, DownloadOutlined, EditOutlined, PlusOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons'
import * as XLSX from 'xlsx'
import { useTransferStore } from '@/stores/transfer'
import { useProjectStore } from '@/stores/project'
import { hasGlobalPermission, useHasGlobalPermission } from '@/stores/permission'
import { TRANSFER_TEMPLATE_HEADERS, compareTransferTemplates, parseTransferTemplateRows, transferTemplateMatrix, transferTemplateRowSpans, type TransferTemplateKind, type TransferTemplateRow, type TransferTeamRole } from '@/lib/transferConfig'
import { exportMergedSheet, exportTimestamp } from '@/utils/exportExcel'

export function TransferConfig(_props: unknown) {
  const state = useTransferStore()
  const actor = useProjectStore(s => s.currentLoginUser)
  const canEdit = useHasGlobalPermission(actor)('configCenter:transferEdit')
  const projectType = state.transferProjectType
  const view = state.transferConfigView
  const kind: TransferTemplateKind = view === 'review' && projectType !== 'tOS版本项目' ? 'review' : 'checklist'
  const versions = state.tmTemplateVersions[projectType][kind]
  const selected = versions.find(version => version.id === state.tmConfigSelectedVersion) ?? versions.at(-1)
  const [editing, setEditing] = useState(false)
  const [roles, setRoles] = useState<TransferTeamRole[]>([])
  const [pendingRows, setPendingRows] = useState<TransferTemplateRow[] | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  useEffect(() => { setEditing(false); setPendingRows(null); state.setTmConfigDiffOpen(false) }, [actor, projectType, view])
  const rows = (selected?.rows ?? []).filter(row => !state.tmConfigSearchText || Object.values(row).some(value => String(value).toLowerCase().includes(state.tmConfigSearchText.toLowerCase())))
  const spans = transferTemplateRowSpans(rows)
  const cell = (_: unknown, index?: number) => ({ rowSpan: spans[index ?? 0] })
  const columns = [
    { title: '序号', dataIndex: 'seq', key: 'seq', width: 85, onCell: cell },
    { title: kind === 'checklist' ? '标准' : '评审要素', dataIndex: kind === 'checklist' ? 'checkItem' : 'standard', key: 'standard', width: 240, onCell: cell },
    { title: '类型', dataIndex: 'type', key: 'type', width: 100 },
    ...(kind === 'review' ? [{ title: '说明', dataIndex: 'description', key: 'description', width: 260 }, { title: '备注', dataIndex: 'remark', key: 'remark', width: 180 }] : []),
    { title: '责任角色', dataIndex: 'responsibleRole', key: 'responsibleRole', width: 100 },
    { title: '资料录入-责任人', dataIndex: 'entryRole', key: 'entryRole', width: 150 },
    { title: '人工审核-责任人', dataIndex: 'reviewRole', key: 'reviewRole', width: 150 },
    { title: '智能检查规则', dataIndex: 'aiCheckRule', key: 'aiCheckRule', width: 280 },
  ]
  const exportRows = (template: boolean) => {
    const data = template ? (kind === 'checklist' ? [{ id: 1, seq: '1', checkItem: '填写标准', type: '检查项', responsibleRole: state.tmTeamConfigs[projectType][0].roleName, entryRole: `在研${state.tmTeamConfigs[projectType][0].roleName}`, reviewRole: `维护${state.tmTeamConfigs[projectType][0].roleName}`, aiCheckRule: '' }] : [{ id: 1, seq: '1', standard: '填写评审要素', type: '检查项', description: '', remark: '', responsibleRole: state.tmTeamConfigs[projectType][0].roleName, entryRole: `在研${state.tmTeamConfigs[projectType][0].roleName}`, reviewRole: `维护${state.tmTeamConfigs[projectType][0].roleName}`, aiCheckRule: '' }]) : selected?.rows ?? []
    const groupSpans = transferTemplateRowSpans(data)
    const merges = groupSpans.flatMap((span, row) => span > 1 ? [0, 1].map(col => ({ s: { r: row + 1, c: col }, e: { r: row + span, c: col } })) : [])
    exportMergedSheet([TRANSFER_TEMPLATE_HEADERS[kind]], merges, transferTemplateMatrix(data, kind), columns.map(column => column.width / 7), `${projectType}_${kind === 'checklist' ? 'CheckList' : '评审要素'}_${template ? '导入模板' : exportTimestamp()}.xlsx`)
  }
  const beforeUpload = async (file: File) => {
    const startActor = actor, startType = projectType, startView = view
    try {
      if (!hasGlobalPermission(startActor, 'configCenter:transferEdit')) throw new Error('暂无转维配置编辑权限')
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      if (!sheet) throw new Error('文件没有工作表')
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: false })
      for (const merge of sheet['!merges'] ?? []) {
        if (merge.s.c !== merge.e.c || merge.s.c > 1 || merge.s.r < 1) continue
        const value = matrix[merge.s.r]?.[merge.s.c]
        for (let row = merge.s.r; row <= merge.e.r; row++) if (matrix[row]) matrix[row][merge.s.c] = value
      }
      if (useProjectStore.getState().currentLoginUser !== startActor || useTransferStore.getState().transferProjectType !== startType || useTransferStore.getState().transferConfigView !== startView) return false
      setPendingRows(parseTransferTemplateRows(matrix, kind, state.tmTeamConfigs[projectType]))
    } catch (error) { message.error(error instanceof Error ? error.message : '无法读取文件，请使用Excel模板') }
    return false
  }
  const differences = useMemo(() => {
    const before = versions.find(version => version.id === from)?.rows ?? []
    const after = versions.find(version => version.id === to)?.rows ?? []
    return compareTransferTemplates(before, after, kind)
  }, [from, to, versions, kind])
  if (view === 'team') return <>
    <Card className="pms-config-workspace-card pms-solid-surface" title={`${projectType} · 转维团队配置`} extra={canEdit && <Button icon={<EditOutlined />} onClick={() => { setRoles(structuredClone(state.tmTeamConfigs[projectType])); setEditing(true) }}>编辑</Button>}>
      <Table className="pms-table" size="small" rowKey="id" pagination={false} dataSource={state.tmTeamConfigs[projectType]} columns={[{ title: '角色名', dataIndex: 'roleName' }, { title: 'IPM角色Code', dataIndex: 'ipmRoleCode' }]} />
    </Card>
    <Modal className="pms-modal" title={`${projectType} · 转维团队配置`} open={editing} width={700} onCancel={() => setEditing(false)} okText="保存" onOk={() => {
      if (useProjectStore.getState().currentLoginUser !== actor) return
      const errors = state.saveTransferTeamConfig(projectType, roles, actor)
      if (errors.length) { message.error(errors.join('；')); return }
      setEditing(false); message.success('团队配置已保存，新申请将使用当前配置')
    }}>
      <Table size="small" rowKey="id" pagination={false} dataSource={roles} columns={[
        { title: '角色名', render: (_: unknown, role: TransferTeamRole) => <Input aria-label={`角色名-${role.id}`} value={role.roleName} onChange={event => setRoles(previous => previous.map(row => row.id === role.id ? { ...row, roleName: event.target.value } : row))} /> },
        { title: 'IPM角色Code', render: (_: unknown, role: TransferTeamRole) => <Input aria-label={`IPM角色Code-${role.id}`} value={role.ipmRoleCode} onChange={event => setRoles(previous => previous.map(row => row.id === role.id ? { ...row, ipmRoleCode: event.target.value } : row))} /> },
        { title: '操作', width: 65, render: (_: unknown, role: TransferTeamRole) => <Button aria-label={`删除角色-${role.id}`} type="text" danger icon={<DeleteOutlined />} disabled={role.id === 'spm'} onClick={() => setRoles(previous => previous.filter(row => row.id !== role.id))} /> },
      ]} />
      <Button style={{ marginTop: 12 }} icon={<PlusOutlined />} onClick={() => setRoles(previous => [...previous, { id: `role-${Date.now()}`, roleName: '', ipmRoleCode: '' }])}>新增角色</Button>
    </Modal>
  </>
  return <>
    <Card className="pms-config-workspace-card pms-solid-surface" title={`${projectType} · ${kind === 'checklist' ? 'CheckList' : '评审要素'}`} extra={<Space wrap>
      <Button icon={<DownloadOutlined />} onClick={() => exportRows(true)}>下载导入模板</Button>
      {canEdit && <Upload accept=".xlsx,.xls" showUploadList={false} beforeUpload={beforeUpload}><Button icon={<UploadOutlined />}>导入</Button></Upload>}
      <Button icon={<DownloadOutlined />} onClick={() => exportRows(false)}>导出</Button>
      <Select aria-label="转维模板版本" style={{ width: 110 }} value={selected?.id} options={versions.map(version => ({ value: version.id, label: version.version }))} onChange={state.setTmConfigSelectedVersion} />
      <Button icon={<DiffOutlined />} disabled={versions.length < 2} onClick={() => { setFrom(versions.at(-2)?.id ?? ''); setTo(selected?.id ?? ''); state.setTmConfigDiffOpen(true) }}>版本对比</Button>
    </Space>}>
      <Input aria-label="搜索转维模板" placeholder="搜索标准、角色或规则" prefix={<SearchOutlined />} value={state.tmConfigSearchText} onChange={event => state.setTmConfigSearchText(event.target.value)} allowClear style={{ width: 320, marginBottom: 16 }} />
      <Table className="pms-table" rowKey="id" size="small" pagination={false} dataSource={rows} columns={columns} scroll={{ x: kind === 'review' ? 1540 : 1150 }} />
    </Card>
    <Modal className="pms-modal" title="确认导入模板" open={Boolean(pendingRows)} onCancel={() => setPendingRows(null)} okText="确认导入" onOk={() => {
      if (!pendingRows || useProjectStore.getState().currentLoginUser !== actor) return
      try {
        const validated = parseTransferTemplateRows([TRANSFER_TEMPLATE_HEADERS[kind], ...transferTemplateMatrix(pendingRows, kind)], kind, useTransferStore.getState().tmTeamConfigs[projectType])
        if (!state.importTransferTemplate(projectType, kind, validated, actor)) { message.error('导入失败，请检查权限'); return }
        setPendingRows(null); message.success('导入成功，已创建新版本')
      } catch (error) { message.error((error as Error).message) }
    }}><p>将导入 {pendingRows?.length ?? 0} 条{kind === 'checklist' ? 'CheckList' : '评审要素'}并生成新版本。已发起的申请保留原模板。</p></Modal>
    <Modal className="pms-modal" title="版本对比" open={state.tmConfigDiffOpen} width={1100} footer={null} onCancel={() => state.setTmConfigDiffOpen(false)}>
      <Space style={{ marginBottom: 16 }}><Select aria-label="基准模板版本" value={from} options={versions.map(version => ({ value: version.id, label: version.version }))} onChange={setFrom} /><span>→</span><Select aria-label="对比模板版本" value={to} options={versions.map(version => ({ value: version.id, label: version.version }))} onChange={setTo} /></Space>
      <Table size="small" rowKey="id" dataSource={differences} pagination={false} locale={{ emptyText: <Empty description="两个版本没有差异" /> }} columns={[{ title: '变更', dataIndex: 'change', width: 80 }, { title: '修改前', dataIndex: 'before' }, { title: '修改后', dataIndex: 'after' }]} />
    </Modal>
  </>
}
