'use client'
import { useState } from 'react'
import { Button, Card, Col, Drawer, Form, Input, Row, Select, Switch, Tag, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useAIConfigStore } from '@/stores/ai-config'
import type { PromptTemplate } from '@/types/ai'

const CATEGORY_COLORS: Record<string, string> = {
  'analysis': 'purple', 'query': 'blue', 'flow': 'green',
}
const CATEGORY_LABELS: Record<string, string> = {
  'analysis': '分析', 'query': '查询', 'flow': '流程',
}

export function PromptTemplatesPanel() {
  const { promptTemplates, updatePromptTemplate } = useAIConfigStore()
  const [editing, setEditing] = useState<PromptTemplate | null>(null)
  const [form] = Form.useForm()

  const onSave = async () => {
    const v = await form.validateFields()
    if (editing) updatePromptTemplate(editing.id, v)
    setEditing(null)
    message.success('已保存')
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <Input.Search placeholder="搜索模板" style={{ width: 240 }} />
        <Button icon={<PlusOutlined />}>新建模板</Button>
      </div>
      <Row gutter={[12, 12]}>
        {promptTemplates.map(t => (
          <Col key={t.id} xs={24} sm={12} md={8} lg={6}>
            <Card size="small" hoverable
              onClick={() => { setEditing(t); form.setFieldsValue(t) }}
              style={{ borderRadius: 8 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Tag color={CATEGORY_COLORS[t.category]}>{CATEGORY_LABELS[t.category]}</Tag>
                {t.showInQuickChips && <Tag color="gold">快捷</Tag>}
              </div>
              <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>{t.name}</div>
              <div style={{ fontSize: 12, color: '#8c8c8c',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.content}
              </div>
            </Card>
          </Col>
        ))}
      </Row>
      <Drawer title={editing?.name} open={!!editing} onClose={() => setEditing(null)} width={480}
        footer={<div style={{ textAlign: 'right' }}><Button onClick={() => setEditing(null)} style={{ marginRight: 8 }}>取消</Button><Button type="primary" onClick={onSave}>保存</Button></div>}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="模板名"><Input /></Form.Item>
          <Form.Item name="category" label="分类">
            <Select options={[
              { label: '分析', value: 'analysis' },
              { label: '查询', value: 'query' },
              { label: '流程', value: 'flow' },
            ]} />
          </Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="content" label="模板内容（{} 占位符）"><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="showInQuickChips" label="在快捷芯片显示" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  )
}
