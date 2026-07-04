import React, { useState, useEffect, useMemo } from 'react';
import { Employee, AttendanceRecord, AttendanceSession, AttendanceEditLog, Holiday, AttendanceSettings, CompanyProfile } from '../types';
import { Clock, Calendar, AlertTriangle, CheckCircle, Search, Filter, Plus, Trash2, Settings as SettingsIcon, X, Download, User, Lock, PlusCircle, Building2, Save, History, Edit, AlertCircle, Laptop, ShieldAlert, Monitor, Activity } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { getAttendanceSettings, saveAttendanceSettings } from '../lib/db';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadWatermarkBase64, stampWatermarkAllPages } from '../lib/pdfWatermark';
import { getUserPublicIP } from './Login';

interface AttendanceProps {
  employees: Employee[];
  currentUser: Employee;
}

const Attendance: React.FC<AttendanceProps> = ({ employees, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'LiveMonitor' | 'Dashboard' | 'Holidays' | 'Settings' | 'SystemLogs'>('LiveMonitor');
  
  // Dashboard historic selectors
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(employees[0]?.id || '');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth()); // 0-indexed
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  
  // Database States
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [todayRecords, setTodayRecords] = useState<AttendanceRecord[]>([]);
  const [settings, setSettings] = useState<AttendanceSettings>({
    officialWorkingHours: 8,
    officialStartTime: '09:00',
    lateTrackingEnabled: false,
    lateGracePeriod: 15,
    ipRestrictionEnabled: false,
    approvedIPs: [],
    autoSundayHoliday: true,
    defaultWorkingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
  });

  // Dynamic Live Timer tick
  const [tick, setTick] = useState(0);

  // Search & Filters for Live Monitor
  const [liveSearch, setLiveSearch] = useState('');
  const [liveDeptFilter, setLiveDeptFilter] = useState('All');

  // UI States
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [isSettingsSaving, setIsSettingsSaving] = useState(false);
  const [selectedDayRecord, setSelectedDayRecord] = useState<{
    date: string;
    record: AttendanceRecord | null;
    isHoliday: boolean;
    holidayName?: string;
  } | null>(null);
  
  // Manual edit form states
  const [isEditingSessions, setIsEditingSessions] = useState(false);
  const [editedStatus, setEditedStatus] = useState<'Present' | 'Absent' | 'Holiday'>('Present');
  const [editedNote, setEditedNote] = useState('');
  const [editedSessions, setEditedSessions] = useState<AttendanceSession[]>([]);
  const [editedLateReason, setEditedLateReason] = useState('');
  const [editedLateMinutes, setEditedLateMinutes] = useState<number>(0);

  // New Holiday form states
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayDesc, setNewHolidayDesc] = useState('');
  
  // Settings Form
  const [formApprovedIP, setFormApprovedIP] = useState('');
  const [detectingIP, setDetectingIP] = useState(false);

  // System Disruption Logs States
  const [systemLogs, setSystemLogs] = useState<any[]>([]);
  const [logSearch, setLogSearch] = useState('');
  const [logEmployeeFilter, setLogEmployeeFilter] = useState('All');
  const [logDateFilter, setLogDateFilter] = useState('');

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => current - 3 + i);
  }, []);

  // Tick interval for live timers
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Subscriptions & Initial Loads
  useEffect(() => {
    // Load Settings
    getAttendanceSettings().then(data => {
      if (data) setSettings(data);
    });

    // Load Company Profile
    const loadProfile = async () => {
      const { getCompanyProfile } = await import('../lib/db');
      const profile = await getCompanyProfile();
      if (profile) setCompanyProfile(profile);
    };
    loadProfile();

    // Subscribe to Holidays
    const unsubHolidays = onSnapshot(collection(db, 'holidays'), (snap) => {
      const hList: Holiday[] = [];
      snap.forEach(doc => {
        hList.push({ id: doc.id, ...doc.data() } as Holiday);
      });
      setHolidays(hList.sort((a, b) => a.date.localeCompare(b.date)));
    });

    // Subscribe to all employee attendance records for today (Live Monitor feed)
    const todayYMD = new Date().toISOString().split('T')[0];
    const qToday = query(
      collection(db, 'attendance'),
      where('date', '==', todayYMD)
    );
    const unsubToday = onSnapshot(qToday, (snap) => {
      const recs: AttendanceRecord[] = [];
      snap.forEach(docSnap => {
        recs.push({ id: docSnap.id, ...docSnap.data() } as AttendanceRecord);
      });
      setTodayRecords(recs);
    });

    // Subscribe to System Disruption Logs
    const unsubLogs = onSnapshot(collection(db, 'system_logs'), (snap) => {
      const logs: any[] = [];
      snap.forEach(docSnap => {
        logs.push(docSnap.data());
      });
      setSystemLogs(logs.sort((a, b) => b.reenterTime.localeCompare(a.reenterTime)));
    }, (err) => {
      console.error("Error subscribing to system logs:", err);
    });

    return () => {
      unsubHolidays();
      unsubToday();
      unsubLogs();
    };
  }, []);

  // Subscribe to Attendance Records for selected employee & year/month
  useEffect(() => {
    if (!selectedEmployeeId) return;

    const monthStr = String(selectedMonth + 1).padStart(2, '0');
    const startPattern = `${selectedYear}-${monthStr}-01`;
    const endPattern = `${selectedYear}-${monthStr}-31`;

    const q = query(
      collection(db, 'attendance'),
      where('employeeId', '==', selectedEmployeeId),
      where('date', '>=', startPattern),
      where('date', '<=', endPattern)
    );

    const unsubAttendance = onSnapshot(q, (snap) => {
      const records: AttendanceRecord[] = [];
      snap.forEach(doc => {
        records.push({ id: doc.id, ...doc.data() } as AttendanceRecord);
      });
      setAttendanceRecords(records);
    });

    return () => {
      unsubAttendance();
    };
  }, [selectedEmployeeId, selectedMonth, selectedYear]);

  // Derived Info: Days list in month
  const daysInMonthList = useMemo(() => {
    const date = new Date(selectedYear, selectedMonth, 1);
    const list: Date[] = [];
    while (date.getMonth() === selectedMonth) {
      list.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return list;
  }, [selectedMonth, selectedYear]);

  // Helper: check if a day is weekend
  const isWeekendDay = (date: Date) => {
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    return !settings.defaultWorkingDays.includes(dayName);
  };

  // Helper: check if holiday
  const checkHolidayStatus = (dateStr: string, dayOfWeek: number) => {
    const general = holidays.find(h => h.date === dateStr);
    if (general) return { isHoliday: true, name: general.name };

    if (settings.autoSundayHoliday && dayOfWeek === 0) {
      return { isHoliday: true, name: 'Sunday Weekly Holiday' };
    }

    return { isHoliday: false };
  };

  // Calculation of Summary Stats
  const statistics = useMemo(() => {
    let workingDays = 0;
    let presentDays = 0;
    let absentDays = 0;
    let holidaysCount = 0;
    let totalWorkedMs = 0;
    let expectedMs = 0;
    let overtimeMs = 0;

    const todayYMD = new Date().toISOString().split('T')[0];

    daysInMonthList.forEach(day => {
      const dateStr = day.getFullYear() + '-' + 
                      String(day.getMonth() + 1).padStart(2, '0') + '-' + 
                      String(day.getDate()).padStart(2, '0');
      
      const { isHoliday } = checkHolidayStatus(dateStr, day.getDay());
      const isPast = dateStr < todayYMD;
      const isWeekend = isWeekendDay(day);

      const record = attendanceRecords.find(r => r.date === dateStr);

      if (isHoliday) {
        holidaysCount++;
        if (record && record.status === 'Present') {
          presentDays++;
          totalWorkedMs += record.totalWorkedMs || 0;
        }
      } else if (isWeekend) {
        if (record && record.status === 'Present') {
          presentDays++;
          totalWorkedMs += record.totalWorkedMs || 0;
        }
      } else {
        workingDays++;
        if (record) {
          if (record.status === 'Present') {
            presentDays++;
            totalWorkedMs += record.totalWorkedMs || 0;
            
            const dailyExpectedMs = settings.officialWorkingHours * 60 * 60 * 1000;
            expectedMs += dailyExpectedMs;
            if (record.totalWorkedMs > dailyExpectedMs) {
              overtimeMs += (record.totalWorkedMs - dailyExpectedMs);
            }
          } else if (record.status === 'Absent') {
            absentDays++;
          }
        } else if (isPast) {
          absentDays++;
        }
      }
    });

    const workedHours = totalWorkedMs / (60 * 60 * 1000);
    const expectedHours = expectedMs / (60 * 60 * 1000);
    const overtimeHours = overtimeMs / (60 * 60 * 1000);
    const attendancePercentage = workingDays > 0 ? (presentDays / workingDays) * 100 : 0;

    return {
      workingDays,
      presentDays,
      absentDays,
      holidaysCount,
      workedHours,
      expectedHours,
      overtimeHours,
      attendancePercentage: Math.min(100, Math.round(attendancePercentage))
    };
  }, [daysInMonthList, attendanceRecords, holidays, settings]);

  const selectedEmployee = useMemo(() => {
    return employees.find(e => e.id === selectedEmployeeId);
  }, [employees, selectedEmployeeId]);

  // Live monitor status helper for each employee
  const getEmployeeLiveStatus = (empId: string) => {
    const record = todayRecords.find(r => r.employeeId === empId);
    if (!record || !record.sessions || record.sessions.length === 0) {
      return {
        isOnline: false,
        statusText: 'Offline',
        sessionDetail: 'No check-in logs today',
        totalMs: 0,
        lastLogout: null
      };
    }

    const sessions = record.sessions;
    const activeSession = sessions.find(s => s.logoutTime === null);
    
    let completedMs = 0;
    sessions.forEach(s => {
      if (s.loginTime && s.logoutTime) {
        completedMs += new Date(s.logoutTime).getTime() - new Date(s.loginTime).getTime();
      }
    });

    if (activeSession) {
      const activeStart = new Date(activeSession.loginTime).getTime();
      const elapsedActive = Math.max(0, Date.now() - activeStart);
      return {
        isOnline: true,
        statusText: 'Clocked In',
        sessionDetail: `Online since ${new Date(activeSession.loginTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        totalMs: completedMs + elapsedActive,
        activeStart: activeSession.loginTime,
        ipAddress: activeSession.ipAddress,
        device: activeSession.device
      };
    } else {
      const lastSession = sessions[sessions.length - 1];
      const logoutTimeStr = lastSession.logoutTime 
        ? new Date(lastSession.logoutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
        : '—';
      return {
        isOnline: false,
        statusText: 'Offline',
        sessionDetail: `Clocked out at ${logoutTimeStr}`,
        totalMs: completedMs,
        lastLogout: lastSession.logoutTime
      };
    }
  };

  const formatDurationLive = (ms: number) => {
    if (ms <= 0) return '00h 00m 00s';
    const totalSecs = Math.floor(ms / 1000);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    return `${String(hrs).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
  };

  // Click on a calendar day
  const handleDayClick = (day: Date) => {
    const dateStr = day.getFullYear() + '-' + 
                    String(day.getMonth() + 1).padStart(2, '0') + '-' + 
                    String(day.getDate()).padStart(2, '0');
    
    const holidayCheck = checkHolidayStatus(dateStr, day.getDay());
    const record = attendanceRecords.find(r => r.date === dateStr) || null;

    setSelectedDayRecord({
      date: dateStr,
      record,
      isHoliday: holidayCheck.isHoliday,
      holidayName: holidayCheck.name
    });

    if (record) {
      setEditedStatus(record.status);
      setEditedNote(record.adminNote || '');
      setEditedSessions(record.sessions || []);
      setEditedLateReason(record.lateReason || '');
      setEditedLateMinutes(record.lateMinutes || 0);
    } else {
      setEditedStatus(holidayCheck.isHoliday ? 'Holiday' : 'Absent');
      setEditedNote('');
      setEditedSessions([]);
      setEditedLateReason('');
      setEditedLateMinutes(0);
    }
    setIsEditingSessions(false);
  };

  // Add a manual session row
  const handleAddSessionRow = () => {
    const now = new Date().toISOString();
    setEditedSessions([...editedSessions, {
      loginTime: now,
      logoutTime: now,
      ipAddress: 'Manual Entry',
      device: 'Admin Revision'
    }]);
  };

  // Edit a session row values
  const handleSessionFieldChange = (idx: number, field: 'loginTime' | 'logoutTime', value: string) => {
    const updated = [...editedSessions];
    try {
      const iso = new Date(value).toISOString();
      updated[idx] = {
        ...updated[idx],
        [field]: iso
      };
      setEditedSessions(updated);
    } catch {}
  };

  // Remove a session row
  const handleRemoveSessionRow = (idx: number) => {
    setEditedSessions(editedSessions.filter((_, i) => i !== idx));
  };

  // Save manual attendance revisions
  const handleSaveRevisions = async () => {
    if (!selectedDayRecord || !selectedEmployee) return;

    try {
      const docId = `${selectedEmployee.id}_${selectedDayRecord.date}`;
      const docRef = doc(db, 'attendance', docId);

      let totalMs = 0;
      const formattedSessions = editedSessions.map(s => {
        const login = s.loginTime;
        const logout = s.logoutTime || null;
        if (login && logout) {
          totalMs += new Date(logout).getTime() - new Date(login).getTime();
        }
        return {
          ...s,
          logoutTime: logout
        };
      });

      const logs: AttendanceEditLog[] = [];
      const nowStr = new Date().toISOString();
      
      const record = selectedDayRecord.record;
      if (record) {
        if (record.status !== editedStatus) {
          logs.push({
            field: 'status',
            previousValue: record.status,
            updatedValue: editedStatus,
            editedBy: currentUser.id,
            editedByName: currentUser.name,
            timestamp: nowStr
          });
        }
        if (record.adminNote !== editedNote) {
          logs.push({
            field: 'notes',
            previousValue: record.adminNote || '',
            updatedValue: editedNote,
            editedBy: currentUser.id,
            editedByName: currentUser.name,
            timestamp: nowStr
          });
        }
        logs.push({
          field: 'loginTime',
          previousValue: record.sessions,
          updatedValue: formattedSessions,
          editedBy: currentUser.id,
          editedByName: currentUser.name,
          timestamp: nowStr
        });
      } else {
        logs.push({
          field: 'status',
          previousValue: 'None',
          updatedValue: editedStatus,
          editedBy: currentUser.id,
          editedByName: currentUser.name,
          timestamp: nowStr
        });
      }

      const updatedHistory = [...(record?.editHistory || []), ...logs];

      const savePayload: any = {
        employeeId: selectedEmployee.id,
        employeeName: selectedEmployee.name,
        date: selectedDayRecord.date,
        status: editedStatus,
        sessions: formattedSessions,
        totalWorkedMs: totalMs,
        adminNote: editedNote,
        editHistory: updatedHistory,
        updatedAt: nowStr
      };

      if (editedLateReason) savePayload.lateReason = editedLateReason;
      if (editedLateMinutes > 0) savePayload.lateMinutes = editedLateMinutes;

      await setDoc(docRef, savePayload, { merge: true });

      alert('Revisions committed successfully!');
      setSelectedDayRecord(null);
      setIsEditingSessions(false);
    } catch (err) {
      console.error(err);
      alert('Failed to save manual revisions.');
    }
  };

  // Holiday Managers
  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolidayDate || !newHolidayName) return alert('Date and Name are required.');

    try {
      const hId = `H_${Date.now()}`;
      await setDoc(doc(db, 'holidays', hId), {
        date: newHolidayDate,
        name: newHolidayName,
        description: newHolidayDesc,
        createdAt: new Date().toISOString()
      });
      setNewHolidayDate('');
      setNewHolidayName('');
      setNewHolidayDesc('');
      alert('Holiday registered successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to register holiday.');
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    if (!window.confirm('Delete this holiday from calendar?')) return;
    try {
      await deleteDoc(doc(db, 'holidays', id));
      alert('Holiday deleted.');
    } catch (err) {
      console.error(err);
    }
  };

  // Settings manager
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSettingsSaving(true);
    try {
      await saveAttendanceSettings(settings);
      alert('Attendance rules updated successfully.');
    } catch (err) {
      console.error(err);
      alert('Failed to save settings.');
    } finally {
      setIsSettingsSaving(false);
    }
  };

  const handleAddIP = () => {
    if (!formApprovedIP.trim()) return;
    setSettings({
      ...settings,
      approvedIPs: [...settings.approvedIPs, formApprovedIP.trim()]
    });
    setFormApprovedIP('');
  };

  const handleRemoveIP = (ip: string) => {
    setSettings({
      ...settings,
      approvedIPs: settings.approvedIPs.filter(x => x !== ip)
    });
  };

  const handleDetectIP = async () => {
    setDetectingIP(true);
    try {
      const ip = await getUserPublicIP();
      setFormApprovedIP(ip);
    } catch (err: any) {
      alert(err.message || 'Could not auto-detect IP.');
    } finally {
      setDetectingIP(false);
    }
  };

  // PDF Report Generation (Quotation branded)
  const handleDownloadPDF = async () => {
    if (!selectedEmployee) return;

    const docPdf = new jsPDF();
    const co = companyProfile;

    const deepEclipse: [number, number, number] = [10, 0, 40];
    const textMuted: [number, number, number] = [100, 116, 139];
    const lightGray: [number, number, number] = [226, 232, 240];
    const royalPurple: [number, number, number] = [108, 46, 247];
    const white: [number, number, number] = [255, 255, 255];
    const pageW = docPdf.internal.pageSize.width;

    docPdf.setFillColor(...deepEclipse);
    docPdf.rect(0, 0, pageW, 46, 'F');

    docPdf.setTextColor(...white);
    docPdf.setFont('helvetica', 'bold');
    docPdf.setFontSize(16);
    docPdf.text(co?.companyName || 'Ash Creative Studio', 14, 18);

    let headerY = 23;
    if (co?.tagline) {
      docPdf.setFontSize(8);
      docPdf.setFont('helvetica', 'italic');
      docPdf.setTextColor(200, 190, 230);
      docPdf.text(co.tagline, 14, headerY);
      headerY += 5;
    }

    docPdf.setFontSize(22);
    docPdf.setFont('helvetica', 'bold');
    docPdf.setTextColor(...white);
    docPdf.text('ATTENDANCE REPORT', pageW - 14, 28, { align: 'right' });

    const detailsY = 56;
    docPdf.setFontSize(8.5);
    docPdf.setFont('helvetica', 'bold');
    docPdf.setTextColor(...deepEclipse);
    docPdf.text('Employee:', 14, detailsY);
    docPdf.text('Department:', 75, detailsY);
    docPdf.text('Period:', 135, detailsY);

    docPdf.setFont('helvetica', 'normal');
    docPdf.setTextColor(...textMuted);
    docPdf.text(selectedEmployee.name, 32, detailsY);
    docPdf.text(selectedEmployee.department, 95, detailsY);
    docPdf.text(`${months[selectedMonth]} ${selectedYear}`, 148, detailsY);

    docPdf.setDrawColor(...lightGray);
    docPdf.setLineWidth(0.5);
    docPdf.line(14, detailsY + 5, pageW - 14, detailsY + 5);

    let metricsY = detailsY + 13;
    docPdf.setFontSize(9);
    docPdf.setFont('helvetica', 'bold');
    docPdf.setTextColor(...deepEclipse);
    docPdf.text('SUMMARY METRICS', 14, metricsY);

    docPdf.setFont('helvetica', 'normal');
    docPdf.setFontSize(8);
    metricsY += 6;
    
    docPdf.text(`Working Days: ${statistics.workingDays}`, 14, metricsY);
    docPdf.text(`Present Days: ${statistics.presentDays}`, 60, metricsY);
    docPdf.text(`Absent Days: ${statistics.absentDays}`, 110, metricsY);
    docPdf.text(`Holidays: ${statistics.holidaysCount}`, 155, metricsY);

    metricsY += 5;
    docPdf.text(`Expected Hours: ${statistics.expectedHours.toFixed(1)} h`, 14, metricsY);
    docPdf.text(`Worked Hours: ${statistics.workedHours.toFixed(1)} h`, 60, metricsY);
    docPdf.text(`Overtime Hours: ${statistics.overtimeHours.toFixed(1)} h`, 110, metricsY);
    docPdf.text(`Attendance %: ${statistics.attendancePercentage}%`, 155, metricsY);

    const tableBody = daysInMonthList.map((day, idx) => {
      const dateStr = day.getFullYear() + '-' + 
                      String(day.getMonth() + 1).padStart(2, '0') + '-' + 
                      String(day.getDate()).padStart(2, '0');
      const r = attendanceRecords.find(x => x.date === dateStr);
      const hol = checkHolidayStatus(dateStr, day.getDay());

      let status = 'Scheduled';
      let hours = '0';
      let sessionsCount = '0';
      let firstLogin = '—';
      let lastLogout = '—';
      let notes = '';

      if (r) {
        status = r.status;
        hours = (r.totalWorkedMs / (60 * 60 * 1000)).toFixed(2);
        sessionsCount = String(r.sessions?.length || 0);
        
        if (r.sessions && r.sessions.length > 0) {
          const lTime = r.sessions[0].loginTime;
          firstLogin = lTime ? new Date(lTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
          
          const logout = r.sessions[r.sessions.length - 1].logoutTime;
          lastLogout = logout ? new Date(logout).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
        }
        
        if (r.lateReason) {
          notes = `Late: ${r.lateReason}`;
        } else if (r.adminNote) {
          notes = r.adminNote;
        }
      } else {
        const todayYMD = new Date().toISOString().split('T')[0];
        if (hol.isHoliday) {
          status = 'Holiday';
          notes = hol.name || '';
        } else if (isWeekendDay(day)) {
          status = 'Weekend';
        } else if (dateStr < todayYMD) {
          status = 'Absent';
        }
      }

      return [
        dateStr,
        status,
        sessionsCount,
        firstLogin,
        lastLogout,
        hours,
        notes
      ];
    });

    autoTable(docPdf, {
      startY: metricsY + 8,
      head: [['DATE', 'STATUS', 'SESSIONS', 'FIRST IN', 'LAST OUT', 'WORKED HOURS', 'REMARKS / NOTES']],
      body: tableBody,
      theme: 'plain',
      headStyles: {
        fillColor: [248, 250, 252],
        textColor: textMuted,
        fontStyle: 'bold',
        fontSize: 7.5,
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: deepEclipse,
      },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 18 },
        2: { cellWidth: 16, halign: 'center' },
        3: { cellWidth: 20, halign: 'center' },
        4: { cellWidth: 20, halign: 'center' },
        5: { cellWidth: 25, halign: 'right' },
        6: { cellWidth: 65 }
      },
      margin: { left: 14, right: 14, bottom: 35 },
      didDrawCell: (data) => {
        if (data.row.section === 'body') {
          docPdf.setDrawColor(241, 245, 249);
          docPdf.setLineWidth(0.5);
          docPdf.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
        }
      }
    });

    const watermarkB64 = await loadWatermarkBase64();
    stampWatermarkAllPages(docPdf, watermarkB64);

    const pageCount = docPdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      docPdf.setPage(i);
      const pageH = docPdf.internal.pageSize.height;
      const footerY = pageH - 28;

      docPdf.setDrawColor(...royalPurple);
      docPdf.setLineWidth(0.6);
      docPdf.line(14, footerY, pageW - 14, footerY);

      docPdf.setFontSize(9);
      docPdf.setFont('helvetica', 'bold');
      docPdf.setTextColor(...deepEclipse);
      docPdf.text(co?.companyName || 'Ash Creative Studio', 14, footerY + 8);

      if (co?.tagline) {
        docPdf.setFontSize(7);
        docPdf.setFont('helvetica', 'italic');
        docPdf.setTextColor(...textMuted);
        docPdf.text(co.tagline, 14, footerY + 13);
      }

      if (pageCount > 1) {
        docPdf.setFontSize(8);
        docPdf.setFont('helvetica', 'bold');
        docPdf.setTextColor(...royalPurple);
        docPdf.text(`${i}/${pageCount}`, pageW / 2, footerY + 9, { align: 'center' });
      }
    }

    docPdf.save(`Attendance_Report_${selectedEmployee.name.replace(/\s+/g, '_')}_${months[selectedMonth]}_${selectedYear}.pdf`);
  };

  // Filter employees for Live Monitor grid
  const filteredLiveEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchesSearch = emp.name.toLowerCase().includes(liveSearch.toLowerCase());
      const matchesDept = liveDeptFilter === 'All' || emp.department === liveDeptFilter;
      return matchesSearch && matchesDept;
    });
  }, [employees, liveSearch, liveDeptFilter]);

  // Overall Live Stats
  const liveStatsSummary = useMemo(() => {
    const total = employees.length;
    let onlineCount = 0;
    let lateCount = 0;

    employees.forEach(emp => {
      const status = getEmployeeLiveStatus(emp.id);
      if (status.isOnline) onlineCount++;
      
      const record = todayRecords.find(r => r.employeeId === emp.id);
      if (record && record.lateMinutes) lateCount++;
    });

    return {
      total,
      onlineCount,
      offlineCount: total - onlineCount,
      lateCount
    };
  }, [employees, todayRecords]);

  // Derived state: Filtered system logs
  const filteredSystemLogs = useMemo(() => {
    return systemLogs.filter(log => {
      const matchesSearch = log.employeeName.toLowerCase().includes(logSearch.toLowerCase());
      const matchesEmployee = logEmployeeFilter === 'All' || log.employeeId === logEmployeeFilter;
      const matchesDate = !logDateFilter || log.date === logDateFilter;
      return matchesSearch && matchesEmployee && matchesDate;
    });
  }, [systemLogs, logSearch, logEmployeeFilter, logDateFilter]);

  return (
    <div className="p-6 bg-slate-50/50 min-h-screen text-slate-800 flex flex-col gap-6 w-full overflow-y-auto">
      
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <Clock className="text-blue-600" size={24} /> Employee Attendance Registry
          </h1>
          <p className="text-slate-500 text-xs mt-1">Configure parameters, inspect active timers, and correct records.</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/40 self-start md:self-auto">
          <button
            onClick={() => setActiveTab('LiveMonitor')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
              activeTab === 'LiveMonitor' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/20' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Live Monitor
          </button>
          <button
            onClick={() => setActiveTab('Dashboard')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
              activeTab === 'Dashboard' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/20' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Employee Calendar
          </button>
          <button
            onClick={() => setActiveTab('Holidays')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
              activeTab === 'Holidays' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/20' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Holiday Calendar
          </button>
          <button
            onClick={() => setActiveTab('Settings')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
              activeTab === 'Settings' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/20' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Settings
          </button>
          <button
            onClick={() => setActiveTab('SystemLogs')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
              activeTab === 'SystemLogs' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/20' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Error / System Logs
          </button>
        </div>
      </div>

      {/* ── 1. LIVE MONITOR TAB ── */}
      {activeTab === 'LiveMonitor' && (
        <div className="flex flex-col gap-6">
          
          {/* Real-time Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Workforce</span>
              <h3 className="text-2xl font-black text-slate-900 mt-2">{liveStatsSummary.total} Employees</h3>
              <p className="text-[10px] text-slate-400 mt-1">Registered accounts</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Active Check-ins</span>
              <h3 className="text-2xl font-black text-emerald-600 mt-2 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                {liveStatsSummary.onlineCount} Online
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">Currently clocked in</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Offline Workforce</span>
              <h3 className="text-2xl font-black text-slate-700 mt-2">{liveStatsSummary.offlineCount} Offline</h3>
              <p className="text-[10px] text-slate-400 mt-1">Not clocked in or completed shift</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Late Arrivals</span>
              <h3 className="text-2xl font-black text-amber-600 mt-2">{liveStatsSummary.lateCount} Today</h3>
              <p className="text-[10px] text-slate-400 mt-1">Clocked in after shift grace period</p>
            </div>
          </div>

          {/* Filtering Panel */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative flex-1 group w-full max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={16} />
              <input
                type="text"
                placeholder="Search staff members..."
                className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-2xl outline-none transition-all text-xs font-bold shadow-inner"
                value={liveSearch}
                onChange={e => setLiveSearch(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
              <Filter size={14} className="text-slate-400" />
              <select
                value={liveDeptFilter}
                onChange={e => setLiveDeptFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-600 px-3 py-2 rounded-xl text-xs font-bold outline-none"
              >
                <option value="All">All Departments</option>
                <option value="Development">Development</option>
                <option value="Graphics Designing">Graphics Designing</option>
                <option value="Marketing">Marketing</option>
                <option value="Management">Management</option>
              </select>
            </div>
          </div>

          {/* Employees live status Grid */}
          {filteredLiveEmployees.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-slate-100 shadow-sm text-slate-400 text-sm">
              No matching employees found.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredLiveEmployees.map(emp => {
                const live = getEmployeeLiveStatus(emp.id);

                return (
                  <div key={emp.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col gap-4 relative overflow-hidden group">
                    {/* Top row */}
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm tracking-tight">{emp.name}</h4>
                        <span className="inline-block mt-1 px-2.5 py-0.5 bg-slate-100 text-slate-500 text-[8px] font-black uppercase tracking-wider rounded-md">
                          {emp.department}
                        </span>
                      </div>
                      
                      {/* Online status indicator */}
                      <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 border ${
                        live.isOnline 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                          : 'bg-slate-50 text-slate-500 border-slate-100'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${live.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                        {live.statusText}
                      </span>
                    </div>

                    {/* Middle details */}
                    <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50 flex flex-col gap-2">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-slate-400">Activity:</span>
                        <span className="text-slate-700 font-bold text-right truncate max-w-[180px]">{live.sessionDetail}</span>
                      </div>
                      
                      {live.isOnline && (
                        <>
                          {live.ipAddress && (
                            <div className="flex justify-between text-[10px] border-t border-slate-100 pt-2">
                              <span className="text-slate-400">Connection IP:</span>
                              <span className="text-slate-600 font-mono">{live.ipAddress}</span>
                            </div>
                          )}
                          {live.device && (
                            <div className="flex justify-between text-[10px]">
                              <span className="text-slate-400">Device:</span>
                              <span className="text-slate-500 truncate max-w-[150px]">{live.device}</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Clock Running / Today Accumulated Time */}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                          {live.isOnline ? 'Session Duration' : 'Total Hours Today'}
                        </p>
                        <div className={`mt-1 font-mono font-bold text-sm px-3 py-1.5 rounded-xl border flex items-center gap-1.5 ${
                          live.isOnline 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100 shadow-sm shadow-emerald-500/5' 
                            : 'bg-slate-50 text-slate-500 border-slate-100'
                        }`}>
                          <Clock size={14} className={live.isOnline ? 'animate-spin' : ''} />
                          {formatDurationLive(live.totalMs)}
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedEmployeeId(emp.id);
                          setActiveTab('Dashboard');
                        }}
                        className="bg-slate-50 text-slate-500 hover:bg-blue-600 hover:text-white rounded-xl px-4 py-2 border border-slate-200 text-[9px] font-black uppercase tracking-widest transition-all"
                      >
                        Calendar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 2. EMPLOYEE HISTORIC CALENDAR TAB ── */}
      {activeTab === 'Dashboard' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start animate-in fade-in duration-300">
          
          {/* Side panel */}
          <div className="lg:col-span-1 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col gap-6">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Dashboard Filters</h3>
            
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Staff Member</label>
                <select
                  value={selectedEmployeeId}
                  onChange={e => setSelectedEmployeeId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-700 px-3 py-2.5 rounded-xl text-xs font-bold outline-none"
                >
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.department})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Month</label>
                  <select
                    value={selectedMonth}
                    onChange={e => setSelectedMonth(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-700 px-3 py-2.5 rounded-xl text-xs font-bold outline-none"
                  >
                    {months.map((m, idx) => (
                      <option key={m} value={idx}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Year</label>
                  <select
                    value={selectedYear}
                    onChange={e => setSelectedYear(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-700 px-3 py-2.5 rounded-xl text-xs font-bold outline-none"
                  >
                    {years.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={handleDownloadPDF}
                className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 text-xs"
              >
                <Download size={16} /> Export PDF Report
              </button>
            </div>

            {selectedEmployee && (
              <div className="border-t border-slate-100 pt-4 flex flex-col gap-2 text-[10px]">
                <span className="text-slate-400">Employee ID: <span className="text-slate-700 font-bold">{selectedEmployee.id}</span></span>
                <span className="text-slate-400">Username: <span className="text-slate-700 font-bold">{selectedEmployee.username}</span></span>
                <span className="text-slate-400">Access Role: <span className="text-slate-700 font-bold">{selectedEmployee.role.toUpperCase()}</span></span>
              </div>
            )}
          </div>

          {/* Statistics Grid */}
          <div className="lg:col-span-3 flex flex-col gap-6">
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Attendance Rate</span>
                <h3 className="text-2xl font-black text-slate-900 mt-2">{statistics.attendancePercentage}%</h3>
                <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div className="bg-blue-600 h-full" style={{ width: `${statistics.attendancePercentage}%` }}></div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Present / Absent</span>
                <h3 className="text-2xl font-black text-slate-900 mt-2">
                  <span className="text-emerald-600">{statistics.presentDays}d</span>
                  <span className="text-slate-400 px-1">/</span>
                  <span className="text-rose-600">{statistics.absentDays}d</span>
                </h3>
                <p className="text-[10px] text-slate-400 mt-2">Custom Holidays: {statistics.holidaysCount}d</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Expected / Worked</span>
                <h3 className="text-2xl font-black text-slate-900 mt-2">
                  <span className="text-slate-400">{statistics.expectedHours.toFixed(1)}h</span>
                  <span className="text-slate-400 px-1">/</span>
                  <span className="text-blue-600">{statistics.workedHours.toFixed(1)}h</span>
                </h3>
                <p className="text-[10px] text-slate-400 mt-2">Average: {statistics.presentDays > 0 ? (statistics.workedHours / statistics.presentDays).toFixed(1) : 0}h/day</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Accumulated Overtime</span>
                <h3 className={`text-2xl font-black mt-2 ${statistics.overtimeHours > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                  {statistics.overtimeHours.toFixed(1)} hrs
                </h3>
                <p className="text-[10px] text-slate-400 mt-2">Based on {settings.officialWorkingHours}h baseline</p>
              </div>
            </div>

            {/* Calendar */}
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
                <h2 className="font-bold text-slate-900 text-lg leading-tight">{months[selectedMonth]} {selectedYear} Calendar</h2>
                <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-100 border border-emerald-200"></span> Present</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-100 border border-rose-200"></span> Absent</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-100 border border-amber-200"></span> Holiday</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-4">
                {daysInMonthList.map(day => {
                  const dateStr = day.getFullYear() + '-' + 
                                  String(day.getMonth() + 1).padStart(2, '0') + '-' + 
                                  String(day.getDate()).padStart(2, '0');
                  
                  const holidayCheck = checkHolidayStatus(dateStr, day.getDay());
                  const isWeekend = isWeekendDay(day);
                  const record = attendanceRecords.find(r => r.date === dateStr);
                  
                  const todayYMD = new Date().toISOString().split('T')[0];
                  const isPast = dateStr < todayYMD;

                  let cellStyle = 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100';
                  let statusText = isWeekend ? 'Weekend' : 'Scheduled';
                  let badge = null;

                  if (holidayCheck.isHoliday) {
                    cellStyle = 'bg-amber-50/50 border-amber-200/50 text-amber-700 hover:bg-amber-50';
                    statusText = holidayCheck.name || 'Holiday';
                  }

                  if (record) {
                    if (record.status === 'Present') {
                      const hrs = (record.totalWorkedMs / (60 * 60 * 1000)).toFixed(1);
                      cellStyle = 'bg-emerald-50/60 border-emerald-200/60 text-emerald-800 hover:bg-emerald-50';
                      statusText = `${hrs} hrs worked`;
                      if (record.lateMinutes) {
                        badge = <span className="absolute top-2 right-2 bg-amber-100 text-amber-700 text-[8px] font-black uppercase px-1 rounded border border-amber-200">Late</span>;
                      }
                    } else if (record.status === 'Absent') {
                      cellStyle = 'bg-rose-50/50 border-rose-200/50 text-rose-700 hover:bg-rose-50';
                      statusText = 'Absent';
                    }
                  } else if (isPast && !holidayCheck.isHoliday && !isWeekend) {
                    cellStyle = 'bg-rose-50/50 border-rose-200/50 text-rose-700 hover:bg-rose-50';
                    statusText = 'Absent';
                  }

                  const dayNum = day.getDate();
                  const dayName = day.toLocaleDateString('en-US', { weekday: 'short' });

                  return (
                    <button
                      key={dateStr}
                      onClick={() => handleDayClick(day)}
                      className={`relative flex flex-col p-4 rounded-2xl border text-left cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all min-h-[95px] ${cellStyle}`}
                    >
                      {badge}
                      <span className="text-xl font-black tracking-tight">{dayNum}</span>
                      <span className="text-[9px] font-black uppercase tracking-widest opacity-60 mt-0.5">{dayName}</span>
                      <span className="text-[9px] font-bold mt-auto truncate w-full">{statusText}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. HOLIDAY REGISTRY TAB ── */}
      {activeTab === 'Holidays' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start animate-in fade-in duration-300">
          
          {/* Register Holiday Form */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col gap-6">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <PlusCircle className="text-blue-600" size={18} /> Register New Holiday
            </h3>

            <form onSubmit={handleAddHoliday} className="flex flex-col gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Holiday Date</label>
                <input
                  type="date"
                  required
                  className="w-full bg-slate-50 border border-slate-200 text-slate-700 px-3 py-2.5 rounded-xl text-xs font-bold outline-none"
                  value={newHolidayDate}
                  onChange={e => setNewHolidayDate(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Holiday Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Independence Day"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold outline-none placeholder:text-slate-400"
                  value={newHolidayName}
                  onChange={e => setNewHolidayName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Remarks (Optional)</label>
                <textarea
                  placeholder="Additional context..."
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold outline-none placeholder:text-slate-400 resize-none"
                  value={newHolidayDesc}
                  onChange={e => setNewHolidayDesc(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
              >
                <Plus size={16} /> Save Holiday
              </button>
            </form>
          </div>

          {/* Holidays Calendar List */}
          <div className="lg:col-span-2 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col gap-6">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <Calendar className="text-blue-600" size={18} /> General Holiday Calendar
            </h3>

            {holidays.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs italic">
                No custom holidays registered. Weekly holidays will be automatically derived.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {holidays.map(h => (
                  <div key={h.id} className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-wider">{new Date(h.date).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                      <h4 className="text-sm font-bold text-slate-900 mt-1">{h.name}</h4>
                      {h.description && <p className="text-xs text-slate-500 mt-1">{h.description}</p>}
                    </div>
                    <button
                      onClick={() => handleDeleteHoliday(h.id)}
                      className="text-slate-400 hover:text-red-500 transition-colors p-1"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 4. CONFIGURATION SETTINGS TAB ── */}
      {activeTab === 'Settings' && (
        <form onSubmit={handleSaveSettings} className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start animate-in fade-in duration-300">
          
          {/* Policy Hours */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col gap-6">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <Clock className="text-blue-600" size={18} /> Shift Hours Configuration
            </h3>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Required Shift Hours (Daily)</label>
                <input
                  type="number"
                  min={1}
                  max={24}
                  required
                  className="w-full bg-slate-50 border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold outline-none"
                  value={settings.officialWorkingHours}
                  onChange={e => setSettings({ ...settings, officialWorkingHours: Number(e.target.value) })}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Official Shift Start Time</label>
                <input
                  type="time"
                  required
                  className="w-full bg-slate-50 border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold outline-none"
                  value={settings.officialStartTime}
                  onChange={e => setSettings({ ...settings, officialStartTime: e.target.value })}
                />
              </div>

              <div className="border-t border-slate-100 pt-4 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="text-xs font-bold text-slate-800 uppercase">Late Arrival Tracking</h5>
                    <p className="text-[10px] text-slate-400 mt-0.5">Capture reasons for late sign-ins</p>
                  </div>
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded text-blue-600 bg-slate-50 border-slate-200 focus:ring-blue-500 cursor-pointer"
                    checked={settings.lateTrackingEnabled}
                    onChange={e => setSettings({ ...settings, lateTrackingEnabled: e.target.checked })}
                  />
                </div>

                {settings.lateTrackingEnabled && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Late Grace Period (Minutes)</label>
                    <input
                      type="number"
                      min={0}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold outline-none"
                      value={settings.lateGracePeriod}
                      onChange={e => setSettings({ ...settings, lateGracePeriod: Number(e.target.value) })}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Network restrict */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col gap-6">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <Lock className="text-blue-600" size={18} /> Network Restricting Policies
            </h3>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-bold text-slate-800 uppercase">Lock to Office network IP</h5>
                  <p className="text-[10px] text-slate-400 mt-0.5">Restrict logins to office WiFi/network</p>
                </div>
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded text-blue-600 bg-slate-50 border-slate-200 focus:ring-blue-500 cursor-pointer"
                  checked={settings.ipRestrictionEnabled}
                  onChange={e => setSettings({ ...settings, ipRestrictionEnabled: e.target.checked })}
                />
              </div>

              {settings.ipRestrictionEnabled && (
                <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. 192.168.1.1"
                      className="flex-1 bg-slate-50 border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold outline-none placeholder:text-slate-400"
                      value={formApprovedIP}
                      onChange={e => setFormApprovedIP(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={handleAddIP}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shrink-0 uppercase tracking-widest"
                    >
                      Add
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={detectingIP}
                    onClick={handleDetectIP}
                    className="w-full bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold py-2 px-3 border border-slate-200 rounded-xl text-[9px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all shadow-sm"
                  >
                    {detectingIP ? 'Detecting IP...' : 'Get My Current Public IP'}
                  </button>

                  <div className="flex flex-col gap-2 mt-2">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Approved Network IPs</p>
                    {settings.approvedIPs.length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic">No approved IPs registered. Access will be blocked.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {settings.approvedIPs.map(ip => (
                          <span key={ip} className="bg-slate-50 border border-slate-200 text-slate-600 px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-2">
                            {ip}
                            <button
                              type="button"
                              onClick={() => handleRemoveIP(ip)}
                              className="text-slate-400 hover:text-red-500 transition-colors"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Schedule Calendar */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col gap-6">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <Calendar className="text-blue-600" size={18} /> Schedule Calendar Configurations
            </h3>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-bold text-slate-800 uppercase">Auto Sunday weekly holiday</h5>
                  <p className="text-[10px] text-slate-400 mt-0.5">Defaults Sundays as weekly holidays</p>
                </div>
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded text-blue-600 bg-slate-50 border-slate-200 focus:ring-blue-500 cursor-pointer"
                  checked={settings.autoSundayHoliday}
                  onChange={e => setSettings({ ...settings, autoSundayHoliday: e.target.checked })}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Default Working Days</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
                    const exists = settings.defaultWorkingDays.includes(day);
                    return (
                      <label key={day} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded text-blue-600 bg-slate-50 border-slate-200 focus:ring-blue-500 cursor-pointer"
                          checked={exists}
                          onChange={e => {
                            const list = e.target.checked
                              ? [...settings.defaultWorkingDays, day]
                              : settings.defaultWorkingDays.filter(d => d !== day);
                            setSettings({ ...settings, defaultWorkingDays: list });
                          }}
                        />
                        {day}
                      </label>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSettingsSaving}
                className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
              >
                {isSettingsSaving ? 'Saving...' : (
                  <>Save Policy Configurations <Save size={16} /></>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ── 5. SYSTEM LOGS TAB ── */}
      {activeTab === 'SystemLogs' && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-300">
          {/* Header Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Disruptions</span>
              <h3 className="text-2xl font-black text-slate-900 mt-2">{filteredSystemLogs.length} Events</h3>
              <p className="text-[10px] text-slate-400 mt-1">Logged PC crashes, restarts or network drops</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Staff Tracked</span>
              <h3 className="text-2xl font-black text-blue-600 mt-2">{employees.filter(e => e.role === 'employee').length} Members</h3>
              <p className="text-[10px] text-slate-400 mt-1">Monitored browser sessions</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Heartbeat Status</span>
              <h3 className="text-2xl font-black text-amber-600 mt-2 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></span>
                Active (30s interval)
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">Real-time background check active</p>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative flex-1 group w-full max-w-sm">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={16} />
              <input
                type="text"
                placeholder="Search by employee name..."
                className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-2xl outline-none transition-all text-xs font-bold shadow-inner"
                value={logSearch}
                onChange={e => setLogSearch(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto shrink-0 justify-end">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Staff:</span>
                <select
                  value={logEmployeeFilter}
                  onChange={e => setLogEmployeeFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-600 px-3 py-2 rounded-xl text-xs font-bold outline-none"
                >
                  <option value="All">All Employees</option>
                  {employees.filter(e => e.role === 'employee').map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date:</span>
                <input
                  type="date"
                  value={logDateFilter}
                  onChange={e => setLogDateFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-600 px-3 py-1.5 rounded-xl text-xs font-bold outline-none"
                />
                {logDateFilter && (
                  <button 
                    type="button"
                    onClick={() => setLogDateFilter('')}
                    className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Table List of Logs */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[800px]">
                <thead>
                  <tr className="bg-slate-50/50 text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] border-b border-slate-100">
                    <th className="px-6 py-4">Employee</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Disrupted / Off Time</th>
                    <th className="px-6 py-4">Recovery / Re-enter Time</th>
                    <th className="px-6 py-4">Duration Offline</th>
                    <th className="px-6 py-4">Diagnostic Event</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredSystemLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-xs italic">
                        No system disruption or restart logs recorded for selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredSystemLogs.map((log) => {
                      const off = new Date(log.offTime);
                      const reenter = new Date(log.reenterTime);
                      const diffMs = Math.max(0, reenter.getTime() - off.getTime());
                      
                      const diffMins = Math.floor(diffMs / 60000);
                      const diffSecs = Math.floor((diffMs % 60000) / 1000);
                      const durationStr = diffMins > 0 ? `${diffMins}m ${diffSecs}s` : `${diffSecs}s`;

                      const formatTime = (date: Date) => {
                        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                      };

                      return (
                        <tr key={log.id} className="hover:bg-slate-50/40 transition-colors">
                          <td className="px-6 py-4">
                            <span className="font-bold text-slate-900 text-xs">{log.employeeName}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs text-slate-500 font-medium">{log.date}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs text-slate-700 font-mono">{formatTime(off)}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs text-slate-700 font-mono">{formatTime(reenter)}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 bg-red-50 text-red-700 border border-red-100 rounded text-[10px] font-mono font-bold">
                              {durationStr}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                              <ShieldAlert size={14} className="text-amber-500" /> PC Off / Connection Drop
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Slide-over details modal */}
      {selectedDayRecord && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-slate-950/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white border-l border-slate-100 h-full flex flex-col shadow-2xl relative animate-in slide-in-from-right duration-250">
            
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Detail Activity Log</p>
                <h3 className="text-base font-black text-slate-900 mt-1">
                  {new Date(selectedDayRecord.date).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDayRecord(null)}
                className="text-slate-400 hover:text-slate-900 transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scroll Body */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
              
              {!isEditingSessions ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                      <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider">Attendance Status</span>
                      <p className="text-sm font-bold text-slate-800 mt-1">
                        {selectedDayRecord.record?.status || (selectedDayRecord.isHoliday ? 'Holiday' : 'Absent')}
                      </p>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                      <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider">Hours Worked</span>
                      <p className="text-sm font-bold text-slate-800 mt-1">
                        {selectedDayRecord.record ? ((selectedDayRecord.record.totalWorkedMs || 0) / (60 * 60 * 1000)).toFixed(2) : '0'} hrs
                      </p>
                    </div>
                  </div>

                  {selectedDayRecord.record?.lateMinutes && (
                    <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-start gap-3">
                      <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />
                      <div>
                        <h4 className="text-xs font-black text-amber-700 uppercase tracking-wider">Late Arrival Registered</h4>
                        <p className="text-xs text-slate-600 mt-1">
                          Clocked in <span className="font-bold text-amber-800">{selectedDayRecord.record.lateMinutes} minutes</span> late.
                        </p>
                        {selectedDayRecord.record.lateReason && (
                          <p className="text-xs text-slate-500 mt-1 italic">Reason: "{selectedDayRecord.record.lateReason}"</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Session Logs */}
                  <div>
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Session Activity Loops</h4>
                    {(!selectedDayRecord.record || !selectedDayRecord.record.sessions || selectedDayRecord.record.sessions.length === 0) ? (
                      <p className="text-xs text-slate-400 italic">No check-in session logs recorded for this day.</p>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {selectedDayRecord.record.sessions.map((session, sIdx) => {
                          const loginStr = session.loginTime ? new Date(session.loginTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
                          const logoutStr = session.logoutTime ? new Date(session.logoutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Active Session';
                          
                          let duration = 'Active';
                          if (session.loginTime && session.logoutTime) {
                            const diff = new Date(session.logoutTime).getTime() - new Date(session.loginTime).getTime();
                            const m = Math.floor(diff / 60000);
                            duration = m >= 60 ? `${(m/60).toFixed(1)}h` : `${m}m`;
                          }

                          return (
                            <div key={sIdx} className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex justify-between items-center text-xs">
                              <div>
                                <p className="font-bold text-slate-800">Login: {loginStr}</p>
                                <p className="text-[10px] text-slate-500 mt-1">Logout: {logoutStr}</p>
                                <p className="text-[9px] text-slate-400 mt-0.5">IP: {session.ipAddress} | {session.device}</p>
                              </div>
                              <span className={`px-2.5 py-1 rounded text-[10px] font-bold ${session.logoutTime ? 'bg-slate-200 text-slate-700' : 'bg-blue-100 text-blue-700'}`}>
                                {duration}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {selectedDayRecord.record?.adminNote && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider">Admin Revision Note</span>
                      <p className="text-xs text-slate-600 mt-1">{selectedDayRecord.record.adminNote}</p>
                    </div>
                  )}

                  {/* Audit Logs */}
                  {selectedDayRecord.record?.editHistory && selectedDayRecord.record.editHistory.length > 0 && (
                    <div>
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <History size={14} /> Audit Revision Logs
                      </h4>
                      <div className="flex flex-col gap-2.5">
                        {selectedDayRecord.record.editHistory.map((h, hIdx) => (
                          <div key={hIdx} className="bg-slate-50 p-3 rounded-xl text-[10px] text-slate-500 border border-slate-100">
                            <div className="flex justify-between font-bold text-slate-600 mb-1">
                              <span>Modified by: {h.editedByName}</span>
                              <span>{new Date(h.timestamp).toLocaleDateString()}</span>
                            </div>
                            <p>Field corrected: <span className="text-slate-800 font-bold">"{h.field}"</span></p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => setIsEditingSessions(true)}
                    className="w-full bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold py-3 px-4 rounded-xl border border-slate-200 transition-all text-xs flex items-center justify-center gap-1.5 mt-4 uppercase tracking-widest"
                  >
                    <Edit size={14} /> Correct Attendance Data
                  </button>
                </>
              ) : (
                <div className="flex flex-col gap-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Override Status</label>
                    <select
                      value={editedStatus}
                      onChange={e => setEditedStatus(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-700 px-3 py-2.5 rounded-xl text-xs font-bold outline-none"
                    >
                      <option value="Present">Present</option>
                      <option value="Absent">Absent</option>
                      <option value="Holiday">Holiday</option>
                    </select>
                  </div>

                  {editedStatus === 'Present' && (
                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5">Late Minutes</label>
                        <input
                          type="number"
                          min={0}
                          className="w-full bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs outline-none"
                          value={editedLateMinutes}
                          onChange={e => setEditedLateMinutes(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5">Late Reason</label>
                        <input
                          type="text"
                          className="w-full bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs outline-none"
                          placeholder="e.g. Traffic"
                          value={editedLateReason}
                          onChange={e => setEditedLateReason(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {editedStatus === 'Present' && (
                    <div className="flex flex-col gap-4">
                      <div className="flex justify-between items-center">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Time Cards Sessions</h4>
                        <button
                          type="button"
                          onClick={handleAddSessionRow}
                          className="text-xs text-blue-600 hover:text-blue-500 font-bold flex items-center gap-1"
                        >
                          <Plus size={14} /> Add Row
                        </button>
                      </div>

                      {editedSessions.length === 0 ? (
                        <p className="text-xs text-slate-400 italic text-center py-4 bg-slate-50 rounded-xl border border-slate-100">No sessions. Click Add Row.</p>
                      ) : (
                        <div className="flex flex-col gap-4">
                          {editedSessions.map((session, sIdx) => {
                            const formatIsoForInput = (isoStr: string | null) => {
                              if (!isoStr) return '';
                              const d = new Date(isoStr);
                              const YMD = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
                              const Time = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
                              return `${YMD}T${Time}`;
                            };

                            return (
                              <div key={sIdx} className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex flex-col gap-3 relative">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSessionRow(sIdx)}
                                  className="absolute top-2 right-2 text-slate-400 hover:text-red-500 transition-colors p-1"
                                >
                                  <X size={14} />
                                </button>

                                <div className="grid grid-cols-2 gap-3 text-xs">
                                  <div>
                                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Check In</label>
                                    <input
                                      type="datetime-local"
                                      className="w-full bg-white border border-slate-200 text-slate-700 p-2 rounded"
                                      value={formatIsoForInput(session.loginTime)}
                                      onChange={e => handleSessionFieldChange(sIdx, 'loginTime', e.target.value)}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Check Out</label>
                                    <input
                                      type="datetime-local"
                                      className="w-full bg-white border border-slate-200 text-slate-700 p-2 rounded"
                                      value={formatIsoForInput(session.logoutTime)}
                                      onChange={e => handleSessionFieldChange(sIdx, 'logoutTime', e.target.value)}
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Revision Reason / Note</label>
                    <textarea
                      required
                      placeholder="Explain details of this manual correction for audit compliance..."
                      rows={3}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl focus:border-blue-500 outline-none placeholder:text-slate-400 resize-none text-xs"
                      value={editedNote}
                      onChange={e => setEditedNote(e.target.value)}
                    />
                  </div>

                  <div className="flex gap-4 mt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingSessions(false)}
                      className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold py-2.5 rounded-xl text-xs transition-all border border-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveRevisions}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-md shadow-blue-500/10 uppercase tracking-widest"
                    >
                      Commit Revisions
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendance;
