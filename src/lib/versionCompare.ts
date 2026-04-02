// 版本对比工具函数

import { PlanTask, VersionDiff } from '@/types';

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
  changeType: '新增' | '删除' | '修改' | '未变更';
  // 当前各字段值（新版本优先，删除时取旧版本）
  taskName: string;
  responsible: string;
  predecessor: string;
  planStartDate: string;
  planEndDate: string;
  estimatedDays: number;
  actualStartDate: string;
  actualEndDate: string;
  actualDays: number;
  status: string;
  progress: number;
  // 字段级差异明细（修改时有值）
  fieldDiffs: FieldDiff[];
  // 修改信息（Mock）
  modifier: string;
  modifyTime: string;
}

/**
 * 比较两个版本，生成表格行数据
 */
export function compareVersionsForTable(oldTasks: PlanTask[], newTasks: PlanTask[]): CompareTableRow[] {
  const rows: CompareTableRow[] = [];
  const oldMap = new Map(oldTasks.map(t => [t.id, t]));
  const newMap = new Map(newTasks.map(t => [t.id, t]));
  const allIds = new Set([...oldMap.keys(), ...newMap.keys()]);

  const mockModifiers = ['张三', '李四', '王五', '赵六'];
  const mockTimes = ['2026-03-10 14:30', '2026-03-11 09:15', '2026-03-11 16:42', '2026-03-12 10:08'];
  let mockIdx = 0;

  for (const id of allIds) {
    const oldTask = oldMap.get(id);
    const newTask = newMap.get(id);

    if (newTask && !oldTask) {
      // 新增
      rows.push({
        key: id,
        taskId: id,
        changeType: '新增',
        taskName: newTask.taskName,
        responsible: (newTask as any).responsible || newTask.responsibleUser || '',
        predecessor: (newTask as any).predecessor || '',
        planStartDate: (newTask.planStartDate as any) || '',
        planEndDate: (newTask.planEndDate as any) || '',
        estimatedDays: (newTask as any).estimatedDays || 0,
        actualStartDate: (newTask.actualStartDate as any) || '',
        actualEndDate: (newTask.actualEndDate as any) || '',
        actualDays: (newTask as any).actualDays || 0,
        status: newTask.status,
        progress: newTask.progress,
        fieldDiffs: [],
        modifier: mockModifiers[mockIdx % mockModifiers.length],
        modifyTime: mockTimes[mockIdx % mockTimes.length],
      });
      mockIdx++;
    } else if (oldTask && !newTask) {
      // 删除
      rows.push({
        key: id,
        taskId: id,
        changeType: '删除',
        taskName: oldTask.taskName,
        responsible: (oldTask as any).responsible || oldTask.responsibleUser || '',
        predecessor: (oldTask as any).predecessor || '',
        planStartDate: (oldTask.planStartDate as any) || '',
        planEndDate: (oldTask.planEndDate as any) || '',
        estimatedDays: (oldTask as any).estimatedDays || 0,
        actualStartDate: (oldTask.actualStartDate as any) || '',
        actualEndDate: (oldTask.actualEndDate as any) || '',
        actualDays: (oldTask as any).actualDays || 0,
        status: oldTask.status,
        progress: oldTask.progress,
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
      const oldEstDays = (oldTask as any).estimatedDays || 0;
      const newEstDays = (newTask as any).estimatedDays || 0;
      if (oldEstDays !== newEstDays) {
        fieldDiffs.push({ field: 'estimatedDays', oldValue: `${oldEstDays}天`, newValue: `${newEstDays}天` });
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
      const oldActDays = (oldTask as any).actualDays || 0;
      const newActDays = (newTask as any).actualDays || 0;
      if (oldActDays !== newActDays) {
        fieldDiffs.push({ field: 'actualDays', oldValue: `${oldActDays}天`, newValue: `${newActDays}天` });
      }
      if (oldTask.status !== newTask.status) {
        fieldDiffs.push({ field: 'status', oldValue: oldTask.status, newValue: newTask.status });
      }
      if (oldTask.progress !== newTask.progress) {
        fieldDiffs.push({ field: 'progress', oldValue: `${oldTask.progress}%`, newValue: `${newTask.progress}%` });
      }

      rows.push({
        key: id,
        taskId: id,
        changeType: fieldDiffs.length > 0 ? '修改' : '未变更',
        taskName: newTask.taskName,
        responsible: newResp,
        predecessor: newPred,
        planStartDate: newStart,
        planEndDate: newEnd,
        estimatedDays: newEstDays,
        actualStartDate: newActStart,
        actualEndDate: newActEnd,
        actualDays: newActDays,
        status: newTask.status,
        progress: newTask.progress,
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
