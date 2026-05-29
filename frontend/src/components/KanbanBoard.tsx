import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import { 
  Search, Filter, Plus, User2, Calendar, ClipboardList,
  Play, CheckCircle2, AlertOctagon, HelpCircle, UserCheck
} from 'lucide-react';

interface Member {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'BLOCKED';
  dueDate: string;
  assigneeId?: string;
  projectId?: string;
  assignee?: Member;
  project?: Project;
}

interface KanbanBoardProps {
  onOpenTaskModal: (task?: Task) => void;
  refreshTrigger: number;
}

const COLUMNS: { id: Task['status']; title: string; icon: React.ReactNode; color: string; bg: string; border: string; glow: string }[] = [
  { id: 'TODO', title: 'To Do', icon: <ClipboardList className="w-4 h-4 text-dark-300" />, color: 'text-dark-300', bg: 'bg-dark-900/40', border: 'border-white/5', glow: 'status-glow-todo' },
  { id: 'IN_PROGRESS', title: 'In Progress', icon: <Play className="w-4 h-4 text-brand-400" />, color: 'text-brand-400', bg: 'bg-brand-500/5', border: 'border-brand-500/10', glow: 'status-glow-progress' },
  { id: 'IN_REVIEW', title: 'In Review', icon: <HelpCircle className="w-4 h-4 text-yellow-400" />, color: 'text-yellow-400', bg: 'bg-yellow-500/5', border: 'border-yellow-500/10', glow: 'status-glow-review' },
  { id: 'DONE', title: 'Completed', icon: <CheckCircle2 className="w-4 h-4 text-green-400" />, color: 'text-green-400', bg: 'bg-green-500/5', border: 'border-green-500/10', glow: 'status-glow-done' },
  { id: 'BLOCKED', title: 'Blocked', icon: <AlertOctagon className="w-4 h-4 text-red-400" />, color: 'text-red-400', bg: 'bg-red-500/5', border: 'border-red-500/10', glow: 'status-glow-blocked' },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ onOpenTaskModal, refreshTrigger }) => {
  const { user, apiFetch } = useAuth();
  const { showToast } = useToast();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [cacheIndicator, setCacheIndicator] = useState<boolean>(false);

  // Filter States
  const [search, setSearch] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('');
  
  // Dragging highlights
  const [activeDragCol, setActiveDragCol] = useState<string | null>(null);

  // Fetch members for assignee dropdown filter
  const fetchAuxiliaryData = useCallback(async () => {
    try {
      const res = await apiFetch('/projects/members');
      if (res.ok) {
        const membersData = await res.json();
        setMembers(membersData);
      }
    } catch (err) {
      console.error('⚠️ Failed to load members:', err);
    }
  }, [apiFetch]);

  // Load all tasks (respecting Member limits and standard queries)
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Build Query Parameters
      const params = new URLSearchParams();
      // To trigger cache hit, we query for a single assignee with page=1, limit=100
      // In the frontend board, we display the tasks in columns.
      // If we are a member, the API automatically restricts to our assignee ID.
      // If we are admin/manager, we can query by a selected assignee or see all.
      // To leverage the cache when filtering by assignee or loading our own Member board:
      if (user?.role === 'MEMBER') {
        params.append('assigneeId', user.id);
        params.append('limit', '100'); // Force standard full list load to hit Redis
      } else if (assigneeFilter) {
        params.append('assigneeId', assigneeFilter);
        params.append('limit', '100'); // Force standard full list load to hit Redis
      } else {
        params.append('limit', '50'); // General load for all tasks in organization
      }

      if (priorityFilter) {
        params.append('priority', priorityFilter);
      }

      const res = await apiFetch(`/tasks?${params.toString()}`);
      if (!res.ok) {
        const errorData = await res.json();
        showToast('Load Failed', errorData.message || 'Could not fetch tasks', 'error');
        return;
      }

      const data = await res.json();
      setTasks(data.tasks);
      setCacheIndicator(!!data.cached);
    } catch (err) {
      showToast('Error', 'An unexpected error occurred while loading tasks', 'error');
    } finally {
      setLoading(false);
    }
  }, [user, assigneeFilter, priorityFilter, apiFetch, showToast]);

  // Load initially
  useEffect(() => {
    fetchAuxiliaryData();
  }, [fetchAuxiliaryData]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks, refreshTrigger]);

  // Handle HTML5 drag start
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
  };

  // Drag over styling control
  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    setActiveDragCol(colId);
  };

  // Drag leave reset styling
  const handleDragLeave = () => {
    setActiveDragCol(null);
  };

  // Handle task status transition on drop
  const handleDrop = async (e: React.DragEvent, newStatus: Task['status']) => {
    e.preventDefault();
    setActiveDragCol(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Check if status is unchanged
    if (task.status === newStatus) return;

    // Client-side quick RBAC check
    if (user?.role === 'MEMBER' && task.assigneeId !== user.id) {
      showToast('Access Denied', 'You can only advance status for tasks assigned to you.', 'warning');
      return;
    }

    // Verify client-side status transition rules
    const validTransitions: Record<Task['status'], Task['status'][]> = {
      TODO: ['IN_PROGRESS', 'BLOCKED'],
      IN_PROGRESS: ['IN_REVIEW', 'BLOCKED'],
      IN_REVIEW: ['DONE', 'BLOCKED'],
      BLOCKED: ['TODO', 'IN_PROGRESS', 'IN_REVIEW'],
      DONE: ['TODO']
    };

    const allowed = validTransitions[task.status];
    if (!allowed || !allowed.includes(newStatus)) {
      showToast(
        'Invalid Transition',
        `Tasks cannot transition directly from ${task.status.replace('_', ' ')} to ${newStatus.replace('_', ' ')}.`,
        'error'
      );
      return;
    }

    // Optimistic Update (for premium micro-interaction response!)
    const previousTasks = [...tasks];
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );

    try {
      const res = await apiFetch(`/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        // Revert on server error
        setTasks(previousTasks);
        const errorData = await res.json();
        showToast('Transition Failed', errorData.message || 'Could not update task status', 'error');
      } else {
        const updatedTask = await res.json();
        // Set real updated task with populated properties
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? updatedTask : t))
        );
        showToast(
          'Status Updated',
          `"${task.title}" has been moved to ${newStatus.replace('_', ' ')}.`,
          'success'
        );
      }
    } catch (err) {
      setTasks(previousTasks);
      showToast('Connection Error', 'Failed to communicate with server', 'error');
    }
  };

  // Filter tasks based on query inputs locally
  const filteredTasks = tasks.filter((t) => {
    const matchesSearch = 
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(search.toLowerCase()));
    return matchesSearch;
  });

  return (
    <div className="flex-1 flex flex-col p-6 max-w-7xl mx-auto w-full gap-6">
      
      {/* Board Controls & Filters */}
      <div className="glass-panel rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[300px]">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md min-w-[200px]">
            <Search className="w-4 h-4 text-dark-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="glass-input pl-10 w-full text-sm font-sans"
            />
          </div>

          {/* Priority Filter */}
          <div className="relative">
            <Filter className="w-4 h-4 text-dark-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="glass-input pl-9 text-sm font-sans appearance-none pr-8 cursor-pointer bg-dark-900"
            >
              <option value="">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>

          {/* Assignee Filter (ADMIN / MANAGER only) */}
          {user?.role !== 'MEMBER' && (
            <div className="relative">
              <UserCheck className="w-4 h-4 text-dark-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
                className="glass-input pl-9 text-sm font-sans appearance-none pr-8 cursor-pointer bg-dark-900"
              >
                <option value="">All Members</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.firstName} {m.lastName} ({m.role})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Cache Indicator & Create Button */}
        <div className="flex items-center gap-4">
          {cacheIndicator && (
            <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-md text-[10px] text-green-400 font-bold uppercase tracking-wider animate-pulse">
              ⚡ Cached (Redis)
            </div>
          )}

          {user?.role !== 'MEMBER' && (
            <button
              onClick={() => onOpenTaskModal()}
              className="btn-primary flex items-center gap-2 whitespace-nowrap text-sm"
            >
              <Plus className="w-4 h-4" />
              New Task
            </button>
          )}
        </div>
      </div>

      {/* Kanban Board Layout */}
      {loading && tasks.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="glass-panel rounded-2xl p-4 flex flex-col gap-3 min-h-[300px]">
              <div className="h-6 w-32 bg-white/5 rounded-md animate-pulse"></div>
              <div className="h-28 bg-white/5 rounded-xl animate-pulse"></div>
              <div className="h-28 bg-white/5 rounded-xl animate-pulse"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-start">
          {COLUMNS.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.id);
            const isDraggingOver = activeDragCol === col.id;

            return (
              <div
                key={col.id}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.id)}
                className={`glass-panel rounded-2xl p-4 flex flex-col gap-4 kanban-column-list transition-all duration-200 ${col.bg} ${
                  isDraggingOver ? `${col.border} ring-2 ring-brand-500/30 scale-[1.01] shadow-2xl` : 'border-white/5'
                }`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <div className="flex items-center gap-2">
                    {col.icon}
                    <h3 className="font-semibold text-sm text-dark-100 font-sans tracking-wide">
                      {col.title}
                    </h3>
                  </div>
                  <span className="bg-white/5 border border-white/5 px-2 py-0.5 rounded-md text-[10px] text-dark-300 font-bold">
                    {colTasks.length}
                  </span>
                </div>

                {/* Task Cards Container */}
                <div className="flex flex-col gap-3 overflow-y-auto max-h-[calc(100vh-340px)] pr-1">
                  {colTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 px-4 border border-dashed border-white/5 rounded-xl text-dark-500 text-xs">
                      No tasks
                    </div>
                  ) : (
                    colTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onCardClick={() => onOpenTaskModal(task)}
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        glowClass={col.glow}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const TaskCard: React.FC<{
  task: Task;
  onCardClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  glowClass: string;
}> = ({ task, onCardClick, onDragStart, glowClass }) => {
  
  const priorityColors = {
    LOW: 'bg-green-500/10 text-green-400 border-green-500/20',
    MEDIUM: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    HIGH: 'bg-red-500/10 text-red-400 border-red-500/20',
  };

  const isOverdue = new Date(task.dueDate) < new Date() && task.status !== 'DONE';
  const displayDate = new Date(task.dueDate).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onCardClick}
      className={`glass-card p-4 rounded-xl flex flex-col gap-3 cursor-grab active:cursor-grabbing hover:translate-y-[-2px] ${glowClass}`}
    >
      {/* Title */}
      <h4 className="font-semibold text-sm text-dark-50 font-sans tracking-wide leading-snug hover:text-brand-400 transition-colors">
        {task.title}
      </h4>

      {/* Description Snippet */}
      {task.description && (
        <p className="text-xs text-dark-400 line-clamp-2 leading-relaxed">
          {task.description}
        </p>
      )}

      {/* Project name if linked */}
      {task.project && (
        <div className="text-[10px] text-brand-400 font-semibold bg-brand-500/5 border border-brand-500/10 px-2 py-0.5 rounded w-max">
          📂 {task.project.name}
        </div>
      )}

      {/* Card Footer Details */}
      <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-1 text-[10px]">
        {/* Priority Badge */}
        <span className={`px-2 py-0.5 rounded font-bold uppercase tracking-wider border text-[9px] ${priorityColors[task.priority]}`}>
          {task.priority}
        </span>

        {/* Due Date & Overdue flag */}
        <div className="flex items-center gap-1">
          <Calendar className={`w-3.5 h-3.5 ${isOverdue ? 'text-red-400 animate-pulse' : 'text-dark-400'}`} />
          <span className={`font-medium ${isOverdue ? 'text-red-400 font-bold' : 'text-dark-300'}`}>
            {displayDate} {isOverdue && '(Overdue)'}
          </span>
        </div>
      </div>

      {/* Assignee display */}
      <div className="flex items-center gap-1.5 border-t border-white/5 pt-2 mt-0.5">
        <div className="w-5 h-5 bg-white/5 rounded-full flex items-center justify-center border border-white/10 text-brand-400">
          <User2 className="w-3 h-3" />
        </div>
        <span className="text-[10px] text-dark-300 font-medium">
          {task.assignee ? `${task.assignee.firstName} ${task.assignee.lastName}` : 'Unassigned'}
        </span>
      </div>
    </div>
  );
};
