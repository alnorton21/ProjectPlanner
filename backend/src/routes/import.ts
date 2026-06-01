import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { parseExcel } from '../services/excelParser';
import { runAlertEngine } from '../services/alertEngine';
import { getDb } from '../database/db';

const router = Router();

const upload = multer({
  dest: path.join(__dirname, '../../uploads'),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.includes('spreadsheet') || file.originalname.endsWith('.xlsx')) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx files are accepted'));
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 },
});

// Preview: parse without saving
router.post('/preview', upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }
  try {
    const result = parseExcel(req.file.path, req.file.originalname);
    res.json({
      projectName: result.projectName,
      taskCount: result.tasks.length,
      assignees: result.assignees,
      tasks: result.tasks.slice(0, 50),
      filePath: req.file.path,
      originalName: req.file.originalname,
    });
  } catch (err) {
    fs.unlinkSync(req.file.path);
    res.status(422).json({ error: (err as Error).message });
  }
});

// Confirm import: save to DB
router.post('/confirm', (req: Request, res: Response) => {
  const { filePath, originalName, projectName, replaceProjectId } = req.body;

  if (!filePath || !originalName) {
    res.status(400).json({ error: 'Missing filePath or originalName' });
    return;
  }

  const db = getDb();

  try {
    const result = parseExcel(filePath, originalName);
    const name = (projectName as string) || result.projectName;

    let projectId: number;

    if (replaceProjectId) {
      db.prepare('DELETE FROM tasks WHERE project_id = ?').run(replaceProjectId);
      db.prepare('UPDATE projects SET name = ?, import_file_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(name, originalName, replaceProjectId);
      projectId = Number(replaceProjectId);
    } else {
      const proj = db.prepare('INSERT INTO projects (name, import_file_name) VALUES (?, ?)').run(name, originalName);
      projectId = proj.lastInsertRowid as number;
    }

    const insertTask = db.prepare(`
      INSERT INTO tasks (project_id, task_name, bucket_name, progress, progress_percent, priority,
        assigned_to, created_by, created_date, start_date, due_date, completed_date,
        labels, notes, checklist_total, checklist_complete, is_milestone)
      VALUES (@project_id, @task_name, @bucket_name, @progress, @progress_percent, @priority,
        @assigned_to, @created_by, @created_date, @start_date, @due_date, @completed_date,
        @labels, @notes, @checklist_total, @checklist_complete, @is_milestone)
    `);

    const insertMany = db.transaction((tasks: typeof result.tasks) => {
      for (const task of tasks) {
        insertTask.run({ project_id: projectId, ...task });
      }
    });

    insertMany(result.tasks);

    const insertMember = db.prepare('INSERT OR IGNORE INTO team_members (name) VALUES (?)');
    for (const name of result.assignees) {
      insertMember.run(name);
    }

    db.prepare('INSERT INTO import_history (project_id, file_name, task_count, status) VALUES (?, ?, ?, ?)').run(
      projectId, originalName, result.tasks.length, 'success'
    );

    runAlertEngine(projectId);

    try { fs.unlinkSync(filePath); } catch { /* already cleaned up */ }

    res.json({ success: true, projectId, taskCount: result.tasks.length });
  } catch (err) {
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    db.prepare('INSERT INTO import_history (file_name, task_count, status) VALUES (?, ?, ?)').run(
      originalName, 0, 'error'
    );
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/history', (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT ih.*, p.name as project_name
    FROM import_history ih
    LEFT JOIN projects p ON ih.project_id = p.id
    ORDER BY ih.imported_at DESC
    LIMIT 50
  `).all();
  res.json(rows);
});

export default router;
