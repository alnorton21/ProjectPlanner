import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { importApi, projectsApi } from '../api/client';
import { ImportHistory, Project } from '../types';
import { type ParsedTask, type ParseResult } from '../services/excelParser';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface PreviewData {
  projectName: string;
  taskCount: number;
  assignees: string[];
  tasks: ParsedTask[];
  originalName: string;
  _parsedResult: ParseResult;
}

export default function ImportPage() {
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [projectName, setProjectName] = useState('');
  const [replaceId, setReplaceId] = useState<number | ''>('');

  const { data: history = [] } = useQuery<ImportHistory[]>({
    queryKey: ['import-history'],
    queryFn: importApi.history,
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  });

  const previewMutation = useMutation({
    mutationFn: importApi.preview,
    onSuccess: (data: PreviewData) => {
      setPreview(data);
      setProjectName(data.projectName);
      setReplaceId('');
      toast.success(`Parsed ${data.taskCount} tasks — review and confirm`);
    },
    onError: (err: Error) => {
      toast.error(err?.message ?? 'Failed to parse file');
    },
  });

  const confirmMutation = useMutation({
    mutationFn: importApi.confirm,
    onSuccess: (data: { taskCount: number }) => {
      toast.success(`Imported ${data.taskCount} tasks successfully`);
      setPreview(null);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['import-history'] });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
    onError: (err: Error) => {
      toast.error(err?.message ?? 'Import failed');
    },
  });

  const onDrop = useCallback((files: File[]) => {
    if (files[0]) previewMutation.mutate(files[0]);
  }, [previewMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    multiple: false,
  });

  const handleConfirm = () => {
    if (!preview) return;
    confirmMutation.mutate({
      _parsedResult: preview._parsedResult,
      originalName: preview.originalName,
      projectName: projectName || preview.projectName,
      replaceProjectId: replaceId ? Number(replaceId) : undefined,
    });
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Instructions */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <h2 className="font-semibold text-slate-100 mb-3">How to Import from Microsoft Teams Planner</h2>
        <ol className="space-y-2 text-sm text-slate-300">
          <li className="flex gap-3"><span className="bg-brand-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">1</span>Open Microsoft Teams → Planner → select your plan</li>
          <li className="flex gap-3"><span className="bg-brand-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">2</span>Click the <strong className="text-slate-100">...</strong> menu → <strong className="text-slate-100">Export plan to Excel</strong></li>
          <li className="flex gap-3"><span className="bg-brand-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">3</span>Save the <strong className="text-slate-100">.xlsx</strong> file to your Downloads folder</li>
          <li className="flex gap-3"><span className="bg-brand-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">4</span>Drag and drop it below (or click to browse)</li>
        </ol>
      </div>

      {/* Drop Zone */}
      {!preview && (
        <div
          {...getRootProps()}
          className={clsx(
            'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors',
            isDragActive
              ? 'border-brand-500 bg-brand-950/30'
              : 'border-slate-600 hover:border-slate-500 hover:bg-slate-800/50'
          )}
        >
          <input {...getInputProps()} />
          {previewMutation.isPending ? (
            <div className="text-slate-400">
              <div className="text-4xl mb-3 animate-pulse">⏳</div>
              <p className="font-medium">Parsing file...</p>
            </div>
          ) : (
            <div className="text-slate-400">
              <div className="text-5xl mb-3">{isDragActive ? '📂' : '📄'}</div>
              <p className="font-medium text-slate-200 mb-1">
                {isDragActive ? 'Drop it here!' : 'Drag & drop your .xlsx file here'}
              </p>
              <p className="text-sm">or click to browse</p>
              <p className="text-xs mt-3 text-slate-600">Microsoft Teams Planner Excel export only</p>
            </div>
          )}
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="space-y-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
            <h2 className="font-semibold text-slate-100 mb-4">Preview — {preview.taskCount} Tasks Detected</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1.5">Project Name</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
              {projects.length > 0 && (
                <div>
                  <label className="text-xs text-slate-400 block mb-1.5">
                    Replace Existing Project (optional)
                  </label>
                  <select
                    value={replaceId}
                    onChange={e => setReplaceId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full bg-slate-700 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                  >
                    <option value="">Create as new project</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>Update: {p.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {preview.assignees.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-slate-400 mb-2">Team members detected:</p>
                <div className="flex flex-wrap gap-2">
                  {preview.assignees.map(a => (
                    <span key={a} className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded-full">{a}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Task preview table */}
            <div className="overflow-x-auto rounded-lg border border-slate-700 max-h-64">
              <table className="w-full text-xs text-slate-300">
                <thead className="bg-slate-900 sticky top-0">
                  <tr>
                    <th className="text-left p-2 text-slate-400">Task</th>
                    <th className="text-left p-2 text-slate-400">Bucket</th>
                    <th className="text-left p-2 text-slate-400">Progress</th>
                    <th className="text-left p-2 text-slate-400">Assigned To</th>
                    <th className="text-left p-2 text-slate-400">Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.tasks.map((task, i) => (
                    <tr key={i} className="border-t border-slate-700/50 hover:bg-slate-700/20">
                      <td className="p-2 max-w-xs truncate">{task.task_name}</td>
                      <td className="p-2 whitespace-nowrap">{task.bucket_name ?? '—'}</td>
                      <td className="p-2 whitespace-nowrap">
                        <span className={clsx('px-1.5 py-0.5 rounded text-xs', {
                          'bg-green-900/60 text-green-300': task.progress === 'Completed',
                          'bg-blue-900/60 text-blue-300': task.progress === 'In progress',
                          'bg-red-900/60 text-red-300': task.progress === 'Late',
                          'bg-slate-700 text-slate-400': task.progress === 'Not started',
                        })}>
                          {task.progress}
                        </span>
                      </td>
                      <td className="p-2 max-w-32 truncate">{task.assigned_to ?? '—'}</td>
                      <td className="p-2 whitespace-nowrap">
                        {task.due_date ? new Date(task.due_date).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.taskCount > 50 && (
              <p className="text-xs text-slate-500 mt-2">Showing first 50 of {preview.taskCount} tasks</p>
            )}

            <div className="flex gap-3 mt-4">
              <button
                onClick={handleConfirm}
                disabled={confirmMutation.isPending}
                className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {confirmMutation.isPending ? 'Importing...' : `Confirm Import (${preview.taskCount} tasks)`}
              </button>
              <button
                onClick={() => setPreview(null)}
                className="px-4 py-2.5 text-sm text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import History */}
      {history.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <h2 className="font-semibold text-slate-100 mb-3 text-sm">Import History</h2>
          <div className="space-y-2">
            {history.map(h => (
              <div key={h.id} className="flex items-center justify-between py-2 border-b border-slate-700/40 last:border-0">
                <div className="flex items-center gap-3">
                  <span className={h.status === 'success' ? 'text-green-400 text-base' : 'text-red-400 text-base'}>
                    {h.status === 'success' ? '✓' : '✗'}
                  </span>
                  <div>
                    <p className="text-sm text-slate-200 truncate max-w-64">{h.file_name}</p>
                    {h.project_name && <p className="text-xs text-slate-500">{h.project_name}</p>}
                  </div>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p>{h.task_count} tasks</p>
                  <p>{formatDistanceToNow(new Date(h.imported_at), { addSuffix: true })}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
