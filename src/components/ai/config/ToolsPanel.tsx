'use client'
import { useState } from 'react'
import { Button, Drawer, Form, Input, Select, Switch, Table, Tag, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useAIConfigStore } from '@/stores/ai-config'
import type { Tool } from '@/types/ai'

export function ToolsPanel() {
  const { tools, updateTool, toggleTool } = useAIConfigStore()
  const [editing, setEditing] = useState<Tool | null>(null)
  const [form] = Form.useForm()

  const cols = [
    { title: '名称', dataIndex: 'name' },
    { title: '类型', dataIndex: 'type', width: 100,
      render: (t: string) => <Tag>{t.toUpperCase()}</Tag> },
    { title: '调用方式', dataIndex: 'callTemplate', ellipsis: true },
    { title: '关联系统', dataIndex: 'relatedSystem', width: 100 },
    { title: '状态', dataIndex: 'enabled', width: 100,
      render: (v: boolean, t: Tool) => <Switch checked={v} onChange={() => toggleTool(t.id)} /> },
    { title: '操作', width: 80, render: (_: any, t: Tool) => <a onClick={() => { setEditing(t); form.setFieldsValue(t) }}>编辑</a> },
  ]

  const onSave = async () => {
    const v = await form.validateFields()
    if (editing) updateTool(editing.id, v)
    setEditing(null)
    message.success('已保存')
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <Input.Search placeholder="搜索工具" style={{ width: 240 }} />
        <Button icon={<PlusOutlined />}>新建工具</Button>
      </div>
      <Table size="small" rowKey="id" columns={cols} dataSource={tools} pagination={false} />
      <Drawer title={editing?.name} open={!!editing} onClose={() => setEditing(null)} width={480}
        footer={<div style={{ textAlign: 'right' }}><Button onClick={() => setEditing(null)} style={{ marginRight: 8 }}>取消</Button><Button type="primary" onClick={onSave}>保存</Button></div>}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称"><Input /></Form.Item>
          <Form.Item name="type" label="类型">
            <Select options={[
              { label: 'CLI', value: 'cli' },
              { label: 'HTTP', value: 'http' },
              { label: '内部函数', value: 'function' },
              { label: 'Shell', value: 'shell' },
            ]} />
          </Form.Item>
          <Form.Item name="callTemplate" label="调用模板（支持 {} 占位符）"><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="relatedSystem" label="关联系统"><Input /></Form.Item>
        </Form>
      </Drawer>
    </div>
  )
}
