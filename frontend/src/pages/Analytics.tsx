import { useQuery } from '@tanstack/react-query';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  LineChart, Line, CartesianGrid, Legend, ResponsiveContainer, RadialBarChart, RadialBar,
} from 'recharts';
import { analyticsApi, projectsApi } from '../api/client';
import { useStore } from '../store/useStore';
import { AnalyticsData, Project } from '../types';

const PRIORITY_COLORS: Record<string, string> = {
  Low: '#94a3b8',
  Medium: '#3b82f6',
  Important: '#f59e0b',
  Urgent: '#ef4444',
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">{title}</h3>
      {children}
    </div>
  );
}

function CompletionRing({ percent }: { percent: number }) {
  const data = [{ name: 'complete', value: percent, fill: '#22c55e' }];
  return (
    <div className="relative flex items-center justify-center" style={{ height: 180 }}>
      <RadialBarChart
        width={180} height={180}
        cx={90} cy={90}
        innerRadius={55} outerRadius={80}
        barSize={14}
        data={data}
        startAngle={90} endAngle={-270}
      >
        <RadialBar dataKey="value" cornerRadius={7} background={{ fill: '#1e293b' }} />
      </RadialBarChart>
      <div className="absolute text-center">
        <div className="text-3xl font-bold text-slate-100">{percent}%</div>
        <div className="text-xs text-slate-400">complete</div>
      </div>
    </div>
  );
}

export default function Analytics() {
  const { activeProjectId } = useStore();

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  });

  const projectId = activeProjectId ?? projects[0]?.id;

  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['analytics', projectId],
    queryFn: () => analyticsApi.project(projectId!),
    enabled: !!projectId,
  });

  const { data: portfolio = [] } = useQuery({
    queryKey: ['analytics-portfolio'],
    queryFn: analyticsApi.portfolio,
  });

  if (!projectId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <div className="text-4xl">▤</div>
        <p className="text-slate-400">No project selected. Import a plan first.</p>
      </div>
    );
  }

  if (isLoading || !data) {
    return <div className="flex items-center justify-center h-64 text-slate-500">Loading analytics...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Top row: ring + status breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Card title="Overall Completion">
          <CompletionRing percent={data.completion_percent} />
          <div className="grid grid-cols-2 gap-2 mt-2 text-center text-xs">
            <div className="bg-green-900/30 rounded-lg py-2">
              <div className="font-bold text-green-400 text-lg">{data.completed}</div>
              <div className="text-slate-400">Completed</div>
            </div>
            <div className="bg-red-900/30 rounded-lg py-2">
              <div className="font-bold text-red-400 text-lg">{data.overdue}</div>
              <div className="text-slate-400">Overdue</div>
            </div>
          </div>
        </Card>

        <Card title="Status Breakdown">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={data.status_breakdown.filter(s => s.value > 0)}
                dataKey="value"
                nameKey="name"
                cx="50%" cy="50%"
                outerRadius={70}
                label={({ name, value }) => `${name} (${value})`}
                labelLine={false}
              >
                {data.status_breakdown.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0' }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Priority Distribution">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.priority_breakdown} layout="vertical" margin={{ left: 10 }}>
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} width={65} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0' }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {data.priority_breakdown.map((entry, i) => (
                  <Cell key={i} fill={PRIORITY_COLORS[entry.name] ?? '#94a3b8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Burndown */}
      {data.burndown.length > 1 && (
        <Card title="Burndown — Remaining Tasks Over Time">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.burndown}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0' }} />
              <Line type="monotone" dataKey="remaining" stroke="#3b82f6" strokeWidth={2} dot={false} name="Remaining Tasks" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Bucket breakdown */}
      {data.bucket_breakdown.length > 0 && (
        <Card title="Tasks by Phase / Bucket">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.bucket_breakdown} margin={{ bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-25} textAnchor="end" />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0' }} />
              <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
              <Bar dataKey="completed" name="Completed" fill="#22c55e" radius={[4, 4, 0, 0]} stackId="a" />
              <Bar dataKey="incomplete" name="Incomplete" fill="#334155" radius={[4, 4, 0, 0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Portfolio comparison */}
      {(portfolio as { id: number; name: string; completion_percent: number; overdue: number }[]).length > 1 && (
        <Card title="Portfolio Overview — All Projects">
          <div className="space-y-3">
            {(portfolio as { id: number; name: string; completion_percent: number; overdue: number }[]).map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <span className="w-36 text-sm text-slate-300 truncate shrink-0">{p.name}</span>
                <div className="flex-1 bg-slate-700 rounded-full h-3">
                  <div
                    className="h-3 rounded-full bg-brand-500"
                    style={{ width: `${p.completion_percent}%` }}
                  />
                </div>
                <span className="w-10 text-xs text-slate-400 text-right">{p.completion_percent}%</span>
                {p.overdue > 0 && (
                  <span className="text-xs text-red-400 w-16 text-right">{p.overdue} late</span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
