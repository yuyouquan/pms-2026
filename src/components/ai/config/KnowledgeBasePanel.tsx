'use client'
import { useState } from 'react'
import { Button, Drawer, Form, Input, Select, Switch, Table, Tag, Tabs, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useAIConfigStore } from '@/stores/ai-config'
import type { KnowledgeBase } from '@/types/ai'

export function KnowledgeBasePanel() {
  const { knowledgeBases, updateKnowledgeBase, toggleKnowledgeBase } = useAIConfigStore()
  const [editing, setEditing] = useState<KnowledgeBase | null>(null)
  const [form] = Form.useForm()

  const structured = knowledgeBases.filter(k => k.type === 'structured')
  const documents = knowledgeBases.filter(k => k.type === 'document')

  const openEdit = (k: KnowledgeBase) => { setEditing(k); form.setFieldsValue(k) }
  const onSave = async () => {
    const values = await form.validateFields()
    if (editing) updateKnowledgeBase(editing.id, values)
    setEditing(null)
    message.success('已保存')
  }

  const structCols = [
    { title: '名称', dataIndex: 'name' },
    { title: '字段数', dataIndex: 'fields', render: (f: string[]) => f?.length ?? 0, width: 80 },
    { title: '记录数', dataIndex: 'recordCount', width: 100 },
    { title: '状态', dataIndex: 'indexStatus', width: 100,
      render: (s: string) => <Tag color={s === 'ready' ? 'green' : s === 'indexing' ? 'blue' : 'red'}>{s}</Tag> },
    { title: '启用', dataIndex: 'enabled', width: 80,
      render: (v: boolean, k: KnowledgeBase) => <Switch checked={v} onChange={() => toggleKnowledgeBase(k.id)} /> },
    { title: '操作', width: 80, render: (_: any, k: KnowledgeBase) => <a onClick={() => openEdit(k)}>编辑</a> },
  ]
  const docCols = [
    { title: '名称', dataIndex: 'name' },
    { title: '大小', dataIndex: 'size', width: 100 },
    { title: '状态', dataIndex: 'indexStatus', width: 100,
      render: (s: string) => <Tag color={s === 'ready' ? 'green' : s === 'indexing' ? 'blue' : 'red'}>
        {s === 'ready' ? '已索引' : s === 'indexing' ? '索引中' : '错误'}</Tag> },
    { title: '启用', dataIndex: 'enabled', width: 80,
      render: (v: boolean, k: KnowledgeBase) => <Switch checked={v} onChange={() => toggleKnowledgeBase(k.id)} /> },
    { title: '操作', width: 80, render: (_: any, k: KnowledgeBase) => <a onClick={() => openEdit(k)}>编辑</a> },
  ]

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <Input.Search placeholder="搜索知识库" style={{ width: 240 }} />
        <Button icon={<PlusOutlined />}>新建知识库</Button>
        <Button onClick={() => message.info('即将上线')}>批量导入</Button>
        <Button onClick={() => message.info('即将上线')}>导出</Button>
      </div>
      <Tabs
        items={[
          { key: 's', label: `结构化数据源 (${structured.length})`,
            children: <Table size="small" rowKey="id" columns={structCols} dataSource={structured} pagination={false} /> },
          { key: 'd', label: `文档知识 (${documents.length})`,
            children: <Table size="small" rowKey="id" columns={docCols} dataSource={documents} pagination={false} /> },
        ]}
      />
      <Drawer title={editing?.name} open={!!editing} onClose={() => setEditing(null)} width={480}
        footer={<div style={{ textAlign: 'right' }}><Button onClick={() => setEditing(null)} style={{ marginRight: 8 }}>取消</Button><Button type="primary" onClick={onSave}>保存</Button></div>}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称"><Input /></Form.Item>
          <Form.Item name="visibleRoles" label="可见角色">
            <Select mode="multiple" options={[
              { label: '系统管理员', value: '系统管理员' },
              { label: '项目经理', value: '项目经理' },
              { label: '产品经理', value: '产品经理' },
              { label: '开发工程师', value: '开发工程师' },
              { label: '测试工程师', value: '测试工程师' },
              { label: '管理层', value: '管理层' },
            ]} />
          </Form.Item>
          {editing?.type === 'document' && (<>
            <Form.Item label="切片策略">
              <Select defaultValue="semantic" options={[
                { label: '固定长度', value: 'fixed' },
                { label: '语义切分', value: 'semantic' },
              ]} />
            </Form.Item>
            <Form.Item label="Embedding 模型">
              <Select defaultValue="text-embedding-3-small" options={[
                { label: 'text-embedding-3-small', value: 'text-embedding-3-small' },
                { label: 'bge-large-zh', value: 'bge-large-zh' },
              ]} />
            </Form.Item>
          </>)}
        </Form>
      </Drawer>
    </div>
  )
}
