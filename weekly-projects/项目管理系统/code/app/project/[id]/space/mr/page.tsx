'use client';

import { useParams } from 'next/navigation';
import Layout from '@/components/Layout/Layout';
import { Card, Table, Tag, Button, Input, Select, Row, Col, Tabs, Modal, Form, DatePicker, Progress } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, BarChartOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { useState } from 'react';

const { Option } = Select;
const { RangePicker } = DatePicker;

// MR版本火车计划数据
const mrPlanData = [
  {
    key: '1',
    version: 'FR',
    versionType: 'FR版本火车计划',
    status: '已完成',
    progress: 100,
    startDate: '2026-01-02',
    endDate: '2026-02-02',
    spm: '张三',
    tpm: '李四',
  },
  {
    key: '2',
    version: 'MR1',
    versionType: 'MR1版本火车计划',
    status: '进行中',
    progress: 65,
    startDate: '2026-02-03',
    endDate: '2026-03-15',
    spm: '张三',
    tpm: '李四',
  },
  {
    key: '3',
    version: 'MR2',
    versionType: 'MR2版本火车计划',
    status: '待开始',
    progress: 0,
    startDate: '2026-03-16',
    endDate: '2026-04-30',
    spm: '张三',
    tpm: '李四',
  },
  {
    key: '4',
    version: 'MR3',
    versionType: 'MR3版本火车计划',
    status: '待开始',
    progress: 0,
    startDate: '2026-05-01',
    endDate: '2026-06-15',
    spm: '张三',
    tpm: '李四',
  },
];

// MR版本详细任务数据
const mrTaskData = [
  {
    key: '1',
   序号: '1',
    taskName: '版本规划',
    responsible: '张三',
    preTask: '-',
    planStart: '2026-02-03',
    planEnd: '2026-02-10',
    actualStart: '2026-02-03',
    actualEnd: '2026-02-09',
    duration: '7天',
    status: '已完成',
    progress: 100,
  },
  {
    key: '2',
    序号: '1.1',
    taskName: '需求收集与评估',
    responsible: '李四',
    preTask: '-',
    planStart: '2026-02-03',
    planEnd: '2026-02-05',
    actualStart: '2026-02-03',
    actualEnd: '2026-02-05',
    duration: '2天',
    status: '已完成',
    progress: 100,
  },
  {
    key: '3',
    序号: '1.2',
    taskName: '版本计划制定',
    responsible: '王五',
    preTask: '1.1',
    planStart: '2026-02-06',
    planEnd: '2026-02-10',
    actualStart: '2026-02-06',
    actualEnd: '2026-02-09',
    duration: '4天',
    status: '已完成',
    progress: 100,
  },
  {
    key: '4',
    序号: '2',
    taskName: '版本开发',
    responsible: '赵六',
    preTask: '1',
    planStart: '2026-02-11',
    planEnd: '2026-03-10',
    actualStart: '2026-02-11',
    actualEnd: '-',
    duration: '27天',
    status: '进行中',
    progress: 60,
  },
  {
    key: '5',
    序号: '2.1',
    taskName: '功能开发',
    responsible: '钱七',
    preTask: '1.2',
    planStart: '2026-02-11',
    planEnd: '2026-02-28',
    actualStart: '2026-02-11',
    actualEnd: '-',
    duration: '17天',
    status: '进行中',
    progress: 70,
  },
  {
    key: '6',
    序号: '2.2',
    taskName: '代码评审',
    responsible: '孙八',
    preTask: '2.1',
    planStart: '2026-03-01',
    planEnd: '2026-03-05',
    actualStart: '2026-03-01',
    actualEnd: '-',
    duration: '4天',
    status: '进行中',
    progress: 40,
  },
  {
    key: '7',
    序号: '2.3',
    taskName: 'MR版本转测',
    responsible: '周九',
    preTask: '2.2',
    planStart: '2026-03-06',
    planEnd: '2026-03-10',
    actualStart: '-',
    actualEnd: '-',
    duration: '4天',
    status: '待开始',
    progress: 0,
  },
  {
    key: '8',
    序号: '3',
    taskName: '版本测试',
    responsible: '吴十',
    preTask: '2',
    planStart: '2026-03-11',
    planEnd: '2026-03-15',
    actualStart: '-',
    actualEnd: '-',
    duration: '4天',
    status: '待开始',
    progress: 0,
  },
];

const statusColors: Record<string, string> = {
  '已完成': 'green',
  '进行中': 'blue',
  '待开始': 'default',
  '已取消': 'default',
};

const columns = [
  { title: '版本', dataIndex: 'version', key: 'version', width: 80 },
  { 
    title: '版本类型', 
    dataIndex: 'versionType', 
    key: 'versionType',
    render: (type: string) => <Tag color="blue">{type}</Tag>
  },
  { 
    title: '状态', 
    dataIndex: 'status', 
    key: 'status',
    render: (status: string) => <Tag color={statusColors[status]}>{status}</Tag>
  },
  { 
    title: '进度', 
    dataIndex: 'progress', 
    key: 'progress',
    render: (progress: number) => (
      <Progress percent={progress} size="small" strokeColor={progress === 100 ? '#52c41a' : '#1890ff'} />
    )
  },
  { title: '计划开始', dataIndex: 'planStart', key: 'planStart' },
  { title: '计划结束', dataIndex: 'planEnd', key: 'planEnd' },
  { title: 'SPM', dataIndex: 'spm', key: 'spm' },
  { title: 'TPM', dataIndex: 'tpm', key: 'tpm' },
  {
    title: '操作',
    key: 'action',
    width: 100,
    render: () => (
      <Button type="link" size="small">详情</Button>
    ),
  },
];

const taskColumns = [
  { title: '序号', dataIndex: '序号', key: '序号', width: 70 },
  { title: '任务名称', dataIndex: 'taskName', key: 'taskName', width: 180 },
  { title: '责任人', dataIndex: 'responsible', key: 'responsible' },
  { title: '前置任务', dataIndex: 'preTask', key: 'preTask' },
  { title: '计划开始', dataIndex: 'planStart', key: 'planStart' },
  { title: '计划结束', dataIndex: 'planEnd', key: 'planEnd' },
  { title: '实际开始', dataIndex: 'actualStart', key: 'actualStart' },
  { title: '实际结束', dataIndex: 'actualEnd', key: 'actualEnd' },
  { title: '工期', dataIndex: 'duration', key: 'duration' },
  { 
    title: '状态', 
    dataIndex: 'status', 
    key: 'status',
    render: (status: string) => <Tag color={statusColors[status]}>{status}</Tag>
  },
  { 
    title: '进度', 
    dataIndex: 'progress', 
    key: 'progress',
    width: 100,
    render: (progress: number) => (
      <Progress percent={progress} size="small" strokeColor={progress === 100 ? '#52c41a' : '#1890ff'} />
    )
  },
];

export default function MRPage() {
  const params = useParams();
  const [activeTab, setActiveTab] = useState('overview');
  const [viewMode, setViewMode] = useState<'table' | 'gantt'>('table');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  // 统计数据
  const totalVersions = mrPlanData.length;
  const completedVersions = mrPlanData.filter(m => m.status === '已完成').length;
  const ongoingVersions = mrPlanData.filter(m => m.status === '进行中').length;

  const items = [
    {
      key: 'overview',
      label: 'MR版本总览',
      children: (
        <div className="space-y-6">
          {/* 版本统计 */}
          <Row gutter={[16, 16]}>
            <Col xs={8}>
              <Card className="bg-[#141b2d] border-[#2a3548]">
                <div className="text-center">
                  <div className="text-[#8c92a4] text-sm">MR版本数</div>
                  <div className="text-2xl text-white font-semibold">{totalVersions}</div>
                </div>
              </Card>
            </Col>
            <Col xs={8}>
              <Card className="bg-[#141b2d] border-[#2a3548]">
                <div className="text-center">
                  <div className="text-[#8c92a4] text-sm">已完成</div>
                  <div className="text-2xl text-green-500 font-semibold">{completedVersions}</div>
                </div>
              </Card>
            </Col>
            <Col xs={8}>
              <Card className="bg-[#141b2d] border-[#2a3548]">
                <div className="text-center">
                  <div className="text-[#8c92a4] text-sm">进行中</div>
                  <div className="text-2xl text-blue-500 font-semibold">{ongoingVersions}</div>
                </div>
              </Card>
            </Col>
          </Row>

          {/* MR版本列表 */}
          <div className="bg-[#141b2d] rounded-xl border border-[#2a3548] p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-white">MR版本火车计划</h2>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
                创建MR版本
              </Button>
            </div>
            
            <Table 
              dataSource={mrPlanData}
              columns={columns}
              pagination={false}
              className="mr-plan-table"
            />
          </div>
        </div>
      ),
    },
    {
      key: 'MR1',
      label: 'MR1版本详情',
      children: (
        <div className="space-y-6">
          {/* 版本详情头部 */}
          <div className="bg-[#141b2d] rounded-xl border border-[#2a3548] p-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold text-white">MR1版本火车计划</h2>
                <p className="text-[#8c92a4] mt-1">计划时间: 2026-02-03 ~ 2026-03-15</p>
              </div>
              <div className="flex gap-2">
                <Button 
                  icon={<UnorderedListOutlined />}
                  type={viewMode === 'table' ? 'primary' : 'default'}
                  onClick={() => setViewMode('table')}
                >
                  表格视图
                </Button>
                <Button 
                  icon={<BarChartOutlined />}
                  type={viewMode === 'gantt' ? 'primary' : 'default'}
                  onClick={() => setViewMode('gantt')}
                >
                  甘特图
                </Button>
                <Button icon={<EditOutlined />}>编辑</Button>
              </div>
            </div>
          </div>

          {/* 筛选条件 */}
          <div className="flex flex-wrap gap-4">
            <Input 
              placeholder="搜索任务名称" 
              prefix={<SearchOutlined />} 
              className="w-64 bg-[#1a2332] border-[#2a3548]"
            />
            <Select placeholder="状态" className="w-36" defaultValue="all">
              <Option value="all">全部状态</Option>
              <Option value="completed">已完成</Option>
              <Option value="ongoing">进行中</Option>
              <Option value="pending">待开始</Option>
            </Select>
            <Select placeholder="责任人" className="w-36" defaultValue="all">
              <Option value="all">全部人员</Option>
              <Option value="zhangsan">张三</Option>
              <Option value="lisi">李四</Option>
            </Select>
            <RangePicker className="bg-[#1a2332] border-[#2a3548]" />
          </div>

          {/* 任务列表/甘特图 */}
          <div className="bg-[#141b2d] rounded-xl border border-[#2a3548] p-6">
            {viewMode === 'table' ? (
              <Table 
                dataSource={mrTaskData}
                columns={taskColumns}
                pagination={{ pageSize: 10 }}
                className="mr-task-table"
              />
            ) : (
              <div className="p-8 text-center text-[#8c92a4]">
                甘特图视图 - 需要集成DHTMLX Gantt
              </div>
            )}
          </div>
        </div>
      ),
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          items={items}
          className="mr-tabs"
        />

        {/* 创建MR版本弹窗 */}
        <Modal
          title="创建MR版本火车计划"
          open={isModalOpen}
          onCancel={() => setIsModalOpen(false)}
          onOk={() => form.submit()}
          width={600}
        >
          <Form form={form} layout="vertical">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="MR版本类型" name="mrType" rules={[{ required: true }]}>
                  <Select placeholder="请选择MR版本类型">
                    <Option value="FR">FR版本火车计划</Option>
                    <Option value="MR1">MR1版本火车计划</Option>
                    <Option value="MR2">MR2版本火车计划</Option>
                    <Option value="MR3">MR3版本火车计划</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="产品线" name="productLine">
                  <Input placeholder="例如: NOTE" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="市场名" name="market">
                  <Input placeholder="例如: OP" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="芯片厂商" name="chipVendor">
                  <Select placeholder="请选择芯片厂商">
                    <Option value="mtk">MTK</Option>
                    <Option value="qcom">QCOM</Option>
                    <Option value="unisoc">UNISOC</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="项目SPM" name="spm">
                  <Select placeholder="请选择SPM">
                    <Option value="zhangsan">张三</Option>
                    <Option value="lisi">李四</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="项目TPM" name="tpm">
                  <Select placeholder="请选择TPM">
                    <Option value="wangwu">王五</Option>
                    <Option value="zhaoliu">赵六</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="计划时间" name="dateRange">
              <RangePicker style={{ width: '100%' }} />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </Layout>
  );
}
