// 项目管理系统类型定义

// 项目类型
export type ProjectType = '整机产品项目' | '产品项目' | '技术项目' | '能力建设项目';

// 计划状态
export type PlanStatus = '未开始' | '进行中' | '已完成' | '已取消';

// 版本状态
export type VersionStatus = '已发布' | '修订版';

// 计划类型（二级计划）
export type Level2PlanType = 
  | '需求开发计划' 
  | '在研版本火车计划' 
  | '1+N MR版本火车计划' 
  | '粉丝版本计划' 
  | '基础体验计划' 
  | 'WBS计划'
  | '自定义';

// 计划任务
export interface PlanTask {
  id: string;
  parentId?: string;
  order: number;
  taskName: string;
  responsibleUser?: string;
  predecessorTask?: string;
  planStartDate?: Date;
  planEndDate?: Date;
  estimatedDays?: number;
  actualStartDate?: Date;
  actualEndDate?: Date;
  actualDays?: number;
  status: PlanStatus;
  progress: number;
  children?: PlanTask[];
}

// 版本
export interface PlanVersion {
  id: string;
  versionNo: string;
  status: VersionStatus;
  tasks: PlanTask[];
  createdAt: Date;
  publishedAt?: Date;
}

// 项目
export interface Project {
  id: string;
  name: string;
  projectType: ProjectType;
  androidVersion: string;
  chipPlatform: string;
  status: string;
  spm: string;
  markets?: string[];
  createdAt: Date;
  updatedAt: Date;
}

// 一级计划模板
export interface Level1PlanTemplate {
  id: string;
  projectType: ProjectType;
  versions: PlanVersion[];
  createdAt: Date;
  updatedAt: Date;
}

// 二级计划模板
export interface Level2PlanTemplate {
  id: string;
  projectType: ProjectType;
  planType: Level2PlanType;
  customTypeName?: string;
  versions: PlanVersion[];
  createdAt: Date;
  updatedAt: Date;
}

// 项目一级计划
export interface ProjectLevel1Plan {
  id: string;
  projectId: string;
  market?: string;
  versions: PlanVersion[];
  createdAt: Date;
  updatedAt: Date;
}

// 项目二级计划
export interface ProjectLevel2Plan {
  id: string;
  projectId: string;
  market?: string;
  planType: Level2PlanType;
  name: string;
  milestones: string[];
  versions: PlanVersion[];
  createdAt: Date;
  updatedAt: Date;
}

// 序号生成
export interface TaskNumberOptions {
  parentId?: string;
  siblings: PlanTask[];
}

// 版本对比结果
export interface VersionDiff {
  taskId: string;
  changeType: '新增' | '删除' | '修改';
  oldValue?: string;
  newValue?: string;
}

// 拖拽排序
export interface DragItem {
  id: string;
  parentId?: string;
  order: number;
}

// 表格列配置
export interface TableColumn {
  key: string;
  label: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  editable?: boolean;
}

// 版本对比选择
export interface VersionCompareSelect {
  version1: string;
  version2: string;
}
