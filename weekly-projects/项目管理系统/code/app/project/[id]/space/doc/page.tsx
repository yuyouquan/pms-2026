'use client';

import { useParams } from 'next/navigation';
import Layout from '@/components/Layout/Layout';
import { Card, Table, Tag, Button, Input, Select, Row, Col, Modal, Form, Upload, Tree } from 'antd';
import { PlusOutlined, SearchOutlined, FileTextOutlined, FolderOutlined, InboxOutlined, DeleteOutlined, DownloadOutlined } from '@ant-design/icons';
import { useState } from 'react';

const { Option } = Select;
const { Dragger } = Upload;

const docData = [
  { 
    key: '1', 
    name: '项目立项报告.docx', 
    type: '文档',
    category: '立项材料',
    size: '2.5MB',
    uploader: '张三',
    uploadTime: '2026-02-15',
    version: 'V1.2'
  },
  { 
    key: '2', 
    name: '需求规格说明书.docx', 
    type: '文档',
    category: '需求文档',
    size: '5.8MB',
    uploader: '李四',
    uploadTime: '2026-02-20',
    version: 'V2.0'
  },
  { 
    key: '3', 
    name: '技术方案设计.pdf', 
    type: '文档',
    category: '技术文档',
    size: '8.2MB',
    uploader: '王五',
    uploadTime: '2026-02-25',
    version: 'V1.0'
  },
  { 
    key: '4', 
    name: '测试计划.xlsx', 
    type: '文档',
    category: '测试文档',
    size: '1.2MB',
    uploader: '赵六',
    uploadTime: '2026-03-01',
    version: 'V1.5'
  },
  { 
    key: '5', 
    name: '用户手册.pdf', 
    type: '文档',
    category: '交付文档',
    size: '15.3MB',
    uploader: '钱七',
    uploadTime: '2026-03-03',
    version: 'V1.0'
  },
  { 
    key: '6', 
    name: 'API接口文档.md', 
    type: '文档',
    category: '技术文档',
    size: '0.5MB',
    uploader: '孙八',
    uploadTime: '2026-03-04',
    version: 'V2.1'
  },
];

const categoryColors: Record<string, string> = {
  '立项材料': 'blue',
  '需求文档': 'purple',
  '技术文档': 'cyan',
  '测试文档': 'orange',
  '交付文档': 'green',
};

const typeColors: Record<string, string> = {
  '文档': 'blue',
  '文件夹': 'gold',
};

const columns = [
  { 
    title: '文档名称', 
    dataIndex: 'name', 
    key: 'name',
    render: (name: string, record: any) => (
      <div className="flex items-center gap-2">
        {record.type === '文件夹' ? <FolderOutlined className="text-yellow-500" /> : <FileTextOutlined className="text-blue-500" />}
        <span>{name}</span>
      </div>
    )
  },
  { 
    title: '类型', 
    dataIndex: 'type', 
    key: 'type',
    render: (type: string) => <Tag color={typeColors[type]}>{type}</Tag>
  },
  { 
    title: '分类', 
    dataIndex: 'category', 
    key: 'category',
    render: (category: string) => <Tag color={categoryColors[category]}>{category}</Tag>
  },
  { title: '大小', dataIndex: 'size', key: 'size' },
  { title: '上传人', dataIndex: 'uploader', key: 'uploader' },
  { title: '上传时间', dataIndex: 'uploadTime', key: 'uploadTime' },
  { title: '版本', dataIndex: 'version', key: 'version' },
  {
    title: '操作',
    key: 'action',
    width: 150,
    render: () => (
      <div className="flex gap-2">
        <Button type="link" size="small" icon={<DownloadOutlined />}>下载</Button>
        <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
      </div>
    ),
  },
];

// 文件夹树形结构数据
const treeData = [
  {
    title: '立项材料',
    key: 'folder-1',
    children: [
      { title: '项目立项报告.docx', key: 'file-1', isLeaf: true },
      { title: '可行性分析报告.docx', key: 'file-2', isLeaf: true },
    ],
  },
  {
    title: '需求文档',
    key: 'folder-2',
    children: [
      { title: '需求规格说明书.docx', key: 'file-3', isLeaf: true },
      { title: '需求变更记录.docx', key: 'file-4', isLeaf: true },
    ],
  },
  {
    title: '技术文档',
    key: 'folder-3',
    children: [
      { title: '技术方案设计.pdf', key: 'file-5', isLeaf: true },
      { title: 'API接口文档.md', key: 'file-6', isLeaf: true },
    ],
  },
  {
    title: '测试文档',
    key: 'folder-4',
    children: [
      { title: '测试计划.xlsx', key: 'file-7', isLeaf: true },
      { title: '测试用例.xlsx', key: 'file-8', isLeaf: true },
    ],
  },
  {
    title: '交付文档',
    key: 'folder-5',
    children: [
      { title: '用户手册.pdf', key: 'file-9', isLeaf: true },
      { title: '发布说明.docx', key: 'file-10', isLeaf: true },
    ],
  },
];

export default function DocPage() {
  const params = useParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [viewMode, setViewMode] = useState<'table' | 'tree'>('table');

  // 计算统计数据
  const totalDocs = docData.length;
  const totalSize = '33.5MB';

  return (
    <Layout>
      <div className="space-y-6">
        {/* 文档统计 */}
        <Row gutter={[16, 16]}>
          <Col xs={8}>
            <Card className="bg-[#141b2d] border-[#2a3548]">
              <div className="text-center">
                <div className="text-[#8c92a4] text-sm">文档总数</div>
                <div className="text-2xl text-white font-semibold">{totalDocs}</div>
              </div>
            </Card>
          </Col>
          <Col xs={8}>
            <Card className="bg-[#141b2d] border-[#2a3548]">
              <div className="text-center">
                <div className="text-[#8c92a4] text-sm">总大小</div>
                <div className="text-2xl text-blue-500 font-semibold">{totalSize}</div>
              </div>
            </Card>
          </Col>
          <Col xs={8}>
            <Card className="bg-[#141b2d] border-[#2a3548]">
              <div className="text-center">
                <div className="text-[#8c92a4] text-sm">分类数</div>
                <div className="text-2xl text-green-500 font-semibold">5</div>
              </div>
            </Card>
          </Col>
        </Row>

        {/* 视图切换和操作 */}
        <div className="bg-[#141b2d] rounded-xl border border-[#2a3548] p-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-2">
              <Button 
                type={viewMode === 'table' ? 'primary' : 'default'} 
                onClick={() => setViewMode('table')}
              >
                表格视图
              </Button>
              <Button 
                type={viewMode === 'tree' ? 'primary' : 'default'} 
                onClick={() => setViewMode('tree')}
              >
                文件夹视图
              </Button>
            </div>
            <div className="flex gap-2">
              <Button icon={<FolderOutlined />}>新建文件夹</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
                上传文档
              </Button>
            </div>
          </div>

          {viewMode === 'table' ? (
            <>
              <div className="flex flex-wrap gap-4 mb-4">
                <Input 
                  placeholder="搜索文档名称" 
                  prefix={<SearchOutlined />} 
                  className="w-64 bg-[#1a2332] border-[#2a3548]"
                />
                <Select placeholder="分类" className="w-40" defaultValue="all">
                  <Option value="all">全部分类</Option>
                  <Option value="project">立项材料</Option>
                  <Option value="requirement">需求文档</Option>
                  <Option value="tech">技术文档</Option>
                  <Option value="test">测试文档</Option>
                  <Option value="delivery">交付文档</Option>
                </Select>
                <Select placeholder="类型" className="w-36" defaultValue="all">
                  <Option value="all">全部类型</Option>
                  <Option value="doc">文档</Option>
                  <Option value="folder">文件夹</Option>
                </Select>
              </div>

              <Table 
                dataSource={docData}
                columns={columns}
                pagination={{ pageSize: 10 }}
                className="doc-table"
              />
            </>
          ) : (
            <div className="p-4 bg-[#1a2332] rounded">
              <Tree
                showIcon
                defaultExpandAll
                treeData={treeData}
                onSelect={(keys) => console.log('Selected:', keys)}
              />
            </div>
          )}
        </div>

        {/* 上传文档弹窗 */}
        <Modal
          title="上传文档"
          open={isModalOpen}
          onCancel={() => setIsModalOpen(false)}
          footer={null}
          width={500}
        >
          <Form form={form} layout="vertical">
            <Form.Item label="选择分类" name="category" rules={[{ required: true }]}>
              <Select placeholder="请选择文档分类">
                <Option value="project">立项材料</Option>
                <Option value="requirement">需求文档</Option>
                <Option value="tech">技术文档</Option>
                <Option value="test">测试文档</Option>
                <Option value="delivery">交付文档</Option>
              </Select>
            </Form.Item>
            <Form.Item label="上传文件" name="file" rules={[{ required: true }]}>
              <Dragger>
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
                <p className="ant-upload-hint">
                  支持单个或批量上传，支持doc、docx、pdf、xlsx、md等格式
                </p>
              </Dragger>
            </Form.Item>
            <Form.Item label="版本号" name="version">
              <Input placeholder="例如: V1.0" />
            </Form.Item>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setIsModalOpen(false)}>取消</Button>
              <Button type="primary" onClick={() => {
                form.submit();
                setIsModalOpen(false);
              }}>上传</Button>
            </div>
          </Form>
        </Modal>
      </div>
    </Layout>
  );
}
