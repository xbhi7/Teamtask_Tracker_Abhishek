import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import { Mail, Key, User, PlusCircle, LogIn, ClipboardList, ShieldAlert, ArrowRight } from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { login, register } = useAuth();
  const { showToast } = useToast();

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  
  // Org join method: 'new' or 'join'
  const [orgMethod, setOrgMethod] = useState<'new' | 'join'>('new');
  const [organizationName, setOrganizationName] = useState('');
  const [organizationId, setOrganizationId] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      showToast('Validation Error', 'Email and password are required', 'error');
      return;
    }

    setLoading(true);

    try {
      if (isRegisterMode) {
        if (!firstName.trim() || !lastName.trim()) {
          showToast('Validation Error', 'First name and last name are required', 'error');
          setLoading(false);
          return;
        }

        if (password.length < 6) {
          showToast('Validation Error', 'Password must be at least 6 characters long', 'error');
          setLoading(false);
          return;
        }

        const registrationPayload: any = {
          email,
          password,
          firstName,
          lastName,
          role: 'ADMIN', // The registering user automatically becomes ADMIN of their org!
        };

        if (orgMethod === 'new') {
          if (!organizationName.trim()) {
            showToast('Validation Error', 'Organization name is required to create a team space', 'error');
            setLoading(false);
            return;
          }
          registrationPayload.organizationName = organizationName;
        } else {
          if (!organizationId.trim()) {
            showToast('Validation Error', 'Organization ID UUID is required to join', 'error');
            setLoading(false);
            return;
          }
          registrationPayload.organizationId = organizationId;
        }

        await register(registrationPayload);
        showToast('Account Logged', 'Registration successful! You may now sign in.', 'success');
        setIsRegisterMode(false);
        setPassword(''); // Reset password for login
      } else {
        await login(email, password);
        showToast('Access Granted', 'Signed in successfully. Welcome back!', 'success');
      }
    } catch (err: any) {
      showToast('Authentication Failed', err.message || 'Credentials invalid, please verify.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 overflow-hidden relative">
      
      {/* Background Animated Blobs for wow aesthetics! */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-brand-500/10 rounded-full blur-[100px] animate-blob" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-[120px] animate-blob delay-2000" />
      
      {/* Glass Panel wrapper */}
      <div className="glass-panel w-full max-w-md rounded-3xl p-8 shadow-2xl relative z-10 border border-white/5 bg-dark-900/60 flex flex-col gap-6">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="bg-brand-600 text-white p-3 rounded-2xl shadow-xl shadow-brand-600/30 flex items-center justify-center">
            <ClipboardList className="w-6 h-6" />
          </div>
          <h1 className="font-extrabold text-2xl font-sans tracking-tight bg-gradient-to-r from-white via-dark-100 to-brand-400 bg-clip-text text-transparent">
            TeamTask Space
          </h1>
          <p className="text-xs text-dark-400">
            {isRegisterMode 
              ? 'Initiate a collaborative project team space'
              : 'Sign in to access your organization dashboard'
            }
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          
          {/* Registration Info Names */}
          {isRegisterMode && (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-dark-300 font-bold uppercase tracking-wider">
                  First Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="glass-input text-xs"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-dark-300 font-bold uppercase tracking-wider">
                  Last Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="glass-input text-xs"
                />
              </div>
            </div>
          )}

          {/* Email */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-dark-300 font-bold uppercase tracking-wider flex items-center gap-1">
              <Mail className="w-3 h-3" />
              Email Address
            </label>
            <input
              type="email"
              required
              placeholder="john@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="glass-input text-xs"
            />
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-dark-300 font-bold uppercase tracking-wider flex items-center gap-1">
              <Key className="w-3 h-3" />
              Password
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="glass-input text-xs"
            />
          </div>

          {/* Organization setup during register */}
          {isRegisterMode && (
            <div className="flex flex-col gap-3 border-t border-white/5 pt-3 mt-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-dark-300 font-bold uppercase tracking-wider">
                  Organization Space
                </span>
                
                {/* Mode Selector */}
                <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/5 text-[9px] font-bold">
                  <button
                    type="button"
                    onClick={() => setOrgMethod('new')}
                    className={`px-2 py-1 rounded-md transition-colors ${
                      orgMethod === 'new' ? 'bg-brand-600 text-white' : 'text-dark-300'
                    }`}
                  >
                    Create New
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrgMethod('join')}
                    className={`px-2 py-1 rounded-md transition-colors ${
                      orgMethod === 'join' ? 'bg-brand-600 text-white' : 'text-dark-300'
                    }`}
                  >
                    Join Existing
                  </button>
                </div>
              </div>

              {orgMethod === 'new' ? (
                <div className="flex flex-col gap-1">
                  <input
                    type="text"
                    required={orgMethod === 'new'}
                    placeholder="Organization Name (e.g. Acme Corp)"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    className="glass-input text-xs"
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <input
                    type="text"
                    required={orgMethod === 'join'}
                    placeholder="Paste Organization UUID"
                    value={organizationId}
                    onChange={(e) => setOrganizationId(e.target.value)}
                    className="glass-input text-xs font-mono"
                  />
                </div>
              )}
            </div>
          )}

          {/* Submission Button */}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full text-xs font-bold uppercase tracking-wider py-3 mt-3 flex items-center justify-center gap-2"
          >
            {isRegisterMode ? <PlusCircle className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
            {loading 
              ? 'Processing Access...' 
              : isRegisterMode 
              ? 'Establish Team Space' 
              : 'Sign in to Console'
            }
          </button>
        </form>

        {/* Helper Test Accounts quick tip */}
        {!isRegisterMode && (
          <div className="bg-white/5 border border-white/5 rounded-xl p-3.5 flex flex-col gap-1.5 text-[10px] leading-relaxed text-dark-300 select-none">
            <div className="flex items-center gap-1 text-brand-400 font-bold font-sans uppercase tracking-wider">
              <ShieldAlert className="w-3.5 h-3.5" />
              Evaluation Accounts:
            </div>
            <div>
              💡 <strong>ADMIN</strong>: <code>admin@acme.com</code> / <code>AdminPass123!</code>
            </div>
            <div>
              💡 <strong>MANAGER</strong>: <code>manager@acme.com</code> / <code>ManagerPass123!</code>
            </div>
            <div>
              💡 <strong>MEMBER</strong>: <code>member1@acme.com</code> / <code>MemberPass123!</code>
            </div>
          </div>
        )}

        {/* Toggle Mode Link */}
        <div className="text-center mt-2 border-t border-white/5 pt-4">
          <button
            onClick={() => {
              setIsRegisterMode(!isRegisterMode);
              setPassword('');
            }}
            className="text-xs text-dark-300 hover:text-brand-400 font-medium transition-colors inline-flex items-center gap-1"
          >
            {isRegisterMode 
              ? 'Return to standard sign in' 
              : 'Create a new project organization space'
            }
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
};
