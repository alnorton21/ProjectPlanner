import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { projectsApi } from '../../api/client';
import { useStore } from '../../store/useStore';
import { Project } from '../../types';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/gantt': 'Gantt Chart',
  '/team': 'Team Workload',
  '/analytics': 'Analytics',
  '/alerts': 'Alerts',
  '/import': 'Import Data',
};

export default function Header() {
  const location = useLocation();
  const { activeProjectId, setActiveProjectId } = useStore();

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
    refetchInterval: 30000,
  });

  const title = PAGE_TITLES[location.pathname] ?? 'Project Planner';
  const activeProject = projects.find(p => p.id === activeProjectId);

  return (
    <header className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-slate-800 bg-slate-900 shrink-0">
      <h1 className="text-base font-semibold text-slate-100">{title}</h1>
      <div className="flex items-center gap-3">
        {projects.length > 0 && (
          <select
            value={activeProjectId ?? ''}
            onChange={e => setActiveProjectId(e.target.value ? Number(e.target.value) : null)}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-brand-500 outline-none"
          >
            <option value="">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
        {activeProject && (
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
            activeProject.health === 'green' ? 'bg-green-900/50 text-green-400' :
            activeProject.health === 'yellow' ? 'bg-yellow-900/50 text-yellow-400' :
            'bg-red-900/50 text-red-400'
          }`}>
            {activeProject.health === 'green' ? 'On Track' :
             activeProject.health === 'yellow' ? 'At Risk' : 'Behind'}
          </span>
        )}
      </div>
    </header>
  );
}
