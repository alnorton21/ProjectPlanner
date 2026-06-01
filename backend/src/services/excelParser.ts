import * as XLSX from 'xlsx';
import path from 'path';

export interface ParsedTask {
  task_name: string;
  bucket_name: string | null;
  progress: string;
  progress_percent: number;
  priority: string;
  assigned_to: string | null;
  created_by: string | null;
  created_date: string | null;
  start_date: string | null;
  due_date: string | null;
  completed_date: string | null;
  labels: string;
  notes: string | null;
  checklist_total: number;
  checklist_complete: number;
  is_milestone: number;
}

export interface ParseResult {
  projectName: string;
  tasks: ParsedTask[];
  assignees: string[];
}

const COLUMN_MAP: Record<string, string> = {
  'task name': 'task_name',
  'bucket name': 'bucket_name',
  'progress': 'progress',
  '% complete': 'progress_percent',
  'priority': 'priority',
  'assigned to': 'assigned_to',
  'created by': 'created_by',
  'created date': 'created_date',
  'start date': 'start_date',
  'due date': 'due_date',
  'completed date': 'completed_date',
  'notes': 'notes',
  'checklist items': 'checklist_items_raw',
};

const LABEL_COLUMNS = ['label 1', 'label 2', 'label 3', 'label 4', 'label 5', 'label 6'];

const PROGRESS_NORMALIZE: Record<string, string> = {
  'not started': 'Not started',
  'in progress': 'In progress',
  'completed': 'Completed',
  'late': 'Late',
  '': 'Not started',
};

function excelDateToISO(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (!date) return null;
    const d = new Date(date.y, date.m - 1, date.d);
    return d.toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    const d = new Date(value.trim());
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

function parseChecklist(raw: unknown): { total: number; complete: number } {
  if (!raw || typeof raw !== 'string') return { total: 0, complete: 0 };
  const match = raw.match(/(\d+)\s*\/\s*(\d+)/);
  if (match) return { complete: parseInt(match[1]), total: parseInt(match[2]) };
  return { total: 0, complete: 0 };
}

function normalizeProgress(raw: unknown): string {
  const key = String(raw ?? '').toLowerCase().trim();
  return PROGRESS_NORMALIZE[key] ?? 'Not started';
}

export function parseExcel(filePath: string, originalName: string): ParseResult {
  const workbook = XLSX.readFile(filePath, { cellDates: false });

  let sheet: XLSX.WorkSheet | null = null;
  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { header: 1 }) as unknown[][];
    const headerRow = rows.find(row =>
      Array.isArray(row) && row.some(cell => String(cell ?? '').toLowerCase().includes('task name'))
    );
    if (headerRow) {
      sheet = ws;
      break;
    }
  }

  if (!sheet) throw new Error('No valid Microsoft Planner sheet found in this file');

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    raw: true,
    defval: '',
  });

  if (rows.length === 0) throw new Error('No task rows found in the spreadsheet');

  const headerKeys = Object.keys(rows[0]).map(k => k.trim());

  const labelCols: string[] = [];
  for (const h of headerKeys) {
    if (LABEL_COLUMNS.includes(h.toLowerCase())) labelCols.push(h);
  }

  const tasks: ParsedTask[] = [];
  const assigneeSet = new Set<string>();

  for (const row of rows) {
    const get = (colLower: string): unknown => {
      const key = headerKeys.find(k => k.toLowerCase() === colLower);
      return key ? row[key] : '';
    };

    const taskName = String(get('task name') ?? '').trim();
    if (!taskName) continue;

    const assignedRaw = String(get('assigned to') ?? '').trim();
    const assignees = assignedRaw
      .split(/[,;]+/)
      .map(s => s.trim())
      .filter(Boolean);
    assignees.forEach(a => assigneeSet.add(a));

    const labels = labelCols
      .map(col => String(row[col] ?? '').trim())
      .filter(Boolean);

    const checklistRaw = get('checklist items');
    const checklist = parseChecklist(checklistRaw);

    const progressRaw = get('progress');
    const progressStr = normalizeProgress(progressRaw);

    const percentRaw = get('% complete');
    let progressPercent = 0;
    if (typeof percentRaw === 'number') {
      progressPercent = Math.round(percentRaw * (percentRaw <= 1 ? 100 : 1));
    } else if (typeof percentRaw === 'string') {
      progressPercent = parseInt(percentRaw) || 0;
    }
    if (progressStr === 'Completed') progressPercent = 100;

    tasks.push({
      task_name: taskName,
      bucket_name: String(get('bucket name') ?? '').trim() || null,
      progress: progressStr,
      progress_percent: progressPercent,
      priority: String(get('priority') ?? 'Medium').trim() || 'Medium',
      assigned_to: assignees.join(', ') || null,
      created_by: String(get('created by') ?? '').trim() || null,
      created_date: excelDateToISO(get('created date')),
      start_date: excelDateToISO(get('start date')),
      due_date: excelDateToISO(get('due date')),
      completed_date: excelDateToISO(get('completed date')),
      labels: JSON.stringify(labels),
      notes: String(get('notes') ?? '').trim() || null,
      checklist_total: checklist.total,
      checklist_complete: checklist.complete,
      is_milestone: 0,
    });
  }

  const projectName = path.basename(originalName, path.extname(originalName));

  return {
    projectName,
    tasks,
    assignees: Array.from(assigneeSet),
  };
}
