import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Gantt, ViewMode } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';
import { ganttApi, projectsApi } from '../api/client';
import { useStore } from '../store/useStore';
import { Project } from '../types';

type GroupBy = 'bucket' | 'assignee' | 'flat';

const VIEW_MODES: { label: string; value: ViewMode }[] = [
  { label: 'Day', value: ViewMode.Day },
  { label: 'Week', value: ViewMode.Week },
  { label: 'Month', value: ViewMode.Month },
  { label: 'Quarter', value: ViewMode.QuarterDay },
  { label: 'Year', value: ViewMode.Year },
];

export default function GanttView() {
  const { activeProjectId } = useStore();
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Month);
  const [groupBy, setGroupBy] = useState<GroupBy>('bucket');

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  });

  const projectId = activeProjectId ?? projects[0]?.id;

  const { data: ganttTasks = [], isLoading } = useQuery({
    queryKey: ['gantt', projectId, groupBy],
    queryFn: () => ganttApi.get(projectId!, { groupBy }),
    enabled: !!projectId,
  });

  const tasks = (ganttTasks as { start: string | Date; end: string | Date; [key: string]: unknown }[]).map(t => ({
    ...t,
    start: t.start instanceof Date ? t.start : new Date(t.start as string),
    end: t.end instanceof Date ? t.end : new Date(t.end as string),
  }));

  if (!projectId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <div className="text-4xl">▬</div>
        <p className="text-slate-400">No project selected. Import a plan first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-800 rounded-xl border border-slate-700 p-3">
        <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-0.5">
          {VIEW_MODES.map(m => (
            <button
              key={m.value}
              onClick={() => setViewMode(m.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === m.value
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-0.5">
          {(['bucket', 'assignee', 'flat'] as GroupBy[]).map(g => (
            <button
              key={g}
              onClick={() => setGroupBy(g)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                groupBy === g
                  ? 'bg-slate-700 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {g === 'flat' ? 'No Group' : `By ${g === 'bucket' ? 'Phase' : 'Person'}`}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" />Completed</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />In Progress</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />Overdue</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-500 inline-block" />Not Started</span>
        </div>
      </div>

      {/* Gantt */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ minHeight: 400 }}>
        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-slate-400 bg-slate-800">
            Loading Gantt chart...
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-slate-400 bg-slate-800">
            No tasks with valid dates to display
          </div>
        ) : (
          <Gantt
            tasks={tasks as Parameters<typeof Gantt>[0]['tasks']}
            viewMode={viewMode}
            listCellWidth="200px"
            columnWidth={viewMode === ViewMode.Month ? 80 : viewMode === ViewMode.Week ? 50 : 40}
            ganttHeight={600}
            todayColor="rgba(59, 130, 246, 0.1)"
            TooltipContent={({ task }) => (
              <div className="bg-slate-800 text-slate-100 p-3 rounded-lg shadow-xl border border-slate-700 max-w-xs text-sm">
                <p className="font-semibold mb-2">{task.name}</p>
                <div className="space-y-1 text-xs text-slate-300">
                  <p>Progress: {task.progress}%</p>
                  {(task as unknown as { assignedTo?: string }).assignedTo && (
                    <p>Assigned: {(task as unknown as { assignedTo: string }).assignedTo}</p>
                  )}
                  {(task as unknown as { priority?: string }).priority && (
                    <p>Priority: {(task as unknown as { priority: string }).priority}</p>
                  )}
                  <p>Start: {task.start.toLocaleDateString()}</p>
                  <p>End: {task.end.toLocaleDateString()}</p>
                  {(task as unknown as { notes?: string }).notes && (
                    <p className="mt-2 text-slate-400 italic truncate">{(task as unknown as { notes: string }).notes}</p>
                  )}
                </div>
              </div>
            )}
          />
        )}
      </div>
    </div>
  );
}
