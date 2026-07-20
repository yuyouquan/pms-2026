// src/data/externalProjectPool.ts
// Mock for the "external system" project enumeration. Real impl would
// be replaced with an async fetch keyed by `bid`.

export interface ExternalProjectEntry {
  bid: string
  name: string
  spm: string
}

export const EXTERNAL_PROJECT_POOL: ExternalProjectEntry[] = [
  { bid: 'EXT-001', name: 'X6900-D8600_H1100', spm: '李白' },
  { bid: 'EXT-002', name: 'X6901-D8700_H1102', spm: '张三' },
  { bid: 'EXT-003', name: 'tOS19.0', spm: '李四' },
  { bid: 'EXT-004', name: 'tOS19.1', spm: '王五' },
  { bid: 'EXT-005', name: 'X6912_H1208', spm: '赵六' },
  { bid: 'EXT-006', name: 'AI-Engine-V3', spm: '张三' },
  { bid: 'EXT-007', name: 'X6920-D8800_H1300', spm: '李白' },
  { bid: 'EXT-008', name: 'CI-Platform-V2', spm: '孙七' },
  { bid: 'EXT-009', name: 'HiOS-Launcher-V2', spm: '王五' },
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
}

// Mocked "external system" fetch. Returns supplementary fields, keyed by bid.
export function fetchByBid(bid: string): FetchByBidResult {
  const map: Record<string, FetchByBidResult> = {
    'EXT-001': { productLine: 'NOTE', productSeries: 'NOTE 60', marketName: 'NOTE 60 Pro', brand: 'TECNO', androidVersion: 'Android 17', chipPlatform: 'MTK', chipCode: 'D8600', chipModel: 'MT6899', memorySize: '8GB+256GB', mainboardName: 'H1100', researchMode: '自研', androidMajorUpgrade: '否', confidentialityLevel: '内部公开', targetMarkets: 'OP,TR,RU', planStartDate: '2026-06-01', planEndDate: '2026-12-31' },
    'EXT-002': { productLine: 'NOTE', productSeries: 'NOTE 60', marketName: 'NOTE 60', brand: 'TECNO', androidVersion: 'Android 17', chipPlatform: 'MTK', chipCode: 'D8700', chipModel: 'MT6888', memorySize: '8GB+128GB', mainboardName: 'H1102', researchMode: '外研', androidMajorUpgrade: '否', confidentialityLevel: '机密', targetMarkets: 'OP,IN', planStartDate: '2026-07-01', planEndDate: '2027-01-31' },
    'EXT-003': { productLine: 'tOS', tosVersion: 'tOS16.1', androidVersion: 'Android 17', chipPlatform: 'MTK', planStartDate: '2026-06-01', planEndDate: '2026-11-30' },
    'EXT-004': { productLine: 'tOS', tosVersion: 'tOS16.3', androidVersion: 'Android 17', chipPlatform: 'QCOM', planStartDate: '2026-08-01', planEndDate: '2027-02-28' },
    'EXT-005': { productLine: 'SPARK', productSeries: 'SPARK 40', marketName: 'SPARK 40 Pro', brand: 'TECNO', androidVersion: 'Android 17', chipPlatform: 'MTK', chipCode: 'X6912', chipModel: 'MT6878', memorySize: '6GB+128GB', mainboardName: 'H1208', researchMode: '自研', androidMajorUpgrade: '是', confidentialityLevel: '内部公开', targetMarkets: 'OP,TR', planStartDate: '2026-06-15', planEndDate: '2026-12-15' },
    'EXT-006': { productLine: 'AI引擎', androidVersion: 'Android 17', chipPlatform: 'MTK', planStartDate: '2026-05-15', planEndDate: '2026-10-31' },
    'EXT-007': { productLine: 'CAMON', productSeries: 'CAMON 50', marketName: 'CAMON 50 Premier', brand: 'TECNO', androidVersion: 'Android 17', chipPlatform: 'QCOM', chipCode: 'D8800', chipModel: 'SM8850', memorySize: '12GB+256GB', mainboardName: 'H1300', researchMode: '自研', androidMajorUpgrade: '否', confidentialityLevel: '绝密', targetMarkets: 'OP,RU,EU', planStartDate: '2026-07-15', planEndDate: '2027-03-31' },
    'EXT-008': { productLine: '工程效率', planStartDate: '2026-06-01', planEndDate: '2026-12-31' },
    'EXT-009': { productLine: '系统应用', tosVersion: 'tOS16.1', androidVersion: 'Android 16', chipPlatform: 'MTK', planStartDate: '2026-06-10', planEndDate: '2026-12-10' },
  }
  return map[bid] ?? {}
}
