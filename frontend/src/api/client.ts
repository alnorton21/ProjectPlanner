import { supabase } from '../lib/supabase';
import { parseISO } from 'date-fns';
import type { Task, Alert, AlertConfig } from '../types';
import { buildGanttData } from '../services/ganttBuilder';
import { runAlertEngine } from '../services/alertEngine';
import { buildProjectAnalytics, buildPortfolioAnalytics } from '../services/analyticsBuilder';
import { parseExcelBrowser, type ParseResult } from '../services/excelParser';

function computeHealth(
  completionPct: number,
  overdueCount: number,
  importedAt: string,
  allDueDates: string[],
): 'green' | 'yellow' | 'red' {
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

// ─── PROJECTS ────────────────────────────────────────────────────────────────
export const projectsApi = {
  list: async () => {
    const { data: projects, error } = await supabase
      .from('projects')
      .select('*')
      .eq('is_active', true)
      .order('updated_at', { ascending: false });
    if (error) throw new Error(error.message);
    if (!projects || projects.length === 0) return [];

    const projectIds = projects.map((p: any) => p.id);
    const { data: tasks, error: taskError } = await supabase
      .from('tasks')
      .select('project_id, progress, due_date')
      .in('project_id', projectIds);
    if (taskError) throw new Error(taskError.message);

    const now = new Date();
    return projects.map((p: any) => {
      const ptasks = (tasks ?? []).filter((t: any) => t.project_id === p.id);
      const total = ptasks.length;
      const completed = ptasks.filter((t: any) => t.progress === 'Completed').length;
      const inProgress = ptasks.filter((t: any) => t.progress === 'In progress').length;
      const overdue = ptasks.filter((t: any) =>
        t.progress !== 'Completed' && t.due_date && parseISO(t.due_date) < now
      ).length;
      const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;
      const allDueDates = ptasks.filter((t: any) => t.due_date).map((t: any) => t.due_date as string);
      return {
        ...p,
        total_tasks: total,
        completed_tasks: completed,
        in_progress_tasks: inProgress,
        overdue_tasks: overdue,
        completion_percent: completionPct,
        health: computeHealth(completionPct, overdue, p.imported_at, allDueDates),
      };
    });
  },

  get: async (id: number) => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  remove: async (id: number) => {
    const { error } = await supabase
      .from('projects')
      .update({ is_active: false })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },
};

// ─── TASKS ────────────────────────────────────────────────────────────────────
export const tasksApi = {
  list: async (params: {
    projectId?: number;
    assignee?: string;
    progress?: string;
    bucket?: string;
    priority?: string;
  } = {}) => {
    let query = supabase.from('tasks').select('*');
    if (params.projectId) query = query.eq('project_id', params.projectId);
    if (params.progress) query = query.eq('progress', params.progress);
    if (params.bucket) query = query.eq('bucket_name', params.bucket);
    if (params.priority) query = query.eq('priority', params.priority);
    if (params.assignee) query = query.ilike('assigned_to', `%${params.assignee}%`);
    query = query.order('due_date', { ascending: true, nullsFirst: false });
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []) as Task[];
  },
};

// ─── GANTT ────────────────────────────────────────────────────────────────────
export const ganttApi = {
  get: async (projectId: number, params: { groupBy?: string } = {}) => {
    const tasks = await tasksApi.list({ projectId });
    return buildGanttData(tasks as any, (params.groupBy ?? 'bucket') as 'bucket' | 'assignee' | 'flat');
  },
};

// ─── TEAM ─────────────────────────────────────────────────────────────────────
export const teamApi = {
  list: async (projectId?: number) => {
    const { data: members, error: memberError } = await supabase
      .from('team_members')
      .select('name')
      .order('name');
    if (memberError) throw new Error(memberError.message);

    let taskQuery = supabase
      .from('tasks')
      .select('*')
      .not('assigned_to', 'is', null)
      .neq('assigned_to', '');
    if (projectId) taskQuery = taskQuery.eq('project_id', projectId);
    const { data: allTasks, error: taskError } = await taskQuery;
    if (taskError) throw new Error(taskError.message);

    const { data: configRow } = await supabase
      .from('alert_config')
      .select('threshold')
      .eq('alert_type', 'member_overloaded')
      .single();
    const overdueThreshold = configRow?.threshold ?? 3;
    const now = new Date();

    return (members ?? [])
      .map((m: { name: string }) => {
        const memberTasks = (allTasks ?? []).filter((t: any) =>
          (t.assigned_to ?? '').split(',').map((s: string) => s.trim()).includes(m.name)
        ) as Task[];
        const total = memberTasks.length;
        if (total === 0) return null;
        const completed = memberTasks.filter(t => t.progress === 'Completed').length;
        const inProgress = memberTasks.filter(t => t.progress === 'In progress').length;
        const notStarted = memberTasks.filter(t => t.progress === 'Not started').length;
        const overdue = memberTasks.filter(t =>
          t.progress !== 'Completed' && t.due_date && parseISO(t.due_date) < now
        ).length;
        return {
          name: m.name,
          total,
          completed,
          in_progress: inProgress,
          overdue,
          not_started: notStarted,
          is_overloaded: overdue >= overdueThreshold,
        };
      })
      .filter(Boolean);
  },

  getMember: async (name: string, projectId?: number) => {
    let query = supabase
      .from('tasks')
      .select('*')
      .ilike('assigned_to', `%${name}%`)
      .order('due_date', { ascending: true, nullsFirst: false });
    if (projectId) query = query.eq('project_id', projectId);
    const { data: tasks, error } = await query;
    if (error) throw new Error(error.message);
    const filtered = (tasks ?? []).filter((t: Task) =>
      (t.assigned_to ?? '').split(',').map((s: string) => s.trim()).includes(name)
    ) as Task[];
    const now = new Date();
    const total = filtered.length;
    const completed = filtered.filter(t => t.progress === 'Completed').length;
    const inProgress = filtered.filter(t => t.progress === 'In progress').length;
    const notStarted = filtered.filter(t => t.progress === 'Not started').length;
    const overdue = filtered.filter(t =>
      t.progress !== 'Completed' && t.due_date && parseISO(t.due_date) < now
    ).length;
    return {
      name,
      tasks: filtered,
      stats: { total, completed, in_progress: inProgress, overdue, not_started: notStarted },
    };
  },
};

// ─── ANALYTICS ───────────────────────────────────────────────────────────────
export const analyticsApi = {
  project: async (projectId: number) => {
    const { data: project, error: projError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('is_active', true)
      .single();
    if (projError) throw new Error(projError.message);
    const { data: tasks, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', projectId);
    if (taskError) throw new Error(taskError.message);
    return buildProjectAnalytics(project, tasks ?? []);
  },

  portfolio: async () => {
    const { data: projects, error: projError } = await supabase
      .from('projects')
      .select('id, name, imported_at')
      .eq('is_active', true);
    if (projError) throw new Error(projError.message);
    if (!projects || projects.length === 0) return [];
    const projectIds = projects.map((p: any) => p.id);
    const { data: tasks, error: taskError } = await supabase
      .from('tasks')
      .select('project_id, progress, due_date')
      .in('project_id', projectIds);
    if (taskError) throw new Error(taskError.message);
    return buildPortfolioAnalytics(projects as any, tasks ?? []);
  },
};

// ─── ALERTS ──────────────────────────────────────────────────────────────────
export const alertsApi = {
  list: async (params: { dismissed?: boolean; projectId?: number } = {}) => {
    let query = supabase
      .from('alerts')
      .select('*, projects(name), tasks(task_name)')
      .order('detected_at', { ascending: false });
    if (!params.dismissed) query = query.eq('is_dismissed', false);
    if (params.projectId) query = query.eq('project_id', params.projectId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []).map((a: any) => ({
      ...a,
      project_name: (a.projects as { name: string } | null)?.name,
      task_name: (a.tasks as { task_name: string } | null)?.task_name,
      projects: undefined,
      tasks: undefined,
    })) as Alert[];
  },

  refresh: async (projectId?: number) => {
    const { data: configs, error: configError } = await supabase
      .from('alert_config')
      .select('*');
    if (configError) throw new Error(configError.message);

    let projectIds: number[];
    if (projectId) {
      projectIds = [projectId];
    } else {
      const { data: projs, error: projError } = await supabase
        .from('projects')
        .select('id')
        .eq('is_active', true);
      if (projError) throw new Error(projError.message);
      projectIds = (projs ?? []).map((p: any) => p.id);
    }

    for (const pid of projectIds) {
      const { data: project } = await supabase
        .from('projects')
        .select('id, imported_at')
        .eq('id', pid)
        .single();
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, project_id, task_name, bucket_name, progress, progress_percent, assigned_to, due_date')
        .eq('project_id', pid);

      if (!project) continue;

      const newAlerts = runAlertEngine(pid, project, tasks ?? [], configs ?? []);

      await supabase
        .from('alerts')
        .delete()
        .eq('project_id', pid)
        .eq('is_dismissed', false);

      if (newAlerts.length > 0) {
        await supabase.from('alerts').insert(newAlerts);
      }
    }
  },

  dismiss: async (id: number) => {
    const { error } = await supabase
      .from('alerts')
      .update({ is_dismissed: true, dismissed_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  clearDismissed: async () => {
    const { error } = await supabase
      .from('alerts')
      .delete()
      .eq('is_dismissed', true);
    if (error) throw new Error(error.message);
  },

  getConfig: async () => {
    const { data, error } = await supabase
      .from('alert_config')
      .select('*')
      .order('id');
    if (error) throw new Error(error.message);
    return (data ?? []) as AlertConfig[];
  },

  updateConfig: async (configs: { id: number; threshold: number; enabled: boolean }[]) => {
    for (const c of configs) {
      const { error } = await supabase
        .from('alert_config')
        .update({ threshold: c.threshold, enabled: c.enabled })
        .eq('id', c.id);
      if (error) throw new Error(error.message);
    }
  },
};

// ─── IMPORT ───────────────────────────────────────────────────────────────────
export const importApi = {
  preview: async (file: File) => {
    const result = await parseExcelBrowser(file);
    return {
      projectName: result.projectName,
      taskCount: result.tasks.length,
      assignees: result.assignees,
      tasks: result.tasks.slice(0, 50),
      originalName: file.name,
      _parsedResult: result,
    };
  },

  confirm: async (data: {
    _parsedResult: ParseResult;
    originalName: string;
    projectName?: string;
    replaceProjectId?: number;
  }) => {
    const { _parsedResult: result, originalName, projectName, replaceProjectId } = data;
    const name = projectName || result.projectName;
    let projectId: number;

    if (replaceProjectId) {
      await supabase.from('tasks').delete().eq('project_id', replaceProjectId);
      const { error } = await supabase
        .from('projects')
        .update({ name, import_file_name: originalName, updated_at: new Date().toISOString() })
        .eq('id', replaceProjectId);
      if (error) throw new Error(error.message);
      projectId = replaceProjectId;
    } else {
      const { data: proj, error } = await supabase
        .from('projects')
        .insert({ name, import_file_name: originalName })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      projectId = proj.id;
    }

    // Insert tasks in batches of 200 to stay within request limits
    const taskRows = result.tasks.map(t => ({ ...t, project_id: projectId }));
    const BATCH = 200;
    for (let i = 0; i < taskRows.length; i += BATCH) {
      const { error } = await supabase.from('tasks').insert(taskRows.slice(i, i + BATCH));
      if (error) throw new Error(error.message);
    }

    if (result.assignees.length > 0) {
      const memberRows = result.assignees.map(n => ({ name: n }));
      await supabase
        .from('team_members')
        .upsert(memberRows, { onConflict: 'name', ignoreDuplicates: true });
    }

    await supabase.from('import_history').insert({
      project_id: projectId,
      file_name: originalName,
      task_count: result.tasks.length,
      status: 'success',
    });

    await alertsApi.refresh(projectId);

    return { taskCount: result.tasks.length, projectId };
  },

  history: async () => {
    const { data, error } = await supabase
      .from('import_history')
      .select('*, projects(name)')
      .order('imported_at', { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []).map((h: any) => ({
      ...h,
      project_name: (h.projects as { name: string } | null)?.name,
      projects: undefined,
    }));
  },
};
