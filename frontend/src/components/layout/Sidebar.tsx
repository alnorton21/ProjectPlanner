import { NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { alertsApi } from '../../api/client';
import { Alert } from '../../types';
import clsx from 'clsx';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '⊞' },
  { to: '/gantt', label: 'Gantt Chart', icon: '▬' },
  { to: '/team', label: 'Team Workload', icon: '◉' },
  { to: '/analytics', label: 'Analytics', icon: '▤' },
  { to: '/alerts', label: 'Alerts', icon: '⚠', badge: true },
  { to: '/import', label: 'Import Data', icon: '↑' },
];

export default function Sidebar() {
  const location = useLocation();

  const { data: alerts = [] } = useQuery<Alert[]>({
    queryKey: ['alerts', 'active'],
    queryFn: () => alertsApi.list({ dismissed: false }),
    refetchInterval: 60000,
  });

  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const totalCount = alerts.length;

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 bg-slate-900 border-r border-slate-800 shrink-0">
        <div className="flex items-center gap-2 px-4 py-5 border-b border-slate-800">
          <div className="w-7 h-7 rounded bg-brand-600 flex items-center justify-center text-sm font-bold">P</div>
          <span className="font-semibold text-slate-100 text-sm">Project Planner</span>
        </div>
        <nav className="flex-1 py-3 space-y-0.5">
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-4 py-2.5 text-sm rounded-none transition-colors relative',
                isActive
                  ? 'bg-brand-600/20 text-brand-400 border-r-2 border-brand-500'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
              )}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
              {item.badge && totalCount > 0 && (
                <span className={clsx(
                  'ml-auto text-xs font-bold px-1.5 py-0.5 rounded-full',
                  criticalCount > 0 ? 'bg-red-600 text-white' : 'bg-yellow-500 text-slate-900'
                )}>
                  {totalCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-slate-800 text-xs text-slate-600">
          Teams Planner Sync
        </div>
      </aside>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-800 flex">
        {NAV.slice(0, 5).map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => clsx(
              'flex-1 flex flex-col items-center py-2 text-xs relative',
              isActive ? 'text-brand-400' : 'text-slate-500'
            )}
          >
            <span className="text-lg leading-none">{item.icon}</span>
            <span className="mt-0.5 truncate">{item.label.split(' ')[0]}</span>
            {item.badge && criticalCount > 0 && (
              <span className="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
