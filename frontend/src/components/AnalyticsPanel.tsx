import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import { BarChart3, AlertTriangle, Clock, Award } from 'lucide-react';

interface UserAnalytics {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  overdueCount: number;
  avgCompletionTimeHours: number;
}

export const AnalyticsPanel: React.FC = () => {
  const { apiFetch } = useAuth();
  const { showToast } = useToast();

  const [data, setData] = useState<UserAnalytics[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/analytics');
      if (res.ok) {
        const result = await res.json();
        setData(result);
      } else {
        showToast('Error', 'Failed to retrieve task analytics data', 'error');
      }
    } catch (err) {
      showToast('Error', 'Connection failed while loading analytics', 'error');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, showToast]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Aggregate Metrics for high visual display
  const totalOverdue = data.reduce((acc, curr) => acc + curr.overdueCount, 0);
  
  const completedTaskUsers = data.filter((u) => u.avgCompletionTimeHours > 0);
  const organizationAvgHours = completedTaskUsers.length > 0
    ? parseFloat((completedTaskUsers.reduce((acc, curr) => acc + curr.avgCompletionTimeHours, 0) / completedTaskUsers.length).toFixed(1))
    : 0.0;

  // Find user with lowest non-zero completion hours (MVP!)
  const mvpUser = completedTaskUsers.length > 0
    ? [...completedTaskUsers].sort((a, b) => a.avgCompletionTimeHours - b.avgCompletionTimeHours)[0]
    : null;

  return (
    <div className="flex-1 flex flex-col p-6 max-w-7xl mx-auto w-full gap-6">
      
      {/* Title */}
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold font-sans tracking-wide bg-gradient-to-r from-white via-dark-100 to-brand-400 bg-clip-text text-transparent">
          Organizational Analytics
        </h2>
        <p className="text-sm text-dark-400">
          Aggregated statistics monitoring overdue backlogs and average task completion performance.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-white/5 rounded-2xl animate-pulse"></div>
          ))}
          <div className="h-96 bg-white/5 rounded-2xl col-span-full animate-pulse"></div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          
          {/* Top Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Overdue Total Backlog */}
            <div className="glass-panel rounded-2xl p-6 flex items-center justify-between border-l-4 border-l-red-500">
              <div>
                <span className="text-[10px] text-dark-400 font-bold uppercase tracking-wider block font-sans">
                  Total Overdue Backlog
                </span>
                <span className="text-3xl font-extrabold font-sans mt-2 block text-red-400">
                  {totalOverdue}
                </span>
                <span className="text-xs text-dark-300 block mt-1">
                  Incomplete tasks past due date
                </span>
              </div>
              <div className="bg-red-500/10 p-3.5 rounded-xl border border-red-500/10 text-red-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>

            {/* Average Completion Time */}
            <div className="glass-panel rounded-2xl p-6 flex items-center justify-between border-l-4 border-l-brand-500">
              <div>
                <span className="text-[10px] text-dark-400 font-bold uppercase tracking-wider block font-sans">
                  Org Avg Completion Speed
                </span>
                <span className="text-3xl font-extrabold font-sans mt-2 block text-brand-400">
                  {organizationAvgHours}h
                </span>
                <span className="text-xs text-dark-300 block mt-1">
                  Average duration from logging to DONE
                </span>
              </div>
              <div className="bg-brand-500/10 p-3.5 rounded-xl border border-brand-500/10 text-brand-400">
                <Clock className="w-6 h-6" />
              </div>
            </div>

            {/* Top Performer (MVP) */}
            <div className="glass-panel rounded-2xl p-6 flex items-center justify-between border-l-4 border-l-green-500">
              <div>
                <span className="text-[10px] text-dark-400 font-bold uppercase tracking-wider block font-sans">
                  Fastest Task Resolver
                </span>
                <span className="text-lg font-bold font-sans mt-3 block text-green-400 truncate max-w-[180px]">
                  {mvpUser ? `${mvpUser.firstName} ${mvpUser.lastName}` : 'N/A'}
                </span>
                <span className="text-xs text-dark-300 block mt-0.5">
                  {mvpUser ? `Leading resolver with avg ${mvpUser.avgCompletionTimeHours}h` : 'No tasks resolved yet'}
                </span>
              </div>
              <div className="bg-green-500/10 p-3.5 rounded-xl border border-green-500/10 text-green-400">
                <Award className="w-6 h-6" />
              </div>
            </div>

          </div>

          {/* User Performance Grid */}
          <div className="glass-panel rounded-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <BarChart3 className="w-5 h-5 text-brand-400" />
              <h3 className="font-bold text-base font-sans tracking-wide">
                User Completion Metrics & Performance
              </h3>
            </div>

            {data.length === 0 ? (
              <div className="py-20 text-center text-dark-400 text-sm">
                No users found in organization.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 text-[10px] uppercase tracking-wider text-dark-400 font-bold">
                      <th className="py-3 px-4">Team Member</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Overdue Tasks</th>
                      <th className="py-3 px-4">Avg Completion Speed</th>
                      <th className="py-3 px-4">Performance Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((user) => {
                      const speedStatus = 
                        user.avgCompletionTimeHours === 0 
                          ? { label: 'Inactive', color: 'bg-dark-500/10 text-dark-400 border-dark-500/20' }
                          : user.avgCompletionTimeHours <= 24
                          ? { label: 'Exceptional Speed', color: 'bg-green-500/10 text-green-400 border-green-500/20' }
                          : user.avgCompletionTimeHours <= 72
                          ? { label: 'On Target', color: 'bg-brand-500/10 text-brand-400 border-brand-500/20' }
                          : { label: 'Action Required', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' };

                      return (
                        <tr key={user.userId} className="border-b border-white/5 text-sm hover:bg-white/[0.02] transition-colors">
                          <td className="py-4 px-4">
                            <div>
                              <div className="font-semibold text-dark-50">
                                {user.firstName} {user.lastName}
                              </div>
                              <div className="text-xs text-dark-400 mt-0.5">
                                {user.email}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className="text-[10px] font-bold bg-white/5 border border-white/10 px-2 py-0.5 rounded tracking-wide text-dark-200">
                              {user.role}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <span className={`font-bold font-sans ${user.overdueCount > 0 ? 'text-red-400' : 'text-dark-300'}`}>
                                {user.overdueCount}
                              </span>
                              {user.overdueCount > 0 && (
                                <span className="bg-red-500/10 border border-red-500/20 px-1.5 py-0.2 rounded text-[9px] text-red-400 font-bold uppercase tracking-wider">
                                  Attention
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className="font-semibold font-sans text-dark-100">
                              {user.avgCompletionTimeHours > 0 
                                ? `${user.avgCompletionTimeHours.toFixed(1)} hrs` 
                                : '0.0 hrs'
                              }
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${speedStatus.color}`}>
                              {speedStatus.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
};
