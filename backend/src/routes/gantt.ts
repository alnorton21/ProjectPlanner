import { Router, Request, Response } from 'express';
import { getDb } from '../database/db';
import { buildGanttData } from '../services/ganttBuilder';

const router = Router();

router.get('/:projectId', (req: Request, res: Response) => {
  const db = getDb();
  const { groupBy = 'bucket', assignee, status, bucket, priority } = req.query;

  let sql = 'SELECT * FROM tasks WHERE project_id = ?';
  const params: unknown[] = [req.params.projectId];

  if (status) { sql += ' AND progress = ?'; params.push(status); }
  if (bucket) { sql += ' AND bucket_name = ?'; params.push(bucket); }
  if (priority) { sql += ' AND priority = ?'; params.push(priority); }
  if (assignee) { sql += ' AND assigned_to LIKE ?'; params.push(`%${assignee}%`); }

  const tasks = db.prepare(sql).all(...params) as Parameters<typeof buildGanttData>[0];
  const ganttData = buildGanttData(tasks, groupBy as 'bucket' | 'assignee' | 'flat');

  res.json(ganttData);
});

export default router;
