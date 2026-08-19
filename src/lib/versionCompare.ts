// 版本对比工具函数

import type { PlanTask, VersionDiff } from '@/types';

// 辅助函数：转换为Date
const toDate = (d: Date | string | undefined): Date | undefined => {
  if (!d) return undefined;
  if (d instanceof Date) return d;
  return new Date(d);
};

// 格式化日期
const formatDate = (date?: Date | string): string => {
  if (!date) return '-';
  const d = toDate(date);
  if (!d) return '-';
  return d.toLocaleDateString('zh-CN');
};

// 字段级别差异
export interface FieldDiff {
  field: string;
  oldValue: string;
  newValue: string;
}

// 表格行级别对比结果
export interface CompareTableRow {
  key: string;
  taskId: string;
  stableId?: string;
  stageName?: string;
  milestoneName?: string;
  activityName?: string;
  sequence?: number;
  changeType: '新增' | '删除' | '修改' | '未变更';
  // 当前各字段值（新版本优先，删除时取旧版本）
  taskName: string;
  responsible: string;
  predecessor: string;
  planStartDate: string;
  planEndDate: string;
  estimatedDays: number | null;
  actualStartDate: string;
  actualEndDate: string;
  actualDays: number | null;
  delayStatus: string;
  status: string;
  progress: number;
  // 字段级差异明细（修改时有值）
  fieldDiffs: FieldDiff[];
  // 修改信息（Mock）
  modifier: string;
  modifyTime: string;
}

export type CompareTask = PlanTask & {
  stableId?: string;
  stageName?: string;
  milestoneName?: string;
  activityName?: string;
  sequence?: number;
  delayStatus?: string;
}

const formatDuration = (value: number | null) => value === null ? '-' : `${value}天`
const normalizeDuration = (value: number | null | undefined): number | null => typeof value === 'number' ? value : null

const getCompareDisplayFields = (task: CompareTask) => ({
  taskName: task.taskName,
  responsible: task.responsible || task.responsibleUser || '',
  predecessor: task.predecessor || '',
  planStartDate: (task.planStartDate as any) || '',
  planEndDate: (task.planEndDate as any) || '',
  estimatedDays: task.estimatedDays ?? null,
  actualStartDate: (task.actualStartDate as any) || '',
  actualEndDate: (task.actualEndDate as any) || '',
  actualDays: task.actualDays ?? null,
  delayStatus: task.delayStatus || '',
  status: task.status,
  progress: task.progress,
  stableId: task.stableId,
  stageName: task.stageName,
  milestoneName: task.milestoneName,
  activityName: task.activityName,
  sequence: task.sequence,
})

/**
 * 比较两个版本，生成表格行数据
 */
export function compareVersionsForTable(oldTasks: CompareTask[], newTasks: CompareTask[]): CompareTableRow[] {
  const rows: CompareTableRow[] = [];
  const countStableIds = (tasks: CompareTask[]) => tasks.reduce((counts, task) => {
    if (task.stableId) counts.set(task.stableId, (counts.get(task.stableId) || 0) + 1)
    return counts
  }, new Map<string, number>())
  const oldStableIdCounts = countStableIds(oldTasks)
  const newStableIdCounts = countStableIds(newTasks)
  const identity = (task: CompareTask) => task.stableId
    && oldStableIdCounts.get(task.stableId) === 1
    && newStableIdCounts.get(task.stableId) === 1
    ? task.stableId
    : task.id
  const countIdentities = (tasks: CompareTask[]) => tasks.reduce((counts, task) => {
    const id = identity(task)
    counts.set(id, (counts.get(id) || 0) + 1)
    return counts
  }, new Map<string, number>())
  const oldIdentityCounts = countIdentities(oldTasks)
  const newIdentityCounts = countIdentities(newTasks)
  const toUniqueMap = (tasks: CompareTask[]) => {
    const occurrences = new Map<string, number>()
    return new Map(tasks.map(task => {
      const baseIdentity = identity(task)
      const occurrence = (occurrences.get(baseIdentity) || 0) + 1
      occurrences.set(baseIdentity, occurrence)
      const duplicateIdentity = Math.max(oldIdentityCounts.get(baseIdentity) || 0, newIdentityCounts.get(baseIdentity) || 0) > 1
      return [duplicateIdentity ? `${baseIdentity}#${occurrence}` : baseIdentity, task]
    }))
  }
  const oldMap = toUniqueMap(oldTasks)
  const newMap = toUniqueMap(newTasks)
  const allIds = new Set([...oldMap.keys(), ...newMap.keys()]);

  const mockModifiers = ['张三', '李四', '王五', '赵六'];
  const mockTimes = ['2026-03-10 14:30', '2026-03-11 09:15', '2026-03-11 16:42', '2026-03-12 10:08'];
  let mockIdx = 0;

  for (const key of allIds) {
    const oldTask = oldMap.get(key);
    const newTask = newMap.get(key);
    const displayTask = newTask || oldTask!
    const taskId = displayTask.id

    if (newTask && !oldTask) {
      // 新增
      rows.push({
        key,
        taskId,
        changeType: '新增',
        ...getCompareDisplayFields(newTask),
        fieldDiffs: [],
        modifier: mockModifiers[mockIdx % mockModifiers.length],
        modifyTime: mockTimes[mockIdx % mockTimes.length],
      });
      mockIdx++;
    } else if (oldTask && !newTask) {
      // 删除
      rows.push({
        key,
        taskId,
        changeType: '删除',
        ...getCompareDisplayFields(oldTask),
        fieldDiffs: [],
        modifier: mockModifiers[mockIdx % mockModifiers.length],
        modifyTime: mockTimes[mockIdx % mockTimes.length],
      });
      mockIdx++;
    } else if (oldTask && newTask) {
      // 对比字段
      const fieldDiffs: FieldDiff[] = [];

      if (oldTask.taskName !== newTask.taskName) {
        fieldDiffs.push({ field: 'taskName', oldValue: oldTask.taskName, newValue: newTask.taskName });
      }
      ;(['stageName', 'milestoneName', 'activityName'] as const).forEach(field => {
        const oldValue = oldTask[field] || ''
        const newValue = newTask[field] || ''
        if (oldValue !== newValue) fieldDiffs.push({ field, oldValue: oldValue || '-', newValue: newValue || '-' })
      })
      const oldResp = (oldTask as any).responsible || oldTask.responsibleUser || '';
      const newResp = (newTask as any).responsible || newTask.responsibleUser || '';
      if (oldResp !== newResp) {
        fieldDiffs.push({ field: 'responsible', oldValue: oldResp || '-', newValue: newResp || '-' });
      }
      const oldPred = (oldTask as any).predecessor || '';
      const newPred = (newTask as any).predecessor || '';
      if (oldPred !== newPred) {
        fieldDiffs.push({ field: 'predecessor', oldValue: oldPred || '-', newValue: newPred || '-' });
      }
      const oldStart = (oldTask.planStartDate as any) || '';
      const newStart = (newTask.planStartDate as any) || '';
      if (oldStart !== newStart) {
        fieldDiffs.push({ field: 'planStartDate', oldValue: oldStart || '-', newValue: newStart || '-' });
      }
      const oldEnd = (oldTask.planEndDate as any) || '';
      const newEnd = (newTask.planEndDate as any) || '';
      if (oldEnd !== newEnd) {
        fieldDiffs.push({ field: 'planEndDate', oldValue: oldEnd || '-', newValue: newEnd || '-' });
      }
      const oldEstDays = normalizeDuration(oldTask.estimatedDays);
      const newEstDays = normalizeDuration(newTask.estimatedDays);
      if (oldEstDays !== newEstDays) {
        fieldDiffs.push({ field: 'estimatedDays', oldValue: formatDuration(oldEstDays), newValue: formatDuration(newEstDays) });
      }
      const oldActStart = (oldTask.actualStartDate as any) || '';
      const newActStart = (newTask.actualStartDate as any) || '';
      if (oldActStart !== newActStart) {
        fieldDiffs.push({ field: 'actualStartDate', oldValue: oldActStart || '-', newValue: newActStart || '-' });
      }
      const oldActEnd = (oldTask.actualEndDate as any) || '';
      const newActEnd = (newTask.actualEndDate as any) || '';
      if (oldActEnd !== newActEnd) {
        fieldDiffs.push({ field: 'actualEndDate', oldValue: oldActEnd || '-', newValue: newActEnd || '-' });
      }
      const oldActDays = normalizeDuration(oldTask.actualDays);
      const newActDays = normalizeDuration(newTask.actualDays);
      if (oldActDays !== newActDays) {
        fieldDiffs.push({ field: 'actualDays', oldValue: formatDuration(oldActDays), newValue: formatDuration(newActDays) });
      }
      const oldDelayStatus = (oldTask as any).delayStatus || '';
      const newDelayStatus = (newTask as any).delayStatus || '';
      if (oldDelayStatus !== newDelayStatus) {
        fieldDiffs.push({ field: 'delayStatus', oldValue: oldDelayStatus || '-', newValue: newDelayStatus || '-' });
      }
      if (oldTask.status !== newTask.status) {
        fieldDiffs.push({ field: 'status', oldValue: oldTask.status, newValue: newTask.status });
      }
      if (oldTask.progress !== newTask.progress) {
        fieldDiffs.push({ field: 'progress', oldValue: `${oldTask.progress}%`, newValue: `${newTask.progress}%` });
      }

      rows.push({
        key,
        taskId,
        changeType: fieldDiffs.length > 0 ? '修改' : '未变更',
        ...getCompareDisplayFields(newTask),
        fieldDiffs,
        modifier: fieldDiffs.length > 0 ? mockModifiers[mockIdx % mockModifiers.length] : '',
        modifyTime: fieldDiffs.length > 0 ? mockTimes[mockIdx % mockTimes.length] : '',
      });
      if (fieldDiffs.length > 0) mockIdx++;
    }
  }

  // 按序号排序
  return rows.sort((a, b) => {
    const aNum = a.taskId.split('.').map(n => parseInt(n) || 0);
    const bNum = b.taskId.split('.').map(n => parseInt(n) || 0);
    for (let i = 0; i < Math.max(aNum.length, bNum.length); i++) {
      if (aNum[i] !== bNum[i]) return (aNum[i] || 0) - (bNum[i] || 0);
    }
    return 0;
  });
}

/**
 * 比较两个版本的差异（旧接口保留兼容）
 */
export function compareVersions(oldTasks: PlanTask[], newTasks: PlanTask[]): VersionDiff[] {
  const diffs: VersionDiff[] = [];
  const oldMap = new Map(oldTasks.map(t => [t.id, t]));
  const newMap = new Map(newTasks.map(t => [t.id, t]));

  for (const [id, task] of newMap) {
    if (!oldMap.has(id)) {
      diffs.push({ taskId: id, changeType: '新增', newValue: task.taskName });
    }
  }
  for (const [id, task] of oldMap) {
    if (!newMap.has(id)) {
      diffs.push({ taskId: id, changeType: '删除', oldValue: task.taskName });
    }
  }
  for (const [id, oldTask] of oldMap) {
    const newTask = newMap.get(id);
    if (newTask) {
      const changes: string[] = [];
      if (oldTask.taskName !== newTask.taskName) changes.push(`任务名称: ${oldTask.taskName} → ${newTask.taskName}`);
      const oldResponsible = (oldTask as any).responsible || oldTask.responsibleUser || '';
      const newResponsible = (newTask as any).responsible || newTask.responsibleUser || '';
      if (oldResponsible !== newResponsible) changes.push(`责任人: ${oldResponsible || '-'} → ${newResponsible || '-'}`);
      if (changes.length > 0) {
        diffs.push({ taskId: id, changeType: '修改', oldValue: changes.join('\n') });
      }
    }
  }
  return diffs.sort((a, b) => {
    const aNum = a.taskId.split('.').map(n => parseInt(n) || 0);
    const bNum = b.taskId.split('.').map(n => parseInt(n) || 0);
    for (let i = 0; i < Math.max(aNum.length, bNum.length); i++) {
      if (aNum[i] !== bNum[i]) return (aNum[i] || 0) - (bNum[i] || 0);
    }
    return 0;
  });
}

export function getDiffStats(diffs: VersionDiff[]): { added: number; deleted: number; modified: number } {
  return {
    added: diffs.filter(d => d.changeType === '新增').length,
    deleted: diffs.filter(d => d.changeType === '删除').length,
    modified: diffs.filter(d => d.changeType === '修改').length,
  };
}
