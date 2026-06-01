import { parseISO, addDays } from 'date-fns';

interface TaskRow {
  id: number;
  task_name: string;
  bucket_name: string | null;
  progress: string;
  progress_percent: number;
  priority: string;
  assigned_to: string | null;
  start_date: string | null;
  due_date: string | null;
  created_date: string | null;
  notes: string | null;
  is_milestone: number;
}

const STATUS_COLORS: Record<string, string> = {
  'Completed': '#22c55e',
  'In progress': '#3b82f6',
  'Late': '#ef4444',
  'Not started': '#94a3b8',
};

function resolveStart(task: TaskRow): Date {
  if (task.start_date) return parseISO(task.start_date);
  if (task.created_date) return parseISO(task.created_date);
  if (task.due_date) return addDays(parseISO(task.due_date), -7);
  return new Date();
}

function resolveEnd(task: TaskRow, start: Date): Date {
  if (task.due_date) {
    const due = parseISO(task.due_date);
    return due > start ? due : addDays(start, 1);
  }
  return addDays(start, 7);
}

function isOverdue(task: TaskRow): boolean {
  if (task.progress === 'Completed') return false;
  if (!task.due_date) return false;
  return parseISO(task.due_date) < new Date();
}

function effectiveStatus(task: TaskRow): string {
  if (isOverdue(task)) return 'Late';
  return task.progress;
}

export function buildGanttData(tasks: TaskRow[], groupBy: 'bucket' | 'assignee' | 'flat' = 'bucket') {
  const ganttTasks: object[] = [];

  if (groupBy === 'bucket') {
    const buckets = new Map<string, TaskRow[]>();
    for (const task of tasks) {
      const bucket = task.bucket_name ?? 'Uncategorized';
      if (!buckets.has(bucket)) buckets.set(bucket, []);
      buckets.get(bucket)!.push(task);
    }

    for (const [bucket, bucketTasks] of buckets) {
      const starts = bucketTasks.map(t => resolveStart(t));
      const ends = bucketTasks.map(t => resolveEnd(t, resolveStart(t)));
      const minStart = new Date(Math.min(...starts.map(d => d.getTime())));
      const maxEnd = new Date(Math.max(...ends.map(d => d.getTime())));
      const completedCount = bucketTasks.filter(t => t.progress === 'Completed').length;
      const bucketProgress = bucketTasks.length > 0 ? Math.round((completedCount / bucketTasks.length) * 100) : 0;

      ganttTasks.push({
        id: `bucket-${bucket}`,
        name: bucket,
        start: minStart,
        end: maxEnd,
        progress: bucketProgress,
        type: 'project',
        hideChildren: false,
        styles: { backgroundColor: '#1e293b', progressColor: '#22c55e' },
      });

      for (const task of bucketTasks) {
        const start = resolveStart(task);
        const end = resolveEnd(task, start);
        const status = effectiveStatus(task);
        const color = STATUS_COLORS[status] ?? '#94a3b8';

        ganttTasks.push({
          id: `task-${task.id}`,
          name: task.task_name,
          start,
          end,
          progress: task.progress_percent,
          type: task.is_milestone ? 'milestone' : 'task',
          project: `bucket-${bucket}`,
          assignedTo: task.assigned_to,
          priority: task.priority,
          status,
          notes: task.notes,
          styles: {
            backgroundColor: color,
            backgroundSelectedColor: color,
            progressColor: status === 'Completed' ? '#16a34a' : '#1d4ed8',
            progressSelectedColor: status === 'Completed' ? '#16a34a' : '#1d4ed8',
          },
        });
      }
    }
  } else if (groupBy === 'assignee') {
    const members = new Map<string, TaskRow[]>();
    for (const task of tasks) {
      const names = (task.assigned_to ?? 'Unassigned').split(',').map(s => s.trim());
      for (const name of names) {
        if (!members.has(name)) members.set(name, []);
        members.get(name)!.push(task);
      }
    }

    for (const [member, memberTasks] of members) {
      const starts = memberTasks.map(t => resolveStart(t));
      const ends = memberTasks.map(t => resolveEnd(t, resolveStart(t)));
      const minStart = new Date(Math.min(...starts.map(d => d.getTime())));
      const maxEnd = new Date(Math.max(...ends.map(d => d.getTime())));
      const completedCount = memberTasks.filter(t => t.progress === 'Completed').length;

      ganttTasks.push({
        id: `member-${member}`,
        name: member,
        start: minStart,
        end: maxEnd,
        progress: memberTasks.length > 0 ? Math.round((completedCount / memberTasks.length) * 100) : 0,
        type: 'project',
        hideChildren: false,
        styles: { backgroundColor: '#1e293b', progressColor: '#22c55e' },
      });

      for (const task of memberTasks) {
        const start = resolveStart(task);
        const end = resolveEnd(task, start);
        const status = effectiveStatus(task);
        const color = STATUS_COLORS[status] ?? '#94a3b8';

        ganttTasks.push({
          id: `task-${task.id}-${member}`,
          name: task.task_name,
          start,
          end,
          progress: task.progress_percent,
          type: 'task',
          project: `member-${member}`,
          assignedTo: task.assigned_to,
          priority: task.priority,
          status,
          notes: task.notes,
          styles: {
            backgroundColor: color,
            backgroundSelectedColor: color,
            progressColor: '#1d4ed8',
            progressSelectedColor: '#1d4ed8',
          },
        });
      }
    }
  } else {
    for (const task of tasks) {
      const start = resolveStart(task);
      const end = resolveEnd(task, start);
      const status = effectiveStatus(task);
      const color = STATUS_COLORS[status] ?? '#94a3b8';

      ganttTasks.push({
        id: `task-${task.id}`,
        name: task.task_name,
        start,
        end,
        progress: task.progress_percent,
        type: 'task',
        assignedTo: task.assigned_to,
        priority: task.priority,
        status,
        notes: task.notes,
        styles: {
          backgroundColor: color,
          backgroundSelectedColor: color,
          progressColor: '#1d4ed8',
          progressSelectedColor: '#1d4ed8',
        },
      });
    }
  }

  return ganttTasks;
}
