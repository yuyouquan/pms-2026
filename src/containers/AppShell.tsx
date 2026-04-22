'use client'

import {
  Row, Col, Space, Menu, Dropdown, Tag, Avatar, Button, Input,
} from 'antd'
import {
  AppstoreOutlined, LeftOutlined, ProjectOutlined, DownOutlined,
  SearchOutlined, SwapOutlined, CheckCircleOutlined, RobotOutlined,
} from '@ant-design/icons'
import { useUiStore } from '@/stores/ui'
import { useProjectStore, PROJECT_MEMBER_MAP } from '@/stores/project'
import { usePlanStore } from '@/stores/plan'
import { usePermissionStore } from '@/stores/permission'
import { useTransferStore } from '@/stores/transfer'
import { useAIChatStore } from '@/stores/ai-chat'
import { ALL_USERS } from '@/components/permission/PermissionModule'
import { useRef, useEffect, useMemo } from 'react'

// ─── Shared user switcher (head avatar + dropdown) ──────────────────

function UserSwitcher() {
  const { projects, currentLoginUser, setCurrentLoginUser, setProjectCardPage } = useProjectStore()
  const { roles, globalRoles } = usePermissionStore()

  const isAdminUser = useMemo(() => {
    const adminGroup = globalRoles.find(r => r.name === '管理组')
    return adminGroup ? adminGroup.members.includes(currentLoginUser) : false
  }, [globalRoles, currentLoginUser])

  return (
    <Dropdown
      menu={{
        items: [
          { key: 'label', label: <div style={{ padding: '4px 0', borderBottom: '1px solid #f3f4f6' }}>
            <span style={{ color: '#999', fontSize: 11 }}>当前登录用户</span>
            <div style={{ fontWeight: 600, marginTop: 2 }}>{currentLoginUser}
              {(() => {
                const adminGroup = globalRoles.find(r => r.name === '管理组')
                const isAdmin = adminGroup?.members.includes(currentLoginUser)
                const projectCount = isAdmin ? projects.length : projects.filter(p => (PROJECT_MEMBER_MAP[p.id] || []).includes(currentLoginUser)).length
                return <>
                  {isAdmin && <Tag color="red" style={{ fontSize: 10, marginLeft: 6 }}>管理组</Tag>}
                  <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 6 }}>可见 {projectCount} 个项目</span>
                </>
              })()}
            </div>
          </div>, disabled: true },
          { type: 'divider' as const },
          { key: 'switch-label', label: <span style={{ color: '#999', fontSize: 11 }}><SwapOutlined style={{ marginRight: 4 }} />切换用户（测试权限）</span>, disabled: true },
          ...ALL_USERS.map(u => {
            const isActive = currentLoginUser === u
            const adminGroup = globalRoles.find(r => r.name === '管理组')
            const isAdmin = adminGroup?.members.includes(u)
            const projectCount = isAdmin ? projects.length : projects.filter(p => (PROJECT_MEMBER_MAP[p.id] || []).includes(u)).length
            const userRoles = roles.filter(r => r.members.includes(u)).map(r => r.name)
            return {
              key: u,
              label: <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: isActive ? 600 : 400 }}>
                <Avatar size="small" style={{ background: isActive ? '#4338ca' : '#e0e0e0', fontSize: 12 }}>{u.slice(-1)}</Avatar>
                <span>{u}</span>
                {isAdmin && <Tag color="red" style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px' }}>管理组</Tag>}
                <span style={{ color: '#9ca3af', fontSize: 11, marginLeft: 'auto' }}>{projectCount}个项目</span>
                {isActive && <CheckCircleOutlined style={{ color: '#4338ca' }} />}
              </div>,
              onClick: () => { setCurrentLoginUser(u); setProjectCardPage(1) },
            }
          }),
        ],
      }}
      placement="bottomRight"
      trigger={['click']}
      overlayStyle={{ minWidth: 340 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '5px 14px', borderRadius: 24, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', transition: 'all 0.25s', backdropFilter: 'blur(8px)' }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.22)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
      >
        <Avatar size={28} style={{ background: 'rgba(255,255,255,0.25)', fontSize: 13, fontWeight: 600 }}>{currentLoginUser.slice(-1)}</Avatar>
        <span style={{ color: '#fff', fontSize: 13, fontWeight: 500 }}>{currentLoginUser}</span>
        {isAdminUser && <Tag color="rgba(255,100,100,0.35)" style={{ color: '#fff', border: '1px solid rgba(255,255,255,0.25)', fontSize: 10, margin: 0 }}>管理组</Tag>}
      </div>
    </Dropdown>
  )
}

// ─── Main mode header (工作台, 路标, 配置, 权限) ─────────────────────

export function MainHeader() {
  const {
    activeModule, setActiveModule, configTab, setConfigTab,
    isEditMode, setIsEditMode, setShowLeaveConfirm, setPendingNavigation,
  } = useUiStore()

  const { versions, currentVersion } = usePlanStore()
  const currentVersionData = versions.find(v => v.id === currentVersion)
  const isCurrentDraft = currentVersionData?.status === '修订中'

  const navigateWithEditGuard = (action: () => void) => {
    if (isEditMode && !isCurrentDraft) {
      setPendingNavigation(() => action)
      setShowLeaveConfirm(true)
    } else {
      action()
    }
  }

  return (
    <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4338ca 100%)', padding: '0 32px', boxShadow: '0 4px 20px rgba(30,27,75,0.4)', position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <Row align="middle" justify="space-between" style={{ height: 56 }}>
        <Col>
          <Space size={32} align="center">
            <Space size={10}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(129,140,248,0.4)' }}>
                <AppstoreOutlined style={{ color: '#fff', fontSize: 16 }} />
              </div>
              <span style={{ fontSize: 17, fontWeight: 700, color: '#fff', letterSpacing: 1.5, textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>项目管理系统</span>
            </Space>
            <Menu
              theme="dark"
              mode="horizontal"
              selectedKeys={[activeModule]}
              onClick={({ key }) => navigateWithEditGuard(() => { setIsEditMode(false); setActiveModule(key); if (key === 'config') setConfigTab('plan') })}
              style={{ background: 'transparent', borderBottom: 'none', fontSize: 14 }}
              items={[
                { key: 'projects', label: '工作台' },
                { key: 'roadmap', label: '项目路标视图' },
                { key: 'hrPipeline', label: '人力资源管道' },
                { key: 'config', label: '配置中心' },
                { key: 'globalPermission', label: '权限中心' },
                { key: 'aiAssistant', label: <span>🤖 智能助手</span> },
              ]}
            />
          </Space>
        </Col>
        <Col>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Button
              type="text"
              size="small"
              icon={<RobotOutlined />}
              onClick={() => {
                const proj = useProjectStore.getState().selectedProject
                useUiStore.getState().setActiveModule('aiAssistant')
                if (proj) useAIChatStore.getState().bindProject(proj.name)
              }}
              style={{ color: '#fff', marginRight: 12 }}
            >
              问 AI
            </Button>
            <UserSwitcher />
          </div>
        </Col>
      </Row>
    </div>
  )
}

// ─── Project space mode header (back + project selector) ────────────

interface ProjectSpaceHeaderProps {
  navigateWithEditGuard: (action: () => void) => void
}

export function ProjectSpaceHeader({ navigateWithEditGuard }: ProjectSpaceHeaderProps) {
  const {
    setActiveModule, showProjectSearch, setShowProjectSearch,
    projectSearchText, setProjectSearchText, setProjectSpaceModule,
  } = useUiStore()

  const {
    projects, selectedProject, setSelectedProject,
    currentLoginUser, setSelectedMarketTab,
  } = useProjectStore()

  const { globalRoles } = usePermissionStore()
  const { setTransferView } = useTransferStore()

  const projectSearchRef = useRef<HTMLDivElement>(null)

  const isAdminUser = useMemo(() => {
    const adminGroup = globalRoles.find(r => r.name === '管理组')
    return adminGroup ? adminGroup.members.includes(currentLoginUser) : false
  }, [globalRoles, currentLoginUser])

  const visibleProjects = useMemo(() => {
    if (isAdminUser) return projects
    return projects.filter(p => {
      const members = PROJECT_MEMBER_MAP[p.id] || []
      return members.includes(currentLoginUser)
    })
  }, [projects, isAdminUser, currentLoginUser])

  const filteredProjects = visibleProjects.filter(p => {
    if (!projectSearchText) return true
    return p.name.toLowerCase().includes(projectSearchText.toLowerCase()) ||
      p.type.includes(projectSearchText) ||
      p.leader.includes(projectSearchText)
  })

  // Click outside to close search
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (projectSearchRef.current && !projectSearchRef.current.contains(e.target as Node)) {
        setShowProjectSearch(false)
      }
    }
    if (showProjectSearch) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showProjectSearch])

  return (
    <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4338ca 100%)', padding: '0 24px', boxShadow: '0 4px 20px rgba(30,27,75,0.4)', position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <Row align="middle" style={{ height: 56 }}>
        <Col flex="none">
          <Button type="text" icon={<LeftOutlined style={{ color: '#fff' }} />} onClick={() => { setTransferView(null); navigateWithEditGuard(() => { useUiStore.getState().setIsEditMode(false); setActiveModule('projects'); }); }} style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>返回工作台</Button>
        </Col>
        <Col flex="auto" style={{ textAlign: 'center' }}>
          <div ref={projectSearchRef} style={{ display: 'inline-block', position: 'relative' }}>
            <div
              style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 12px', borderRadius: 6, transition: 'background 0.2s', background: showProjectSearch ? 'rgba(255,255,255,0.15)' : 'transparent' }}
              onClick={() => setShowProjectSearch(!showProjectSearch)}
            >
              <ProjectOutlined style={{ color: '#fff', fontSize: 16 }} />
              <span style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>{selectedProject?.name}</span>
              <DownOutlined style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', transition: 'transform 0.2s', transform: showProjectSearch ? 'rotate(180deg)' : 'rotate(0deg)' }} />
              <Tag style={{ marginLeft: 4, fontSize: 11, background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff' }}>项目空间</Tag>
            </div>
            {showProjectSearch && (
              <div style={{
                position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                marginTop: 4, width: 360, background: '#fff', borderRadius: 8,
                boxShadow: '0 6px 16px rgba(0,0,0,0.12)', border: '1px solid #e5e7eb',
                zIndex: 1000, overflow: 'hidden',
              }}>
                <div style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6' }}>
                  <Input
                    placeholder="搜索项目名称..."
                    prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                    value={projectSearchText}
                    onChange={(e) => setProjectSearchText(e.target.value)}
                    allowClear
                    autoFocus
                    style={{ borderRadius: 6 }}
                  />
                </div>
                <div style={{ maxHeight: 300, overflowY: 'auto', padding: '4px 0' }}>
                  {filteredProjects.length === 0 ? (
                    <div style={{ padding: '16px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>无匹配项目</div>
                  ) : (
                    filteredProjects.map(p => (
                      <div
                        key={p.id}
                        style={{
                          padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          background: selectedProject?.id === p.id ? 'rgba(99,102,241,0.06)' : 'transparent',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => { if (selectedProject?.id !== p.id) (e.currentTarget as HTMLElement).style.background = '#fafafa' }}
                        onMouseLeave={(e) => { if (selectedProject?.id !== p.id) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                        onClick={() => {
                          navigateWithEditGuard(() => {
                            setSelectedProject(p)
                            setProjectSpaceModule('basic')
                            setShowProjectSearch(false)
                            setProjectSearchText('')
                            if (p.markets && p.markets.length > 0) {
                              setSelectedMarketTab(p.markets[0])
                            }
                          })
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{p.type} | {p.leader}</div>
                        </div>
                        <Tag color={p.status === '进行中' ? 'blue' : p.status === '已完成' ? 'green' : 'orange'} style={{ fontSize: 11 }}>{p.status}</Tag>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </Col>
        <Col flex="none">
          <UserSwitcher />
        </Col>
      </Row>
    </div>
  )
}
