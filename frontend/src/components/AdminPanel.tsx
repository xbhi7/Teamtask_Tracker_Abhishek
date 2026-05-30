import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import { UserPlus, Users, User, ShieldAlert, Mail, ShieldCheck, Key } from 'lucide-react';

interface Member {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export const AdminPanel: React.FC = () => {
  const { user, apiFetch } = useAuth();
  const { showToast } = useToast();

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // Registration Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'MANAGER' | 'MEMBER'>('MEMBER');
  const [registering, setRegistering] = useState(false);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/projects/members');
      if (res.ok) {
        setMembers(await res.json());
      } else {
        showToast('Error', 'Could not retrieve organization members', 'error');
      }
    } catch (err) {
      showToast('Error', 'Connection failed while loading members', 'error');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, showToast]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || !firstName.trim() || !lastName.trim()) {
      showToast('Validation Error', 'All fields are required to register a user', 'error');
      return;
    }

    if (password.length < 6) {
      showToast('Validation Error', 'Password must be at least 6 characters', 'error');
      return;
    }

    setRegistering(true);

    try {
      // Register request dynamically pointing to dynamic base URL
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5002/api';
      const res = await fetch(`${apiUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          firstName,
          lastName,
          role,
          organizationId: user?.organizationId, // Automatically join the same organization!
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        showToast('Registration Failed', errorData.message || 'Could not register user', 'error');
      } else {
        showToast('Success', `Account for ${firstName} created successfully!`, 'success');
        // Clear fields
        setEmail('');
        setPassword('');
        setFirstName('');
        setLastName('');
        setRole('MEMBER');
        // Refresh list
        fetchMembers();
      }
    } catch (err) {
      showToast('Connection Error', 'Failed to communicate with auth system', 'error');
    } finally {
      setRegistering(false);
    }
  };

  const roleBadges = {
    ADMIN: 'bg-red-500/10 text-red-400 border-red-500/20',
    MANAGER: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    MEMBER: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  };

  return (
    <div className="flex-1 flex flex-col p-6 max-w-7xl mx-auto w-full gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold font-sans tracking-wide bg-gradient-to-r from-white via-dark-100 to-brand-400 bg-clip-text text-transparent">
          Team Management Dashboard
        </h2>
        <p className="text-sm text-dark-400">
          Monitor your organization members and manage system credentials.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Members List */}
        <div className="glass-panel rounded-2xl p-6 lg:col-span-2 flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-white/5 pb-3">
            <Users className="w-5 h-5 text-brand-400" />
            <h3 className="font-bold text-base font-sans tracking-wide">
              Active Organization Members
            </h3>
            <span className="bg-white/5 border border-white/5 px-2.5 py-0.5 rounded-full text-xs text-dark-300 ml-auto font-bold">
              {members.length} Total
            </span>
          </div>

          {loading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse"></div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-1">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="glass-card p-4 rounded-xl flex items-center justify-between border border-white/5 transition-all duration-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-brand-500/10 border border-brand-500/20 rounded-xl flex items-center justify-center text-brand-400 font-bold font-sans text-sm">
                      {m.firstName[0]}{m.lastName[0]}
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-dark-50 font-sans tracking-wide">
                        {m.firstName} {m.lastName}
                      </h4>
                      <p className="text-xs text-dark-400 mt-0.5 flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-dark-500" />
                        {m.email}
                      </p>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 text-[10px] font-bold font-sans rounded border tracking-wider select-none ${
                    roleBadges[m.role as keyof typeof roleBadges] || 'bg-white/5'
                  }`}>
                    {m.role}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* User Registration Panel */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-white/5 pb-3">
            <UserPlus className="w-5 h-5 text-brand-400" />
            <h3 className="font-bold text-base font-sans tracking-wide">
              Add Team Member
            </h3>
          </div>

          {user?.role !== 'ADMIN' ? (
            <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 p-4 rounded-xl text-xs leading-normal flex items-start gap-2.5">
              <ShieldAlert className="w-4.5 h-4.5 mt-0.5 shrink-0" />
              <div>
                <strong>Authorization Notice</strong>. Only users with the <strong>ADMIN</strong> role can add new team members. Users with the <strong>MANAGER</strong> role can view this list, but cannot register users.
              </div>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="flex flex-col gap-4">
              {/* First Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-dark-300 font-bold uppercase tracking-wider">
                  First Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Charlie"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="glass-input text-sm"
                />
              </div>

              {/* Last Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-dark-300 font-bold uppercase tracking-wider">
                  Last Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Member"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="glass-input text-sm"
                />
              </div>

              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-dark-300 font-bold uppercase tracking-wider flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" />
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="charles@acme.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="glass-input text-sm"
                />
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-dark-300 font-bold uppercase tracking-wider flex items-center gap-1">
                  <Key className="w-3.5 h-3.5" />
                  Initial Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="glass-input text-sm"
                />
              </div>

              {/* Role Select */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-dark-300 font-bold uppercase tracking-wider">
                  Assigned Access Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="glass-input text-sm cursor-pointer bg-dark-900 focus:border-brand-500"
                >
                  <option value="MEMBER">MEMBER (View/Update assigned tasks)</option>
                  <option value="MANAGER">MANAGER (Manage projects/tasks & assigners)</option>
                  <option value="ADMIN">ADMIN (Full organization permissions)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={registering}
                className="btn-primary w-full text-sm font-semibold py-2.5 mt-2 flex items-center justify-center gap-2"
              >
                <UserPlus className="w-4.5 h-4.5" />
                {registering ? 'Creating Member...' : 'Register User'}
              </button>
            </form>
          )}

        </div>

      </div>
    </div>
  );
};
