// 版本对比工具函数

import { PlanTask, VersionDiff } from '@/types';

/**
 * 比较两个版本的差异
 * @param oldTasks 旧版本任务列表
 * @param newTasks 新版本任务列表
 * @returns 差异列表
 */
export function compareVersions(oldTasks: PlanTask[], newTasks: PlanTask[]): VersionDiff[] {
  const diffs: VersionDiff[] = [];
  const oldMap = new Map(oldTasks.map(t => [t.id, t]));
  const newMap = new Map(newTasks.map(t => [t.id, t]));
  
  // 找出新增的任务
  for (const [id, task] of newMap) {
    if (!oldMap.has(id)) {
      diffs.push({
        taskId: id,
        changeType: '新增',
        newValue: task.taskName,
      });
    }
  }
  
  // 找出力除的任务
  for (const [id, task] of oldMap) {
    if (!newMap.has(id)) {
      diffs.push({
        taskId: id,
        changeType: '删除',
        oldValue: task.taskName,
      });
    }
  }
  
  // 找出修改的任务
  for (const [id, oldTask] of oldMap) {
    const newTask = newMap.get(id);
    if (newTask) {
      const changes: string[] = [];
      
      if (oldTask.taskName !== newTask.taskName) {
        changes.push(`任务名称: ${oldTask.taskName} → ${newTask.taskName}`);
      }
      if (oldTask.responsibleUser !== newTask.responsibleUser) {
        changes.push(`责任人: ${oldTask.responsibleUser || '-'} → ${newTask.responsibleUser || '-'}`);
      }
      if (oldTask.planStartDate?.getTime() !== newTask.planStartDate?.getTime()) {
        changes.push(`计划开始: ${formatDate(oldTask.planStartDate)} → ${formatDate(newTask.planStartDate)}`);
      }
      if (oldTask.planEndDate?.getTime() !== newTask.planEndDate?.getTime()) {
        changes.push(`计划结束: ${formatDate(oldTask.planEndDate)} → ${formatDate(newTask.planEndDate)}`);
      }
      if (oldTask.status !== newTask.status) {
        changes.push(`状态: ${oldTask.status} → ${newTask.status}`);
      }
      if (oldTask.progress !== newTask.progress) {
        changes.push(`进度: ${oldTask.progress}% → ${newTask.progress}%`);
      }
      
      if (changes.length > 0) {
        diffs.push({
          taskId: id,
          changeType: '修改',
          oldValue: changes.join('\n'),
          newValue: undefined,
        });
      }
    }
  }
  
  // 按序号排序
  return diffs.sort((a, b) => {
    const aNum = a.taskId.split('.').map(n => parseInt(n) || 0);
    const bNum = b.taskId.split('.').map(n => parseInt(n) || 0);
    for (let i = 0; i < Math.max(aNum.length, bNum.length); i++) {
      if (aNum[i] !== bNum[i]) return (aNum[i] || 0) - (bNum[i] || 0);
    }
    return 0;
  });
}

/**
 * 格式化日期
 */
function formatDate(date?: Date): string {
  if (!date) return '-';
  return date.toLocaleDateString('zh-CN');
}

/**
 * 获取差异统计
 */
export function getDiffStats(diffs: VersionDiff[]): {
  added: number;
  deleted: number;
  modified: number;
} {
  return {
    added: diffs.filter(d => d.changeType === '新增').length,
    deleted: diffs.filter(d => d.changeType === '删除').length,
    modified: diffs.filter(d => d.changeType === '修改').length,
  };
}
