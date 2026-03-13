'use client'

import { useState, useEffect } from 'react'
import type { ProjectType, PlanTask, PlanVersion, VersionStatus } from '@/types'
import { generateTaskNumber } from '@/lib/taskNumber'
import { compareVersionsForTable, CompareTableRow, FieldDiff } from '@/lib/versionCompare'

// 项目类型选项
const PROJECT_TYPES: ProjectType[] = ['整机产品项目', '产品项目', '技术项目', '能力建设项目']

// 示例数据
const SAMPLE_TASKS: PlanTask[] = [
  { id: '1', order: 1, taskName: '概念', status: '已完成', progress: 100 },
  { id: '1.1', parentId: '1', order: 1, taskName: '概念启动', status: '已完成', progress: 100 },
  { id: '1.2', parentId: '1', order: 2, taskName: 'STR1', status: '已完成', progress: 100 },
  { id: '2', order: 2, taskName: '计划', status: '进行中', progress: 60 },
  { id: '2.1', parentId: '2', order: 1, taskName: 'STR2', status: '进行中', progress: 60 },
  { id: '2.2', parentId: '2', order: 2, taskName: 'STR3', status: '未开始', progress: 0 },
  { id: '3', order: 3, taskName: '开发验证', status: '未开始', progress: 0 },
  { id: '3.1', parentId: '3', order: 1, taskName: 'STR4', status: '未开始', progress: 0 },
  { id: '3.2', parentId: '3', order: 2, taskName: 'STR4A', status: '未开始', progress: 0 },
  { id: '4', order: 4, taskName: '上市保障', status: '未开始', progress: 0 },
  { id: '4.1', parentId: '4', order: 1, taskName: 'STR5', status: '未开始', progress: 0 },
]

export default function Level1PlanTemplatePage() {
  const [projectType, setProjectType] = useState<ProjectType>('整机产品项目')
  const [versions, setVersions] = useState<PlanVersion[]>([
    { id: 'v1', versionNo: 'V1', status: '已发布', tasks: [...SAMPLE_TASKS], createdAt: new Date('2026-01-01'), publishedAt: new Date('2026-01-15') },
  ])
  const [currentVersionIndex, setCurrentVersionIndex] = useState(0)
  const [isEditing, setIsEditing] = useState(false)
  const [editedTasks, setEditedTasks] = useState<PlanTask[]>([])
  const [showVersionCompare, setShowVersionCompare] = useState(false)
  const [compareVersions, setCompareVersions] = useState({ v1: '', v2: '' })
  const [templateCompareResult, setTemplateCompareResult] = useState<CompareTableRow[]>([])
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null)

  const currentVersion = versions[currentVersionIndex]
  const hasDraftVersion = versions.some(v => v.status === '修订版')

  const navigateWithEditGuard = (action: () => void) => {
    if (isEditing) {
      setPendingNavigation(() => action)
      setShowLeaveConfirm(true)
    } else {
      action()
    }
  }

  const handleConfirmLeave = () => {
    setIsEditing(false)
    setEditedTasks([])
    setShowLeaveConfirm(false)
    if (pendingNavigation) {
      pendingNavigation()
      setPendingNavigation(null)
    }
  }

  const handleCancelLeave = () => {
    setShowLeaveConfirm(false)
    setPendingNavigation(null)
  }

  // 初始化编辑数据
  const handleEdit = () => {
    setEditedTasks(JSON.parse(JSON.stringify(currentVersion.tasks)))
    setIsEditing(true)
  }

  // 保存修改
  const handleSave = () => {
    const newVersions = [...versions]
    newVersions[currentVersionIndex] = {
      ...currentVersion,
      tasks: editedTasks,
    }
    setVersions(newVersions)
    setIsEditing(false)
  }

  // 取消编辑
  const handleCancel = () => {
    setEditedTasks([])
    setIsEditing(false)
  }

  // 创建修订版
  const handleCreateDraft = () => {
    const newVersionNo = `V${versions.length + 1}`
    const latestPublished = versions.find(v => v.status === '已发布')
    const newTasks = latestPublished ? JSON.parse(JSON.stringify(latestPublished.tasks)) : []
    
    const newVersion: PlanVersion = {
      id: `v${versions.length + 1}`,
      versionNo: newVersionNo,
      status: '修订版',
      tasks: newTasks,
      createdAt: new Date(),
    }
    
    setVersions([...versions, newVersion])
    setCurrentVersionIndex(versions.length)
  }

  // 发布版本
  const handlePublish = () => {
    const newVersions = versions.map((v, i) => {
      if (i === currentVersionIndex) {
        return {
          ...v,
          status: '已发布' as VersionStatus,
          publishedAt: new Date(),
        }
      }
      return v
    })
    setVersions(newVersions)
  }

  // 添加新任务
  const handleAddTask = (parentId?: string) => {
    const siblings = parentId 
      ? editedTasks.filter(t => t.parentId === parentId)
      : editedTasks.filter(t => !t.parentId)
    
    const newTaskNumber = generateTaskNumber(siblings, parentId)
    const newTask: PlanTask = {
      id: newTaskNumber,
      parentId,
      order: siblings.length + 1,
      taskName: '新任务',
      status: '未开始',
      progress: 0,
    }
    
    setEditedTasks([...editedTasks, newTask])
  }

  // 删除任务
  const handleDeleteTask = (taskId: string) => {
    // 删除该任务及其子任务
    const taskIdsToDelete = new Set<string>()
    const findChildren = (id: string) => {
      taskIdsToDelete.add(id)
      editedTasks.filter(t => t.parentId === id).forEach(t => findChildren(t.id))
    }
    findChildren(taskId)
    
    setEditedTasks(editedTasks.filter(t => !taskIdsToDelete.has(t.id)))
  }

  // 更新任务名称
  const handleUpdateTaskName = (taskId: string, name: string) => {
    setEditedTasks(editedTasks.map(t => 
      t.id === taskId ? { ...t, taskName: name } : t
    ))
  }

  // 渲染序号缩进
  const renderTaskNumber = (taskId: string) => {
    const level = taskId.split('.').length
    const classes = {
      1: 'font-bold',
      2: 'pl-6',
      3: 'pl-12',
    }
    return <span className={`task-number ${classes[level as keyof typeof classes]}`}>{taskId}</span>
  }

  // 获取当前版本的表格数据
  const displayTasks = isEditing ? editedTasks : currentVersion.tasks
  const rootTasks = displayTasks.filter(t => !t.parentId)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <header className="bg-white border-b border-gray-200 h-16">
        <div className="h-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h1 className="text-xl font-bold text-gray-800">项目管理系统</h1>
            <nav className="flex gap-6">
              <button className="text-sm font-medium text-gray-600 hover:text-gray-900">
                工作台
              </button>
              <button className="text-sm font-medium text-blue-600 border-b-2 border-blue-600 h-16 flex items-center">
                配置中心
              </button>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm">
              用
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* 侧边栏 */}
        <aside className="w-60 bg-gray-50 border-r border-gray-200 min-h-[calc(100vh-64px)]">
          <nav className="p-4">
            <div className="mb-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">
                计划管理
              </h3>
            </div>
            <a href="/config/level1-template" className="flex items-center gap-3 px-3 py-2 text-sm text-blue-600 bg-blue-50 rounded-md">
              <span>一级计划模板</span>
            </a>
            <a href="/config/level2-template" className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 rounded-md hover:bg-blue-50 hover:text-blue-600"
              onClick={(e) => { if (isEditing) { e.preventDefault(); navigateWithEditGuard(() => { window.location.href = '/config/level2-template' }) } }}>
              <span>二级计划模板</span>
            </a>
          </nav>
        </aside>

        {/* 主内容区 */}
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            {/* 页面标题 */}
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-gray-800">一级计划模板管理</h2>
              <p className="text-gray-500 mt-1">配置和管理项目一级计划模板</p>
            </div>

            {/* 筛选条件区 */}
            <div className="card mb-6">
              <div className="p-4 flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">项目类型:</label>
                  <select
                    value={projectType}
                    onChange={(e) => navigateWithEditGuard(() => setProjectType(e.target.value as ProjectType))}
                    className="select w-48"
                  >
                    {PROJECT_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">版本:</label>
                  <select
                    value={currentVersionIndex}
                    onChange={(e) => navigateWithEditGuard(() => setCurrentVersionIndex(Number(e.target.value)))}
                    className="select w-48"
                  >
                    {versions.map((v, i) => (
                      <option key={v.id} value={i}>
                        {v.versionNo}({v.status})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 编辑模式提示 */}
            {isEditing && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 mb-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-yellow-800">当前版本: {currentVersion.versionNo}(修订版)</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSave} className="btn btn-success">
                    保存
                  </button>
                  <button onClick={handleCancel} className="btn btn-secondary">
                    取消
                  </button>
                </div>
              </div>
            )}

            {/* 操作按钮区 */}
            <div className="card mb-6">
              <div className="p-4 flex items-center justify-between">
                <div className="flex gap-2">
                  {!hasDraftVersion && !isEditing && (
                    <button onClick={handleCreateDraft} className="btn btn-primary">
                      创建修订
                    </button>
                  )}
                  {currentVersion.status === '修订版' && !isEditing && (
                    <>
                      <button onClick={handleEdit} className="btn btn-secondary">
                        编辑
                      </button>
                      <button onClick={handlePublish} className="btn btn-primary">
                        发布
                      </button>
                    </>
                  )}
                  <button 
                    onClick={() => setShowVersionCompare(true)} 
                    className="btn btn-secondary"
                  >
                    历史版本对比
                  </button>
                </div>
                <div className="flex gap-2">
                  <span className="text-sm text-gray-500 self-center">视图:</span>
                  <button className="btn btn-secondary text-sm">
                    表格视图
                  </button>
                </div>
              </div>
            </div>

            {/* 计划表格 */}
            <div className="card">
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="w-20">序号</th>
                      <th>任务名称</th>
                      <th className="w-32 text-center">责任人</th>
                      <th className="w-24 text-center">前置任务</th>
                      <th className="text-center">计划开始时间</th>
                      <th className="text-center">计划完成时间</th>
                      <th className="text-right">预估工期</th>
                      <th className="text-center">实际开始时间</th>
                      <th className="text-center">实际结束时间</th>
                      <th className="text-right">实际工期</th>
                      <th className="text-center">状态</th>
                      <th className="w-20 text-center">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rootTasks.map(rootTask => (
                      <>
                        <tr key={rootTask.id} className="hover:bg-gray-50">
                          <td className="font-mono font-medium">
                            {renderTaskNumber(rootTask.id)}
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                type="text"
                                value={rootTask.taskName}
                                onChange={(e) => handleUpdateTaskName(rootTask.id, e.target.value)}
                                className="input"
                              />
                            ) : (
                              rootTask.taskName
                            )}
                          </td>
                          <td className="text-center">-</td>
                          <td className="text-center">-</td>
                          <td className="text-center">-</td>
                          <td className="text-center">-</td>
                          <td className="text-right">-</td>
                          <td className="text-center">-</td>
                          <td className="text-center">-</td>
                          <td className="text-right">-</td>
                          <td className="text-center">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              rootTask.status === '已完成' ? 'bg-green-100 text-green-700' :
                              rootTask.status === '进行中' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {rootTask.status}
                            </span>
                          </td>
                          <td className="text-center">
                            {isEditing && (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleAddTask(rootTask.id)}
                                  className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                  title="添加子项"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteTask(rootTask.id)}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                                  title="删除"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                        {/* 渲染子任务 */}
                        {displayTasks
                          .filter(t => t.parentId === rootTask.id)
                          .map(childTask => (
                            <tr key={childTask.id} className="bg-gray-30 hover:bg-gray-50">
                              <td className="font-mono pl-6">
                                {renderTaskNumber(childTask.id)}
                              </td>
                              <td>
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={childTask.taskName}
                                    onChange={(e) => handleUpdateTaskName(childTask.id, e.target.value)}
                                    className="input"
                                  />
                                ) : (
                                  childTask.taskName
                                )}
                              </td>
                              <td className="text-center">-</td>
                              <td className="text-center">-</td>
                              <td className="text-center">-</td>
                              <td className="text-center">-</td>
                              <td className="text-right">-</td>
                              <td className="text-center">-</td>
                              <td className="text-center">-</td>
                              <td className="text-right">-</td>
                              <td className="text-center">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  childTask.status === '已完成' ? 'bg-green-100 text-green-700' :
                                  childTask.status === '进行中' ? 'bg-blue-100 text-blue-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {childTask.status}
                                </span>
                              </td>
                              <td className="text-center">
                                {isEditing && (
                                  <button
                                    onClick={() => handleDeleteTask(childTask.id)}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                                    title="删除"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 添加新活动按钮 */}
            {isEditing && (
              <div className="mt-4">
                <button
                  onClick={() => handleAddTask()}
                  className="btn btn-secondary"
                >
                  + 添加新活动
                </button>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* 版本对比弹窗 */}
      {showVersionCompare && (
        <div className="modal-overlay" onClick={() => setShowVersionCompare(false)}>
          <div className="modal" style={{ maxWidth: 1100, width: '95vw' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="text-lg font-semibold">版本对比</h3>
              <button onClick={() => setShowVersionCompare(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="flex items-center gap-4 mb-4">
                <select
                  value={compareVersions.v1}
                  onChange={(e) => setCompareVersions({ ...compareVersions, v1: e.target.value })}
                  className="select flex-1"
                >
                  <option value="">选择版本A</option>
                  {versions.map((v, i) => (
                    <option key={v.id} value={i}>{v.versionNo}({v.status})</option>
                  ))}
                </select>
                <span className="text-gray-400">对比</span>
                <select
                  value={compareVersions.v2}
                  onChange={(e) => setCompareVersions({ ...compareVersions, v2: e.target.value })}
                  className="select flex-1"
                >
                  <option value="">选择版本B</option>
                  {versions.map((v, i) => (
                    <option key={v.id} value={i}>{v.versionNo}({v.status})</option>
                  ))}
                </select>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    const v1Idx = parseInt(compareVersions.v1)
                    const v2Idx = parseInt(compareVersions.v2)
                    if (isNaN(v1Idx) || isNaN(v2Idx)) return
                    const oldTasks = versions[v1Idx]?.tasks || []
                    let newTasks = versions[v2Idx]?.tasks || []
                    if (v1Idx !== v2Idx) {
                      newTasks = [
                        ...newTasks.map(t => {
                          if (t.id === '2.1') return { ...t, taskName: 'STR2(更新)', status: '已完成' as const, progress: 100 }
                          return t
                        }),
                        { id: '5', order: 5, taskName: '维护', status: '未开始' as const, progress: 0 }
                      ]
                    }
                    const result = compareVersionsForTable(oldTasks, newTasks)
                    setTemplateCompareResult(result)
                  }}
                >
                  开始对比
                </button>
              </div>
              {templateCompareResult.length === 0 ? (
                <div className="text-sm text-gray-400 text-center py-8">
                  请选择两个版本点击"开始对比"
                </div>
              ) : (() => {
                const changed = templateCompareResult.filter(r => r.changeType !== '未变更')
                const stats = { added: changed.filter(r => r.changeType === '新增').length, deleted: changed.filter(r => r.changeType === '删除').length, modified: changed.filter(r => r.changeType === '修改').length }
                const getRowBg = (type: string) => type === '新增' ? '#f6ffed' : type === '删除' ? '#fff2f0' : type === '修改' ? '#e6f4ff' : ''
                const getBadge = (type: string) => type === '新增' ? <span style={{ background: '#52c41a', color: '#fff', padding: '1px 6px', borderRadius: 4, fontSize: 11, marginLeft: 4 }}>新增</span> : type === '删除' ? <span style={{ background: '#ff4d4f', color: '#fff', padding: '1px 6px', borderRadius: 4, fontSize: 11, marginLeft: 4 }}>删除</span> : type === '修改' ? <span style={{ background: '#1890ff', color: '#fff', padding: '1px 6px', borderRadius: 4, fontSize: 11, marginLeft: 4 }}>修改</span> : null
                const renderCell = (row: CompareTableRow, fieldKey: string, value: any) => {
                  const diff = row.fieldDiffs.find((d: FieldDiff) => d.field === fieldKey)
                  if (row.changeType === '修改' && diff) return <span title={`修改人: ${row.modifier}\n修改时间: ${row.modifyTime}`} style={{ color: '#1890ff' }}><span style={{ textDecoration: 'line-through', opacity: 0.6 }}>{diff.oldValue}</span> → <strong>{diff.newValue}</strong></span>
                  if (row.changeType === '新增') return <span title={`修改人: ${row.modifier}\n修改时间: ${row.modifyTime}`} style={{ color: '#52c41a' }}>{value || '-'}</span>
                  if (row.changeType === '删除') return <span title={`修改人: ${row.modifier}\n修改时间: ${row.modifyTime}`} style={{ color: '#ff4d4f', textDecoration: 'line-through' }}>{value || '-'}</span>
                  return <span>{value || '-'}</span>
                }
                return (
                  <div>
                    <div style={{ marginBottom: 12, padding: '8px 12px', background: '#e6f7ff', borderRadius: 6, fontSize: 13 }}>
                      对比完成: <span style={{ color: '#52c41a', fontWeight: 600 }}>新增 {stats.added} 项</span> · <span style={{ color: '#ff4d4f', fontWeight: 600 }}>删除 {stats.deleted} 项</span> · <span style={{ color: '#1890ff', fontWeight: 600 }}>修改 {stats.modified} 项</span>
                    </div>
                    <div style={{ maxHeight: 420, overflow: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: '#fafafa' }}>
                            <th style={{ border: '1px solid #e8e8e8', padding: '8px 10px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>序号</th>
                            <th style={{ border: '1px solid #e8e8e8', padding: '8px 10px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>变更</th>
                            <th style={{ border: '1px solid #e8e8e8', padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>任务名称</th>
                            <th style={{ border: '1px solid #e8e8e8', padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>状态</th>
                            <th style={{ border: '1px solid #e8e8e8', padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>进度</th>
                          </tr>
                        </thead>
                        <tbody>
                          {changed.map(row => (
                            <tr key={row.key} style={{ background: getRowBg(row.changeType) }}>
                              <td style={{ border: '1px solid #e8e8e8', padding: '6px 10px', fontWeight: 600 }}>{row.taskId}</td>
                              <td style={{ border: '1px solid #e8e8e8', padding: '6px 10px' }}>{getBadge(row.changeType)}</td>
                              <td style={{ border: '1px solid #e8e8e8', padding: '6px 10px' }}>{renderCell(row, 'taskName', row.taskName)}</td>
                              <td style={{ border: '1px solid #e8e8e8', padding: '6px 10px' }}>{renderCell(row, 'status', row.status)}</td>
                              <td style={{ border: '1px solid #e8e8e8', padding: '6px 10px' }}>{renderCell(row, 'progress', `${row.progress}%`)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })()}
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowVersionCompare(false)} className="btn btn-secondary">
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑离开确认弹窗 */}
      {showLeaveConfirm && (
        <div className="modal-overlay" onClick={handleCancelLeave}>
          <div className="modal max-w-md" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="text-lg font-semibold">离开确认</h3>
              <button onClick={handleCancelLeave} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <p className="text-gray-600">您还未提交现有编辑内容，是否要离开该界面？</p>
            </div>
            <div className="modal-footer">
              <button onClick={handleCancelLeave} className="btn btn-secondary">取消</button>
              <button onClick={handleConfirmLeave} className="btn btn-primary bg-red-500 hover:bg-red-600 border-red-500">确认离开</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
