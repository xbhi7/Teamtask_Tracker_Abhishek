import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import { X, Calendar, AlertCircle, Trash2, Save, User2, AlignLeft, ShieldCheck, AlertOctagon, HelpCircle } from 'lucide-react';

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

interface TaskModalProps {
  task?: Task;
  onClose: () => void;
  onSuccess: () => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({ task, onClose, onSuccess }) => {
  const { user, apiFetch } = useAuth();
  const { showToast } = useToast();

  const isEditMode = !!task;

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [status, setStatus] = useState<Task['status']>('TODO');
  const [assigneeId, setAssigneeId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [dueDate, setDueDate] = useState('');

  // Dropdown lists
  const [members, setMembers] = useState<Member[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Field locking based on role:
  // MEMBERS can only edit "status"
  const isReadOnly = user?.role === 'MEMBER';

  // Load auxiliary lists (members, projects)
  useEffect(() => {
    const loadAuxData = async () => {
      try {
        const [mRes, pRes] = await Promise.all([
          apiFetch('/projects/members'),
          apiFetch('/projects')
        ]);
        if (mRes.ok && pRes.ok) {
          setMembers(await mRes.json());
          setProjects(await pRes.json());
        }
      } catch (err) {
        console.error('Failed to load aux data', err);
      }
    };
    loadAuxData();
  }, [apiFetch]);

  // Load task fields if in edit mode
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setPriority(task.priority);
      setStatus(task.status);
      setAssigneeId(task.assigneeId || '');
      setProjectId(task.projectId || '');
      
      // Format ISO string to input date format (YYYY-MM-DD)
      const date = new Date(task.dueDate);
      const formattedDate = date.toISOString().split('T')[0];
      setDueDate(formattedDate);
    } else {
      setTitle('');
      setDescription('');
      setPriority('MEDIUM');
      setStatus('TODO');
      setAssigneeId('');
      setProjectId('');
      
      // Default due date to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setDueDate(tomorrow.toISOString().split('T')[0]);
    }
  }, [task]);

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('Validation Error', 'Task title is required', 'error');
      return;
    }

    // Verify due date is in the future
    const parsedDueDate = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Ignore hour checking

    if (isNaN(parsedDueDate.getTime()) || parsedDueDate < today) {
      showToast('Validation Error', 'due_date must be a future date', 'error');
      return;
    }

    // Status state-machine validation in edit mode (MEMBER and MANAGER status transition check)
    if (isEditMode && task && task.status !== status) {
      const validTransitions: Record<Task['status'], Task['status'][]> = {
        TODO: ['IN_PROGRESS', 'BLOCKED'],
        IN_PROGRESS: ['IN_REVIEW', 'BLOCKED'],
        IN_REVIEW: ['DONE', 'BLOCKED'],
        BLOCKED: ['TODO', 'IN_PROGRESS', 'IN_REVIEW'],
        DONE: ['TODO']
      };

      const allowed = validTransitions[task.status];
      if (!allowed || !allowed.includes(status)) {
        showToast(
          'Invalid Transition',
          `Cannot transition directly from ${task.status.replace('_', ' ')} to ${status.replace('_', ' ')}.`,
          'error'
        );
        return;
      }
    }

    setSubmitting(true);

    try {
      let res;
      const body: any = isReadOnly 
        ? { status } // Members can only send the status
        : {
            title,
            description: description || null,
            priority,
            status,
            assigneeId: assigneeId || null,
            projectId: projectId || null,
            dueDate: parsedDueDate.toISOString(),
          };

      if (isEditMode && task) {
        res = await apiFetch(`/tasks/${task.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await apiFetch('/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const errorData = await res.json();
        showToast('Operation Failed', errorData.message || 'Failed to save task details', 'error');
      } else {
        showToast(
          isEditMode ? 'Task Updated' : 'Task Created',
          isEditMode ? 'Changes saved successfully.' : 'New task has been logged.',
          'success'
        );
        onSuccess();
        onClose();
      }
    } catch (err) {
      showToast('Connection Error', 'Failed to reach the server', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete handler
  const handleDelete = async () => {
    if (!task) return;
    setDeleting(true);

    try {
      const res = await apiFetch(`/tasks/${task.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errorData = await res.json();
        showToast('Deletion Failed', errorData.message || 'Could not delete task', 'error');
      } else {
        showToast('Task Deleted', 'Task was permanently removed from system.', 'success');
        onSuccess();
        onClose();
      }
    } catch (err) {
      showToast('Connection Error', 'Could not delete the task', 'error');
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-dark-950/70 backdrop-blur-sm transition-opacity duration-300"
      />

      {/* Modal Container */}
      <div className="glass-panel w-full max-w-lg rounded-2xl shadow-2xl relative z-10 overflow-hidden animate-slide-up flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-base font-bold font-sans tracking-wide text-dark-50">
            {isEditMode ? 'Task Specifications' : 'Draft New Task'}
          </h3>
          <button 
            onClick={onClose}
            className="text-dark-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto flex flex-col gap-4">
          
          {/* Read-Only Banner for Members */}
          {isReadOnly && (
            <div className="bg-brand-500/10 border border-brand-500/20 text-brand-300 p-3 rounded-lg flex items-start gap-2.5 text-xs leading-normal">
              <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <strong>Role Limit: Member</strong>. You have permissions to update only the task workflow status. Other specifications remain locked.
              </div>
            </div>
          )}

          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-dark-300 font-bold uppercase tracking-wider">
              Title
            </label>
            <input
              type="text"
              required
              disabled={isReadOnly}
              placeholder="e.g. Optimize Redis Caching Strategy"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="glass-input text-sm focus:border-brand-500"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-dark-300 font-bold uppercase tracking-wider">
              Description
            </label>
            <textarea
              rows={3}
              disabled={isReadOnly}
              placeholder="Enter detailed description here..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="glass-input text-sm focus:border-brand-500 resize-none"
            />
          </div>

          {/* Priority & Status Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Priority */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-dark-300 font-bold uppercase tracking-wider">
                Priority
              </label>
              <select
                disabled={isReadOnly}
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="glass-input text-sm cursor-pointer bg-dark-900 focus:border-brand-500"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>

            {/* Status */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-dark-300 font-bold uppercase tracking-wider">
                Workflow Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="glass-input text-sm cursor-pointer bg-dark-900 focus:border-brand-500"
              >
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="IN_REVIEW">In Review</option>
                <option value="DONE">Completed</option>
                <option value="BLOCKED">Blocked</option>
              </select>
            </div>
          </div>

          {/* Assignee & Project Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Assignee */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-dark-300 font-bold uppercase tracking-wider">
                Assignee
              </label>
              <select
                disabled={isReadOnly}
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="glass-input text-sm cursor-pointer bg-dark-900 focus:border-brand-500"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.firstName} {m.lastName} ({m.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Project */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-dark-300 font-bold uppercase tracking-wider">
                Linked Project
              </label>
              <select
                disabled={isReadOnly}
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="glass-input text-sm cursor-pointer bg-dark-900 focus:border-brand-500"
              >
                <option value="">No Project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Due Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-dark-300 font-bold uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Due Date
            </label>
            <input
              type="date"
              required
              disabled={isReadOnly}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="glass-input text-sm focus:border-brand-500 bg-dark-900 cursor-pointer"
            />
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between border-t border-white/5 pt-5 mt-4">
            {/* Delete button (Admin/Manager edit mode only) */}
            {isEditMode && user?.role !== 'MEMBER' ? (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-400 font-medium">Delete permanently?</span>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={handleDelete}
                    className="bg-red-600 hover:bg-red-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="bg-white/5 hover:bg-white/10 text-xs px-3 py-1.5 rounded-lg border border-white/10 text-dark-100 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 p-2.5 rounded-lg transition-all duration-150"
                  title="Remove this task permanently"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )
            ) : (
              <div />
            )}

            {/* Save / Cancel buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary text-sm px-4 py-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary text-sm px-5 py-2 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {submitting ? 'Saving...' : 'Save Specifications'}
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
};
