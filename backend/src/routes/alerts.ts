import { Router, Request, Response } from 'express';
import { getDb } from '../database/db';
import { runAlertEngine } from '../services/alertEngine';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { dismissed = 'false', projectId } = req.query;

  let sql = `
    SELECT a.*, p.name as project_name, t.task_name
    FROM alerts a
    LEFT JOIN projects p ON a.project_id = p.id
    LEFT JOIN tasks t ON a.task_id = t.id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (dismissed === 'false') { sql += ' AND a.is_dismissed = 0'; }
  if (projectId) { sql += ' AND a.project_id = ?'; params.push(projectId); }
  sql += ' ORDER BY a.severity ASC, a.detected_at DESC';

  res.json(db.prepare(sql).all(...params));
});

router.post('/refresh', (req: Request, res: Response) => {
  const db = getDb();
  const { projectId } = req.body;

  if (projectId) {
    runAlertEngine(Number(projectId));
  } else {
    const projects = db.prepare('SELECT id FROM projects WHERE is_active = 1').all() as { id: number }[];
    for (const p of projects) runAlertEngine(p.id);
  }

  res.json({ success: true });
});

router.put('/:id/dismiss', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('UPDATE alerts SET is_dismissed = 1, dismissed_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.delete('/dismissed', (_req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM alerts WHERE is_dismissed = 1').run();
  res.json({ success: true });
});

router.get('/config', (_req: Request, res: Response) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM alert_config ORDER BY id ASC').all());
});

router.put('/config', (req: Request, res: Response) => {
  const db = getDb();
  const configs = req.body as { id: number; threshold: number; enabled: number }[];

  const update = db.prepare('UPDATE alert_config SET threshold = @threshold, enabled = @enabled WHERE id = @id');
  const updateMany = db.transaction(() => {
    for (const c of configs) update.run(c);
  });
  updateMany();

  res.json({ success: true });
});

export default router;
