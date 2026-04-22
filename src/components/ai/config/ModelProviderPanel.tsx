'use client'
import { useState } from 'react'
import { Button, Card, Drawer, Form, Input, Select, Slider, Switch, Tag, Row, Col, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useAIConfigStore } from '@/stores/ai-config'
import type { ModelProvider } from '@/types/ai'

export function ModelProviderPanel() {
  const { providers, updateProvider, toggleProvider, defaultProviderId, setDefaultProviderId } = useAIConfigStore()
  const [editing, setEditing] = useState<ModelProvider | null>(null)
  const [form] = Form.useForm()

  const openEdit = (p: ModelProvider) => {
    setEditing(p)
    form.setFieldsValue(p)
  }

  const onSave = async () => {
    const values = await form.validateFields()
    if (editing) {
      updateProvider(editing.id, { ...values, enabled: true })
      message.success('已保存')
    }
    setEditing(null)
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <Input.Search placeholder="搜索供应商" style={{ width: 240 }} />
        <Button icon={<PlusOutlined />}>新建供应商</Button>
        <Button onClick={() => message.info('即将上线')}>批量导入</Button>
        <Button onClick={() => message.info('即将上线')}>导出</Button>
      </div>
      <Row gutter={[12, 12]}>
        {providers.map(p => (
          <Col key={p.id} xs={24} sm={12} md={8} lg={6}>
            <Card hoverable onClick={() => openEdit(p)} size="small"
              style={{ borderRadius: 8, borderColor: p.id === defaultProviderId ? '#1677ff' : undefined }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: '#8c8c8c' }}>{p.models.length} 个模型</div>
                </div>
                <Switch
                  size="small" checked={p.enabled}
                  onClick={(_, e) => e.stopPropagation()}
                  onChange={() => toggleProvider(p.id)}
                />
              </div>
              <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {p.enabled ? <Tag color="success">已接入</Tag> : <Tag>未配置</Tag>}
                {p.id === defaultProviderId && <Tag color="blue">默认</Tag>}
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Drawer
        title={editing ? `编辑 · ${editing.name}` : ''}
        open={!!editing}
        onClose={() => setEditing(null)}
        width={480}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button onClick={() => { if (editing) { setDefaultProviderId(editing.id); message.success('已设为默认') } }}>
              设为默认
            </Button>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={() => setEditing(null)}>取消</Button>
              <Button type="primary" onClick={onSave}>保存</Button>
            </div>
          </div>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="供应商名称"><Input disabled /></Form.Item>
          <Form.Item name="apiEndpoint" label="API Endpoint"><Input /></Form.Item>
          <Form.Item name="apiKey" label="API Key"><Input.Password /></Form.Item>
          <Form.Item name="defaultModel" label="默认模型">
            <Select options={editing?.models.map(m => ({ label: m, value: m })) ?? []} />
          </Form.Item>
          <Form.Item name="temperature" label="温度（0 - 2）"><Slider min={0} max={2} step={0.1} /></Form.Item>
          <Form.Item name="maxTokens" label="最大 Token"><Input type="number" /></Form.Item>
        </Form>
      </Drawer>
    </div>
  )
}
