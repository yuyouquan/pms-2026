'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Layout from '@/components/Layout/Layout';
import { Card, Button, Select, Table, Tabs, Progress, Row, Col, Tag, Modal, Input, DatePicker, message } from 'antd';
import { ArrowLeftOutlined, PlusOutlined, EditOutlined, DeleteOutlined, RocketOutlined, SwapOutlined, EyeOutlined, CalendarOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { RangePicker } = DatePicker;

// 版本列表
const versionOptions = [
  { value: 'v3', label: 'V3(修订版)' },
  { value: 'v2', label: 'V2(已发布)' },
  { value: 'v1', label: 'V1(已发布)' },
];

// 一级计划数据
const level1PlanData = [
  {
    id: '1',
    序号: '1',
    taskName: '概念',
    owner: '张三',
    preTask: '',
    planStart: '2026-01-01',
    planEnd: '2026-01-15',
    duration: 15,
    actualStart: '2026-01-01',
    actualEnd: '2026-01-15',
    actualDuration: 15,
    status: '已完成',
    progress: 100,
  },
  {
    id: '1.1',
    序号: '1.1',
    taskName: '概念启动',
    owner: '李四',
    preTask: '',
    planStart: '2026-01-01',
    planEnd: '2026-01-07',
    duration: 7,
    actualStart: '2026-01-01',
    actualEnd: '2026-01-07',
    actualDuration: 7,
    status: '已完成',
    progress: 100,
  },
  {
    id: '1.2',
    序号: '1.2',
    taskName: 'STR1',
    owner: '王五',
    preTask: '1.1',
    planStart: '2026-01-08',
    planEnd: '2026-01-15',
    duration: 8,
    actualStart: '2026-01-08',
    actualEnd: '2026-01-15',
    actualDuration: 8,
    status: '已完成',
    progress: 100,
  },
  {
    id: '2',
    序号: '2',
    taskName: '计划',
    owner: '张三',
    preTask: '',
    planStart: '2026-01-16',
    planEnd: '2026-02-28',
    duration: 44,
    actualStart: '2026-01-16',
    actualEnd: '',
    actualDuration: 0,
    status: '进行中',
    progress: 80,
  },
  {
    id: '2.1',
    序号: '2.1',
    taskName: 'STR2',
    owner: '李四',
    preTask: '1.2',
    planStart: '2026-01-16',
    planEnd: '2026-02-15',
    duration: 31,
    actualStart: '2026-01-16',
    actualEnd: '',
    actualDuration: 0,
    status: '进行中',
    progress: 85,
  },
  {
    id: '2.2',
    序号: '2.2',
    taskName: 'STR3',
    owner: '王五',
    preTask: '2.1',
    planStart: '2026-02-16',
    planEnd: '2026-02-28',
    duration: 13,
    actualStart: '',
    actualEnd: '',
    actualDuration: 0,
    status: '待开始',
    progress: 0,
  },
  {
    id: '3',
    序号: '3',
    taskName: '开发验证',
    owner: '张三',
    preTask: '2',
    planStart: '2026-03-01',
    planEnd: '2026-04-30',
    duration: 61,
    actualStart: '',
    actualEnd: '',
    actualDuration: 0,
    status: '待开始',
    progress: 0,
  },
  {
    id: '4',
    序号: '4',
    taskName: '上市保障',
    owner: '李四',
    preTask: '3',
    planStart: '2026-05-01',
    planEnd: '2026-05-31',
    duration: 31,
    actualStart: '',
    actualEnd: '',
    actualDuration: 0,
    status: '待开始',
    progress: 0,
  },
];

// 二级计划数据 - 在研版本火车计划
const level2TrainData = [
  {
    id: '1',
    序号: '1',
    taskName: '16.3.030',
    owner: '张三',
    preTask: '',
    planStart: '2026-01-01',
    planEnd: '2026-02-01',
    duration: 32,
    actualStart: '2026-01-01',
    actualEnd: '2026-02-01',
    actualDuration: 32,
    status: '已完成',
    progress: 100,
  },
  {
    id: '2',
    序号: '2',
    taskName: '16.3.031',
    owner: '李四',
    preTask: '1',
    planStart: '2026-02-02',
    planEnd: '2026-03-15',
    duration: 42,
    actualStart: '2026-02-02',
    actualEnd: '',
    actualDuration: 0,
    status: '进行中',
    progress: 60,
  },
  {
    id: '3',
    序号: '3',
    taskName: '16.3.032',
    owner: '王五',
    preTask: '2',
    planStart: '2026-03-16',
    planEnd: '2026-05-01',
    duration: 47,
    actualStart: '',
    actualEnd: '',
    actualDuration: 0,
    status: '待开始',
    progress: 0,
  },
];

// FR版本火车计划
const frTrainData = [
  {
    id: '1',
    序号: '1',
    taskName: '版本规划',
    owner: '张三',
    preTask: '',
    planStart: '2026-01-02',
    planEnd: '2026-02-02',
    duration: 32,
    actualStart: '2026-01-02',
    actualEnd: '2026-02-02',
    actualDuration: 32,
    status: '已完成',
    progress: 100,
    children: [
      {
        id: '1.1',
        序号: '1.1',
        taskName: '修改点收集',
        owner: '李四',
        preTask: '',
        planStart: '2026-01-02',
        planEnd: '2026-02-02',
        duration: 32,
        actualStart: '2026-01-02',
        actualEnd: '2026-02-02',
        actualDuration: 32,
        status: '已完成',
        progress: 100,
      },
    ],
  },
  {
    id: '2',
    序号: '2',
    taskName: '版本开发',
    owner: '王五',
    preTask: '1',
    planStart: '2026-02-02',
    planEnd: '2026-03-15',
    duration: 42,
    actualStart: '',
    actualEnd: '',
    actualDuration: 0,
    status: '待开始',
    progress: 0,
    children: [
      {
        id: '2.1',
        序号: '2.1',
        taskName: 'MP分支入库',
        owner: '张三',
        preTask: '',
        planStart: '2026-02-02',
        planEnd: '2026-03-01',
        duration: 28,
        actualStart: '',
        actualEnd: '',
        actualDuration: 0,
        status: '待开始',
        progress: 0,
      },
      {
        id: '2.2',
        序号: '2.2',
        taskName: 'MR版本转测',
        owner: '李四',
        preTask: '2.1',
        planStart: '2026-03-02',
        planEnd: '2026-03-15',
        duration: 14,
        actualStart: '',
        actualEnd: '',
        actualDuration: 0,
        status: '待开始',
        progress: 0,
      },
    ],
  },
  {
    id: '3',
    序号: '3',
    taskName: '版本测试',
    owner: '王五',
    preTask: '2',
    planStart: '2026-03-16',
    planEnd: '2026-05-01',
    duration: 47,
    actualStart: '',
    actualEnd: '',
    actualDuration: 0,
    status: '待开始',
    progress: 0,
    children: [
      {
        id: '3.1',
        序号: '3.1',
        taskName: 'MR版本测试',
        owner: '张三',
        preTask: '',
        planStart: '2026-03-16',
        planEnd: '2026-05-01',
        duration: 47,
        actualStart: '',
        actualEnd: '',
        actualDuration: 0,
        status: '待开始',
        progress: 0,
      },
    ],
  },
];

// 二级计划类型
const level2Types = [
  { value: 'requirement', label: '需求开发计划' },
  { value: 'train', label: '在研版本火车计划' },
  { value: 'fr', label: 'FR版本火车计划' },
  { value: 'mr', label: 'MR版本火车计划' },
  { value: 'fans', label: '粉丝版本计划' },
  { value: 'experience', label: '基础体验计划' },
  { value: 'wbs', label: 'WBS计划' },
];

// 计划总览数据（融合一级和二级计划）
const overviewData = [
  {
    id: '2',
    序号: '2',
    taskName: '计划',
    owner: '张三',
    planStart: '2026-01-01',
    planEnd: '2026-05-01',
    progress: 45,
    status: '进行中',
    type: 'level1',
    children: [
      {
        id: '2.1',
        序号: '2.1',
        taskName: 'STR2',
        owner: '李四',
        planStart: '2026-01-01',
        planEnd: '2026-03-01',
        progress: 70,
        status: '进行中',
        type: 'milestone',
        children: [
          {
            id: '2.1.1',
            序号: '2.1.1',
            taskName: '在研版本火车计划',
            owner: '张三',
            planStart: '2026-01-01',
            planEnd: '2026-02-01',
            progress: 100,
            status: '已完成',
            type: 'level2-train',
            children: [
              {
                id: '2.1.1.1',
                序号: '2.1.1.1',
                taskName: '16.3.030',
                owner: '李四',
                planStart: '2026-01-01',
                planEnd: '2026-02-01',
                progress: 100,
                status: '已完成',
                type: 'level2-item',
              },
              {
                id: '2.1.1.2',
                序号: '2.1.1.2',
                taskName: '16.3.031',
                owner: '王五',
                planStart: '2026-02-02',
                planEnd: '2026-03-01',
                progress: 50,
                status: '进行中',
                type: 'level2-item',
              },
            ],
          },
          {
            id: '2.1.2',
            序号: '2.1.2',
            taskName: 'FR版本火车计划',
            owner: '张三',
            planStart: '2026-01-02',
            planEnd: '2026-02-02',
            progress: 100,
            status: '已完成',
            type: 'level2-fr',
            children: [
              {
                id: '2.1.2.1',
                序号: '2.1.2.1',
                taskName: '版本规划',
                owner: '李四',
                planStart: '2026-01-02',
                planEnd: '2026-02-02',
                progress: 100,
                status: '已完成',
                type: 'level2-item',
                children: [
                  {
                    id: '2.1.2.1.1',
                    序号: '2.1.2.1.1',
                    taskName: '修改点收集',
                    owner: '王五',
                    planStart: '2026-01-02',
                    planEnd: '2026-02-02',
                    progress: 100,
                    status: '已完成',
                    type: 'level2-item',
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: '2.2',
        序号: '2.2',
        taskName: 'STR3',
        owner: '王五',
        planStart: '2026-03-02',
        planEnd: '2026-05-01',
        progress: 20,
        status: '进行中',
        type: 'milestone',
        children: [
          {
            id: '2.2.1',
            序号: '2.2.1',
            taskName: '在研版本火车计划',
            owner: '张三',
            planStart: '2026-02-02',
            planEnd: '2026-05-01',
            progress: 30,
            status: '进行中',
            type: 'level2-train',
            children: [
              {
                id: '2.2.1.1',
                序号: '2.2.1.1',
                taskName: '16.3.031',
                owner: '李四',
                planStart: '2026-02-02',
                planEnd: '2026-03-15',
                progress: 50,
                status: '进行中',
                type: 'level2-item',
              },
              {
                id: '2.2.1.2',
                序号: '2.2.1.2',
                taskName: '16.3.032',
                owner: '王五',
                planStart: '2026-03-16',
                planEnd: '2026-05-01',
                progress: 0,
                status: '待开始',
                type: 'level2-item',
              },
            ],
          },
          {
            id: '2.2.2',
            序号: '2.2.2',
            taskName: 'FR版本火车计划',
            owner: '张三',
            planStart: '2026-02-02',
            planEnd: '2026-05-01',
            progress: 25,
            status: '进行中',
            type: 'level2-fr',
            children: [
              {
                id: '2.2.2.1',
                序号: '2.2.2.1',
                taskName: '版本开发',
                owner: '李四',
                planStart: '2026-02-02',
                planEnd: '2026-03-15',
                progress: 40,
                status: '进行中',
                type: 'level2-item',
                children: [
                  {
                    id: '2.2.2.1.1',
                    序号: '2.2.2.1.1',
                    taskName: 'MP分支入库',
                    owner: '王五',
                    planStart: '2026-02-02',
                    planEnd: '2026-03-01',
                    progress: 60,
                    status: '进行中',
                    type: 'level2-item',
                  },
                  {
                    id: '2.2.2.1.2',
                    序号: '2.2.2.1.2',
                    taskName: 'MR版本转测',
                    owner: '张三',
                    planStart: '2026-03-02',
                    planEnd: '2026-03-15',
                    progress: 0,
                    status: '待开始',
                    type: 'level2-item',
                  },
                ],
              },
              {
                id: '2.2.2.2',
                序号: '2.2.2.2',
                taskName: '版本测试',
                owner: '李四',
                planStart: '2026-03-16',
                planEnd: '2026-05-01',
                progress: 0,
                status: '待开始',
                type: 'level2-item',
                children: [
                  {
                    id: '2.2.2.2.1',
                    序号: '2.2.2.2.1',
                    taskName: 'MR版本测试',
                    owner: '王五',
                    planStart: '2026-03-16',
                    planEnd: '2026-05-01',
                    progress: 0,
                    status: '待开始',
                    type: 'level2-item',
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

// 通用表格列配置
const commonColumns: ColumnsType<any> = [
  { 
    title: '序号', 
    dataIndex: '序号', 
    key: '序号', 
    width: 80,
    fixed: 'left',
    render: (text, record) => {
      const indent = record.type === 'level1' ? '' : 
                     record.type === 'milestone' ? '  ' :
                     record.type?.startsWith('level2') ? '    ' : '      ';
      return <span style={{ fontFamily: 'monospace' }}>{indent}{text}</span>;
    }
  },
  { title: '任务名称', dataIndex: 'taskName', key: 'taskName', width: 200,
    render: (text, record) => {
      const colors: Record<string, string> = {
        'level1': '#1890ff',
        'milestone': '#52c41a',
        'level2-train': '#722ed1',
        'level2-fr': '#eb2f96',
        'level2-item': '#8c92a4',
      };
      const color = colors[record.type] || '#8c92a4';
      return <span style={{ color }}>{text}</span>;
    }
  },
  { title: '责任人', dataIndex: 'owner', key: 'owner', width: 100 },
  { title: '计划开始', dataIndex: 'planStart', key: 'planStart', width: 120 },
  { title: '计划结束', dataIndex: 'planEnd', key: 'planEnd', width: 120 },
  { title: '预估工期', dataIndex: 'duration', key: 'duration', width: 100 },
  { title: '实际开始', dataIndex: 'actualStart', key: 'actualStart', width: 120 },
  { title: '实际结束', dataIndex: 'actualEnd', key: 'actualEnd', width: 120 },
  { title: '实际工期', dataIndex: 'actualDuration', key: 'actualDuration', width: 100 },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    render: (status: string) => {
      const colors: Record<string, string> = {
        '已完成': '#52c41a',
        '进行中': '#1890ff',
        '待开始': '#8c92a4',
      };
      return <span style={{ color: colors[status] }}>{status}</span>;
    },
  },
  {
    title: '完成进度',
    dataIndex: 'progress',
    key: 'progress',
    width: 150,
    render: (progress: number) => (
      <div className="flex items-center gap-2">
        <Progress percent={progress} size="small" strokeColor="#1890ff" />
      </div>
    ),
  },
];

export default function PlanPage() {
  const params = useParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [version, setVersion] = useState('v3');
  const [viewMode, setViewMode] = useState('table');
  const [level2Type, setLevel2Type] = useState('train');
  const [isEditing, setIsEditing] = useState(false);
  const [expandedRows, setExpandedRows] = useState<string[]>(['2', '2.1', '2.2']);

  const tabItems = [
    { key: 'level1', label: '📊 一级计划' },
    { key: 'level2', label: '📈 二级计划' },
    { key: 'overview', label: '🗓 计划总览' },
  ];

  // 甘特图组件
  const GanttChart = ({ data, title }: { data: any[], title: string }) => {
    const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05'];
    
    const getPosition = (start: string, end: string) => {
      if (!start || !end) return { left: 0, width: 0 };
      const startMonth = parseInt(start.split('-')[1]);
      const startDay = parseInt(start.split('-')[2]);
      const endMonth = parseInt(end.split('-')[1]);
      const endDay = parseInt(end.split('-')[2]);
      
      const totalDays = (endMonth - startMonth) * 30 + (endDay - startDay);
      const left = (startMonth - 1) * 120 + (startDay / 30) * 120;
      const width = (totalDays / 30) * 120;
      
      return { left, width: Math.max(width, 20) };
    };

    const flattenData = (items: any[], level = 0): any[] => {
      let result: any[] = [];
      items.forEach(item => {
        result.push({ ...item, level });
        if (item.children) {
          result = result.concat(flattenData(item.children, level + 1));
        }
      });
      return result;
    };

    const flatData = flattenData(data);

    const colors: Record<string, string> = {
      'level1': '#1890ff',
      'milestone': '#52c41a',
      'level2-train': '#722ed1',
      'level2-fr': '#eb2f96',
      'level2-item': '#8c92a4',
    };

    return (
      <div className="bg-[#1a2235] rounded-lg p-4">
        <h3 className="text-white font-semibold mb-4">{title}</h3>
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            {/* 月份标题 */}
            <div className="flex border-b border-[#2a3548] pb-2 mb-2">
              <div className="w-48 flex-shrink-0 text-[#8c92a4] text-sm">任务名称</div>
              <div className="flex-1 flex">
                {months.map(month => (
                  <div key={month} className="w-[120px] text-center text-[#8c92a4] text-sm">{month}</div>
                ))}
              </div>
            </div>
            {/* 数据行 */}
            {flatData.map((row, idx) => {
              const { left, width } = getPosition(row.planStart, row.planEnd);
              const color = colors[row.type] || '#8c92a4';
              return (
                <div key={row.id} className="flex items-center h-8 border-b border-[#2a3548]/50 hover:bg-[#2a3548]/30">
                  <div className="w-48 flex-shrink-0 text-white text-sm truncate pr-2" style={{ paddingLeft: `${row.level * 16}px` }}>
                    {row.taskName}
                  </div>
                  <div className="flex-1 relative h-full">
                    <div className="absolute h-3 top-1/2 -translate-y-1/2 rounded"
                      style={{
                        left: `${left}px`,
                        width: `${width}px`,
                        backgroundColor: color,
                        opacity: row.status === '待开始' ? 0.3 : 0.8
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {/* 图例 */}
        <div className="flex gap-4 mt-4 pt-2 border-t border-[#2a3548]">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#1890ff' }} />
            <span className="text-[#8c92a4] text-sm">一级计划</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#52c41a' }} />
            <span className="text-[#8c92a4] text-sm">里程碑</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#722ed1' }} />
            <span className="text-[#8c92a4] text-sm">在研版本火车</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#eb2f96' }} />
            <span className="text-[#8c92a4] text-sm">FR版本火车</span>
          </div>
        </div>
      </div>
    );
  };

  // 获取当前标签页的数据
  const getCurrentData = () => {
    switch (activeTab) {
      case 'level1':
        return level1PlanData;
      case 'level2':
        return level2Type === 'train' ? level2TrainData : frTrainData;
      case 'overview':
        return overviewData;
      default:
        return [];
    }
  };

  const getCurrentTitle = () => {
    switch (activeTab) {
      case 'level1':
        return '一级计划管理';
      case 'level2':
        return level2Type === 'train' ? '在研版本火车计划' : 'FR版本火车计划';
      case 'overview':
        return '计划总览';
      default:
        return '';
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* 头部导航 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              icon={<ArrowLeftOutlined />} 
              onClick={() => router.push(`/project/${params.id}/space`)}
              className="bg-[#141b2d] border-[#2a3548] text-white"
            >
              返回项目空间
            </Button>
            <h1 className="text-2xl font-bold text-white">计划管理</h1>
          </div>
        </div>

        {/* 标签页 */}
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          items={tabItems}
          className="custom-tabs"
        />

        {/* 控制栏 */}
        <Card className="bg-[#141b2d] border-[#2a3548]">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              {activeTab === 'level2' && (
                <Select
                  value={level2Type}
                  onChange={setLevel2Type}
                  className="w-48"
                  options={level2Types}
                />
              )}
              <span className="text-white">版本:</span>
              <Select value={version} onChange={setVersion} className="w-40" options={versionOptions} />
            </div>
            <div className="flex gap-2">
              {!isEditing && (
                <>
                  <Button icon={<PlusOutlined />}>创建修订</Button>
                  <Button icon={<EditOutlined />} onClick={() => setIsEditing(true)}>编辑</Button>
                  <Button type="primary" icon={<RocketOutlined />}>发布</Button>
                  <Button icon={<SwapOutlined />}>历史版本对比</Button>
                </>
              )}
              {isEditing && (
                <>
                  <Button type="primary" onClick={() => { setIsEditing(false); message.success('保存成功'); }}>保存</Button>
                  <Button onClick={() => setIsEditing(false)}>取消</Button>
                </>
              )}
            </div>
          </div>
        </Card>

        {/* 视图切换 */}
        <div className="flex gap-2">
          <Button 
            type={viewMode === 'table' ? 'primary' : 'default'} 
            onClick={() => setViewMode('table')}
          >
            📊 表格视图
          </Button>
          <Button 
            type={viewMode === 'gantt' ? 'primary' : 'default'} 
            onClick={() => setViewMode('gantt')}
          >
            📈 甘特图
          </Button>
        </div>

        {/* 内容区域 */}
        <Card className="bg-[#141b2d] border-[#2a3548]">
          {viewMode === 'table' ? (
            <Table
              dataSource={getCurrentData()}
              columns={commonColumns}
              rowKey="id"
              pagination={false}
              expandable={
                activeTab === 'overview' || activeTab === 'level2'
                ? {
                    expandedRowKeys: expandedRows,
                    onExpandedRowsChange: (keys) => setExpandedRows(keys as string[]),
                    defaultExpandAllRows: true,
                  }
                : undefined
              }
              scroll={{ x: 1200 }}
            />
          ) : (
            <GanttChart data={getCurrentData()} title={getCurrentTitle()} />
          )}
        </Card>
      </div>

      <style jsx global>{`
        .custom-tabs .ant-tabs-nav {
          background: #141b2d;
          padding: 0 16px;
          border-radius: 8px 8px 0 0;
        }
        .custom-tabs .ant-tabs-tab {
          color: #8c92a4;
        }
        .custom-tabs .ant-tabs-tab-active .ant-tabs-tab-btn {
          color: #1890ff !important;
        }
        .custom-tabs .ant-tabs-ink-bar {
          background: #1890ff;
        }
      `}</style>
    </Layout>
  );
}
