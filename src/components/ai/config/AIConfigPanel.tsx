'use client'
import { Tabs } from 'antd'
import { ModelProviderPanel } from './ModelProviderPanel'
import { KnowledgeBasePanel } from './KnowledgeBasePanel'
import { ToolsPanel } from './ToolsPanel'
import { MCPServersPanel } from './MCPServersPanel'
import { PromptTemplatesPanel } from './PromptTemplatesPanel'

export default function AIConfigPanel() {
  return (
    <Tabs
      defaultActiveKey="providers"
      items={[
        { key: 'providers', label: '模型供应商', children: <ModelProviderPanel /> },
        { key: 'kb', label: '知识库', children: <KnowledgeBasePanel /> },
        { key: 'tools', label: '工具', children: <ToolsPanel /> },
        { key: 'mcp', label: 'MCP 服务器', children: <MCPServersPanel /> },
        { key: 'prompts', label: '提示词模板', children: <PromptTemplatesPanel /> },
      ]}
    />
  )
}
