import type { MilestoneInfo, RoadmapViewConfig } from '@/types'

const STORAGE_KEY = 'pms_roadmap_milestone_views'

/** 推断里程碑排序权重 */
export function inferMilestoneOrder(name: string): number {
  if (name === '概念启动') return 0
  // 匹配 STR 后跟数字和可选的 /数字 组合
  const strMatch = name.match(/^STR(\d+(?:\/\d+)*)$/)
  if (strMatch) {
    const parts = strMatch[1].split('/')
    const first = parseInt(parts[0], 10)
    // STR1 = 10, STR2 = 20, STR1/2/3 = 15 (取中间值)
    if (parts.length > 1) {
      const last = parseInt(parts[parts.length - 1], 10)
      return (first * 10 + last * 10) / 2
    }
    return first * 10
  }
  // 其他名称按字母排序，放在后面
  return 1000
}

/** 从项目列表中聚合里程碑（去重并排序） */
export function aggregateMilestones(
  projects: any[],
  projectType: string,
  marketPlanData: Record<string, { tasks: any[], level2Tasks: any[], createdLevel2Plans: any[] }>,
  level1Tasks: any[]
): MilestoneInfo[] {
  const milestoneSet = new Set<string>()
  const filtered = projects.filter(p => p.type === projectType)

  for (const project of filtered) {
    if (project.type === '整机产品项目' && project.markets?.length > 0) {
      // 整机产品项目：使用第一个市场的 tasks
      const firstMarket = project.markets[0]
      const data = marketPlanData[firstMarket]
      if (data?.tasks) {
        for (const task of data.tasks) {
          if (task.parentId) {
            milestoneSet.add(task.taskName)
          }
        }
      }
    } else {
      // 其他项目类型：使用 level1Tasks
      for (const task of level1Tasks) {
        if (task.parentId) {
          milestoneSet.add(task.taskName)
        }
      }
    }
  }

  const milestones: MilestoneInfo[] = Array.from(milestoneSet).map(name => ({
    name,
    order: inferMilestoneOrder(name),
  }))

  milestones.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order
    return a.name.localeCompare(b.name, 'zh-CN')
  })

  return milestones
}

/** 生成表格数据行 */
export function generateTableData(
  projects: any[],
  milestones: MilestoneInfo[],
  projectType: string,
  marketPlanData: Record<string, { tasks: any[], level2Tasks: any[], createdLevel2Plans: any[] }>,
  level1Tasks: any[]
): any[] {
  const filtered = projects.filter(p => p.type === projectType)
  const rows: any[] = []

  for (const project of filtered) {
    if (project.type === '整机产品项目') {
      const row: any = {
        key: project.id,
        projectId: project.id,
        projectName: project.name,
        productLine: project.productLine || '-',
        chipPlatform: project.chipPlatform || '-',
        tosVersion: project.tosVersion || '-',
        status: project.status,
        spm: project.spm || '-',
        brand: project.brand || '-',
        productType: project.productType || '-',
        memory: project.memory || '-',
        versionType: project.versionType || '-',
        developMode: project.developMode || '-',
        launchDate: project.launchDate || '-',
        currentNode: project.currentNode || '-',
      }

      // Use first market's tasks for milestone data
      const firstMarket = project.markets?.[0]
      const data = firstMarket ? marketPlanData[firstMarket] : null
      for (const ms of milestones) {
        const task = data?.tasks?.find((t: any) => t.parentId && t.taskName === ms.name)
        row[`ms_${ms.name}`] = task?.planEndDate || '-'
      }

      rows.push(row)
    } else {
      const row: any = {
        key: project.id,
        projectId: project.id,
        projectName: project.name,
        market: undefined,
        productLine: project.productLine || '-',
        chipPlatform: project.chipPlatform || '-',
        tosVersion: project.tosVersion || '-',
        status: project.status,
        spm: project.spm || '-',
        versionType: project.versionType || '-',
        currentNode: project.currentNode || '-',
      }

      for (const ms of milestones) {
        const task = level1Tasks.find((t: any) => t.parentId && t.taskName === ms.name)
        row[`ms_${ms.name}`] = task?.planEndDate || '-'
      }

      rows.push(row)
    }
  }

  return rows
}

/** 保存视图配置到 localStorage */
export function saveView(config: RoadmapViewConfig): void {
  try {
    const views = loadAllViews()
    const existIdx = views.findIndex(v => v.id === config.id)
    if (existIdx >= 0) {
      views[existIdx] = config
    } else {
      views.push(config)
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(views))
  } catch {
    // graceful fail
  }
}

/** 从 localStorage 加载所有保存的视图 */
export function loadAllViews(): RoadmapViewConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** 删除指定视图 */
export function deleteView(id: string): void {
  try {
    const views = loadAllViews().filter(v => v.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(views))
  } catch {
    // graceful fail
  }
}
