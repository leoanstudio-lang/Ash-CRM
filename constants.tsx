
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
  FileText
} from 'lucide-react';
import { Section } from './types';

export const SIDEBAR_ITEMS = [
  { id: 'Dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
  { id: 'Quotations', label: 'Quotations', icon: <FileText size={20} /> },
  { id: 'Development', label: 'Development', icon: <Code2 size={20} /> },
  { id: 'Graphics Designing', label: 'Graphics Designing', icon: <Palette size={20} /> },
  { id: 'Sales CRM', label: 'Sales CRM', icon: <Users size={20} /> },
  { id: 'Notification', label: 'Notification', icon: <Bell size={20} /> },
  { id: 'Client DB', label: 'Client DB', icon: <Database size={20} /> },
  { id: 'Payments', label: 'Payments', icon: <Wallet size={20} /> },
  { id: 'History', label: 'Work History', icon: <HistoryIcon size={20} /> },
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
