
export type Section = 'Dashboard' | 'Development' | 'Graphics Designing' | 'Sales CRM' | 'Client DB' | 'Notification' | 'Settings' | 'History' | 'Payments';
export type Role = 'admin' | 'employee';
export type Priority = 'Low' | 'Medium' | 'High' | 'Urgent';

export interface Client {
  id: string;
  name: string;
  companyName: string;
  mobile: string;
  email: string;
  serviceEnquired: string;
  dateAdded: string;
  status: 'Active' | 'Inactive';
}

export interface Project {
  id: string;
  clientId: string;
  serviceId: string;
  type: 'Web' | 'Full Dev' | 'Mobile' | 'Graphic' | 'SEO';
  priority: Priority;
  deadline: string;
  startDate: string;
  createdAt?: string;
  totalAmount: number;
  advance: number;
  receivedAmount?: number; // New field for actual cash received
  description: string;
  status: string; // "Allocated", "Working", "Waiting", "Completed", etc.
  progress: number; // 0 to 100
  assignedEmployeeId?: string;
  clientName?: string; // Denormalized for ease
  serviceName?: string; // Denormalized for ease
  packageId?: string; // Links task to a package (optional)
  packageLineItemIndex?: number; // Which line item in the package this task belongs to
  completedAt?: string; // ISO Date String when status becomes 'Finished'/'Completed'
}

export interface Lead {
  id: string;
  name: string;
  mobile: string;
  email: string;
  projectName: string;
  nextFollowUp: string;
  status: 'Cold' | 'Warm' | 'Hot' | 'Lost' | 'Closed' | 'Lead Today';
  description: string;
  source?: string; // e.g. Meta Ads, Google Ads
  value?: number; // Potential Deal Value
  dateAdded?: string;
  googleResourceName?: string; // ID for Google Contacts sync
}

export interface Employee {
  id: string;
  name: string;
  mobile: string;
  username: string;
  password?: string;
  department: string;
  role: Role;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'alert';
  timestamp: string;
}

export interface Service {
  id: string;
  name: string;
  category: string;
}

// --- Package Management Types ---

export interface PackageLineItem {
  serviceName: string;
  quantity: number;
  completedCount: number;
}

export interface PaymentMilestone {
  label: string;
  percentage: number;
  triggerAtQuantity: number; // Number of completed items that triggers this milestone
  status: 'upcoming' | 'due' | 'received' | 'pending' | 'waiting';
  amountDue: number;
  paidDate?: string;
}

export interface Package {
  id: string;
  clientId: string;
  clientName: string;
  packageName: string;
  period: string; // e.g. "February 2026"
  lineItems: PackageLineItem[];
  totalAmount: number;
  receivedAmount: number;
  paymentMilestones: PaymentMilestone[];
  status: 'active' | 'completed' | 'paused';
  createdAt: string;
  completedAt?: string;
}

export interface PaymentAlert {
  id: string;
  clientId: string;
  clientName: string;
  packageId?: string; // null for standalone tasks
  packageName?: string;
  projectId?: string; // for standalone task payments
  taskName?: string; // for standalone task payments
  milestoneLabel: string;
  amount: number;
  status: 'received' | 'pending' | 'waiting' | 'due';
  triggeredAt: string;
  resolvedAt?: string;
  type: 'package' | 'standalone'; // distinguish package vs standalone payments
}
