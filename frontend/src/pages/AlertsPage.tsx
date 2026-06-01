import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { alertsApi } from '../api/client';
import { Alert, AlertConfig } from '../types';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const SEVERITY_STYLES = {
  critical: 'border-red-700/60 bg-red-950/30',
  warning: 'border-yellow-700/60 bg-yellow-950/30',
  info: 'border-blue-700/60 bg-blue-950/30',
};

const SEVERITY_ICONS = { critical: '🔴', warning: '🟡', info: '🔵' };

const TYPE_LABELS: Record<string, string> = {
  overdue_task: 'Overdue Task',
  at_risk: 'At Risk',
  project_behind: 'Behind Schedule',
  member_overloaded: 'Member Overloaded',
  stalled_bucket: 'Stalled Bucket',
};

export default function AlertsPage() {
  const queryClient = useQueryClient();
  const [showDismissed, setShowDismissed] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  const { data: alerts = [], isLoading } = useQuery<Alert[]>({
    queryKey: ['alerts', showDismissed],
    queryFn: () => alertsApi.list({ dismissed: showDismissed }),
    refetchInterval: 60000,
  });

  const { data: configs = [] } = useQuery<AlertConfig[]>({
    queryKey: ['alert-config'],
    queryFn: alertsApi.getConfig,
  });

  const [localConfigs, setLocalConfigs] = useState<AlertConfig[]>([]);

  const dismissMutation = useMutation({
    mutationFn: alertsApi.dismiss,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      toast.success('Alert dismissed');
    },
  });

  const refreshMutation = useMutation({
    mutationFn: () => alertsApi.refresh(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      toast.success('Alerts refreshed');
    },
  });

  const clearDismissedMutation = useMutation({
    mutationFn: alertsApi.clearDismissed,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      toast.success('Cleared dismissed alerts');
    },
  });

  const saveConfigMutation = useMutation({
    mutationFn: alertsApi.updateConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-config'] });
      toast.success('Alert settings saved');
      setConfigOpen(false);
    },
  });

  const openConfig = () => {
    setLocalConfigs(configs.map(c => ({ ...c })));
    setConfigOpen(true);
  };

  const grouped = alerts.reduce<Record<string, Alert[]>>((acc, a) => {
    const key = a.severity;
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-800 rounded-xl border border-slate-700 p-3">
        <div className="flex gap-2">
          <button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium rounded-lg transition-colors"
          >
            {refreshMutation.isPending ? 'Refreshing...' : '↻ Refresh Alerts'}
          </button>
          <button
            onClick={openConfig}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium rounded-lg transition-colors"
          >
            ⚙ Configure
          </button>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showDismissed}
              onChange={e => setShowDismissed(e.target.checked)}
              className="rounded"
            />
            Show dismissed
          </label>
          {showDismissed && (
            <button
              onClick={() => clearDismissedMutation.mutate()}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Clear all dismissed
            </button>
          )}
        </div>
      </div>

      {/* Alerts list */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32 text-slate-500">Loading alerts...</div>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <div className="text-4xl">✅</div>
          <p className="text-slate-400">No active alerts — all projects are on track!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {(['critical', 'warning', 'info'] as const).map(severity => {
            const items = grouped[severity] ?? [];
            if (items.length === 0) return null;
            return (
              <div key={severity}>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-2">
                  <span>{SEVERITY_ICONS[severity]}</span>
                  <span>{severity} ({items.length})</span>
                </h2>
                <div className="space-y-2">
                  {items.map(alert => (
                    <div
                      key={alert.id}
                      className={clsx('flex items-start gap-3 p-4 rounded-xl border', SEVERITY_STYLES[alert.severity])}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                            {TYPE_LABELS[alert.alert_type] ?? alert.alert_type}
                          </span>
                          {alert.project_name && (
                            <span className="text-xs text-slate-500">{alert.project_name}</span>
                          )}
                        </div>
                        <p className="text-sm text-slate-200">{alert.message}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          Detected {formatDistanceToNow(new Date(alert.detected_at), { addSuffix: true })}
                        </p>
                      </div>
                      {!alert.is_dismissed && (
                        <button
                          onClick={() => dismissMutation.mutate(alert.id)}
                          className="shrink-0 text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-700 transition-colors"
                        >
                          Dismiss
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Config Modal */}
      {configOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-lg">
            <h2 className="font-semibold text-slate-100 mb-4">Alert Configuration</h2>
            <div className="space-y-4">
              {localConfigs.map((c, i) => (
                <div key={c.id} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={c.enabled}
                    onChange={e => {
                      const next = [...localConfigs];
                      next[i] = { ...c, enabled: e.target.checked };
                      setLocalConfigs(next);
                    }}
                    className="rounded accent-brand-500"
                  />
                  <label className="flex-1 text-sm text-slate-300">{c.label}</label>
                  <input
                    type="number"
                    value={c.threshold}
                    min={1}
                    onChange={e => {
                      const next = [...localConfigs];
                      next[i] = { ...c, threshold: Number(e.target.value) };
                      setLocalConfigs(next);
                    }}
                    className="w-16 bg-slate-700 border border-slate-600 text-slate-200 text-sm rounded px-2 py-1 text-center"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button
                onClick={() => setConfigOpen(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={() => saveConfigMutation.mutate(localConfigs.map(c => ({ id: c.id, threshold: c.threshold, enabled: c.enabled })))}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm rounded-lg"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
