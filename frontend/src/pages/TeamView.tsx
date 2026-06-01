import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { teamApi } from '../api/client';
import { useStore } from '../store/useStore';
import { TeamMember, Task } from '../types';
import { format, parseISO } from 'date-fns';
import clsx from 'clsx';

function WorkloadBar({ member }: { member: TeamMember }) {
  const total = member.total || 1;
  const completedPct = (member.completed / total) * 100;
  const inProgressPct = (member.in_progress / total) * 100;
  const overduePct = (member.overdue / total) * 100;
  const notStartedPct = (member.not_started / total) * 100;

  return (
    <div className="w-full h-3 rounded-full overflow-hidden flex bg-slate-700">
      <div className="bg-green-500 h-full" style={{ width: `${completedPct}%` }} title={`${member.completed} completed`} />
      <div className="bg-blue-500 h-full" style={{ width: `${inProgressPct}%` }} title={`${member.in_progress} in progress`} />
      <div className="bg-red-500 h-full" style={{ width: `${overduePct}%` }} title={`${member.overdue} overdue`} />
      <div className="bg-slate-600 h-full" style={{ width: `${notStartedPct}%` }} title={`${member.not_started} not started`} />
    </div>
  );
}

function MemberCard({ member, projectId }: { member: TeamMember; projectId?: number }) {
  const [expanded, setExpanded] = useState(false);

  const { data: memberDetail } = useQuery({
    queryKey: ['team-member', member.name, projectId],
    queryFn: () => teamApi.getMember(member.name, projectId),
    enabled: expanded,
  });

  const tasks: Task[] = memberDetail?.tasks ?? [];

  const statusColor = (progress: string, dueDate: string | null) => {
    if (progress === 'Completed') return 'text-green-400';
    if (dueDate && parseISO(dueDate) < new Date() && progress !== 'Completed') return 'text-red-400';
    if (progress === 'In progress') return 'text-blue-400';
    return 'text-slate-400';
  };

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-lg font-bold text-slate-300 shrink-0">
          {member.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-slate-100 truncate">{member.name}</span>
            {member.is_overloaded && (
              <span className="text-xs bg-red-900/60 text-red-300 px-2 py-0.5 rounded-full">Overloaded</span>
            )}
          </div>
          <WorkloadBar member={member} />
          <div className="grid grid-cols-4 gap-1 mt-2 text-center">
            <div>
              <div className="text-sm font-bold text-green-400">{member.completed}</div>
              <div className="text-xs text-slate-500">Done</div>
            </div>
            <div>
              <div className="text-sm font-bold text-blue-400">{member.in_progress}</div>
              <div className="text-xs text-slate-500">Active</div>
            </div>
            <div>
              <div className="text-sm font-bold text-red-400">{member.overdue}</div>
              <div className="text-xs text-slate-500">Overdue</div>
            </div>
            <div>
              <div className="text-sm font-bold text-slate-400">{member.not_started}</div>
              <div className="text-xs text-slate-500">Pending</div>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full mt-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600 rounded-lg transition-colors"
      >
        {expanded ? '▲ Hide Tasks' : `▼ Show ${member.total} Tasks`}
      </button>

      {expanded && tasks.length > 0 && (
        <div className="mt-3 space-y-1 max-h-64 overflow-y-auto">
          {tasks.map(task => (
            <div key={task.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-700/40 text-sm">
              <span className={clsx('text-xs', statusColor(task.progress, task.due_date))}>●</span>
              <span className="flex-1 truncate text-slate-300">{task.task_name}</span>
              <div className="text-right shrink-0">
                {task.due_date && (
                  <span className={clsx('text-xs', {
                    'text-red-400': parseISO(task.due_date) < new Date() && task.progress !== 'Completed',
                    'text-slate-500': parseISO(task.due_date) >= new Date() || task.progress === 'Completed',
                  })}>
                    {format(parseISO(task.due_date), 'MMM d')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TeamView() {
  const { activeProjectId } = useStore();
  const [sortBy, setSortBy] = useState<'name' | 'overdue' | 'total'>('overdue');

  const { data: members = [], isLoading } = useQuery<TeamMember[]>({
    queryKey: ['team', activeProjectId],
    queryFn: () => teamApi.list(activeProjectId ?? undefined),
    refetchInterval: 30000,
  });

  const sorted = [...members].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'overdue') return b.overdue - a.overdue;
    return b.total - a.total;
  });

  const overloaded = members.filter(m => m.is_overloaded).length;

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-slate-500">Loading team...</div>;
  }

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <div className="text-4xl">◉</div>
        <p className="text-slate-400">No team members found. Import a plan with assigned tasks first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-slate-800 rounded-xl border border-slate-700 p-4">
        <div className="flex gap-6">
          <div><span className="text-2xl font-bold text-slate-100">{members.length}</span> <span className="text-slate-400 text-sm">members</span></div>
          {overloaded > 0 && (
            <div><span className="text-2xl font-bold text-red-400">{overloaded}</span> <span className="text-slate-400 text-sm">overloaded</span></div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Sort by:</span>
          {(['overdue', 'total', 'name'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={clsx('px-2.5 py-1 rounded text-xs font-medium transition-colors', {
                'bg-brand-600 text-white': sortBy === s,
                'bg-slate-700 text-slate-300 hover:bg-slate-600': sortBy !== s,
              })}
            >
              {s === 'overdue' ? 'Overdue' : s === 'total' ? 'Workload' : 'Name'}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-400 px-1">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" />Completed</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />In Progress</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />Overdue</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-600 inline-block" />Not Started</span>
      </div>

      {/* Member Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sorted.map(member => (
          <MemberCard key={member.name} member={member} projectId={activeProjectId ?? undefined} />
        ))}
      </div>
    </div>
  );
}
