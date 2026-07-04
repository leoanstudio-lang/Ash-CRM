
import React from 'react';
import {
  LayoutDashboard,
  Code2,
  Palette,
  Users,
  Database,
  Bell,
  Settings as SettingsIcon,
  History as HistoryIcon,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Wallet,
  Target,
  FileText,
  Video,
  Landmark,
  Megaphone,
  Building2
} from 'lucide-react';
import { Section } from './types';

export const SIDEBAR_ITEMS = [
  { id: 'Execution Center', label: 'Execution Center', icon: <LayoutDashboard size={20} /> },
  { id: 'Strategies', label: 'Strategies', icon: <Target size={20} /> },
  { id: 'Content Studio', label: 'Content Studio', icon: <Video size={20} /> },
  { id: 'Quotations', label: 'Quotations', icon: <FileText size={20} /> },
  { id: 'Development', label: 'Development', icon: <Code2 size={20} /> },
  { id: 'Graphics Designing', label: 'Graphics Designing', icon: <Palette size={20} /> },
  { id: 'Marketing', label: 'Marketing', icon: <Megaphone size={20} /> },
  { id: 'Sales CRM', label: 'Sales CRM', icon: <Users size={20} /> },
  { id: 'Internal Hub', label: 'Internal Hub', icon: <Building2 size={20} /> },
  { id: 'Attendance', label: 'Employee Attendance', icon: <Clock size={20} /> },
  { id: 'Notification', label: 'Notification', icon: <Bell size={20} /> },
  { id: 'Client DB', label: 'Client DB', icon: <Database size={20} /> },
  { id: 'Payments', label: 'Payments', icon: <Wallet size={20} /> },
  { id: 'History', label: 'Work History', icon: <HistoryIcon size={20} /> },
  { id: 'Accounts', label: 'Accounts / Finance', icon: <Landmark size={20} /> },
  { id: 'Settings', label: 'Settings', icon: <SettingsIcon size={20} /> },
] as const;

export const PROJECT_STATUSES = [
  "Pending",
  "Waiting",
  "In Progress",
  "Client Feedback",
  "Testing",
  "Closed",
  "Completed"
];

export const SERVICE_CATEGORIES = [
  "Web Development",
  "Mobile Development",
  "Graphic Designing",
  "Digital Marketing",
  "SEO"
];
