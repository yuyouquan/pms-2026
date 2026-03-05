'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Layout from '@/components/Layout/Layout';
import { Select, Button, Table, Tabs, Descriptions, Card, Row, Col, Menu } from 'antd';
import { ArrowLeftOutlined, EditOutlined, RocketOutlined, SwapOutlined, PlusOutlined } from '@ant-design/icons';
import Link from 'next/link';
import Overview from './overview/page';

// 项目基础信息
const projectInfo = {
  projectName: 'X6855 H8917(Android 16)',
  projectType: '整机产品项目',
  productLine: 'NOTE',
  boardName: 'H8917',
  marketName: 'NOTE 50 Pro',
  chip: 'MT6789J (G100 Ultimate)',
  osVersion: 'XOS16.2.0',
  androidVersion: '16 (W)',
  projectStatus: '进行中',
  cooperation: 'ODC',
  softwareLevel: 'A',
  ppm: '李莲秋',
  spm: '李白',
};

const versions = [
  { value: 'v3', label: 'V3(修订版)' },
  { value: 'v2', label: 'V2(已发布)' },
  { value: 'v1', label: 'V1(已发布)' },
];

const planData = [
  {
    id: '1',
    序号: '1',
    taskName: '概念',
    owner: '张三',
    planStart: '2026-01-01',
    planEnd: '2026-01-15',
    progress: 100,
    status: '已完成',
  },
  {
    id: '1.1',
    序号: '1.1',
    taskName: '概念启动',
    owner: '李四',
    planStart: '2026-01-01',
    planEnd: '2026-01-07',
    progress: 100,
    status: '已完成',
  },
  {
    id: '1.2',
    序号: '1.2',
    taskName: 'STR1',
    owner: '王五',
    planStart: '2026-01-08',
    planEnd: '2026-01-15',
    progress: 100,
    status: '已完成',
  },
  {
    id: '2',
    序号: '2',
    taskName: '计划',
    owner: '张三',
    planStart: '2026-01-16',
    planEnd: '2026-02-28',
    progress: 80,
    status: '进行中',
  },
];

export default function ProjectSpace() {
  const params = useParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('info');
  const [version, setVersion] = useState('v3');
  const [viewMode, setViewMode] = useState('table');

  const menuItems = [
    { key: 'info', label: '📋 基础信息' },
    { key: 'overview', label: '📊 概况' },
    { key: 'requirement', label: '📝 需求' },
    { key: 'plan1', label: '📊 一级计划' },
    { key: 'plan2', label: '📈 二级计划' },
    { key: 'plan', label: '🗓 计划管理' },
    { key: 'mr', label: '🚄 MR版本' },
    { key: 'resource', label: '👥 资源' },
    { key: 'task', label: '✅ 任务' },
    { key: 'risk', label: '⚠️ 风险' },
    { key: 'bug', label: '🐛 缺陷' },
    { key: 'team', label: '👨‍👩‍👧‍👦 团队' },
    { key: 'doc', label: '📁 项目文档' },
  ];

  const columns = [
    { title: '序号', dataIndex: '序号', key: '序号', width: 80 },
    { title: '任务名称', dataIndex: 'taskName', key: 'taskName' },
    { title: '责任人', dataIndex: 'owner', key: 'owner' },
    { title: '计划开始', dataIndex: 'planStart', key: 'planStart' },
    { title: '计划结束', dataIndex: 'planEnd', key: 'planEnd' },
    { 
      title: '进度', 
      dataIndex: 'progress', 
      key: 'progress',
      render: (progress: number) => (
        <div className="flex items-center gap-2">
          <div className="w-16 h-2 bg-[#2a3548] rounded-full overflow-hidden">
            <div className="h-full bg-[#1890ff] rounded-full" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs text-[#8c92a4]">{progress}%</span>
        </div>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colors: Record<string, string> = {
          '已完成': '#52c41a',
          '进行中': '#1890ff',
          '待开始': '#8c92a4',
        };
        return <span style={{ color: colors[status] }}>{status}</span>;
      },
    },
  ];

  // 待开发模块的占位组件
  const Placeholder = ({ title }: { title: string }) => (
    <div className="h-96 flex items-center justify-center text-[#8c92a4]">
      <div className="text-center">
        <div className="text-4xl mb-4">🚧</div>
        <div>{title}开发中...</div>
        <div className="text-sm mt-2">待需求明确后实现</div>
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="space-y-6">
        {/* 返回按钮 */}
        <div className="flex items-center gap-4">
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={() => router.push('/')}
            className="bg-[#141b2d] border-[#2a3548] text-white"
          >
            返回主页
          </Button>
          <h1 className="text-2xl font-bold text-white">{projectInfo.projectName}</h1>
        </div>

        {/* 侧边栏菜单 */}
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-2">
            <Card className="bg-[#141b2d] border-[#2a3548]">
              <Menu
                mode="vertical"
                selectedKeys={[activeTab]}
                onClick={(e) => setActiveTab(e.key)}
                className="bg-transparent border-none"
                items={menuItems}
              />
            </Card>
          </div>

          <div className="col-span-10 space-y-6">
            {/* 基础信息 */}
            {activeTab === 'info' && (
              <div className="bg-[#141b2d] rounded-xl border border-[#2a3548] p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white">项目基础信息</h2>
                  <Button icon={<EditOutlined />}>编辑</Button>
                </div>
                <Descriptions bordered column={{ xxl: 4, xl: 3, lg: 2, md: 1 }}>
                  <Descriptions.Item label="项目名">{projectInfo.projectName}</Descriptions.Item>
                  <Descriptions.Item label="项目类型">{projectInfo.projectType}</Descriptions.Item>
                  <Descriptions.Item label="产品线">{projectInfo.productLine}</Descriptions.Item>
                  <Descriptions.Item label="主板名">{projectInfo.boardName}</Descriptions.Item>
                  <Descriptions.Item label="市场名">{projectInfo.marketName}</Descriptions.Item>
                  <Descriptions.Item label="芯片">{projectInfo.chip}</Descriptions.Item>
                  <Descriptions.Item label="OS版本">{projectInfo.osVersion}</Descriptions.Item>
                  <Descriptions.Item label="安卓版本">{projectInfo.androidVersion}</Descriptions.Item>
                  <Descriptions.Item label="项目状态">{projectInfo.projectStatus}</Descriptions.Item>
                  <Descriptions.Item label="合作形式">{projectInfo.cooperation}</Descriptions.Item>
                  <Descriptions.Item label="软件项目等级">{projectInfo.softwareLevel}</Descriptions.Item>
                  <Descriptions.Item label="PPM">{projectInfo.ppm}</Descriptions.Item>
                  <Descriptions.Item label="SPM">{projectInfo.spm}</Descriptions.Item>
                </Descriptions>
              </div>
            )}

            {/* 概况 */}
            {activeTab === 'overview' && <Overview />}

            {/* 需求 */}
            {activeTab === 'requirement' && (
              <div className="bg-[#141b2d] rounded-xl border border-[#2a3548] p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white">需求开发计划</h2>
                  <Link href={`/project/${params.id}/space/requirement`}>
                    <Button type="primary">进入详情</Button>
                  </Link>
                </div>
              </div>
            )}

            {/* 一级计划/二级计划/计划总览 */}
            {(activeTab === 'plan1' || activeTab === 'plan2' || activeTab === 'overview') && (
              <>
                <div className="bg-[#141b2d] rounded-xl border border-[#2a3548] p-4">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                      <span className="text-white">版本:</span>
                      <Select value={version} onChange={setVersion} className="w-40" options={versions} />
                    </div>
                    <div className="flex gap-2">
                      <Button icon={<PlusOutlined />}>创建修订</Button>
                      <Button icon={<EditOutlined />}>编辑</Button>
                      <Button type="primary" icon={<RocketOutlined />}>发布</Button>
                      <Button icon={<SwapOutlined />}>历史版本对比</Button>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button type={viewMode === 'table' ? 'primary' : 'default'} onClick={() => setViewMode('table')}>
                    📊 表格视图
                  </Button>
                  <Button type={viewMode === 'gantt' ? 'primary' : 'default'} onClick={() => setViewMode('gantt')}>
                    📈 甘特图
                  </Button>
                </div>

                <div className="bg-[#141b2d] rounded-xl border border-[#2a3548] p-6">
                  {viewMode === 'table' ? (
                    <Table dataSource={planData} columns={columns} rowKey="id" pagination={false} />
                  ) : (
                    <Placeholder title="甘特图" />
                  )}
                </div>
              </>
            )}

            {/* MR版本 */}
            {activeTab === 'mr' && (
              <div className="bg-[#141b2d] rounded-xl border border-[#2a3548] p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white">1+N MR版本火车计划</h2>
                  <Link href={`/project/${params.id}/space/mr`}>
                    <Button type="primary">进入详情</Button>
                  </Link>
                </div>
              </div>
            )}

            {/* 计划管理 */}
            {activeTab === 'plan' && (
              <div className="bg-[#141b2d] rounded-xl border border-[#2a3548] p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white">计划管理</h2>
                  <Link href={`/project/${params.id}/space/plan`}>
                    <Button type="primary">进入详情</Button>
                  </Link>
                </div>
              </div>
            )}

            {/* 资源管理 */}
            {activeTab === 'resource' && (
              <div className="bg-[#141b2d] rounded-xl border border-[#2a3548] p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white">资源管理</h2>
                  <Link href={`/project/${params.id}/space/resource`}>
                    <Button type="primary">进入详情</Button>
                  </Link>
                </div>
              </div>
            )}

            {/* 任务管理 */}
            {activeTab === 'task' && (
              <div className="bg-[#141b2d] rounded-xl border border-[#2a3548] p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white">任务管理</h2>
                  <Link href={`/project/${params.id}/space/task`}>
                    <Button type="primary">进入详情</Button>
                  </Link>
                </div>
              </div>
            )}

            {/* 风险管理 */}
            {activeTab === 'risk' && (
              <div className="bg-[#141b2d] rounded-xl border border-[#2a3548] p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white">风险管理</h2>
                  <Link href={`/project/${params.id}/space/risk`}>
                    <Button type="primary">进入详情</Button>
                  </Link>
                </div>
              </div>
            )}

            {/* 缺陷管理 */}
            {activeTab === 'bug' && (
              <div className="bg-[#141b2d] rounded-xl border border-[#2a3548] p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white">缺陷管理</h2>
                  <Link href={`/project/${params.id}/space/bug`}>
                    <Button type="primary">进入详情</Button>
                  </Link>
                </div>
              </div>
            )}

            {/* 团队管理 */}
            {activeTab === 'team' && (
              <div className="bg-[#141b2d] rounded-xl border border-[#2a3548] p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white">团队管理</h2>
                  <Link href={`/project/${params.id}/space/team`}>
                    <Button type="primary">进入详情</Button>
                  </Link>
                </div>
              </div>
            )}

            {/* 项目文档 */}
            {activeTab === 'doc' && (
              <div className="bg-[#141b2d] rounded-xl border border-[#2a3548] p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white">项目文档</h2>
                  <Link href={`/project/${params.id}/space/doc`}>
                    <Button type="primary">进入详情</Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
