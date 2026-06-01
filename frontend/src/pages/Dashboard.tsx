import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { projectsApi, alertsApi, importApi } from '../api/client';
import { Project, Alert, ImportHistory } from '../types';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';

function HealthBadge({ health }: { health: Project['health'] }) {
  return (
    <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', {
      'bg-green-900/60 text-green-300': health === 'green',
      'bg-yellow-900/60 text-yellow-300': health === 'yellow',
      'bg-red-900/60 text-red-300': health === 'red',
    })}>
      {health === 'green' ? 'On Track' : health === 'yellow' ? 'At Risk' : 'Behind'}
    </span>
  );
}

function ProgressBar({ percent, health }: { percent: number; health: Project['health'] }) {
  return (
    <div className="w-full bg-slate-700 rounded-full h-2">
      <div
        className={clsx('h-2 rounded-full transition-all', {
          'bg-green-500': health === 'green',
          'bg-yellow-500': health === 'yellow',
          'bg-red-500': health === 'red',
        })}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-slate-400 mt-1">{label}</div>
    </div>
  );
}

export default function Dashboard() {
  const { data: projects = [], isLoading: projLoading } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
    refetchInterval: 30000,
  });

  const { data: alerts = [] } = useQuery<Alert[]>({
    queryKey: ['alerts', 'active'],
    queryFn: () => alertsApi.list({ dismissed: false }),
    refetchInterval: 60000,
  });

  const { data: history = [] } = useQuery<ImportHistory[]>({
    queryKey: ['import-history'],
    queryFn: importApi.history,
  });

  const totals = projects.reduce(
    (acc, p) => ({
      total: acc.total + p.total_tasks,
      completed: acc.completed + p.completed_tasks,
      inProgress: acc.inProgress + p.in_progress_tasks,
      overdue: acc.overdue + p.overdue_tasks,
    }),
    { total: 0, completed: 0, inProgress: 0, overdue: 0 }
  );

  const criticalAlerts = alerts.filter(a => a.severity === 'critical').slice(0, 3);
  const warningAlerts = alerts.filter(a => a.severity === 'warning').slice(0, 2);
  const topAlerts = [...criticalAlerts, ...warningAlerts].slice(0, 4);

  if (projLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        Loading projects...
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <div className="text-5xl">📋</div>
        <h2 className="text-xl font-semibold text-slate-200">No Projects Yet</h2>
        <p className="text-slate-400 max-w-md">
          Export your plan from Microsoft Teams Planner and import it to get started.
        </p>
        <Link
          to="/import"
          className="mt-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Import Your First Plan
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Tasks" value={totals.total} color="text-slate-200" />
        <StatCard label="Completed" value={totals.completed} color="text-green-400" />
        <StatCard label="In Progress" value={totals.inProgress} color="text-blue-400" />
        <StatCard label="Overdue" value={totals.overdue} color="text-red-400" />
      </div>

      {/* Active Alerts Banner */}
      {topAlerts.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <span>⚠</span> Active Alerts
            </h2>
            <Link to="/alerts" className="text-xs text-brand-400 hover:text-brand-300">
              View all ({alerts.length}) →
            </Link>
          </div>
          <div className="space-y-2">
            {topAlerts.map(alert => (
              <div
                key={alert.id}
                className={clsx('flex items-start gap-3 p-3 rounded-lg text-sm', {
                  'bg-red-950/40 border border-red-800/40': alert.severity === 'critical',
                  'bg-yellow-950/40 border border-yellow-800/40': alert.severity === 'warning',
                  'bg-blue-950/40 border border-blue-800/40': alert.severity === 'info',
                })}
              >
                <span>{alert.severity === 'critical' ? '🔴' : alert.severity === 'warning' ? '🟡' : '🔵'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-200 truncate">{alert.message}</p>
                  {alert.project_name && (
                    <p className="text-xs text-slate-500 mt-0.5">{alert.project_name}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Project Health Cards */}
      <div>
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Projects Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map(project => (
            <div
              key={project.id}
              className="bg-slate-800 rounded-xl border border-slate-700 p-5 hover:border-slate-600 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-slate-100 truncate">{project.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Updated {formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}
                  </p>
                </div>
                <HealthBadge health={project.health} />
              </div>

              <div className="mb-3">
                <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                  <span>Progress</span>
                  <span className="font-medium text-slate-200">{project.completion_percent}%</span>
                </div>
                <ProgressBar percent={project.completion_percent} health={project.health} />
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-lg font-bold text-green-400">{project.completed_tasks}</div>
                  <div className="text-xs text-slate-500">Done</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-blue-400">{project.in_progress_tasks}</div>
                  <div className="text-xs text-slate-500">Active</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-red-400">{project.overdue_tasks}</div>
                  <div className="text-xs text-slate-500">Overdue</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Imports */}
      {history.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <h2 className="text-sm font-semibold text-slate-200 mb-3">Recent Imports</h2>
          <div className="space-y-2">
            {history.slice(0, 5).map(h => (
              <div key={h.id} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-700/50 last:border-0">
                <div className="flex items-center gap-3">
                  <span className={h.status === 'success' ? 'text-green-400' : 'text-red-400'}>
                    {h.status === 'success' ? '✓' : '✗'}
                  </span>
                  <div>
                    <p className="text-slate-200 truncate max-w-xs">{h.file_name}</p>
                    {h.project_name && <p className="text-xs text-slate-500">{h.project_name}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-slate-400 text-xs">{h.task_count} tasks</p>
                  <p className="text-slate-600 text-xs">
                    {formatDistanceToNow(new Date(h.imported_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
