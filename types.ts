
export type Section = 'Dashboard' | 'Quotations' | 'Development' | 'Graphics Designing' | 'Sales CRM' | 'Client DB' | 'Notification' | 'Settings' | 'History' | 'Payments';
export type Role = 'admin' | 'employee';
export type Priority = 'Low' | 'Medium' | 'High' | 'Urgent';

export interface Client {
  id: string;
  name: string;
  companyName?: string;
  mobile: string;
  email: string;
  serviceEnquired?: string;
  dateAdded?: string;
  status: 'Active' | 'Inactive';
  source: string;
  sourceCampaign?: string;
  sourceChannel?: string;
  createdAt?: string;
  googleResourceName?: string;
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

  // -- Outbound Specific Fields (DEPRECATED - Moved to separate collections) --
  // These fields shouldn't be used for new outbound flow, keeping for legacy type safety if needed temporarily
  campaignId?: string;
  outboundStatus?: string;
  leadScore?: number;
  nurtureReason?: string;
  outboundStage?: string;
  stageEnteredDate?: string;
  activities?: any[];
}

// --- Outbound Sales Types (NEW SEPARATED LIFECYCLE) ---

export interface Channel {
  id: string;
  name: string;
}

export interface Campaign {
  id: string;
  name: string;
  targetRegion: string;
  serviceId: string;
  channel: string; // Dynamic ID or Name string
  startDate: string;
  endDate: string;
  cost: number;
  status: 'Active' | 'Paused' | 'Completed';
  createdAt: string;
  isArchived?: boolean;
}

export interface ContactMethod {
  type: 'email' | 'phone' | 'instagram' | 'linkedin' | 'whatsapp';
  value: string;
}

export interface ActivityTimelineEntry {
  id: string;
  date: string;
  type: 'status_change' | 'note' | 'stage_move' | 'campaign_added';
  description: string;
  oldValue?: string;
  newValue?: string;
}

export interface CampaignProspect {
  id: string;
  campaignId: string;

  // Optional identifiers
  name?: string; // Legacy/fallback
  contactName?: string;
  companyName?: string;
  projectName?: string; // Legacy
  decisionMakerName?: string;

  // New flexible contact structure
  contactMethods: ContactMethod[];

  // Legacy strict fields (kept optional for backwards compatibility during migration)
  mobile?: string;
  email?: string;

  outboundStatus: 'Not Contacted' | 'Message Sent' | 'Replied' | 'Interested' | 'Not Interested' | 'No Response';
  attemptCount: number;
  lastContactedDate?: string;
  leadScore: number;
  createdAt: string;
  activities: ActivityTimelineEntry[];
}

export interface ActiveDeal {
  id: string;
  campaignId: string;

  // Optional identifiers
  name?: string;
  contactName?: string;
  companyName?: string;
  projectName?: string;
  decisionMakerName?: string;

  // New flexible contact structure
  contactMethods: ContactMethod[];

  mobile?: string;
  email?: string;

  outboundStage: 'New Prospect' | 'Contacted' | 'Qualified' | 'Proposal Sent' | 'Negotiation' | 'Closed Won' | 'Closed Lost';
  stageEnteredAt: string;
  leadScore: number;
  value?: number;
  nextFollowUpDate?: string;
  followUpNotes?: string;
  createdAt: string; // Date it became an active deal
  activities: ActivityTimelineEntry[];
}

export interface NurturedLead {
  id: string;
  campaignId: string;
  name?: string;
  contactName?: string;
  companyName?: string;
  projectName?: string;
  decisionMakerName?: string;
  contactMethods: ContactMethod[];
  mobile?: string;
  email?: string;
  nurtureReason: 'Budget Issue' | 'Wrong Timing' | 'Not Interested' | 'No Response'; // 'Not Interested' & 'No Response' might ideally go to their respective pools based on the prompt, but keeping type flexible
  lastContactedDate?: string;
  nextFollowUpDate?: string;
  createdAt: string;
}

export interface SilentLead {
  id: string;
  campaignId: string;
  name?: string;
  contactName?: string;
  companyName?: string;
  projectName?: string;
  decisionMakerName?: string;
  contactMethods: ContactMethod[];
  mobile?: string;
  email?: string;
  attemptCount: number;
  lastAttemptDate?: string;
  nextRetryDate?: string;
  createdAt: string;
}

export interface CampaignSequence {
  id: string;
  campaignId: string;
  title: string;
  body: string;
  createdAt: string;
}

export interface SuppressedLead {
  id: string;
  campaignId: string;
  name: string;
  mobile: string;
  email: string;
  projectName?: string;
  reason: string; // e.g., 'Not Interested', 'Max Attempts Reached'
  createdAt: string;
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
  linkData?: {
    section: Section;
    tab?: 'dashboard' | 'inbound' | 'outbound';
    prospectId?: string;
  };
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
  department?: string; // e.g. 'Development' or 'Graphics Designing'
}

export interface DynamicField {
  id: string; // Unique identifier for React mapping and deletion
  label: string; // The title (e.g., "Customer Care", "TikTok", "Head Office")
  value: string; // The actual content/URL
}

export interface CompanyProfile {
  companyName: string;
  tagline: string;
  logoUrl?: string;
  contacts: DynamicField[];
  socials: DynamicField[];
}

// --- Quotation Management Types ---

export interface QuotationItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Quotation {
  id: string;
  quotationNumber: string; // e.g. QTN-2026-001
  issueDate: string;
  validityDate: string;
  clientId?: string; // Optional: if existing client
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string; // Optional "To" address
  items: QuotationItem[];
  subtotal: number;
  discount?: number;
  totalAmount: number;
  termsAndConditions: string;
  status: 'Draft' | 'Sent' | 'Approved' | 'Rejected';
  createdAt: string;
  isNewClient: boolean;
}
