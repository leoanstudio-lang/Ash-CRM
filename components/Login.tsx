
import React, { useState } from 'react';
import { Employee } from '../types';
import { Lock, User, Eye, EyeOff, Loader2 } from 'lucide-react';
import { auth, signInWithEmailAndPassword } from '../lib/firebase';

interface LoginProps {
  employees: Employee[];
  onLogin: (user: Employee) => void;
}

const Login: React.FC<LoginProps> = ({ employees, onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isEmail = (value: string) => value.includes('@');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isEmail(username)) {
        // ── ADMIN PATH: Firebase Email/Password Authentication ──
        await signInWithEmailAndPassword(auth, username, password);

        // Find the matching admin employee record (for name/role info)
        const adminEmployee = employees.find(emp => emp.role === 'admin');
        if (adminEmployee) {
          onLogin(adminEmployee);
        } else {
          // Fallback admin if no employee record exists yet
          onLogin({
            id: 'FIREBASE_ADMIN',
            name: 'Admin',
            mobile: '',
            username: username,
            department: 'Management',
            role: 'super_admin'
          });
        }
      } else {
        // ── EMPLOYEE PATH: Firestore Username/Password lookup ──
        // NOTE: employees list passed here already excludes admin-role users (filtered in App.tsx)
        const user = employees.find(
          emp => emp.username === username && emp.password === password
        );
        if (user) {
          onLogin(user);
        } else {
          setError('Invalid username or password. Admins must sign in with their email address.');
        }
      }
    } catch (err: any) {
      // Firebase error codes → friendly messages
      const code = err?.code || '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setError('Invalid email or password.');
      } else if (code === 'auth/too-many-requests') {
        setError('Too many attempts. Please wait a moment and try again.');
      } else if (code === 'auth/network-request-failed') {
        setError('Network error. Check your connection.');
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl shadow-xl shadow-blue-500/20 mb-4">
            <span className="text-white text-3xl font-black">Y</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">ash CRM</h1>
          <p className="text-slate-400 mt-2">Sign in to your dashboard</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Username / Email
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  type="text"
                  required
                  autoComplete="username"
                  className="w-full bg-slate-900/50 border border-slate-700 text-white pl-10 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-600"
                  placeholder="Username or admin@email.com"
                  value={username}
                  onChange={e => { setUsername(e.target.value); setError(''); }}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  className="w-full bg-slate-900/50 border border-slate-700 text-white pl-10 pr-12 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-600"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl text-red-400 text-sm font-medium text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-60 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 group"
            >
              {isLoading ? (
                <><Loader2 size={18} className="animate-spin" /> Signing in...</>
              ) : (
                <>Sign In <div className="w-5 h-px bg-white/30 group-hover:w-8 transition-all"></div></>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-slate-500 text-sm">
              Forgot your credentials? <a href="#" className="text-blue-500 hover:underline font-semibold">Contact Admin</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
