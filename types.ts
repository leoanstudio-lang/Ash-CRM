
export type Section = 'Execution Center' | 'Strategies' | 'Quotations' | 'Development' | 'Graphics Designing' | 'Marketing' | 'Sales CRM' | 'Client DB' | 'Notification' | 'Settings' | 'Payments' | 'Content Studio' | 'Accounts' | 'Internal Hub' | 'Attendance' | 'Invoices';
export type Role = 'admin' | 'employee' | 'super_admin' | 'team_lead' | 'dept_manager' | 'hr';
export type Priority = 'Low' | 'Medium' | 'High' | 'Urgent';

export interface TimeLog {
  id: string;
  startTime: string; // ISO String
  endTime?: string; // ISO String
  durationSeconds?: number;
}

export interface ExecutionTask {
  id: string;
  name: string;
  department: string;
  priority: 'High' | 'Medium' | 'Low';
  impactType: 'Revenue' | 'Growth' | 'System' | 'Admin';
  energyType: 'Deep Work' | 'Medium Work' | 'Light Work';
  deadline: string; // ISO string
  estimatedTimeSeconds: number;
  actualTimeSeconds: number;
  status: 'Pending' | 'In Progress' | 'Completed' | 'Ignored';
  notes: string;
  clientId?: string;
  projectId?: string;
  createdAt: string; // ISO string
  timeLogs: TimeLog[];
}

export interface Strategy {
  id: string;
  month: string;
  year: number;
  targetRevenue: number;
  blueprintPdfUrl?: string;
  createdAt: string; // ISO string
}

export interface StrategyTodo {
  id: string;
  strategyId: string;
  text: string;
  isCompleted: boolean;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  companyName?: string;
  mobile: string;
  email: string;
  serviceEnquired?: string;
  dateAdded?: string;
  status: 'Active' | 'Inactive';
  source?: string;
  sourceCampaign?: string;
  sourceChannel?: string;
  createdAt?: string;
  googleResourceName?: string;
}

// --- CONTENT STUDIO TYPES ---

export interface ContentMonth {
  id: string; // e.g. "March-2026"
  month: string;
  year: number;
  targetVideos: number;
  objective: 'Lead Generation' | 'Authority Building' | 'Journey Documentation' | 'Sales Conversion';
  targetLeads: number;
  createdAt: string;
}

export interface ContentCard {
  id: string;
  monthId: string; // Maps to ContentMonth
  title: string;
  hook: string;
  type: 'Educational' | 'Proof' | 'Journey' | 'Sales';
  platform: 'Instagram' | 'LinkedIn' | 'YouTube' | 'Other';
  scriptNotes: string;
  cta: string;
  recordingDate: string;
  postingDate: string;
  status: 'Idea' | 'Scripted' | 'Recorded' | 'Edited' | 'Posted';

  // Business fields
  views?: number;
  comments?: number;
  saves?: number;
  shares?: number;
  leadsGenerated: number;
  convertedClient: 'Yes' | 'No';

  createdAt: string;
}

export interface ContentAsset {
  id: string;
  category: 'Hook' | 'CTA' | 'Caption' | 'Script Format' | 'Topic Idea';
  title: string;
  content: string;
  createdAt: string;
}

export interface ProjectJourneyMilestone {
  id: string;
  date: string;
  title: string;
  desc: string;
  completed: boolean;
}

export interface ProjectNote {
  id: string;
  text: string;
  createdAt: string;
}

export interface MarketingReportEntry {
  id: string;
  date: string;
  content: string;
  submittedBy: string;
  submittedById: string;
  fileName?: string;
}

export interface MarketingServiceAllocation {
  serviceId: string;
  serviceName: string;
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  status: 'Pending' | 'Working' | 'Waiting' | 'Finished';
  report?: string;
  reportsHistory?: MarketingReportEntry[];
  googleDocTabId?: string;
  googleDocTabTitle?: string;
}

export interface GraphicDeliverableLog {
  id: string;
  date: string; // ISO date string
  count: number;
  note?: string;
  fileName?: string;
  fileUrl?: string;
  workLink?: string;
  completedBy: string;
  completedByName?: string;
}

export interface Project {
  id: string;
  clientId: string;
  serviceId: string;
  type: 'Web' | 'Full Dev' | 'Mobile' | 'Graphic' | 'SEO' | 'Marketing';
  priority: Priority;
  deadline: string;
  startDate: string;
  totalAmount: number;
  advance: number;
  receivedAmount?: number; // New field for actual cash received
  description: string;
  status: string; // "Allocated", "Working", "Waiting", "Completed", etc.
  progress: number; // 0 to 100
  createdAt: string;
  completedAt?: string; // ISO Date String when status becomes 'Finished'/'Completed'
  assignedEmployeeId?: string;
  clientName?: string; // Denormalized for ease
  serviceName?: string; // Denormalized for ease
  department?: string; // Department associated with task (e.g., 'Graphics Designing')
  totalDeliverables?: number; // Total item quantity (e.g. 10 posters)
  completedDeliverables?: number; // Completed item quantity (e.g. 4 posters)
  deliverableLogs?: GraphicDeliverableLog[]; // Log of completed items
  packageId?: string; // Links task to a package (optional)
  packageLineItemIndex?: number; // Which line item in the package this task belongs to
  deliveryFileName?: string; // File name / description entered by employee on task completion
  workLink?: string; // Project Drive / Figma / Canva folder URL
  documentation?: string; // Free-form Google Docs style documentation
  notes?: ProjectNote[]; // Keep style notes
  servicesAllocated?: MarketingServiceAllocation[]; // Services allocated for Marketing campaigns
  marketingNotes?: string; // Shared WYSIWYG note document for Marketing campaigns
  googleDocumentId?: string;
  googleDocTitle?: string;
  googleDocLastEdited?: string;
  googleDocOwner?: string;
  googleDocWebLink?: string;
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
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  incentiveStatus?: 'Unpaid' | 'Paid';
  incentiveAmount?: number;

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

export interface Department {
  id: string;
  name: string;
}

export interface Campaign {
  id: string;
  name: string;
  targetRegion: string;
  serviceId?: string;
  channel?: string; // Dynamic ID or Name string
  startDate: string;
  endDate?: string;
  cost?: number;
  status: 'Active' | 'Paused' | 'Completed';
  createdAt: string;
  isArchived?: boolean;
  department?: string; // Which department to route closed deals to (e.g. 'Development', 'Graphics Designing', 'Marketing')
  notes?: string;
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

  outboundStatus: 'Not Contacted' | 'Called' | 'Message Sent' | 'Mailed' | 'Replied' | 'Interested' | 'Not Interested' | 'No Response';
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

  outboundStage: 'New Prospect' | 'Contacted' | 'Qualified' | 'Proposal Sent' | 'Quotation' | 'Negotiation' | 'Closed Won' | 'Closed Lost';
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

export interface CatalogService {
  id: string;
  name: string;
  category: string;
  price: number;
  billingCycle: 'one_time' | 'monthly' | 'yearly';
  description?: string;
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
  packagePeriod?: string; // e.g. "April 2026" — the package's billing period
  projectId?: string; // for standalone task payments
  taskName?: string; // for standalone task payments
  milestoneLabel: string;
  amount: number;
  actualAmount?: number; // Actual cash received (may differ from billed amount)
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
  googleRefreshToken?: string;
  googleClientId?: string;
  googleClientSecret?: string;
}

export interface AIConfig {
  geminiApiKey: string;
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
  status: 'Draft' | 'Sent' | 'Manager Approved' | 'Approved' | 'Rejected';
  createdAt: string;
  isNewClient: boolean;
  isCustomHtml?: boolean;
  customHtmlContent?: string;
  salesDealId?: string; // Optional reference to the Sales Deal it was created from
  salesType?: 'Inbound' | 'Outbound'; // Optional indicator of sales source
  sourceCampaignName?: string; // Optional campaign name context
  salesDealBackup?: any; // Backup of sales deal data for undo/restore
  originalCollection?: string; // Original collection name (e.g. activeDeals, inboundActiveDeals)
  createdClientId?: string; // Auto-created client ID to delete on undo
  createdProjectId?: string; // Auto-created project ID to delete on undo
}
// --- Quotation Demo Types ---

export interface QuotationDemo {
  id: string;
  clientId?: string; // Existing client ID
  clientName: string; // Used if new client
  clientEmail?: string;
  clientPhone?: string;
  serviceId: string;
  serviceName: string; // The type of demo/creative work
  description: string; // Specifics of what the demo requires
  assignedEmployeeId: string;
  allocatedDate: string; // When the employee should do this
  status: 'Pending' | 'Completed' | 'Approved' | 'Rejected'; // Approved means client created
  createdAt: string;
  isNewClient: boolean;
}

// --- Invoice Management Types ---

export interface InvoiceItem {
  serviceName?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string; // e.g. INV-2026-001
  issueDate: string;
  dueDate: string;
  clientId?: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  paymentAlertId?: string; // Linked PaymentAlert ID if created from suggestion
  packageId?: string;
  projectId?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount?: number;
  tax?: number;
  totalAmount: number;
  termsAndConditions: string;
  notes?: string;
  status: 'Draft' | 'Sent' | 'Pending' | 'Received' | 'Cancelled';
  createdAt: string;
  createdBy?: string;
}


// --- Accounting Module Types ---

export type AccountType = 'Revenue' | 'Expense' | 'Asset' | 'Liability' | 'Equity';

export type MoneyInType = 'Sales Revenue' | 'Owner Investment' | 'Loan Received' | 'Client Advance' | 'Other Income';
export type MoneyOutType = 'Operational Expense' | 'Fixed Asset Purchase' | 'Loan Repayment' | 'Owner Withdrawal' | 'Security Deposit' | 'Advance Payment' | 'Other Payment';

export type FinancialAccountType = 'Cash' | 'Petty Cash' | 'Bank' | 'UPI' | 'Credit Card' | 'Payment Gateway' | 'Other';

export interface FinancialAccount {
  id: string;
  accountName: string; // e.g. "Office Cash", "Federal Bank Current Account"
  accountType: FinancialAccountType;
  bankName?: string; // Only if Bank selected
  accountNumber?: string;
  ifscCode?: string;
  openingBalance: number;
  openingBalanceDate: string;
  currentBalance?: number;
  status: 'Active' | 'Inactive';
  isDefault: boolean;
  remarks?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AccountingCategory {
  id: string;
  name: string;
  type: AccountType;
  status: 'Active' | 'Disabled';
  isDefault: boolean;
  createdAt: string;
}

export interface JournalEntryLine {
  accountId: string; // The category or asset/loan id
  accountName: string;
  accountType: AccountType;
  amount: number;
  type: 'DEBIT' | 'CREDIT';
  financialAccountId?: string;
  financialAccountName?: string;
}

export interface JournalEntry {
  id: string;
  date: string;
  type: 'Revenue' | 'Expense' | 'Asset' | 'Loan' | 'Capital' | 'Withdrawal' | 'Deposit';
  subType?: MoneyInType | MoneyOutType;
  referenceId?: string; // e.g. paymentId, to prevent duplicates
  remarks: string;
  entries: JournalEntryLine[];
  createdBy?: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
  isVoided?: boolean;
  periodMonth?: string;
  vendor?: string;
  clientId?: string;
  clientName?: string;
  loanId?: string;
  assetId?: string;
  interestAmount?: number;
  financialAccountId?: string;
  financialAccountName?: string;
}

export interface AccountingAsset {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  purchaseDate: string; // ISO string
  cost: number;
  usefulLifeYears: number;
  paymentMethod: string;
  paymentSource?: 'Cash' | 'Bank' | 'Loan' | 'Credit' | 'Owner Contribution' | 'Opening Balance';
  isOpeningAsset?: boolean;
  vendor?: string;
  status?: 'Active' | 'Disposed' | 'Maintenance';
  journalEntryId?: string;
  remarks?: string;
  createdAt: string;
}

export interface AccountingLoan {
  id: string;
  name: string;
  lender: string;
  source?: 'Bank' | 'Family' | 'Friend' | 'Credit Card' | 'Finance Company' | 'Mother' | 'Brother' | 'Other';
  amount: number;
  interestRate?: number;
  emiAmount?: number;
  remainingBalance: number;
  date: string;
  startDate?: string;
  endDate?: string;
  status?: 'Active' | 'Paid Off';
  journalEntryId?: string;
  isOpeningBalance?: boolean;
  remarks?: string;
  createdAt: string;
}

export type VendorType =
  | 'Landlord'
  | 'Employee'
  | 'Freelancer'
  | 'Consultant'
  | 'Office Supplier'
  | 'Printing'
  | 'Marketing Agency'
  | 'Software Subscription'
  | 'Internet Provider'
  | 'Electricity Provider'
  | 'Finance Company'
  | 'Government'
  | 'Courier'
  | 'Maintenance'
  | 'Miscellaneous'
  | 'Custom';

export interface Vendor {
  id: string;
  name: string;
  vendorType: VendorType | string;
  contactPerson?: string;
  mobile?: string;
  email?: string;
  gstNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  website?: string;
  notes?: string;
  status: 'Active' | 'Inactive' | 'Archived';
  outstandingBalance?: number;
  createdAt: string;
  updatedAt?: string;
}

// --- Manual Task (Employee-Created) ---

export interface ManualTask {
  id: string;
  clientId: string;
  clientName: string;
  companyName?: string;
  description: string;
  priority: Priority;
  status: 'Pending' | 'Working' | 'Waiting' | 'Finished';
  startDate: string;
  finishedDate?: string;
  createdBy: string;
  createdByName: string;
  department: string;
  adminConfirmed: boolean;
  totalAmount?: number;
  advance?: number;
  createdAt: string;
  projectId?: string;
}

export interface EmployeeNotification {
  id: string;
  type: 'manual_task_created';
  manualTaskId: string;
  employeeId: string;
  employeeName: string;
  department: string;
  clientId: string;
  clientName: string;
  companyName?: string;
  description: string;
  priority: Priority;
  status: 'pending_review' | 'confirmed' | 'rejected';
  createdAt: string;
}

// --- INTERNAL HUB TYPES ---

export interface DailyImprovement {
  id: string;
  title: string;
  description: string;
  department: string;
  category: 'Productivity' | 'Quality' | 'Cost Saving' | 'Customer Experience' | 'Automation' | 'Process' | 'Innovation' | 'Documentation';
  businessImpact: string;
  timeSaved: string; // e.g. "30 mins", "2 hours"
  attachments: string[]; // URLs or file names
  submittedBy: string; // Employee ID
  submittedByName: string; // Employee Name
  submittedDate: string; // ISO String
  status: 'Submitted' | 'Under Review' | 'Approved' | 'Implemented' | 'Rejected';
  managerComments?: string;
}

export interface IssueReport {
  id: string;
  title: string;
  description: string;
  department: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  category: 'CRM' | 'Software' | 'Hardware' | 'Internet' | 'Client' | 'Communication' | 'Process' | 'HR' | 'Finance' | 'Operations' | 'Other';
  attachments: string[];
  submittedBy: string;
  submittedByName: string;
  assignedTo?: string; // Employee ID
  assignedToName?: string; // Employee Name
  status: 'Open' | 'Assigned' | 'In Progress' | 'Waiting' | 'Resolved' | 'Closed';
  resolutionNotes?: string;
  createdAt: string; // ISO String
}

export interface Suggestion {
  id: string;
  title: string;
  description: string;
  businessBenefit: string;
  difficulty: 'Low' | 'Medium' | 'High';
  department: string;
  attachments: string[];
  submittedBy: string;
  submittedByName: string;
  status: 'New' | 'Under Review' | 'Approved' | 'Planned' | 'Implemented' | 'Rejected';
  managerFeedback?: string;
  createdAt: string;
}

export interface ProcessImprovement {
  id: string;
  currentProcess: string;
  proposedProcess: string;
  benefits: string;
  timeSaved: string;
  expectedOutcome: string;
  attachments: string[];
  submittedBy: string;
  submittedByName: string;
  createdAt: string;
}

export interface ResourceRequest {
  id: string;
  resourceName: string;
  reason: string;
  priority: 'Low' | 'Medium' | 'High';
  requiredDate: string;
  submittedBy: string;
  submittedByName: string;
  status: 'Pending' | 'Approved' | 'Ordered' | 'Delivered' | 'Rejected';
  managerNotes?: string;
  createdAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  category: 'Event' | 'Holiday' | 'Policy' | 'Introduction' | 'Update' | 'Meeting';
  publishedBy: string;
  publishedById: string;
  date: string; // ISO String
  readBy: string[]; // Array of employee IDs who clicked read
}

export interface KBArticle {
  id: string;
  title: string;
  content: string;
  category: 'Company Policies' | 'Client Guidelines' | 'Branding Standards' | 'CRM Guides' | 'Marketing Guides' | 'Sales Guides' | 'HR Documents';
  tags: string[];
  attachments: string[];
  lastUpdated: string;
  updatedBy: string;
  version: number;
  views: number;
}

export interface SOP {
  id: string;
  title: string;
  department: 'Graphic Design' | 'Digital Marketing' | 'Sales' | 'Accounts' | 'HR' | 'Development';
  content: string; // Step-by-step markdown content
  attachments: string[];
  lastUpdated: string;
  version: number;
}

export interface QuestionAnswer {
  id: string;
  content: string;
  submittedBy: string;
  submittedByName: string;
  createdAt: string;
}

export interface QuestionThread {
  id: string;
  title: string;
  content: string;
  submittedBy: string;
  submittedByName: string;
  tags: string[];
  repliesCount: number;
  acceptedAnswerId?: string; // ID of QuestionAnswer
  answers: QuestionAnswer[];
  createdAt: string;
}

export interface EmployeeRecognition {
  id: string;
  type: 'Team Player' | 'Innovation Award' | 'Best Performer' | 'Fast Delivery' | 'Customer Appreciation' | 'Employee of the Month';
  recipientId: string;
  recipientName: string;
  recognizedBy: string;
  recognizedById: string;
  message: string;
  date: string;
}

export interface TrainingMaterial {
  title: string;
  type: 'video' | 'pdf' | 'presentation' | 'checklist';
  url: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answerIndex: number;
}

export interface TrainingCourse {
  id: string;
  title: string;
  description: string;
  department: string;
  materials: TrainingMaterial[];
  quizzes: QuizQuestion[];
  assignedEmployees: string[]; // IDs
  completedBy: {
    employeeId: string;
    completionDate: string;
    score: number;
  }[];
  dueDate?: string;
  createdAt: string;
}

export interface PollResponse {
  employeeId: string;
  answers: string[]; // selected option values or text
}

export interface Poll {
  id: string;
  question: string;
  options: string[];
  questionType: 'Single Choice' | 'Multiple Choice' | 'Rating' | 'Text Feedback';
  expiresAt: string;
  createdBy: string;
  responses: PollResponse[];
  createdAt: string;
}

export interface HubRBAC {
  permissions: Record<string, Record<string, 'read' | 'write' | 'manage' | 'none'>>;
}

export interface AttendanceSession {
  loginTime: string; // ISO String
  logoutTime: string | null; // ISO String
  ipAddress: string;
  device: string;
  deviceInfo?: string;
  lastPingTime?: string; // ISO String tracking browser heartbeat
}

export interface SystemLog {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  offTime: string; // ISO String
  reenterTime: string; // ISO String
  type: 'disruption';
}

export interface AttendanceEditLog {
  field: 'loginTime' | 'logoutTime' | 'status' | 'notes';
  sessionIdx?: number;
  previousValue: any;
  updatedValue: any;
  editedBy: string;
  editedByName: string;
  timestamp: string; // ISO String
}

export interface AttendanceRecord {
  id: string; // e.g. "employeeId_YYYY-MM-DD"
  employeeId: string;
  employeeName: string;
  date: string; // "YYYY-MM-DD"
  status: 'Present' | 'Absent' | 'Holiday';
  sessions: AttendanceSession[];
  totalWorkedMs: number;
  lateReason?: string | null;
  lateMinutes?: number | null;
  adminNote?: string;
  editHistory: AttendanceEditLog[];
  createdAt: string;
}

export interface Holiday {
  id: string;
  date: string; // "YYYY-MM-DD"
  name: string;
  description?: string;
  createdAt?: string;
}

export interface AttendanceSettings {
  officialWorkingHours: number; // default: 8
  officialStartTime: string; // default: "09:00"
  lateTrackingEnabled: boolean; // default: false
  lateGracePeriod: number; // default: 15 (minutes)
  ipRestrictionEnabled: boolean; // default: false
  approvedIPs: string[]; // array of IPs
  autoSundayHoliday: boolean; // default: true
  defaultWorkingDays: string[]; // e.g. ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
}
