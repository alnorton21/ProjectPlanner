import { parseISO, eachWeekOfInterval, format } from 'date-fns';
import type { AnalyticsData } from '../types';

interface TaskRow {
  id?: number;
  progress: string;
  progress_percent?: number;
  bucket_name: string | null;
  priority: string;
  due_date: string | null;
  completed_date: string | null;
  created_date?: string | null;
}

interface ProjectRow {
  id: number;
  name: string;
  imported_at: string;
}

function buildBurndown(tasks: TaskRow[], importedAt: string): { date: string; remaining: number }[] {
  const now = new Date();
  const start = parseISO(importedAt);
  const allDueDates = tasks.filter(t => t.due_date).map(t => parseISO(t.due_date!));
  if (allDueDates.length === 0) return [];

  const end = new Date(Math.max(now.getTime(), ...allDueDates.map(d => d.getTime())));
  if (end <= start) return [];

  const weeks = eachWeekOfInterval({ start, end });
  return weeks.map(weekStart => {
    const remaining = tasks.filter(t => {
      if (t.completed_date && parseISO(t.completed_date) <= weekStart) return false;
      return true;
    }).length;
    return { date: format(weekStart, 'yyyy-MM-dd'), remaining };
  });
}

export function buildProjectAnalytics(project: ProjectRow, tasks: TaskRow[]): AnalyticsData {
  const now = new Date();
  const total = tasks.length;
  const completed = tasks.filter(t => t.progress === 'Completed').length;
  const inProgress = tasks.filter(t => t.progress === 'In progress').length;
  const notStarted = tasks.filter(t => t.progress === 'Not started').length;
  const overdue = tasks.filter(t => {
    if (t.progress === 'Completed') return false;
    if (!t.due_date) return false;
    return parseISO(t.due_date) < now;
  }).length;
  const late = tasks.filter(t => t.progress === 'Late').length;
  const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const bucketCounts: Record<string, { total: number; completed: number }> = {};
  for (const task of tasks) {
    const bucket = task.bucket_name ?? 'Uncategorized';
    if (!bucketCounts[bucket]) bucketCounts[bucket] = { total: 0, completed: 0 };
    bucketCounts[bucket].total++;
    if (task.progress === 'Completed') bucketCounts[bucket].completed++;
  }

  const priorityCounts: Record<string, number> = { Low: 0, Medium: 0, Important: 0, Urgent: 0 };
  for (const task of tasks) {
    const p = task.priority ?? 'Medium';
    if (p in priorityCounts) priorityCounts[p]++;
  }

  return {
    project_id: project.id,
    project_name: project.name,
    total,
    completed,
    in_progress: inProgress,
    not_started: notStarted,
    overdue,
    late,
    completion_percent: completionPct,
    status_breakdown: [
      { name: 'Completed', value: completed, color: '#22c55e' },
      { name: 'In Progress', value: inProgress, color: '#3b82f6' },
      { name: 'Not Started', value: notStarted, color: '#94a3b8' },
      { name: 'Overdue', value: overdue, color: '#ef4444' },
    ],
    bucket_breakdown: Object.entries(bucketCounts).map(([name, counts]) => ({
      name,
      total: counts.total,
      completed: counts.completed,
      incomplete: counts.total - counts.completed,
    })),
    priority_breakdown: Object.entries(priorityCounts).map(([name, value]) => ({ name, value })),
    burndown: buildBurndown(tasks, project.imported_at),
  };
}

export function buildPortfolioAnalytics(
  projects: ProjectRow[],
  tasks: { project_id: number; progress: string; due_date: string | null }[],
): { id: number; name: string; total: number; completed: number; overdue: number; completion_percent: number }[] {
  const now = new Date();
  return projects.map(p => {
    const ptasks = tasks.filter(t => t.project_id === p.id);
    const total = ptasks.length;
    const completed = ptasks.filter(t => t.progress === 'Completed').length;
    const overdue = ptasks.filter(t => {
      if (t.progress === 'Completed') return false;
      if (!t.due_date) return false;
      return parseISO(t.due_date) < now;
    }).length;
    const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { id: p.id, name: p.name, total, completed, overdue, completion_percent: completionPct };
  });
}
