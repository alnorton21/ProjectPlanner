export interface Project {
  id: number;
  name: string;
  description: string | null;
  import_file_name: string | null;
  imported_at: string;
  updated_at: string;
  is_active: boolean;
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  overdue_tasks: number;
  completion_percent: number;
  health: 'green' | 'yellow' | 'red';
}

export interface Task {
  id: number;
  project_id: number;
  task_name: string;
  bucket_name: string | null;
  progress: 'Not started' | 'In progress' | 'Completed' | 'Late';
  progress_percent: number;
  priority: 'Low' | 'Medium' | 'Important' | 'Urgent';
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
  is_milestone: boolean;
}

export interface TeamMember {
  name: string;
  total: number;
  completed: number;
  in_progress: number;
  overdue: number;
  not_started: number;
  is_overloaded: boolean;
}

export interface Alert {
  id: number;
  project_id: number | null;
  task_id: number | null;
  alert_type: 'overdue_task' | 'at_risk' | 'project_behind' | 'member_overloaded' | 'stalled_bucket';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  detected_at: string;
  is_dismissed: boolean;
  dismissed_at: string | null;
  project_name?: string;
  task_name?: string;
}

export interface AlertConfig {
  id: number;
  alert_type: string;
  label: string;
  threshold: number;
  enabled: boolean;
}

export interface AnalyticsData {
  project_id: number;
  project_name: string;
  total: number;
  completed: number;
  in_progress: number;
  not_started: number;
  overdue: number;
  late: number;
  completion_percent: number;
  status_breakdown: { name: string; value: number; color: string }[];
  bucket_breakdown: { name: string; total: number; completed: number; incomplete: number }[];
  priority_breakdown: { name: string; value: number }[];
  burndown: { date: string; remaining: number }[];
}

export interface ImportHistory {
  id: number;
  project_id: number | null;
  file_name: string;
  task_count: number;
  imported_at: string;
  status: 'success' | 'error';
  project_name?: string;
}
