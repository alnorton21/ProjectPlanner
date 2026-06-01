import { Router, Request, Response } from 'express';
import { getDb } from '../database/db';
import { parseISO } from 'date-fns';

const router = Router();

interface TaskRow {
  id: number;
  task_name: string;
  bucket_name: string | null;
  progress: string;
  progress_percent: number;
  priority: string;
  assigned_to: string | null;
  due_date: string | null;
  project_id: number;
}

function computeMemberStats(tasks: TaskRow[]) {
  const now = new Date();
  const total = tasks.length;
  const completed = tasks.filter(t => t.progress === 'Completed').length;
  const inProgress = tasks.filter(t => t.progress === 'In progress').length;
  const overdue = tasks.filter(t => {
    if (t.progress === 'Completed') return false;
    if (!t.due_date) return false;
    return parseISO(t.due_date) < now;
  }).length;
  const notStarted = tasks.filter(t => t.progress === 'Not started').length;
  return { total, completed, in_progress: inProgress, overdue, not_started: notStarted };
}

router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { projectId } = req.query;

  let taskSql = 'SELECT * FROM tasks WHERE assigned_to IS NOT NULL AND assigned_to != ""';
  const params: unknown[] = [];
  if (projectId) { taskSql += ' AND project_id = ?'; params.push(projectId); }

  const allTasks = db.prepare(taskSql).all(...params) as TaskRow[];
  const members = db.prepare('SELECT name FROM team_members ORDER BY name ASC').all() as { name: string }[];

  const overdueThreshold = (db.prepare("SELECT threshold FROM alert_config WHERE alert_type = 'member_overloaded'").get() as { threshold: number } | undefined)?.threshold ?? 3;

  const result = members.map(m => {
    const memberTasks = allTasks.filter(t =>
      (t.assigned_to ?? '').split(',').map(s => s.trim()).includes(m.name)
    );
    const stats = computeMemberStats(memberTasks);
    return {
      name: m.name,
      ...stats,
      is_overloaded: stats.overdue >= overdueThreshold,
    };
  }).filter(m => m.total > 0);

  res.json(result);
});

router.get('/:name', (req: Request, res: Response) => {
  const db = getDb();
  const { projectId } = req.query;
  const name = decodeURIComponent(req.params.name);

  let sql = 'SELECT * FROM tasks WHERE assigned_to LIKE ?';
  const params: unknown[] = [`%${name}%`];
  if (projectId) { sql += ' AND project_id = ?'; params.push(projectId); }
  sql += ' ORDER BY due_date ASC';

  const tasks = db.prepare(sql).all(...params) as TaskRow[];
  const filtered = tasks.filter(t =>
    (t.assigned_to ?? '').split(',').map(s => s.trim()).includes(name)
  );

  res.json({ name, tasks: filtered, stats: computeMemberStats(filtered) });
});

export default router;
