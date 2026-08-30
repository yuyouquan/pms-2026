// src/data/externalProjectPool.ts
// Mock for the "external system" project enumeration. Real impl would
// be replaced with an async fetch keyed by `bid`.

export interface ExternalProjectEntry {
  bid: string
  name: string
  spm: string
  ipmProjectCategoryName: string
  ipmStatus?: string
  technicalTrack?: string
  subprojects?: Array<{
    id: string
    name: string
    ipmOrder: number
  }>
}

export const EXTERNAL_PROJECT_POOL: ExternalProjectEntry[] = [
  { bid: 'EXT-001', name: 'X6900-D8600_H1100', spm: '李白', ipmProjectCategoryName: '整机产品-基线IPD' },
  { bid: 'EXT-002', name: 'X6901-D8700_H1102', spm: '张三', ipmProjectCategoryName: '整机产品-模块化IPD' },
  { bid: 'EXT-003', name: 'tOS19.0', spm: '李四', ipmProjectCategoryName: '软件产品项目', ipmStatus: '进行中' },
  { bid: 'EXT-004', name: 'tOS19.1', spm: '王五', ipmProjectCategoryName: '软件产品项目', ipmStatus: '维护期' },
  { bid: 'EXT-005', name: 'X6912_H1208', spm: '赵六', ipmProjectCategoryName: '其他-平板--整机产品项目' },
  {
    bid: 'EXT-006', name: 'AI-Engine-V3', spm: '张三', ipmProjectCategoryName: '研发级-基础研究-重点项目', technicalTrack: 'AIOS',
    subprojects: [
      { id: 'IPM-AI-001', name: 'AI推理引擎子项目', ipmOrder: 1 },
      { id: 'IPM-AI-002', name: '多模态子项目', ipmOrder: 2 },
      // The same stable ID exists as inactive in the PMS seed, so a sync
      // demonstrates lossless reactivation rather than creating a new child.
      { id: 'IPM-AI-003', name: '端侧训练子项目', ipmOrder: 3 },
    ],
  },
  { bid: 'EXT-007', name: 'X6920-D8800_H1300', spm: '李白', ipmProjectCategoryName: '整机产品-非IPD' },
  { bid: 'EXT-008', name: 'CI-Platform-V2', spm: '孙七', ipmProjectCategoryName: '公司级能力建设' },
  { bid: 'EXT-009', name: 'HiOS-Launcher-V2', spm: '王五', ipmProjectCategoryName: '部门级-技术研发', technicalTrack: '系统体验' },
  { bid: 'EXT-010', name: 'X6870', spm: '李白', ipmProjectCategoryName: '整机产品-基线IPD' },
  { bid: 'EXT-011', name: 'X6870', spm: '李白', ipmProjectCategoryName: '手机整机产品-大版本升级' },
  { bid: 'EXT-012', name: 'X6870', spm: '李白', ipmProjectCategoryName: '手机整机产品-大版本升级' },
  { bid: 'EXT-013', name: 'AIOS-Architecture-Prestudy', spm: '赵六', ipmProjectCategoryName: '技术项目前置工作', technicalTrack: 'AIOS' },
]

export interface FetchByBidResult {
  productLine?: string
  productSeries?: string
  brand?: string
  marketName?: string
  tosVersion?: string
  androidVersion?: string
  chipPlatform?: string
  chipCode?: string
  chipModel?: string
  memorySize?: string
  mainboardName?: string
  researchMode?: string
  androidMajorUpgrade?: string
  confidentialityLevel?: string
  launchDate?: string
  productionForbiddenDate?: string
  targetMarkets?: string
  planStartDate?: string
  planEndDate?: string
  projectCode?: string
  platform?: string
  productType?: '新品' | '老品'
  startRam?: '2GB' | '3GB' | '4GB' | '6GB' | '8GB' | '12GB' | '16GB'
  versionType?: 'Full' | 'Slim' | 'Go'
  str5Date?: string
  developMode?: '自研' | 'ODC' | 'ITD-ODC' | 'ODM' | '纯外研'
  remark?: string
}

// Mocked "external system" fetch. Returns supplementary fields, keyed by bid.
export function fetchByBid(bid: string): FetchByBidResult {
  const map: Record<string, FetchByBidResult> = {
    'EXT-001': { productLine: 'NOTE', productSeries: 'NOTE 60', marketName: 'NOTE 60 Pro', brand: 'TECNO', androidVersion: 'Android 17', chipPlatform: 'MTK', chipCode: 'D8600', chipModel: 'MT6899', memorySize: '8GB+256GB', mainboardName: 'H1100', researchMode: '自研', androidMajorUpgrade: '否', confidentialityLevel: '内部公开', targetMarkets: 'OP,TR,RU', planStartDate: '2026-06-01', planEndDate: '2026-12-31', projectCode: 'X6900', platform: 'D8600', productType: '新品', startRam: '8GB', versionType: 'Full', str5Date: '2026-12-15', launchDate: '2027-01-15', developMode: '自研', remark: '外部项目池同步的整机项目。' },
    'EXT-002': { productLine: 'NOTE', productSeries: 'NOTE 60', marketName: 'NOTE 60', brand: 'TECNO', androidVersion: 'Android 17', chipPlatform: 'MTK', chipCode: 'D8700', chipModel: 'MT6888', memorySize: '8GB+128GB', mainboardName: 'H1102', researchMode: '外研', androidMajorUpgrade: '否', confidentialityLevel: '机密', targetMarkets: 'OP,IN', planStartDate: '2026-07-01', planEndDate: '2027-01-31', projectCode: 'X6901', platform: 'D8700', productType: '新品', startRam: '8GB', versionType: 'Slim', str5Date: '2027-01-15', launchDate: '2027-02-15', developMode: 'ODC', remark: '外部项目池同步的整机项目。' },
    'EXT-003': { productLine: 'tOS', tosVersion: 'tOS16.1', androidVersion: 'Android 17', chipPlatform: 'MTK', planStartDate: '2026-06-01', planEndDate: '2026-11-30' },
    'EXT-004': { productLine: 'tOS', tosVersion: 'tOS16.3', androidVersion: 'Android 17', chipPlatform: 'QCOM', planStartDate: '2026-08-01', planEndDate: '2027-02-28' },
    'EXT-005': { productLine: 'SPARK', productSeries: 'SPARK 40', marketName: 'SPARK 40 Pro', brand: 'TECNO', androidVersion: 'Android 17', chipPlatform: 'MTK', chipCode: 'X6912', chipModel: 'MT6878', memorySize: '6GB+128GB', mainboardName: 'H1208', researchMode: '自研', androidMajorUpgrade: '是', confidentialityLevel: '内部公开', targetMarkets: 'OP,TR', planStartDate: '2026-06-15', planEndDate: '2026-12-15', projectCode: 'X6912', platform: 'H1208', productType: '新品', startRam: '6GB', versionType: 'Full', str5Date: '2026-11-30', launchDate: '2027-01-01', developMode: 'ODM', remark: '外部项目池同步的整机项目。' },
    'EXT-006': { productLine: 'AI引擎', androidVersion: 'Android 17', chipPlatform: 'MTK', planStartDate: '2026-05-15', planEndDate: '2026-10-31' },
    'EXT-007': { productLine: 'CAMON', productSeries: 'CAMON 50', marketName: 'CAMON 50 Premier', brand: 'TECNO', androidVersion: 'Android 17', chipPlatform: 'QCOM', chipCode: 'D8800', chipModel: 'SM8850', memorySize: '12GB+256GB', mainboardName: 'H1300', researchMode: '自研', androidMajorUpgrade: '否', confidentialityLevel: '绝密', targetMarkets: 'OP,RU,EU', planStartDate: '2026-07-15', planEndDate: '2027-03-31', projectCode: 'X6920', platform: 'D8800', productType: '新品', startRam: '12GB', versionType: 'Full', str5Date: '2027-03-15', launchDate: '2027-04-15', developMode: 'ITD-ODC', remark: '外部项目池同步的整机项目。' },
    'EXT-008': { productLine: '工程效率', planStartDate: '2026-06-01', planEndDate: '2026-12-31' },
    'EXT-009': { productLine: '系统应用', tosVersion: 'tOS16.1', androidVersion: 'Android 16', chipPlatform: 'MTK', planStartDate: '2026-06-10', planEndDate: '2026-12-10' },
    'EXT-010': { productLine: 'NOTE', productSeries: 'NOTE 60', marketName: 'X6870', brand: 'TECNO', tosVersion: 'tOS14.0.0', androidVersion: 'Android 17', chipPlatform: 'MTK', chipCode: 'D8600', chipModel: 'MT6899', memorySize: '8GB+256GB', mainboardName: 'H1100', researchMode: '自研', androidMajorUpgrade: '否', confidentialityLevel: '内部公开', targetMarkets: 'OP,TR', planStartDate: '2026-06-01', planEndDate: '2026-12-31', projectCode: 'X6870', platform: 'D8600', productType: '新品', startRam: '8GB', versionType: 'Full', str5Date: '2026-12-15', launchDate: '2027-01-15', developMode: '自研', remark: 'X6870 新品联动验证。' },
    'EXT-011': { productLine: 'NOTE', productSeries: 'NOTE 60', marketName: 'X6870', brand: 'TECNO', tosVersion: 'tOS15.0.0', androidVersion: 'Android 18', chipPlatform: 'MTK', chipCode: 'D8600', chipModel: 'MT6899', memorySize: '8GB+256GB', mainboardName: 'H1100', researchMode: '自研', androidMajorUpgrade: '是', confidentialityLevel: '内部公开', targetMarkets: 'OP,TR', planStartDate: '2027-01-01', planEndDate: '2027-06-30', projectCode: 'X6870', platform: 'D8600', productType: '老品', startRam: '8GB', versionType: 'Full', str5Date: '2027-05-15', launchDate: '2027-07-15', developMode: '自研', remark: 'X6870 老品 15.0.0 联动验证。' },
    'EXT-012': { productLine: 'NOTE', productSeries: 'NOTE 60', marketName: 'X6870', brand: 'TECNO', tosVersion: 'tOS17.10.0', androidVersion: 'Android 18', chipPlatform: 'MTK', chipCode: 'D8600', chipModel: 'MT6899', memorySize: '8GB+256GB', mainboardName: 'H1100', researchMode: '自研', androidMajorUpgrade: '是', confidentialityLevel: '内部公开', targetMarkets: 'OP,TR', planStartDate: '2027-03-01', planEndDate: '2027-09-30', projectCode: 'X6870', platform: 'D8600', productType: '老品', startRam: '8GB', versionType: 'Full', str5Date: '2027-08-15', launchDate: '2027-10-15', developMode: '自研', remark: 'X6870 老品 17.10.0 联动验证。' },
    'EXT-013': { productLine: '系统应用', planStartDate: '2026-08-01', planEndDate: '2026-12-31' },
  }
  return map[bid] ?? {}
}
