'use client'
import { useState } from 'react'
import { Badge, Button, Card, Col, Drawer, Form, Input, Row, Select, Switch, Tag, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useAIConfigStore } from '@/stores/ai-config'
import type { MCPServer } from '@/types/ai'

const STATUS_MAP = {
  connected: { color: 'success' as const, text: '已连接' },
  disconnected: { color: 'default' as const, text: '未连接' },
  error: { color: 'error' as const, text: '连接失败' },
}

export function MCPServersPanel() {
  const { mcpServers, updateMCPServer, toggleMCPServerTool } = useAIConfigStore()
  const [editing, setEditing] = useState<MCPServer | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [form] = Form.useForm()

  const testConnection = (s: MCPServer) => {
    message.loading({ content: '测试中...', key: 'mcp-test', duration: 0 })
    setTimeout(() => {
      if (s.connectionStatus === 'connected') {
        message.success({ content: '连接成功', key: 'mcp-test' })
      } else {
        message.error({ content: '连接失败', key: 'mcp-test' })
      }
    }, 1500)
  }

  const onSave = async () => {
    const v = await form.validateFields()
    if (editing) updateMCPServer(editing.id, v)
    setEditing(null)
    message.success('已保存')
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <Input.Search placeholder="搜索 MCP 服务器" style={{ width: 240 }} />
        <Button icon={<PlusOutlined />}>新建 MCP</Button>
      </div>
      <Row gutter={[12, 12]}>
        {mcpServers.map(s => {
          const status = STATUS_MAP[s.connectionStatus]
          const isExpanded = expanded === s.id
          return (
            <Col key={s.id} xs={24} md={12} lg={8}>
              <Card size="small" style={{ borderRadius: 8 }}
                title={<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Badge status={status.color} />
                  <span>{s.name}</span>
                  <Tag style={{ marginLeft: 'auto' }}>{s.protocol.toUpperCase()}</Tag>
                </div>}
                extra={<a onClick={() => { setEditing(s); form.setFieldsValue(s) }}>编辑</a>}
              >
                <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 8, wordBreak: 'break-all' }}>
                  {s.endpoint}
                </div>
                <div style={{ fontSize: 12, marginBottom: 8 }}>
                  {status.text} · 工具数：{s.exposedTools.length}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <Button size="small" onClick={() => testConnection(s)}>测试连接</Button>
                  <Button size="small" onClick={() => setExpanded(isExpanded ? null : s.id)}>
                    {isExpanded ? '收起工具' : '查看工具'}
                  </Button>
                </div>
                {isExpanded && (
                  <div style={{ marginTop: 12, borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
                    {s.exposedTools.map(t => (
                      <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 8,
                        padding: '4px 0', fontSize: 12 }}>
                        <Switch size="small" checked={t.enabled}
                          onChange={() => toggleMCPServerTool(s.id, t.name)} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 500 }}>{t.name}</div>
                          <div style={{ color: '#8c8c8c', fontSize: 11 }}>{t.description}</div>
                        </div>
                      </div>
                    ))}
                    {s.exposedTools.length === 0 && <div style={{ color: '#8c8c8c', fontSize: 12 }}>无可用工具</div>}
                  </div>
                )}
              </Card>
            </Col>
          )
        })}
      </Row>
      <Drawer title={editing?.name} open={!!editing} onClose={() => setEditing(null)} width={480}
        footer={<div style={{ textAlign: 'right' }}><Button onClick={() => setEditing(null)} style={{ marginRight: 8 }}>取消</Button><Button type="primary" onClick={onSave}>保存</Button></div>}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称"><Input /></Form.Item>
          <Form.Item name="protocol" label="协议">
            <Select options={[
              { label: 'stdio', value: 'stdio' },
              { label: 'SSE', value: 'sse' },
              { label: 'HTTP', value: 'http' },
            ]} />
          </Form.Item>
          <Form.Item name="endpoint" label="命令或 URL"><Input /></Form.Item>
        </Form>
      </Drawer>
    </div>
  )
}
