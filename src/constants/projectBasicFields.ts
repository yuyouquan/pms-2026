export const WHOLE_MACHINE_BASIC_INFO_FIELDS = [
  { label: '项目名', key: 'name' },
  { label: '主板名', key: 'mainboard' },
  { label: '市场名', key: 'marketName' },
  { label: '产品系列', key: 'productSeries' },
  { label: '产品类型', key: 'productType' },
  { label: '安卓版本', key: 'androidVersion', fallbackKeys: ['operatingSystem'] },
  { label: 'tOS版本', key: 'tosVersion' },
  { label: '研发模式', key: 'developMode' },
  { label: '合作形式', key: 'cooperationForm' },
  { label: '品牌', key: 'brand' },
  { label: '产品线', key: 'productLine' },
  { label: '市场', key: 'market', fallbackKeys: ['markets'] },
  { label: '项目定级', key: 'projectLevel' },
  { label: '安卓大版本升级', key: 'androidMajorUpgrade' },
  { label: '系统类型', key: 'systemType' },
  { label: '是否为GO', key: 'isGo' },
  { label: '是否二段式', key: 'isTwoStage' },
  { label: '是否为Slim版本', key: 'isSlimVersion' },
  { label: '是否外研mini版本', key: 'isOutsourcedMini' },
  { label: '项目描述', key: 'projectDescription' },
  { label: 'Jira项目', key: 'jiraProjects' },
] as const

export const WHOLE_MACHINE_HARDWARE_CONFIG_FIELDS = [
  { label: '市场项目名', key: 'marketProjectName' },
  { label: '芯片平台', key: 'chipPlatform' },
  { label: '芯片型号', key: 'cpu' },
  { label: '版本类型', key: 'versionType' },
  { label: 'Bom', key: 'bom' },
  { label: '内存', key: 'memory' },
  { label: '屏幕', key: 'lcd' },
  { label: '屏幕形态', key: 'screenShape' },
  { label: '屏幕类型', key: 'screenType' },
  { label: '前摄像头', key: 'frontCamera' },
  { label: '后摄像头', key: 'primaryCamera' },
  { label: '网络模式', key: 'networkMode' },
  { label: 'kernel版本', key: 'kernelVersion' },
  { label: '灯效', key: 'lightEffect' },
  { label: '人脸', key: 'faceRecognition' },
  { label: '音效', key: 'soundEffect' },
  { label: 'SIM卡', key: 'simCard' },
  { label: '马达', key: 'motor' },
  { label: '指纹', key: 'fingerprint' },
  { label: '红外', key: 'infrared' },
  { label: '编译选项', key: 'buildOption' },
  { label: '编译市场', key: 'buildMarket' },
] as const

export const PRODUCT_SERIES_OPTIONS = [
  { label: 'CAMON 50', value: 'CAMON 50' },
  { label: 'P', value: 'P' },
  { label: 'A', value: 'A' },
  { label: 'SPARK 30', value: 'SPARK 30' },
  { label: 'NOTE 50', value: 'NOTE 50' },
]

export const TECH_DOMAIN_OPTIONS = [
  { label: '基础架构', value: '基础架构' },
  { label: '影像', value: '影像' },
  { label: '测试', value: '测试' },
  { label: '性能', value: '性能' },
  { label: '工程效率', value: '工程效率' },
]

export const TOS_VERSION_OPTIONS = [
  { label: '15.0', value: '15.0' },
  { label: '15.1', value: '15.1' },
  { label: '15.2', value: '15.2' },
  { label: '15.3', value: '15.3' },
  { label: '16.0', value: '16.0' },
  { label: '16.1', value: '16.1' },
  { label: '16.2', value: '16.2' },
  { label: '16.3', value: '16.3' },
  { label: '17.0', value: '17.0' },
  { label: '17.1', value: '17.1' },
  { label: '18.0', value: '18.0' },
]

export const OS_SERIES_OPTIONS = [
  { label: '15.X', value: '15.X' },
  { label: '16.X', value: '16.X' },
  { label: '17.X', value: '17.X' },
  { label: '18.X', value: '18.X' },
]

export function inferTosVersionFromProjectName(projectName: string) {
  const match = projectName.match(/(\d{2}\.\d)/)
  return match?.[1] || ''
}

export function inferOsSeriesFromProjectName(projectName: string) {
  const version = inferTosVersionFromProjectName(projectName)
  if (!version) return ''
  return `${version.split('.')[0]}.X`
}
