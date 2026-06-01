import { Router, Request, Response } from 'express';
import { getDb } from '../database/db';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { projectId, assignee, status, bucket, priority } = req.query;

  let sql = 'SELECT * FROM tasks WHERE 1=1';
  const params: unknown[] = [];

  if (projectId) { sql += ' AND project_id = ?'; params.push(projectId); }
  if (status) { sql += ' AND progress = ?'; params.push(status); }
  if (bucket) { sql += ' AND bucket_name = ?'; params.push(bucket); }
  if (priority) { sql += ' AND priority = ?'; params.push(priority); }
  if (assignee) { sql += ' AND assigned_to LIKE ?'; params.push(`%${assignee}%`); }

  sql += ' ORDER BY due_date ASC, task_name ASC';

  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

export default router;
