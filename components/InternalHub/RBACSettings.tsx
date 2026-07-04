import React, { useState } from 'react';
import { Save, Shield, HelpCircle, AlertTriangle } from 'lucide-react';
import { saveHubRBAC } from '../../lib/db';

interface RBACSettingsProps {
  rbacConfig: any;
  setRbacConfig: (config: any) => void;
  currentUser: any;
}

const SECTION_LABELS: Record<string, string> = {
  improvements: 'Daily Improvements',
  issues: 'Issue Reporting',
  suggestions: 'Suggestions & Ideas',
  process: 'Process Improvement',
  resources: 'Resource Requests',
  announcements: 'Company Announcements',
  kb: 'Knowledge Base',
  sop: 'SOP Library',
  questions: 'Questions & Help',
  recognition: 'Employee Recognition',
  training: 'Training Center',
  polls: 'Polls & Surveys'
};

const ROLES: { id: string; label: string; desc: string }[] = [
  { id: 'employee', label: 'Employee', desc: 'Standard staff view and personal dashboard' },
  { id: 'team_lead', label: 'Team Lead', desc: 'Team-level logging and review capabilities' },
  { id: 'dept_manager', label: 'Department Manager', desc: 'Can review and assign issues/approvals for their department' },
  { id: 'hr', label: 'HR Specialist', desc: 'Special permissions for training, polling, and recognition' },
  { id: 'admin', label: 'Administrator', desc: 'Full business management and configuration' },
  { id: 'super_admin', label: 'Super Admin', desc: 'Complete access to all data and module configuration' }
];

const PERM_LEVELS: { id: string; label: string; color: string }[] = [
  { id: 'none', label: 'None', color: 'bg-slate-100 text-slate-500' },
  { id: 'read', label: 'Read Only', color: 'bg-blue-50 text-blue-600' },
  { id: 'write', label: 'Read & Write', color: 'bg-indigo-50 text-indigo-600' },
  { id: 'manage', label: 'Full Manage', color: 'bg-purple-50 text-purple-600' }
];

const RBACSettings: React.FC<RBACSettingsProps> = ({ rbacConfig, setRbacConfig, currentUser }) => {
  const [selectedRole, setSelectedRole] = useState<string>('employee');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handlePermissionChange = (section: string, level: string) => {
    const updatedPermissions = {
      ...rbacConfig.permissions,
      [selectedRole]: {
        ...rbacConfig.permissions[selectedRole],
        [section]: level
      }
    };
    setRbacConfig({
      ...rbacConfig,
      permissions: updatedPermissions
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      await saveHubRBAC(rbacConfig);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (e) {
      console.error(e);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const isSuperAdmin = currentUser?.role === 'super_admin' || currentUser?.role === 'admin';

  if (!isSuperAdmin) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-6 text-center max-w-lg mx-auto shadow-sm">
        <AlertTriangle className="mx-auto text-amber-500 mb-3" size={40} />
        <h3 className="text-lg font-bold text-slate-800">Access Denied</h3>
        <p className="text-slate-500 mt-1.5 text-xs">
          Only System Administrators and Super Admins can configure Role-Based Access Control settings.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[500px]">
      {/* Left panel: Roles List */}
      <div className="w-full md:w-64 border-r border-slate-200 bg-slate-50/50 p-4.5 flex flex-col shrink-0">
        <h4 className="font-bold text-slate-800 text-[10px] uppercase tracking-wider mb-3.5 flex items-center gap-2">
          <Shield size={14} className="text-slate-500" /> System Roles
        </h4>
        <nav className="space-y-1 flex-1">
          {ROLES.map((role) => (
            <button
              key={role.id}
              onClick={() => setSelectedRole(role.id)}
              className={`w-full text-left p-3 rounded-lg transition duration-200 border ${
                selectedRole === role.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-700 border-slate-202 hover:border-slate-300'
              }`}
            >
              <p className="font-bold text-sm leading-none">{role.label}</p>
              <p className={`text-[10px] mt-1 leading-tight ${selectedRole === role.id ? 'text-blue-100' : 'text-slate-400'}`}>
                {role.desc}
              </p>
            </button>
          ))}
        </nav>
      </div>

      {/* Right panel: Permission Matrix */}
      <div className="flex-1 p-6 md:p-8 flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-black text-slate-900">
              Permissions for {ROLES.find(r => r.id === selectedRole)?.label}
            </h3>
            <p className="text-xs text-slate-500">Configure access levels to Hub sections dynamically.</p>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-black transition disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : <><Save size={14} /> Save Config</>}
          </button>
        </div>

        {saveStatus === 'success' && (
          <div className="mb-4 p-3 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg text-xs font-bold flex items-center gap-2 animate-in fade-in">
            ✓ Role configurations updated successfully in Firestore!
          </div>
        )}

        {saveStatus === 'error' && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 border border-red-100 rounded-lg text-xs font-bold flex items-center gap-2 animate-in fade-in">
            ✕ Error saving configurations. Check your Firestore connection/rules.
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {Object.keys(SECTION_LABELS).map((sectKey) => {
            const currentPerm = rbacConfig?.permissions?.[selectedRole]?.[sectKey] || 'none';
            return (
              <div
                key={sectKey}
                className="p-3 rounded-lg border border-slate-200 hover:border-slate-300 transition bg-slate-50/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-2">
                  <HelpCircle size={14} className="text-slate-400" />
                  <div>
                    <span className="font-bold text-slate-850 text-xs">{SECTION_LABELS[sectKey]}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {PERM_LEVELS.map((level) => {
                    const active = currentPerm === level.id;
                    return (
                      <button
                        key={level.id}
                        onClick={() => handlePermissionChange(sectKey, level.id)}
                        className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition ${
                          active
                            ? 'bg-slate-900 text-white'
                            : 'bg-white text-slate-550 hover:bg-slate-100 border border-slate-202'
                        }`}
                      >
                        {level.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default RBACSettings;
