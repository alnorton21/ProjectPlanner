import { Router, Request, Response } from 'express';
import { getDb } from '../database/db';
import { parseISO } from 'date-fns';

const router = Router();

function computeHealth(completionPct: number, overdueCount: number, importedAt: string, allDueDates: string[]): string {
  if (overdueCount > 2) return 'red';

  if (allDueDates.length > 0) {
    const projectStart = parseISO(importedAt);
    const projectEnd = new Date(Math.max(...allDueDates.map(d => parseISO(d).getTime())));
    const now = new Date();
    const totalDuration = projectEnd.getTime() - projectStart.getTime();
    if (totalDuration > 0) {
      const elapsed = now.getTime() - projectStart.getTime();
      const timeElapsedPct = Math.min(100, (elapsed / totalDuration) * 100);
      if (timeElapsedPct > completionPct + 20) return 'red';
      if (timeElapsedPct > completionPct + 5) return 'yellow';
    }
  }

  if (overdueCount > 0) return 'yellow';
  return 'green';
}

router.get('/', (_req: Request, res: Response) => {
  const db = getDb();

  const projects = db.prepare('SELECT * FROM projects WHERE is_active = 1 ORDER BY updated_at DESC').all() as {
    id: number; name: string; description: string | null; import_file_name: string | null;
    imported_at: string; updated_at: string;
  }[];

  const result = projects.map(p => {
    const tasks = db.prepare('SELECT progress, due_date FROM tasks WHERE project_id = ?').all(p.id) as {
      progress: string; due_date: string | null;
    }[];

    const total = tasks.length;
    const completed = tasks.filter(t => t.progress === 'Completed').length;
    const inProgress = tasks.filter(t => t.progress === 'In progress').length;
    const now = new Date();
    const overdue = tasks.filter(t => {
      if (t.progress === 'Completed') return false;
      if (!t.due_date) return false;
      return parseISO(t.due_date) < now;
    }).length;

    const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;
    const allDueDates = tasks.filter(t => t.due_date).map(t => t.due_date!);
    const health = computeHealth(completionPct, overdue, p.imported_at, allDueDates);

    return {
      ...p,
      total_tasks: total,
      completed_tasks: completed,
      in_progress_tasks: inProgress,
      overdue_tasks: overdue,
      completion_percent: completionPct,
      health,
    };
  });

  res.json(result);
});

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND is_active = 1').get(req.params.id);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  res.json(project);
});

router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('UPDATE projects SET is_active = 0 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
