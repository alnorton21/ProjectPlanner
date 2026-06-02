import React, { useState, useRef, useEffect, useCallback, createContext, useContext, useMemo } from 'react';
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

// gantt-task-react defaults
const HEADER_HEIGHT = 50;
const SCROLLBAR_HEIGHT = 22;

// ── Resizable column context & stable custom list components ──────────────────
// Defined outside GanttView so React sees them as stable component references
// and never unmounts/remounts the task list during resize drags.

type ColWidths = { name: number; from: number; to: number };

const ColCtx = createContext<{
  widths: ColWidths;
  onStartResize: (col: keyof ColWidths, e: React.MouseEvent) => void;
}>({ widths: { name: 200, from: 120, to: 120 }, onStartResize: () => {} });

function GanttColHandle({ col }: { col: keyof ColWidths }) {
  const { onStartResize } = useContext(ColCtx);
  return (
    <div
      onMouseDown={e => onStartResize(col, e)}
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 6,
        cursor: 'col-resize',
        zIndex: 2,
        borderRight: '2px solid transparent',
        transition: 'border-color 0.1s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderRightColor = '#94a3b8'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderRightColor = 'transparent'; }}
    />
  );
}

function GanttListHeader({ headerHeight, fontFamily, fontSize }: any) {
  const { widths } = useContext(ColCtx);
  const cell: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: '0 10px',
    fontWeight: 600,
    color: '#1e293b',
    background: '#f8fafc',
    borderRight: '1px solid #e2e8f0',
    position: 'relative',
    overflow: 'hidden',
    userSelect: 'none',
    flexShrink: 0,
  };
  return (
    <div style={{ display: 'flex', height: headerHeight, borderBottom: '2px solid #e2e8f0', fontFamily, fontSize, background: '#f8fafc' }}>
      <div style={{ ...cell, width: widths.name, minWidth: widths.name }}>
        Name
        <GanttColHandle col="name" />
      </div>
      <div style={{ ...cell, width: widths.from, minWidth: widths.from }}>
        From
        <GanttColHandle col="from" />
      </div>
      <div style={{ ...cell, width: widths.to, minWidth: widths.to, borderRight: 'none' }}>
        To
      </div>
    </div>
  );
}

function GanttListTable({ rowHeight, tasks, selectedTaskId, setSelectedTask, onExpanderClick, locale, fontSize, fontFamily }: any) {
  const { widths } = useContext(ColCtx);
  return (
    <div style={{ fontFamily }}>
      {(tasks as any[]).map((task, i) => {
        const isSelected = task.id === selectedTaskId;
        const expanderSymbol =
          task.hideChildren === false ? '▼' :
          task.hideChildren === true ? '▶' : '';
        const hasExpander = task.hideChildren !== undefined;
        return (
          <div
            key={task.id + 'row'}
            style={{
              display: 'flex',
              height: rowHeight,
              background: isSelected ? '#dbeafe' : i % 2 === 0 ? '#ffffff' : '#f8fafc',
              cursor: 'pointer',
              borderBottom: '1px solid #f1f5f9',
            }}
            onClick={() => setSelectedTask(task.id)}
          >
            <div style={{ width: widths.name, minWidth: widths.name, maxWidth: widths.name, display: 'flex', alignItems: 'center', padding: '0 6px 0 8px', color: '#1e293b', borderRight: '1px solid #e2e8f0', overflow: 'hidden', flexShrink: 0 }}>
              <span
                style={{ width: 18, flexShrink: 0, fontSize: 10, color: '#64748b', cursor: hasExpander ? 'pointer' : 'default', userSelect: 'none', textAlign: 'center' }}
                onClick={e => { if (hasExpander) { e.stopPropagation(); onExpanderClick(task); } }}
              >
                {expanderSymbol}
              </span>
              <span style={{ fontSize, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#1e293b' }}>
                {task.name}
              </span>
            </div>
            <div style={{ width: widths.from, minWidth: widths.from, maxWidth: widths.from, display: 'flex', alignItems: 'center', padding: '0 8px', fontSize, color: '#475569', borderRight: '1px solid #e2e8f0', overflow: 'hidden', flexShrink: 0 }}>
              {task.start.toLocaleDateString(locale ?? 'en-US')}
            </div>
            <div style={{ width: widths.to, minWidth: widths.to, maxWidth: widths.to, display: 'flex', alignItems: 'center', padding: '0 8px', fontSize, color: '#475569', overflow: 'hidden', flexShrink: 0 }}>
              {task.end.toLocaleDateString(locale ?? 'en-US')}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GanttView() {
  const { activeProjectId } = useStore();
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Month);
  const [groupBy, setGroupBy] = useState<GroupBy>('bucket');
  const ganttContainerRef = useRef<HTMLDivElement>(null);
  const [ganttHeight, setGanttHeight] = useState(500);
  const [containerWidth, setContainerWidth] = useState(1200);

  const [colWidths, setColWidths] = useState<ColWidths>({ name: 200, from: 120, to: 120 });
  const colWidthsRef = useRef(colWidths);
  useEffect(() => { colWidthsRef.current = colWidths; }, [colWidths]);

  // expand/collapse: maps task.id → hideChildren value
  const [expandState, setExpandState] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const el = ganttContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0]?.contentRect ?? {};
      // Subtract header and horizontal scrollbar so they fit inside the container
      if (height && height > 100) setGanttHeight(Math.max(100, Math.floor(height) - HEADER_HEIGHT - SCROLLBAR_HEIGHT));
      if (width && width > 100) setContainerWidth(Math.floor(width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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

  // Reset expand state when project or grouping changes
  useEffect(() => { setExpandState({}); }, [projectId, groupBy]);

  // Merge query data with local expand state
  const localTasks = useMemo(() => {
    return (ganttTasks as { start: string | Date; end: string | Date; id: unknown; hideChildren?: boolean; [key: string]: unknown }[]).map(t => {
      const base = {
        ...t,
        start: t.start instanceof Date ? t.start : new Date(t.start as string),
        end: t.end instanceof Date ? t.end : new Date(t.end as string),
      };
      const id = String(t.id);
      if (base.hideChildren !== undefined && id in expandState) {
        return { ...base, hideChildren: expandState[id] };
      }
      return base;
    });
  }, [ganttTasks, expandState]);

  // Called by the library with hideChildren already toggled
  const handleExpanderClick = useCallback((task: any) => {
    setExpandState(prev => ({ ...prev, [String(task.id)]: task.hideChildren as boolean }));
  }, []);

  const startResize = useCallback((col: keyof ColWidths, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = colWidthsRef.current[col];
    const onMove = (evt: MouseEvent) => {
      setColWidths(prev => ({ ...prev, [col]: Math.max(60, startW + evt.clientX - startX) }));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  // Memoize context value so it only changes when widths or resize handler changes
  const ctxValue = useMemo(() => ({ widths: colWidths, onStartResize: startResize }), [colWidths, startResize]);

  if (!projectId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <div className="text-4xl">▬</div>
        <p className="text-slate-400">No project selected. Import a plan first.</p>
      </div>
    );
  }

  const totalListWidth = colWidths.name + colWidths.from + colWidths.to;

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-800 rounded-xl border border-slate-700 p-3 shrink-0">
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

      {/* Gantt — ColCtx.Provider wraps the container so GanttListHeader/Table can read widths */}
      <ColCtx.Provider value={ctxValue}>
        <div ref={ganttContainerRef} className="bg-white rounded-xl flex-1 min-h-0 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-64 text-slate-400 bg-slate-800">
              Loading Gantt chart...
            </div>
          ) : localTasks.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-slate-400 bg-slate-800">
              No tasks with valid dates to display
            </div>
          ) : (
            <Gantt
              tasks={localTasks as Parameters<typeof Gantt>[0]['tasks']}
              viewMode={viewMode}
              // Pass total list width so the library re-runs its offsetWidth effect when columns resize
              listCellWidth={`${totalListWidth}px`}
              columnWidth={(() => {
                const chartWidth = Math.max(200, containerWidth - totalListWidth);
                const dates = localTasks.flatMap(t => [t.start.getTime(), t.end.getTime()]);
                if (!dates.length) return 60;
                const minT = Math.min(...dates);
                const maxT = Math.max(...dates);
                const diffDays = Math.max(1, (maxT - minT) / 86400000);
                const unitsPerDay =
                  viewMode === ViewMode.Year ? 1 / 365 :
                  viewMode === ViewMode.Month ? 1 / 30 :
                  viewMode === ViewMode.Week ? 1 / 7 : 1;
                const numUnits = Math.ceil(diffDays * unitsPerDay) + 2;
                const MIN_COL = viewMode === ViewMode.Day ? 30 : viewMode === ViewMode.Week ? 30 : 50;
                return Math.max(MIN_COL, Math.floor(chartWidth / numUnits));
              })()}
              ganttHeight={ganttHeight}
              onExpanderClick={handleExpanderClick}
              TaskListHeader={GanttListHeader}
              TaskListTable={GanttListTable}
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
      </ColCtx.Provider>
    </div>
  );
}
