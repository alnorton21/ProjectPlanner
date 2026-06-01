import { differenceInDays, isPast, parseISO } from 'date-fns';

interface AlertConfigRow {
  alert_type: string;
  threshold: number;
  enabled: boolean;
}

interface TaskRow {
  id: number;
  project_id: number;
  task_name: string;
  bucket_name: string | null;
  progress: string;
  progress_percent: number;
  assigned_to: string | null;
  due_date: string | null;
}

interface ProjectRow {
  imported_at: string;
}

export interface AlertInsert {
  project_id: number;
  task_id: number | null;
  alert_type: string;
  severity: string;
  message: string;
}

function getConfig(configs: AlertConfigRow[], type: string): AlertConfigRow | undefined {
  return configs.find(c => c.alert_type === type && c.enabled);
}

export function runAlertEngine(
  projectId: number,
  project: ProjectRow,
  tasks: TaskRow[],
  configs: AlertConfigRow[],
): AlertInsert[] {
  const results: AlertInsert[] = [];
  const now = new Date();

  // 1. Overdue tasks
  const overdueConfig = getConfig(configs, 'overdue_task');
  if (overdueConfig) {
    for (const task of tasks) {
      if (task.progress === 'Completed') continue;
      if (!task.due_date) continue;
      const due = parseISO(task.due_date);
      if (isPast(due)) {
        const daysOverdue = differenceInDays(now, due);
        results.push({
          project_id: projectId,
          task_id: task.id,
          alert_type: 'overdue_task',
          severity: 'critical',
          message: `"${task.task_name}" is ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue`,
        });
      }
    }
  }

  // 2. At-risk tasks (due within N days, no progress)
  const atRiskConfig = getConfig(configs, 'at_risk');
  if (atRiskConfig) {
    for (const task of tasks) {
      if (task.progress === 'Completed') continue;
      if (task.progress_percent > 0) continue;
      if (!task.due_date) continue;
      const due = parseISO(task.due_date);
      if (isPast(due)) continue;
      const daysUntil = differenceInDays(due, now);
      if (daysUntil <= atRiskConfig.threshold) {
        results.push({
          project_id: projectId,
          task_id: task.id,
          alert_type: 'at_risk',
          severity: 'warning',
          message: `"${task.task_name}" is due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''} with no progress`,
        });
      }
    }
  }

  // 3. Project behind schedule
  const behindConfig = getConfig(configs, 'project_behind');
  if (behindConfig) {
    const allDueDates = tasks.filter(t => t.due_date).map(t => parseISO(t.due_date!));
    if (allDueDates.length > 0) {
      const projectStart = parseISO(project.imported_at);
      const projectEnd = new Date(Math.max(...allDueDates.map(d => d.getTime())));
      const totalDuration = projectEnd.getTime() - projectStart.getTime();
      if (totalDuration > 0) {
        const elapsed = now.getTime() - projectStart.getTime();
        const timeElapsedPct = Math.min(100, (elapsed / totalDuration) * 100);
        const completedTasks = tasks.filter(t => t.progress === 'Completed').length;
        const completionPct = tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0;
        if (timeElapsedPct > completionPct + behindConfig.threshold) {
          const gap = Math.round(timeElapsedPct - completionPct);
          results.push({
            project_id: projectId,
            task_id: null,
            alert_type: 'project_behind',
            severity: 'warning',
            message: `Project is ${gap}% behind schedule (${Math.round(completionPct)}% complete, ${Math.round(timeElapsedPct)}% of time elapsed)`,
          });
        }
      }
    }
  }

  // 4. Member overloaded
  const overloadConfig = getConfig(configs, 'member_overloaded');
  if (overloadConfig) {
    const memberOverdue: Record<string, number> = {};
    for (const task of tasks) {
      if (task.progress === 'Completed') continue;
      if (!task.due_date) continue;
      const due = parseISO(task.due_date);
      if (!isPast(due)) continue;
      const members = (task.assigned_to ?? '').split(',').map(s => s.trim()).filter(Boolean);
      for (const m of members) {
        memberOverdue[m] = (memberOverdue[m] ?? 0) + 1;
      }
    }
    for (const [member, count] of Object.entries(memberOverdue)) {
      if (count >= overloadConfig.threshold) {
        results.push({
          project_id: projectId,
          task_id: null,
          alert_type: 'member_overloaded',
          severity: 'warning',
          message: `${member} has ${count} overdue task${count !== 1 ? 's' : ''}`,
        });
      }
    }
  }

  // 5. Stalled buckets
  const stalledConfig = getConfig(configs, 'stalled_bucket');
  if (stalledConfig) {
    const buckets: Record<string, TaskRow[]> = {};
    for (const task of tasks) {
      const bucket = task.bucket_name ?? 'Uncategorized';
      if (!buckets[bucket]) buckets[bucket] = [];
      buckets[bucket].push(task);
    }
    for (const [bucket, bucketTasks] of Object.entries(buckets)) {
      const incomplete = bucketTasks.filter(t => t.progress !== 'Completed');
      if (incomplete.length === 0) continue;
      const anyProgress = incomplete.some(t => t.progress_percent > 0 || t.progress === 'In progress');
      if (!anyProgress) {
        const hasDue = incomplete.some(t => t.due_date && isPast(parseISO(t.due_date)));
        if (hasDue) {
          results.push({
            project_id: projectId,
            task_id: null,
            alert_type: 'stalled_bucket',
            severity: 'info',
            message: `Bucket "${bucket}" has ${incomplete.length} incomplete tasks with no progress`,
          });
        }
      }
    }
  }

  return results;
}
