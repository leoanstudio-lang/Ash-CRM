import React, { useState } from 'react';
import { Employee } from '../types';
import { Lock, User, Eye, EyeOff, Loader2, Clock } from 'lucide-react';
import { auth, signInWithEmailAndPassword, db } from '../lib/firebase';

interface LoginProps {
  employees: Employee[];
  onLogin: (user: Employee, ipAddress?: string, lateReason?: string, lateMinutes?: number) => void;
}

export const getUserPublicIP = async (): Promise<string> => {
  const services = [
    'https://api.ipify.org?format=json',
    'https://api.seeip.org/jsonip',
    'https://ipapi.co/json/'
  ];
  for (const url of services) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const ip = data.ip || data.jsonip;
        if (ip) return ip;
      }
    } catch (e) {
      console.warn(`Failed to fetch IP from ${url}:`, e);
    }
  }
  throw new Error('Unable to determine public IP address.');
};

const Login: React.FC<LoginProps> = ({ employees, onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Late reason capturing state
  const [pendingLateInfo, setPendingLateInfo] = useState<{
    user: Employee;
    ip: string;
    lateMinutes: number;
  } | null>(null);
  const [lateReason, setLateReason] = useState('Traffic / Road Congestion');
  const [customLateReason, setCustomLateReason] = useState('');

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
        const user = employees.find(
          emp => emp.username === username && emp.password === password
        );
        if (!user) {
          setError('Invalid username or password. Admins must sign in with their email address.');
          setIsLoading(false);
          return;
        }

        // 1. Fetch settings from Firestore doc config/attendance_settings
        const { getDoc, doc } = await import('firebase/firestore');
        const settingsSnap = await getDoc(doc(db, 'config', 'attendance_settings'));
        const settings = settingsSnap.exists() ? settingsSnap.data() : {
          officialWorkingHours: 8,
          officialStartTime: '09:00',
          lateTrackingEnabled: false,
          lateGracePeriod: 15,
          ipRestrictionEnabled: false,
          approvedIPs: []
        };

        // 2. Validate IP Restriction
        let userIp = 'Unknown';
        if (settings.ipRestrictionEnabled) {
          try {
            userIp = await getUserPublicIP();
            const approved = settings.approvedIPs || [];
            if (!approved.includes(userIp)) {
              setError(`Access denied. Your public IP (${userIp}) is not registered on the office network.`);
              setIsLoading(false);
              return;
            }
          } catch (ipErr) {
            setError('Access blocked. Unable to verify your office network connection.');
            setIsLoading(false);
            return;
          }
        } else {
          try {
            userIp = await getUserPublicIP();
          } catch {}
        }

        // 3. Check for Late Arrival
        const localDate = new Date();
        const dateYMD = localDate.getFullYear() + '-' + 
                        String(localDate.getMonth() + 1).padStart(2, '0') + '-' + 
                        String(localDate.getDate()).padStart(2, '0');
        
        const attendanceDocRef = doc(db, 'attendance', `${user.id}_${dateYMD}`);
        const attendanceSnap = await getDoc(attendanceDocRef);
        const hasSessions = attendanceSnap.exists() && (attendanceSnap.data()?.sessions?.length > 0);

        if (!hasSessions && settings.lateTrackingEnabled) {
          const [startHour, startMin] = (settings.officialStartTime || '09:00').split(':').map(Number);
          const shiftStartLocal = new Date(localDate.getFullYear(), localDate.getMonth(), localDate.getDate(), startHour, startMin, 0);
          const gracePeriodEnd = new Date(shiftStartLocal.getTime() + (settings.lateGracePeriod || 15) * 60 * 1000);

          if (localDate.getTime() > gracePeriodEnd.getTime()) {
            const diffMs = localDate.getTime() - shiftStartLocal.getTime();
            const lateMins = Math.floor(diffMs / 60000);

            // Trigger Late Reason collection phase
            setPendingLateInfo({
              user,
              ip: userIp,
              lateMinutes: lateMins
            });
            setIsLoading(false);
            return;
          }
        }

        // Complete normal login if not late or already checked in today
        onLogin(user, userIp);
      }
    } catch (err: any) {
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

  const handleLateReasonSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingLateInfo) return;

    const finalReason = lateReason === 'Other' ? customLateReason.trim() : lateReason;
    if (!finalReason) {
      alert("Please enter a reason for your late arrival.");
      return;
    }

    onLogin(pendingLateInfo.user, pendingLateInfo.ip, finalReason, pendingLateInfo.lateMinutes);
    setPendingLateInfo(null);
  };

  if (pendingLateInfo) {
    const reasonsList = [
      'Traffic / Road Congestion',
      'Medical Appointment / Health Issue',
      'Public Transport Delay',
      'Personal / Family Emergency',
      'Bad Weather Conditions',
      'Other'
    ];

    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white/5 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-500/10 text-amber-500 rounded-2xl border border-amber-500/20 mb-4 animate-pulse">
              <Clock size={32} />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Late Arrival Registered</h2>
            <p className="text-slate-400 text-sm mt-2">
              You are check-in ready but logging in <span className="text-amber-400 font-semibold">{pendingLateInfo.lateMinutes} minutes late</span> today.
            </p>
          </div>

          <form onSubmit={handleLateReasonSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Reason for Late Arrival
              </label>
              <select
                className="w-full bg-slate-900 border border-slate-700 text-white px-3 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                value={lateReason}
                onChange={e => setLateReason(e.target.value)}
              >
                {reasonsList.map(r => (
                  <option key={r} value={r} className="bg-slate-900 text-white">{r}</option>
                ))}
              </select>
            </div>

            {lateReason === 'Other' && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Please Specify
                </label>
                <input
                  type="text"
                  required
                  placeholder="Describe details..."
                  className="w-full bg-slate-900 border border-slate-700 text-white px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-600"
                  value={customLateReason}
                  onChange={e => setCustomLateReason(e.target.value)}
                />
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 group"
            >
              Confirm & Access Dashboard <div className="w-5 h-px bg-white/30 group-hover:w-8 transition-all"></div>
            </button>
          </form>
        </div>
      </div>
    );
  }

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
