// 序号生成工具函数

import { PlanTask } from '@/types';

/**
 * 生成任务序号
 * @param siblings 同级任务列表
 * @param parentId 父任务ID（可选）
 * @returns 序号字符串
 */
export function generateTaskNumber(siblings: PlanTask[], parentId?: string): string {
  if (!parentId) {
    // 一级活动：1, 2, 3...
    return String(siblings.length + 1);
  } else {
    // 子活动：1.1, 1.2, 2.1...
    const parentNumber = siblings[0]?.id.split('.').pop() || '1';
    return `${parentNumber}.${siblings.length + 1}`;
  }
}

/**
 * 根据父任务序号生成子任务序号
 * @param parentNumber 父任务序号，如 "1" 或 "1.1"
 * @param childCount 当前子任务数量
 * @returns 子任务序号，如 "1.1" 或 "1.1.1"
 */
export function generateChildNumber(parentNumber: string, childCount: number): string {
  return `${parentNumber}.${childCount + 1}`;
}

/**
 * 验证序号格式
 * @param number 序号字符串
 * @returns 是否有效
 */
export function isValidTaskNumber(number: string): boolean {
  // 匹配格式：1, 2, 1.1, 1.2, 1.1.1, 2.3.4 等
  return /^\d+(\.\d+)*$/.test(number);
}

/**
 * 获取序号层级
 * @param number 序号字符串
 * @returns 层级（1, 2, 3）
 */
export function getTaskLevel(number: string): number {
  return number.split('.').length;
}

/**
 * 重新计算所有任务的序号
 * @param tasks 任务列表
 * @returns 重新编号后的任务列表
 */
export function renumberTasks(tasks: PlanTask[]): PlanTask[] {
  const result: PlanTask[] = [];
  
  // 按order排序
  const sorted = [...tasks].sort((a, b) => a.order - b.order);
  
  let level1Index = 0;
  let level2Index: { [key: string]: number } = {};
  let level3Index: { [key: string]: number } = {};
  
  for (const task of sorted) {
    const level = getTaskLevel(task.id);
    
    if (!task.parentId) {
      // 一级任务
      level1Index++;
      level2Index[task.id] = 0;
      level3Index[task.id] = 0;
      result.push({ ...task, id: String(level1Index) });
    } else if (level === 2) {
      // 二级任务
      const parent = result.find(t => t.id === task.parentId);
      if (parent) {
        level2Index[task.parentId]++;
        level3Index[task.id] = 0;
        result.push({ ...task, id: `${parent.id}.${level2Index[task.parentId]}` });
      }
    } else if (level === 3) {
      // 三级任务
      const parent = result.find(t => t.id === task.parentId);
      if (parent) {
        level3Index[task.parentId]++;
        result.push({ ...task, id: `${parent.id}.${level3Index[task.parentId]}` });
      }
    }
  }
  
  return result;
}
