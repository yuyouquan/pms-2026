'use client';

import { useParams } from 'next/navigation';
import Layout from '@/components/Layout/Layout';
import { Card, Table, Tag, Button, Input, Select, Row, Col, Modal, Form, Progress } from 'antd';
import { PlusOutlined, SearchOutlined, BugOutlined } from '@ant-design/icons';
import { useState } from 'react';

const { Option } = Select;

const bugData = [
  { 
    key: '1', 
    bugId: 'BUG-001',
    title: '系统重启后网络连接失败', 
    module: '系统模块',
    severity: '严重',
    priority: 'P0',
    status: '待处理',
    assignee: '张三',
    reporter: '李四',
    createTime: '2026-03-01',
    resolveTime: '-'
  },
  { 
    key: '2', 
    bugId: 'BUG-002',
    title: '相机启动时闪退', 
    module: '相机模块',
    severity: '严重',
    priority: 'P0',
    status: '处理中',
    assignee: '王五',
    reporter: '赵六',
    createTime: '2026-03-02',
    resolveTime: '-'
  },
  { 
    key: '3', 
    bugId: 'BUG-003',
    title: '电量显示不准确', 
    module: '电源管理',
    severity: '一般',
    priority: 'P2',
    status: '已验证',
    assignee: '钱七',
    reporter: '孙八',
    createTime: '2026-02-28',
    resolveTime: '2026-03-05'
  },
  { 
    key: '4', 
    bugId: 'BUG-004',
    title: '蓝牙配对失败', 
    module: '蓝牙模块',
    severity: '严重',
    priority: 'P1',
    status: '待处理',
    assignee: '周九',
    reporter: '吴十',
    createTime: '2026-03-03',
    resolveTime: '-'
  },
  { 
    key: '5', 
    bugId: 'BUG-005',
    title: '通知栏图标显示异常', 
    module: 'UI模块',
    severity: '轻微',
    priority: 'P3',
    status: '已关闭',
    assignee: '郑十一',
    reporter: '张三',
    createTime: '2026-02-20',
    resolveTime: '2026-02-25'
  },
  { 
    key: '6', 
    bugId: 'BUG-006',
    title: 'WIFI信号不稳定', 
    module: '网络模块',
    severity: '一般',
    priority: 'P2',
    status: '处理中',
    assignee: '李四',
    reporter: '王五',
    createTime: '2026-03-04',
    resolveTime: '-'
  },
];

const severityColors: Record<string, string> = {
  '严重': 'red',
  '一般': 'orange',
  '轻微': 'blue',
};

const priorityColors: Record<string, string> = {
  'P0': 'red',
  'P1': 'orange',
  'P2': 'blue',
  'P3': 'default',
};

const statusColors: Record<string, string> = {
  '待处理': 'orange',
  '处理中': 'blue',
  '已验证': 'cyan',
  '已关闭': 'green',
  '已拒绝': 'default',
};

const columns = [
  { 
    title: 'Bug ID', 
    dataIndex: 'bugId', 
    key: 'bugId',
    width: 100,
  },
  { 
    title: 'Bug标题', 
    dataIndex: 'title', 
    key: 'title',
    width: 250,
  },
  { title: '模块', dataIndex: 'module', key: 'module' },
  { 
    title: '严重程度', 
    dataIndex: 'severity', 
    key: 'severity',
    render: (severity: string) => <Tag color={severityColors[severity]}>{severity}</Tag>
  },
  { 
    title: '优先级', 
    dataIndex: 'priority', 
    key: 'priority',
    render: (priority: string) => <Tag color={priorityColors[priority]}>{priority}</Tag>
  },
  { 
    title: '状态', 
    dataIndex: 'status', 
    key: 'status',
    render: (status: string) => <Tag color={statusColors[status]}>{status}</Tag>
  },
  { title: '责任人', dataIndex: 'assignee', key: 'assignee' },
  { title: '创建时间', dataIndex: 'createTime', key: 'createTime' },
  {
    title: '操作',
    key: 'action',
    width: 120,
    render: () => (
      <div className="flex gap-2">
        <Button type="link" size="small">详情</Button>
        <Button type="link" size="small">编辑</Button>
      </div>
    ),
  },
];

export default function BugPage() {
  const params = useParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  // 计算统计数据
  const totalBugs = bugData.length;
  const criticalBugs = bugData.filter(b => b.severity === '严重').length;
  const pendingBugs = bugData.filter(b => b.status === '待处理').length;
  const processingBugs = bugData.filter(b => b.status === '处理中').length;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Bug统计 */}
        <Row gutter={[16, 16]}>
          <Col xs={6}>
            <Card className="bg-[#141b2d] border-[#2a3548]">
              <div className="text-center">
                <div className="text-[#8c92a4] text-sm">Bug总数</div>
                <div className="text-2xl text-white font-semibold">{totalBugs}</div>
              </div>
            </Card>
          </Col>
          <Col xs={6}>
            <Card className="bg-[#141b2d] border-[#2a3548]">
              <div className="text-center">
                <div className="text-[#8c92a4] text-sm">严重</div>
                <div className="text-2xl text-red-500 font-semibold">{criticalBugs}</div>
              </div>
            </Card>
          </Col>
          <Col xs={6}>
            <Card className="bg-[#141b2d] border-[#2a3548]">
              <div className="text-center">
                <div className="text-[#8c92a4] text-sm">待处理</div>
                <div className="text-2xl text-orange-500 font-semibold">{pendingBugs}</div>
              </div>
            </Card>
          </Col>
          <Col xs={6}>
            <Card className="bg-[#141b2d] border-[#2a3548]">
              <div className="text-center">
                <div className="text-[#8c92a4] text-sm">处理中</div>
                <div className="text-2xl text-blue-500 font-semibold">{processingBugs}</div>
              </div>
            </Card>
          </Col>
        </Row>

        {/* 严重程度分布 */}
        <div className="bg-[#141b2d] rounded-xl border border-[#2a3548] p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Bug严重程度分布</h3>
          <div className="flex gap-6">
            <div className="flex-1">
              <div className="flex justify-between mb-2">
                <span className="text-[#8c92a4]">严重</span>
                <span className="text-white">{criticalBugs}</span>
              </div>
              <Progress percent={(criticalBugs / totalBugs) * 100} strokeColor="#ff4d4f" showInfo={false} />
            </div>
            <div className="flex-1">
              <div className="flex justify-between mb-2">
                <span className="text-[#8c92a4]">一般</span>
                <span className="text-white">{bugData.filter(b => b.severity === '一般').length}</span>
              </div>
              <Progress percent={(bugData.filter(b => b.severity === '一般').length / totalBugs) * 100} strokeColor="#faad14" showInfo={false} />
            </div>
            <div className="flex-1">
              <div className="flex justify-between mb-2">
                <span className="text-[#8c92a4]">轻微</span>
                <span className="text-white">{bugData.filter(b => b.severity === '轻微').length}</span>
              </div>
              <Progress percent={(bugData.filter(b => b.severity === '轻微').length / totalBugs) * 100} strokeColor="#1890ff" showInfo={false} />
            </div>
          </div>
        </div>

        {/* Bug列表 */}
        <div className="bg-[#141b2d] rounded-xl border border-[#2a3548] p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">缺陷管理</h2>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
              提报Bug
            </Button>
          </div>
          
          <div className="flex flex-wrap gap-4 mb-4">
            <Input 
              placeholder="搜索Bug标题" 
              prefix={<SearchOutlined />} 
              className="w-64 bg-[#1a2332] border-[#2a3548]"
            />
            <Select placeholder="严重程度" className="w-36" defaultValue="all">
              <Option value="all">全部</Option>
              <Option value="critical">严重</Option>
              <Option value="normal">一般</Option>
              <Option value="minor">轻微</Option>
            </Select>
            <Select placeholder="状态" className="w-36" defaultValue="all">
              <Option value="all">全部状态</Option>
              <Option value="pending">待处理</Option>
              <Option value="processing">处理中</Option>
              <Option value="verified">已验证</Option>
              <Option value="closed">已关闭</Option>
            </Select>
            <Select placeholder="模块" className="w-40" defaultValue="all">
              <Option value="all">全部模块</Option>
              <Option value="system">系统模块</Option>
              <Option value="camera">相机模块</Option>
              <Option value="network">网络模块</Option>
              <Option value="ui">UI模块</Option>
            </Select>
          </div>

          <Table 
            dataSource={bugData}
            columns={columns}
            pagination={{ pageSize: 10 }}
            className="bug-table"
          />
        </div>

        {/* 创建Bug弹窗 */}
        <Modal
          title="提报Bug"
          open={isModalOpen}
          onCancel={() => setIsModalOpen(false)}
          onOk={() => form.submit()}
          width={600}
        >
          <Form form={form} layout="vertical">
            <Form.Item label="Bug标题" name="title" rules={[{ required: true }]}>
              <Input placeholder="请输入Bug标题" />
            </Form.Item>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="模块" name="module">
                  <Select placeholder="请选择模块">
                    <Option value="system">系统模块</Option>
                    <Option value="camera">相机模块</Option>
                    <Option value="network">网络模块</Option>
                    <Option value="ui">UI模块</Option>
                    <Option value="power">电源管理</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="严重程度" name="severity">
                  <Select placeholder="请选择严重程度">
                    <Option value="critical">严重</Option>
                    <Option value="normal">一般</Option>
                    <Option value="minor">轻微</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="优先级" name="priority">
                  <Select placeholder="请选择优先级">
                    <Option value="P0">P0</Option>
                    <Option value="P1">P1</Option>
                    <Option value="P2">P2</Option>
                    <Option value="P3">P3</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="责任人" name="assignee">
                  <Select placeholder="请选择责任人">
                    <Option value="zhangsan">张三</Option>
                    <Option value="lisi">李四</Option>
                    <Option value="wangwu">王五</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="复现步骤" name="steps">
              <Input.TextArea rows={4} placeholder="请输入复现步骤" />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </Layout>
  );
}
