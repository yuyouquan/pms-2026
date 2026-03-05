'use client';

import { useParams } from 'next/navigation';
import Layout from '@/components/Layout/Layout';
import { Card, Table, Tag, Button, Input, Select, Row, Col, Modal, Form, Avatar } from 'antd';
import { PlusOutlined, SearchOutlined, UserOutlined, TeamOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useState } from 'react';

const { Option } = Select;

const teamData = [
  { 
    key: '1', 
    name: '张三', 
    role: '项目经理',
    department: '项目管理部',
    email: 'zhangsan@company.com',
    phone: '138****1234',
    status: '在岗'
  },
  { 
    key: '2', 
    name: '李四', 
    role: '技术负责人',
    department: '研发部',
    email: 'lisi@company.com',
    phone: '139****5678',
    status: '在岗'
  },
  { 
    key: '3', 
    name: '王五', 
    role: '开发工程师',
    department: '研发部',
    email: 'wangwu@company.com',
    phone: '136****9012',
    status: '在岗'
  },
  { 
    key: '4', 
    name: '赵六', 
    role: '测试工程师',
    department: '测试部',
    email: 'zhaoliu@company.com',
    phone: '137****3456',
    status: '在岗'
  },
  { 
    key: '5', 
    name: '钱七', 
    role: 'UI设计师',
    department: '设计部',
    email: 'qianqi@company.com',
    phone: '135****7890',
    status: '请假'
  },
  { 
    key: '6', 
    name: '孙八', 
    role: '运维工程师',
    department: '运维部',
    email: 'sunba@company.com',
    phone: '134****2345',
    status: '在岗'
  },
  { 
    key: '7', 
    name: '周九', 
    role: '产品经理',
    department: '产品部',
    email: 'zhoujiu@company.com',
    phone: '133****6789',
    status: '在岗'
  },
  { 
    key: '8', 
    name: '吴十', 
    role: '质量工程师',
    department: '质量部',
    email: 'wushi@company.com',
    phone: '132****0123',
    status: '在岗'
  },
];

const roleColors: Record<string, string> = {
  '项目经理': 'blue',
  '技术负责人': 'purple',
  '开发工程师': 'cyan',
  '测试工程师': 'orange',
  'UI设计师': 'pink',
  '运维工程师': 'green',
  '产品经理': 'red',
  '质量工程师': 'gold',
};

const statusColors: Record<string, string> = {
  '在岗': 'green',
  '请假': 'orange',
  '离职': 'red',
};

const columns = [
  { 
    title: '成员', 
    key: 'member',
    render: (_: any, record: any) => (
      <div className="flex items-center gap-3">
        <Avatar style={{ backgroundColor: '#1890ff' }} icon={<UserOutlined />} />
        <span className="font-medium">{record.name}</span>
      </div>
    )
  },
  { 
    title: '角色', 
    dataIndex: 'role', 
    key: 'role',
    render: (role: string) => <Tag color={roleColors[role]}>{role}</Tag>
  },
  { title: '部门', dataIndex: 'department', key: 'department' },
  { title: '邮箱', dataIndex: 'email', key: 'email' },
  { title: '电话', dataIndex: 'phone', key: 'phone' },
  { 
    title: '状态', 
    dataIndex: 'status', 
    key: 'status',
    render: (status: string) => <Tag color={statusColors[status]}>{status}</Tag>
  },
  {
    title: '操作',
    key: 'action',
    width: 120,
    render: () => (
      <div className="flex gap-2">
        <Button type="link" size="small" icon={<EditOutlined />}>编辑</Button>
        <Button type="link" size="small" danger icon={<DeleteOutlined />}>移除</Button>
      </div>
    ),
  },
];

// 角色列表
const roleOptions = [
  '项目经理', '技术负责人', '开发工程师', '测试工程师', 
  'UI设计师', '运维工程师', '产品经理', '质量工程师'
];

// 部门列表
const departmentOptions = [
  '项目管理部', '研发部', '测试部', '设计部', '运维部', '产品部', '质量部'
];

export default function TeamPage() {
  const params = useParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  // 计算统计数据
  const totalMembers = teamData.length;
  const activeMembers = teamData.filter(t => t.status === '在岗').length;
  const onLeaveMembers = teamData.filter(t => t.status === '请假').length;

  // 按角色统计
  const roleStats = teamData.reduce((acc, member) => {
    acc[member.role] = (acc[member.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Layout>
      <div className="space-y-6">
        {/* 团队统计 */}
        <Row gutter={[16, 16]}>
          <Col xs={8}>
            <Card className="bg-[#141b2d] border-[#2a3548]">
              <div className="text-center">
                <div className="text-[#8c92a4] text-sm">团队总人数</div>
                <div className="text-2xl text-white font-semibold">{totalMembers}</div>
              </div>
            </Card>
          </Col>
          <Col xs={8}>
            <Card className="bg-[#141b2d] border-[#2a3548]">
              <div className="text-center">
                <div className="text-[#8c92a4] text-sm">在岗</div>
                <div className="text-2xl text-green-500 font-semibold">{activeMembers}</div>
              </div>
            </Card>
          </Col>
          <Col xs={8}>
            <Card className="bg-[#141b2d] border-[#2a3548]">
              <div className="text-center">
                <div className="text-[#8c92a4] text-sm">请假</div>
                <div className="text-2xl text-orange-500 font-semibold">{onLeaveMembers}</div>
              </div>
            </Card>
          </Col>
        </Row>

        {/* 角色分布 */}
        <div className="bg-[#141b2d] rounded-xl border border-[#2a3548] p-6">
          <h3 className="text-lg font-semibold text-white mb-4">角色分布</h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(roleStats).map(([role, count]) => (
              <Tag key={role} color={roleColors[role]} className="px-3 py-1">
                {role}: {count}人
              </Tag>
            ))}
          </div>
        </div>

        {/* 团队成员列表 */}
        <div className="bg-[#141b2d] rounded-xl border border-[#2a3548] p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">团队成员</h2>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
              添加成员
            </Button>
          </div>
          
          <div className="flex flex-wrap gap-4 mb-4">
            <Input 
              placeholder="搜索成员姓名" 
              prefix={<SearchOutlined />} 
              className="w-64 bg-[#1a2332] border-[#2a3548]"
            />
            <Select placeholder="角色" className="w-40" defaultValue="all">
              <Option value="all">全部角色</Option>
              {roleOptions.map(role => (
                <Option key={role} value={role}>{role}</Option>
              ))}
            </Select>
            <Select placeholder="部门" className="w-40" defaultValue="all">
              <Option value="all">全部部门</Option>
              {departmentOptions.map(dept => (
                <Option key={dept} value={dept}>{dept}</Option>
              ))}
            </Select>
            <Select placeholder="状态" className="w-36" defaultValue="all">
              <Option value="all">全部状态</Option>
              <Option value="active">在岗</Option>
              <Option value="leave">请假</Option>
              <Option value="left">离职</Option>
            </Select>
          </div>

          <Table 
            dataSource={teamData}
            columns={columns}
            pagination={{ pageSize: 10 }}
            className="team-table"
          />
        </div>

        {/* 添加成员弹窗 */}
        <Modal
          title="添加团队成员"
          open={isModalOpen}
          onCancel={() => setIsModalOpen(false)}
          onOk={() => form.submit()}
          width={500}
        >
          <Form form={form} layout="vertical">
            <Form.Item label="姓名" name="name" rules={[{ required: true }]}>
              <Input placeholder="请输入成员姓名" />
            </Form.Item>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="角色" name="role" rules={[{ required: true }]}>
                  <Select placeholder="请选择角色">
                    {roleOptions.map(role => (
                      <Option key={role} value={role}>{role}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="部门" name="department" rules={[{ required: true }]}>
                  <Select placeholder="请选择部门">
                    {departmentOptions.map(dept => (
                      <Option key={dept} value={dept}>{dept}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="邮箱" name="email" rules={[{ required: true, type: 'email' }]}>
                  <Input placeholder="请输入邮箱" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="电话" name="phone">
                  <Input placeholder="请输入电话" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="状态" name="status" initialValue="在岗">
              <Select placeholder="请选择状态">
                <Option value="在岗">在岗</Option>
                <Option value="请假">请假</Option>
                <Option value="离职">离职</Option>
              </Select>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </Layout>
  );
}
