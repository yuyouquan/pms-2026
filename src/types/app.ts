// Common prop types for extracted components
// Derived from the mock data structures in src/app/page.tsx

/** Project type literals used in initialProjects */
export type ProjectCategory = '整机产品项目' | '产品项目' | '技术项目' | '能力建设项目';

/** Health status for project cards */
export type HealthStatus = 'normal' | 'warning' | 'risk';

/** Version five roles (版本五大员) - used in 产品项目 */
export interface VersionFiveRoles {
  版本规划代表: string;
  版本经理: string;
  版本SE: string;
  版本测试代表: string;
  版本质量代表: string;
}

/** Project record - matches initialProjects structure in page.tsx */
export interface ProjectItem {
  id: string;
  name: string;
  type: ProjectCategory;
  status: string;
  progress: number;
  leader: string;
  markets: string[];
  androidVersion: string;
  chipPlatform: string;
  spm: string;
  updatedAt: string;
  productLine: string;
  tosVersion: string;
  planStartDate: string;
  planEndDate: string;
  developCycle: number;
  healthStatus: HealthStatus;
  operatingSystem?: string;
  version?: string;
  buildAddress?: string;
  currentNode?: string;
  branchInfo?: string;
  jenkinsUrl?: string;
  // 整机产品项目 specific
  marketName?: string;
  brand?: string;
  developMode?: string;
  model?: string;
  mainboard?: string;
  born?: string;
  cpu?: string;
  memory?: string;
  lcd?: string;
  frontCamera?: string;
  primaryCamera?: string;
  productType?: string;
  tosVersionName?: string;
  versionType?: string;
  market?: string;
  ppm?: string;
  tpm?: string;
  projectLevel?: string;
  launchDate?: string;
  screenShape?: string;
  screenType?: string;
  networkMode?: string;
  kernelVersion?: string;
  lightEffect?: string;
  faceRecognition?: string;
  soundEffect?: string;
  simCard?: string;
  motor?: string;
  fingerprint?: string;
  infrared?: string;
  // 产品项目 specific
  versionFiveRoles?: VersionFiveRoles;
  // 技术项目 / 能力建设项目 specific
  projectDescription?: string;
  teamMembers?: string;
}

/** Todo item - matches initialTodos structure */
export interface TodoItem {
  id: string;
  projectId: string;
  projectName: string;
  planLevel: 'level1' | 'level2';
  planType: string;
  planTabKey: string;
  versionNo: string;
  versionId: string;
  market: string;
  responsible: string;
  priority: 'high' | 'medium' | 'low';
  deadline: string;
  status: string;
  taskDesc: string;
  category: 'overdue' | 'upcoming' | 'pending' | 'completed';
}

/** Version entry - matches VERSION_DATA structure */
export interface VersionItem {
  id: string;
  versionNo: string;
  status: string;
}

/** Level 1 task - matches LEVEL1_TASKS structure */
export interface TaskItem {
  id: string;
  parentId?: string;
  order: number;
  taskName: string;
  status: string;
  progress: number;
  responsible: string;
  predecessor: string;
  planStartDate: string;
  planEndDate: string;
  estimatedDays: number;
  actualStartDate: string;
  actualEndDate: string;
  actualDays: number;
  planId?: string;
}

/** Table column config - matches ALL_COLUMNS structure */
export interface ColumnConfig {
  key: string;
  title: string;
  default: boolean;
}

/** Transfer view type */
export type TransferViewType = null | 'apply' | 'detail' | 'entry' | 'review' | 'sqa-review';

/** Todo filter type */
export type TodoFilterType = 'all' | 'overdue' | 'upcoming' | 'pending' | 'completed';

/** Project status config - matches STATUS_CONFIG keys */
export interface StatusConfig {
  color: string;
  tagColor: string;
}
