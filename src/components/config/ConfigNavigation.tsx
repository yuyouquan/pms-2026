'use client'

import { useEffect, useMemo, useState } from 'react'
import { Empty, Input, Menu } from 'antd'
import { AppstoreOutlined, CalendarOutlined, FileTextOutlined, SearchOutlined, TeamOutlined } from '@ant-design/icons'
import { CONFIG_MENU_GROUPS, filterConfigMenu, type ConfigMenuTarget } from '@/lib/configNavigation'

interface ConfigNavigationProps {
  collapsed: boolean
  selectedKey: string
  onSelect: (target: ConfigMenuTarget, key: string) => void
}

const GROUP_ICONS = {
  plan: <CalendarOutlined />,
  transfer: <FileTextOutlined />,
  enum: <AppstoreOutlined />,
  hrPipeline: <TeamOutlined />,
}

export default function ConfigNavigation({ collapsed, selectedKey, onSelect }: ConfigNavigationProps) {
  const [query, setQuery] = useState('')
  const selectedGroup = selectedKey.split(':')[0]
  const [openKeys, setOpenKeys] = useState<string[]>([selectedGroup])
  const filteredGroups = useMemo(() => filterConfigMenu(query), [query])
  const searching = Boolean(query.trim())

  useEffect(() => {
    setOpenKeys(previous => previous.includes(selectedGroup) ? previous : [...previous, selectedGroup])
  }, [selectedGroup])

  return (
    <div className="pms-config-navigation">
      {!collapsed && (
        <Input
          className="pms-config-navigation-search"
          prefix={<SearchOutlined />}
          placeholder="搜索配置菜单"
          aria-label="搜索配置菜单"
          value={query}
          allowClear
          onChange={event => setQuery(event.target.value)}
        />
      )}
      <Menu
        aria-label="配置菜单"
        className="pms-config-sidebar-menu pms-config-navigation-menu"
        mode="inline"
        inlineCollapsed={collapsed}
        inlineIndent={16}
        selectedKeys={[selectedKey]}
        openKeys={collapsed ? undefined : searching ? filteredGroups.map(group => group.key) : openKeys}
        onOpenChange={keys => { if (!collapsed && !searching) setOpenKeys(keys) }}
        items={(collapsed ? CONFIG_MENU_GROUPS : filteredGroups).map(group => ({
          key: group.key,
          icon: GROUP_ICONS[group.key],
          label: group.label,
          children: group.children.map(leaf => ({ key: leaf.key, label: <span data-testid={leaf.target.module === 'enum' ? `enum-type-${leaf.target.enumType}` : `config-menu-${leaf.key}`}>{leaf.label}</span>, title: leaf.label })),
        }))}
        onClick={({ key }) => {
          const leaf = CONFIG_MENU_GROUPS.flatMap(group => group.children).find(item => item.key === key)
          if (leaf) {
            // The collapsed menu shows all categories, so discard its hidden filter on selection.
            if (collapsed) setQuery('')
            onSelect(leaf.target, leaf.key)
          }
        }}
      />
      {!collapsed && filteredGroups.length === 0 && (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未找到配置菜单" />
      )}
    </div>
  )
}
