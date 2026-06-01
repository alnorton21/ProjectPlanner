import Database from 'better-sqlite3';

export function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      import_file_name TEXT,
      imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      task_name TEXT NOT NULL,
      bucket_name TEXT,
      progress TEXT DEFAULT 'Not started',
      progress_percent INTEGER DEFAULT 0,
      priority TEXT DEFAULT 'Medium',
      assigned_to TEXT,
      created_by TEXT,
      created_date DATETIME,
      start_date DATETIME,
      due_date DATETIME,
      completed_date DATETIME,
      labels TEXT DEFAULT '[]',
      notes TEXT,
      checklist_total INTEGER DEFAULT 0,
      checklist_complete INTEGER DEFAULT 0,
      is_milestone INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS team_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS alert_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_type TEXT NOT NULL UNIQUE,
      label TEXT,
      threshold INTEGER DEFAULT 3,
      enabled INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
      alert_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      message TEXT NOT NULL,
      detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      dismissed_at DATETIME,
      is_dismissed INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS import_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      file_name TEXT,
      task_count INTEGER,
      imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'success'
    );
  `);

  seedAlertConfig(db);
}

function seedAlertConfig(db: Database.Database): void {
  const configs = [
    { alert_type: 'overdue_task', label: 'Overdue task alert', threshold: 1, enabled: 1 },
    { alert_type: 'at_risk', label: 'Days before due date with no progress', threshold: 3, enabled: 1 },
    { alert_type: 'project_behind', label: 'Project schedule buffer (%)', threshold: 10, enabled: 1 },
    { alert_type: 'member_overloaded', label: 'Overdue tasks per member', threshold: 3, enabled: 1 },
    { alert_type: 'stalled_bucket', label: 'Stalled bucket alert', threshold: 1, enabled: 1 },
  ];

  const insert = db.prepare(`
    INSERT OR IGNORE INTO alert_config (alert_type, label, threshold, enabled)
    VALUES (@alert_type, @label, @threshold, @enabled)
  `);

  for (const config of configs) {
    insert.run(config);
  }
}
