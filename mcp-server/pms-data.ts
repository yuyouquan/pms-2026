/**
 * Standalone data extract for MCP server.
 * Mirrors initialProjects + PROJECT_MEMBER_MAP from src/data/projects.ts
 * WITHOUT importing the gantt component chain (which would pollute stdio).
 */

export const initialProjects = [
  {
    id: '1', name: 'X6877-D8400_H991', type: '整机产品项目',
    status: '进行中', progress: 65, leader: '张三',
    markets: ['OP', 'TR', 'RU'], androidVersion: 'Android 16', chipPlatform: 'MTK',
    spm: '李白', tosVersion: 'tOS 16.3',
    planStartDate: '2026-01-01', planEndDate: '2026-06-30',
    currentNode: 'STR2', launchDate: '2026-06-15',
    ppm: '王明', tpm: '刘洋', projectLevel: 'A',
  },
  {
    id: '3', name: 'X6855_H8917', type: '整机产品项目',
    status: '进行中', progress: 45, leader: '王五',
    markets: ['OP', 'TR'], androidVersion: 'Android 16', chipPlatform: 'MTK',
    spm: '赵六', tosVersion: 'tOS 16.3',
    planStartDate: '2026-02-01', planEndDate: '2026-08-31',
    currentNode: 'STR1', launchDate: '2026-09-01',
    ppm: '赵敏', tpm: '李刚', projectLevel: 'B',
  },
  {
    id: '2', name: 'tOS16.0', type: '产品项目',
    status: '进行中', progress: 55, leader: '李四',
    markets: [] as string[], androidVersion: 'Android 15', chipPlatform: 'MTK',
    spm: '张三', tosVersion: 'tOS 16.0',
    planStartDate: '2026-01-15', planEndDate: '2026-05-30',
    currentNode: 'STR3', launchDate: undefined as string | undefined,
  },
  {
    id: '6', name: 'tOS17.1', type: '产品项目',
    status: '筹备中', progress: 15, leader: '赵六',
    markets: [] as string[], androidVersion: 'Android 16', chipPlatform: 'QCOM',
    spm: '李四', tosVersion: 'tOS 17.1',
    planStartDate: '2026-03-01', planEndDate: '2026-09-30',
    currentNode: 'STR1', launchDate: undefined as string | undefined,
  },
  {
    id: '4', name: 'X6876_H786', type: '技术项目',
    status: '已完成', progress: 100, leader: '孙七',
    markets: [] as string[], androidVersion: 'Android 15', chipPlatform: 'QCOM',
    spm: '李四', tosVersion: 'tOS 15.0',
    planStartDate: '2025-10-01', planEndDate: '2026-02-28',
    currentNode: 'STR5', launchDate: undefined as string | undefined,
  },
  {
    id: '5', name: 'X6873_H972', type: '能力建设项目',
    status: '进行中', progress: 30, leader: '周八',
    markets: [] as string[], androidVersion: 'Android 16', chipPlatform: 'UNISOC',
    spm: '王五', tosVersion: 'tOS 16.2',
    planStartDate: '2026-02-15', planEndDate: '2026-07-31',
    currentNode: undefined as string | undefined, launchDate: undefined as string | undefined,
  },
  {
    id: '7', name: 'X6890-D8500_H1001', type: '整机产品项目',
    status: '筹备中', progress: 10, leader: '李白',
    markets: ['OP', 'TR', 'RU', 'IN'], androidVersion: 'Android 16', chipPlatform: 'QCOM',
    spm: '张三', tosVersion: 'tOS 16.5',
    planStartDate: '2026-03-15', planEndDate: '2026-10-31',
    currentNode: '概念启动', launchDate: '2026-11-15',
    ppm: '王明', tpm: '刘洋', projectLevel: 'S',
  },
  {
    id: '8', name: 'tOS18.0', type: '产品项目',
    status: '筹备中', progress: 5, leader: '杜甫',
    markets: [] as string[], androidVersion: 'Android 17', chipPlatform: 'MTK',
    spm: '赵六', tosVersion: 'tOS 18.0',
    planStartDate: '2026-04-01', planEndDate: '2026-12-31',
    currentNode: '概念启动', launchDate: undefined as string | undefined,
  },
  {
    id: '9', name: 'AI-Engine-V2', type: '技术项目',
    status: '进行中', progress: 40, leader: '李四',
    markets: [] as string[], androidVersion: 'Android 16', chipPlatform: 'MTK',
    spm: '张三', tosVersion: '',
    planStartDate: '2026-02-01', planEndDate: '2026-07-15',
    currentNode: 'STR3', launchDate: undefined as string | undefined,
  },
  {
    id: '10', name: 'DevOps-Platform', type: '能力建设项目',
    status: '进行中', progress: 55, leader: '孙七',
    markets: [] as string[], androidVersion: '', chipPlatform: '',
    spm: '李四', tosVersion: '',
    planStartDate: '2026-01-10', planEndDate: '2026-06-30',
    currentNode: undefined as string | undefined, launchDate: undefined as string | undefined,
  },
]

export const PROJECT_MEMBER_MAP: Record<string, string[]> = {
  '1': ['张三', '李白', '王明', '刘洋', '赵六', '孙七', '周八'],
  '2': ['李四', '张三', '王五', '赵六', '孙七'],
  '3': ['王五', '赵六', '赵敏', '李刚', '张三'],
  '4': ['孙七', '李四', '张三'],
  '5': ['周八', '王五', '李白'],
  '6': ['赵六', '孙七', '李四', '王五', '张三'],
  '7': ['李白', '张三', '王明', '刘洋'],
  '8': ['杜甫', '李白', '张三', '李四', '王五', '赵六'],
  '9': ['李四', '张三', '赵六', '孙七'],
  '10': ['孙七', '周八', '李白', '杜甫', '王五'],
}
