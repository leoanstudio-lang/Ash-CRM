import React, { useState } from 'react';
import { Lead, Client, Service, Campaign, Channel, CampaignSequence } from '../types';
import { Target, Users, Megaphone, Inbox, Search, Filter, Plus, TrendingUp, Calendar, DollarSign, Activity, FileSpreadsheet, Trash2, AlignLeft, Copy, Check, Pencil, X } from 'lucide-react';
import {
  addCampaignToDB,
  deleteCampaignFromDB,
  addCampaignProspectToDB,
  addActiveDealToDB,
  addNurturedLeadToDB,
  addSilentLeadToDB,
  addSuppressedLeadToDB,
  updateCampaignProspectInDB,
  deleteCampaignProspectFromDB,
  updateActiveDealInDB,
  deleteActiveDealFromDB,
  updateNurturedLeadInDB,
  deleteNurturedLeadFromDB,
  updateSilentLeadInDB,
  deleteSilentLeadFromDB,
  addCampaignSequenceToDB,
  updateCampaignSequenceInDB,
  deleteCampaignSequenceFromDB
} from '../lib/db';

interface SalesOutboundProps {
  leads: Lead[];
  setLeads?: React.Dispatch<React.SetStateAction<Lead[]>>;
  setClients?: React.Dispatch<React.SetStateAction<Client[]>>;
  services: Service[];
  campaigns?: Campaign[];
  campaignProspects?: any[];
  campaignSequences?: CampaignSequence[];
  activeDeals?: any[];
  nurturingLeads?: any[];
  noResponseLeads?: any[];
  suppressedLeads?: any[];
  channels?: Channel[];
  autoOpenProspectId?: string | null;
  onClearAutoOpen?: () => void;
}

type OutboundTab = 'overview' | 'campaigns' | 'prospects' | 'nurturing' | 'noResponsePool';

const SalesOutbound: React.FC<SalesOutboundProps> = ({
  leads, setLeads, setClients, services, campaigns = [],
  campaignProspects = [], campaignSequences = [], activeDeals = [], nurturingLeads = [], noResponseLeads = [], suppressedLeads = [], channels = [],
  autoOpenProspectId, onClearAutoOpen
}) => {
  const [activeTab, setActiveTab] = useState<OutboundTab>('overview');
  const [showNewCampaignModal, setShowNewCampaignModal] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<any | null>(null);

  // --- Sequence State ---
  const [showSequenceModal, setShowSequenceModal] = useState(false);
  const [sequenceCampaignId, setSequenceCampaignId] = useState<string | null>(null);
  const [seqForm, setSeqForm] = useState<{ title: string; body: string }>({ title: '', body: '' });
  const [editingSeqId, setEditingSeqId] = useState<string | null>(null);
  const [copiedSeqId, setCopiedSeqId] = useState<string | null>(null);
  const [showSeqAddForm, setShowSeqAddForm] = useState(false);

  // Auto-open effect
  React.useEffect(() => {
    if (autoOpenProspectId) {
      // Search in all relevant outbound lists
      const prospect =
        activeDeals.find(d => d.id === autoOpenProspectId) ||
        campaignProspects.find(p => p.id === autoOpenProspectId) ||
        nurturingLeads.find(l => l.id === autoOpenProspectId) ||
        noResponseLeads.find(l => l.id === autoOpenProspectId);

      if (prospect) {
        setSelectedProspect(prospect);
        // Switch to appropriate tab if needed, but 'prospects' or 'overview' is fine
        if (activeDeals.some(d => d.id === autoOpenProspectId)) setActiveTab('prospects');
        else if (nurturingLeads.some(l => l.id === autoOpenProspectId)) setActiveTab('nurturing');
        else if (noResponseLeads.some(l => l.id === autoOpenProspectId)) setActiveTab('noResponsePool');

        // Clear the trigger after opening
        onClearAutoOpen?.();
      }
    }
  }, [autoOpenProspectId, activeDeals, campaignProspects, nurturingLeads, noResponseLeads]);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [viewNotesProspect, setViewNotesProspect] = useState<any | null>(null);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const copyPhone = (num: string) => { navigator.clipboard.writeText(num); setCopiedPhone(num); setTimeout(() => setCopiedPhone(null), 1500); };
  // Panel stage tracking for inline nurture reason
  const [panelSelectedStage, setPanelSelectedStage] = useState<string>('');
  const [panelNurtureReason, setPanelNurtureReason] = useState<string>('Timing');
  const [showContactEdit, setShowContactEdit] = useState<boolean>(false);
  const [newCampaign, setNewCampaign] = useState<Partial<Campaign>>({
    name: '',
    targetRegion: '',
    serviceId: '',
    channel: 'Email',
    startDate: '',
    endDate: '',
    cost: 0,
    status: 'Active'
  });

  // Flexible CSV Upload States
  const [csvFileToMap, setCsvFileToMap] = useState<{ headers: string[], rows: string[][], campaignId: string } | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());

  const MAPPABLE_FIELDS = [
    { id: 'ignore', label: '-- Ignore Column --' },
    { id: 'contactName', label: 'Contact Name' },
    { id: 'companyName', label: 'Company / Business Name' },
    { id: 'decisionMakerName', label: 'Decision Maker Name' },
    { id: 'email', label: 'Email Address' },
    { id: 'phone', label: 'Phone Number' },
    { id: 'whatsapp', label: 'WhatsApp Number' },
    { id: 'instagram', label: 'Instagram Handle' },
    { id: 'linkedin', label: 'LinkedIn URL' },
    { id: 'notes', label: 'Notes / Custom Info' }
  ];

  // Google Contacts Integration
  const [googleToken, setGoogleToken] = useState<string | null>(null);

  React.useEffect(() => {
    // Initialize Google Client
    import('../lib/googleContacts').then(({ initGoogleClient }) => {
      initGoogleClient((token) => {
        setGoogleToken(token);
      });
    });
  }, []);

  // --- Helper Functions for Flexible Contact Rendering ---
  const getPrimaryContact = (prospect: any): React.ReactNode => {
    if (prospect.contactMethods && prospect.contactMethods.length > 0) {
      const priority = ['instagram', 'linkedin', 'whatsapp', 'email', 'phone']; // Prioritize social handles for display if they exist
      for (const p of priority) {
        const match = prospect.contactMethods.find((m: any) => m.type === p);
        if (match) {
          const val = match.value;
          if (match.type === 'instagram') {
            const cleanVal = val.startsWith('@') ? val.substring(1) : val;
            const url = cleanVal.startsWith('http') ? cleanVal : `https://instagram.com/${cleanVal}`;
            return <a href={url} target="_blank" rel="noreferrer" className="hover:underline inline-flex items-center gap-1">{val} <span className="text-[8px] opacity-70">↗</span></a>;
          }
          if (match.type === 'linkedin') {
            const url = val.startsWith('http') ? val : `https://linkedin.com/in/${val}`;
            return <a href={url} target="_blank" rel="noreferrer" className="hover:underline inline-flex items-center gap-1">{val} <span className="text-[8px] opacity-70">↗</span></a>;
          }
          if (match.type === 'whatsapp') {
            const cleanNum = val.replace(/\D/g, '');
            return <a href={`https://wa.me/${cleanNum}`} target="_blank" rel="noreferrer" className="hover:underline inline-flex items-center gap-1">{val} <span className="text-[8px] opacity-70">↗</span></a>;
          }
          if (match.type === 'email') {
            return <a href={`mailto:${val}`} className="hover:underline inline-flex items-center gap-1">{val} <span className="text-[8px] opacity-70">↗</span></a>;
          }
          if (match.type === 'phone') {
            return <a href={`tel:${val}`} className="hover:underline inline-flex items-center gap-1">{val} <span className="text-[8px] opacity-70">↗</span></a>;
          }
          return val;
        }
      }
      return prospect.contactMethods[0].value;
    }
    return prospect.email || prospect.mobile || 'No Contact Info';
  };

  const getContactIcons = (prospect: any) => {
    if (!prospect.contactMethods) return null;
    return (
      <div className="flex gap-1 mt-1 text-slate-400">
        {prospect.contactMethods.find((m: any) => m.type === 'email') && <span title="Email">📧</span>}
        {prospect.contactMethods.find((m: any) => m.type === 'phone' || m.type === 'whatsapp') && <span title="Phone/WA">📞</span>}
        {prospect.contactMethods.find((m: any) => m.type === 'linkedin') && <span title="LinkedIn">💼</span>}
      </div>
    );
  };

  // --- Sequence Handlers ---
  const openSequenceModal = (campaignId: string) => {
    setSequenceCampaignId(campaignId);
    setShowSequenceModal(true);
    setShowSeqAddForm(false);
    setEditingSeqId(null);
    setSeqForm({ title: '', body: '' });
  };

  const handleAddSequence = async () => {
    if (!seqForm.title.trim() || !seqForm.body.trim() || !sequenceCampaignId) return;
    await addCampaignSequenceToDB({
      campaignId: sequenceCampaignId,
      title: seqForm.title.trim(),
      body: seqForm.body.trim(),
      createdAt: new Date().toISOString()
    });
    setSeqForm({ title: '', body: '' });
    setShowSeqAddForm(false);
  };

  const handleEditSequence = async (seq: CampaignSequence) => {
    if (!seqForm.title.trim() || !seqForm.body.trim()) return;
    await updateCampaignSequenceInDB(seq.id, {
      title: seqForm.title.trim(),
      body: seqForm.body.trim()
    });
    setEditingSeqId(null);
    setSeqForm({ title: '', body: '' });
  };

  const handleDeleteSequence = async (id: string) => {
    if (!window.confirm('Delete this sequence?')) return;
    await deleteCampaignSequenceFromDB(id);
  };

  const handleCopySequence = (seq: CampaignSequence) => {
    navigator.clipboard.writeText(seq.body);
    setCopiedSeqId(seq.id);
    setTimeout(() => setCopiedSeqId(null), 2000);
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampaign.name) return;

    try {
      await addCampaignToDB({
        ...newCampaign,
        cost: Number(newCampaign.cost) || 0,
        createdAt: new Date().toISOString()
      });

      setNewCampaign({
        name: '',
        targetRegion: '',
        serviceId: '',
        channel: 'Email',
        startDate: '',
        endDate: '',
        cost: 0,
        status: 'Active'
      });
      setShowNewCampaignModal(false);
    } catch (error) {
      console.error("Failed to create campaign:", error);
    }
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>, campaignId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Get the campaign's channel so we can map 'Contact ID' correctly
    const campaignChannel = campaigns.find(c => c.id === campaignId)?.channel?.toLowerCase() || 'instagram';
    // Map channel name to our internal contact method type
    const channelToContactType: Record<string, string> = {
      instagram: 'instagram',
      facebook: 'facebook',
      whatsapp: 'whatsapp',
      linkedin: 'linkedin',
      email: 'email',
      twitter: 'twitter',
      tiktok: 'tiktok',
    };
    const contactIdType = channelToContactType[campaignChannel] || campaignChannel;

    // Proper RFC-4180 CSV parser — handles quoted fields that contain commas
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } // escaped quote
          else inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      result.push(current.trim());
      return result;
    };

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r?\n/);
      const headers = parseCSVLine(lines[0]);

      const rows = [];
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const row = parseCSVLine(lines[i]);
        if (row.some(val => val)) rows.push(row);
      }

      setCsvFileToMap({ headers, rows, campaignId });

      // Smart Auto-Mapping - all columns included by default
      const initialMapping: Record<string, string> = {};
      headers.forEach(h => {
        const lowerH = h.toLowerCase();
        // Dynamic: 'contact id' or just 'id' maps to whatever channel the campaign uses
        if (lowerH === 'contact id' || lowerH === 'contactid' || lowerH === 'id') initialMapping[h] = contactIdType;
        else if (lowerH.includes('email')) initialMapping[h] = 'email';
        else if (lowerH.includes('phone') || lowerH.includes('mobile') || lowerH.includes('call')) initialMapping[h] = 'phone';
        else if (lowerH.includes('name') && !lowerH.includes('company')) initialMapping[h] = 'contactName';
        else if (lowerH.includes('company') || lowerH.includes('business')) initialMapping[h] = 'companyName';
        else if (lowerH.includes('insta')) initialMapping[h] = 'instagram';
        else if (lowerH.includes('linkedin')) initialMapping[h] = 'linkedin';
        else if (lowerH.includes('whatsapp')) initialMapping[h] = 'whatsapp';
        else if (lowerH.includes('category') || lowerH.includes('badge') || lowerH.includes('type') || lowerH.includes('segment')) initialMapping[h] = 'category';
        else if (lowerH.includes('potential') || lowerH.includes('priority') || lowerH.includes('chance') || lowerH.includes('score')) initialMapping[h] = 'potential';
        else if (lowerH.includes('note') || lowerH.includes('remark') || lowerH.includes('comment')) initialMapping[h] = 'notes';
        else initialMapping[h] = 'notes'; // Unknown columns stored as notes with their header
      });
      setColumnMapping(initialMapping);

      e.target.value = ''; // clear input
    };
    reader.readAsText(file);
  };

  const processMappedCSV = async () => {
    if (!csvFileToMap) return;
    const { headers, rows, campaignId } = csvFileToMap;

    let importCount = 0;
    let skippedCount = 0;

    for (const row of rows) {
      let contactName = '';
      let companyName = '';
      let decisionMakerName = '';
      let notes = '';
      let categoryBadge = '';
      let potentialBadge = '';
      const contactMethods: any[] = [];

      // Legacy fields
      let legacyEmail = '';
      let legacyPhone = '';

      headers.forEach((header, index) => {
        if (hiddenColumns.has(header)) return; // Completely ignore removed columns

        const value = row[index];
        if (!value) return;

        const mappedType = columnMapping[header] || 'notes';
        if (mappedType === 'ignore') return;

        if (mappedType === 'contactName') contactName = value;
        else if (mappedType === 'companyName') companyName = value;
        else if (mappedType === 'decisionMakerName') decisionMakerName = value;
        else if (mappedType === 'category') categoryBadge = value;
        else if (mappedType === 'potential') potentialBadge = value;
        else if (mappedType === 'notes') {
          // Save as "Header: Value" if the header adds context
          notes += (notes ? ' | ' : '') + `${header}: ${value}`;
        } else if (['email', 'phone', 'instagram', 'linkedin', 'whatsapp', 'facebook', 'twitter', 'tiktok'].includes(mappedType) || true) {
          // All contact method types (including dynamic channel types like facebook, tiktok, etc.)
          contactMethods.push({ type: mappedType, value: value });
          if (mappedType === 'email' && !legacyEmail) legacyEmail = value;
          if ((mappedType === 'phone' || mappedType === 'whatsapp') && !legacyPhone) legacyPhone = value;
        }
      });

      if (contactMethods.length === 0) {
        skippedCount++;
        continue; // Must have at least one contact method
      }

      // Check Duplicates using Priority
      let duplicateProspectId = null;
      let highestPriorityMatch: any = null;

      const priorityOrder = ['email', 'phone', 'whatsapp', 'instagram', 'linkedin', 'facebook', 'twitter', 'tiktok'];

      for (const priorityType of priorityOrder) {
        const methodExists = contactMethods.find(m => m.type === priorityType);
        if (methodExists) {
          const match = campaignProspects.find(p => p.contactMethods?.some((m: any) => m.type === priorityType && m.value === methodExists.value));
          if (match) {
            duplicateProspectId = match.id;
            highestPriorityMatch = methodExists;
            break;
          }
        }
      }

      if (duplicateProspectId) {
        console.log(`Matched existing record using ${highestPriorityMatch?.type}. Skipping duplicate creation.`);
        skippedCount++;
      } else {
        await addCampaignProspectToDB({
          campaignId,
          contactName,
          companyName,
          decisionMakerName,
          categoryBadge,
          potentialBadge,
          notes,
          name: contactName || companyName || 'Unknown Prospect',
          projectName: companyName || '',
          email: legacyEmail || '',
          mobile: legacyPhone || '',
          contactMethods,
          outboundStatus: 'Not Contacted',
          attemptCount: 0,
          leadScore: 0,
          activities: [{
            id: Date.now().toString() + Math.random().toString(),
            type: 'note',
            date: new Date().toISOString(),
            description: `Imported into Campaign.${notes ? ' Notes: ' + notes : ''}`
          }],
          createdAt: new Date().toISOString()
        });
        importCount++;
      }
    }

    setCsvFileToMap(null);
    setHiddenColumns(new Set());
    alert(`Import complete! Loaded ${importCount} prospects. Skipped ${skippedCount} duplicate or empty rows.`);
  };

  const handleDeleteCampaign = async (campaignId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent clicking the row
    if (window.confirm("Are you sure you want to completely delete this campaign and all its uploaded prospects? This action cannot be undone.")) {
      try {
        // Find and delete all associated prospects
        const prospectsToDelete = campaignProspects.filter(p => p.campaignId === campaignId);
        for (const p of prospectsToDelete) {
          await deleteCampaignProspectFromDB(p.id);
        }

        // Delete the campaign itself
        await deleteCampaignFromDB(campaignId);

        if (activeCampaignId === campaignId) {
          setActiveCampaignId(null);
        }

        alert("Campaign successfully deleted.");
      } catch (error) {
        console.error("Failed to delete campaign:", error);
        alert("An error occurred while deleting the campaign.");
      }
    }
  };

  const handleProspectStatusChange = async (prospect: any, newStatus: string) => {
    try {
      if (newStatus === 'Message Sent') {
        await updateCampaignProspectInDB(prospect.id, {
          outboundStatus: 'Message Sent',
          attemptCount: (prospect.attemptCount || 0) + 1,
          lastContactedDate: new Date().toISOString()
        });
      } else if (newStatus === 'Replied') {
        await updateCampaignProspectInDB(prospect.id, {
          outboundStatus: 'Replied',
          leadScore: (prospect.leadScore || 0) + 10
        });
      } else if (newStatus === 'Interested') {
        // Move to Active Deals
        await addActiveDealToDB({
          campaignId: prospect.campaignId,
          name: prospect.name,
          mobile: prospect.mobile,
          email: prospect.email,
          projectName: prospect.projectName,
          outboundStage: 'New Prospect',
          stageEnteredAt: new Date().toISOString(),
          leadScore: (prospect.leadScore || 0) + 20,
          createdAt: new Date().toISOString(),
          activities: prospect.activities || []
        });
        await deleteCampaignProspectFromDB(prospect.id);
      } else if (newStatus === 'Not Now (Nurture)') {
        // Move to Nurturing — destructure 'id' out so it doesn't overwrite the new Firestore doc ID
        const { id: originalId, ...prospectData } = prospect;
        await addNurturedLeadToDB({
          ...prospectData,
          originalProspectId: originalId,
          nurtureReason: 'Timing',
          dateAddedToNurture: new Date().toISOString()
        });
        await deleteCampaignProspectFromDB(prospect.id);
      } else if (newStatus === 'No Response') {
        // Move to Silent Pool — same fix
        const { id: originalId, ...prospectData } = prospect;
        await addSilentLeadToDB({
          ...prospectData,
          originalProspectId: originalId,
          dateAddedToPool: new Date().toISOString()
        });
        await deleteCampaignProspectFromDB(prospect.id);
      } else if (newStatus === 'Not Interested (Suppress)') {
        // Move to Suppression — same fix
        const { id: originalId, ...prospectData } = prospect;
        await addSuppressedLeadToDB({
          ...prospectData,
          originalProspectId: originalId,
          dateSuppressed: new Date().toISOString()
        });
        await deleteCampaignProspectFromDB(prospect.id);
      }
    } catch (err) {
      console.error("Error updating prospect status:", err);
    }
  };

  // --- AUTOMATION RULES & UPDATE LOGIC (FOR ACTIVE DEALS) ---
  const updateDeal = async (dealId: string, updates: Partial<Lead>, actionType: 'stage_move' | 'status_change' | 'note' = 'note', description: string = '') => {
    // Find the currently selected deal. It could be in Active, Nurturing, or No Response pool.
    let deal = activeDeals.find(d => d.id === dealId);
    let sourceCollection: 'active' | 'nurturing' | 'silent' = 'active';

    if (!deal) {
      deal = (nurturingLeads || []).find(l => l.id === dealId);
      sourceCollection = 'nurturing';
    }
    if (!deal) {
      deal = (noResponseLeads || []).find(l => l.id === dealId);
      sourceCollection = 'silent';
    }

    if (!deal) return;

    let updatedDeal = { ...deal, ...updates };
    let newScore = deal.leadScore || 0;
    let newActivity = {
      id: Date.now().toString(),
      type: actionType,
      date: new Date().toISOString(),
      description: description,
      oldValue: '',
      newValue: ''
    };

    // Stage movement logging
    if (updates.outboundStage && updates.outboundStage !== deal.outboundStage) {
      newActivity.description = `Pipeline stage updated to ${updates.outboundStage}`;
      newActivity.oldValue = deal.outboundStage || 'None';
      newActivity.newValue = updates.outboundStage;

      // Bonus points for moving down the pipeline
      if (updates.outboundStage === 'Qualified') newScore += 15;
      if (updates.outboundStage === 'Proposal Sent') newScore += 20;
      if (updates.outboundStage === 'Negotiation') newScore += 10;

      // --- MOVE TO NURTURING ---
      if (updates.outboundStage === 'Nurturing') {
        const { id: originalId, ...dealData } = deal;
        await addNurturedLeadToDB({
          ...dealData,
          originalProspectId: originalId,
          nurtureReason: (updates as any).nurtureReason || 'Timing',
          dateAddedToNurture: new Date().toISOString()
        });
        await deleteActiveDealFromDB(dealId);
        setSelectedProspect(null);
        console.log('Deal moved to Nurturing.');
        return;
      }

      // --- MOVE TO NO RESPONSE POOL (Closed Lost) ---
      if (updates.outboundStage === 'Closed Lost') {
        const { id: originalId, ...dealData } = deal;
        await addSilentLeadToDB({
          ...dealData,
          originalProspectId: originalId,
          lostLead: true,
          lostLeadDate: new Date().toISOString(),
          dateAddedToPool: new Date().toISOString()
        });
        await deleteActiveDealFromDB(dealId);
        setSelectedProspect(null);
        console.log('Deal marked as Lost and moved to No Response Pool.');
        return;
      }

      // --- AUTO-SYNC TO GOOGLE CONTACTS on Proposal Sent / Negotiation (soft save) ---
      if (
        updates.outboundStage === 'Proposal Sent' ||
        updates.outboundStage === 'Negotiation'
      ) {
        if (googleToken) {
          try {
            const { saveContactToGoogle } = await import('../lib/googleContacts');
            await saveContactToGoogle(googleToken, {
              firstName: deal.contactName || deal.name || 'Unknown Prospect',
              email: deal.email || (deal.contactMethods?.find((m: any) => m.type === 'email')?.value) || '',
              phone: deal.mobile || (deal.contactMethods?.find((m: any) => m.type === 'phone' || m.type === 'whatsapp')?.value) || '',
              company: deal.companyName || deal.projectName || 'Unknown',
              jobTitle: updates.outboundStage === 'Proposal Sent' ? 'Prospect (Proposal Sent)' : 'Prospect (Negotiation)'
            });
            newActivity.description += ` — Saved to Google Contacts`;
            console.log(`Auto-synced to Google Contacts at stage: ${updates.outboundStage}`);
          } catch (err) {
            console.warn('Google Contacts soft-sync failed (non-blocking):', err);
            // Non-blocking: continue even if sync fails at these stages
          }
        }
      }

      // --- AUTO-SYNC TO GOOGLE CONTACTS + CLIENT DB ON WON (soft-blocks on Google sync failures, but proceed to Client DB) ---
      if (updates.outboundStage === ('Closed Won' as any)) {
        newActivity.description += " (Auto-saving to Google Contacts & Client DB)";

        let resourceName = '';
        if (googleToken) {
          try {
            const { saveContactToGoogle } = await import('../lib/googleContacts');
            resourceName = await saveContactToGoogle(googleToken, {
              firstName: deal.contactName || deal.name || 'Unknown Prospect',
              email: deal.email || (deal.contactMethods?.find((m: any) => m.type === 'email')?.value) || '',
              phone: deal.mobile || (deal.contactMethods?.find((m: any) => m.type === 'phone' || m.type === 'whatsapp')?.value) || '',
              company: deal.companyName || deal.projectName || 'Unknown',
              jobTitle: 'Client'
            }) || '';
            console.log('Outbound Deal Won! Synced to Google Contacts:', resourceName);
          } catch (error) {
            console.warn('Failed to sync won deal to Google Contacts (non-blocking for Client DB):', error);
          }
        } else {
          console.log("No Google Token available to sync won deal. Proceeding to Client DB only.");
        }

        try {
          const { addClientToDB } = await import('../lib/db');
          await addClientToDB({
            name: deal.contactName || deal.name || getPrimaryContact(deal) || 'Unknown',
            companyName: deal.companyName || deal.projectName || '',
            mobile: deal.mobile || (deal.contactMethods?.find((m: any) => m.type === 'phone' || m.type === 'whatsapp')?.value) || '',
            email: deal.email || (deal.contactMethods?.find((m: any) => m.type === 'email')?.value) || '',
            source: 'Outbound',
            sourceCampaign: campaigns.find(c => c.id === deal.campaignId)?.name || '',
            sourceChannel: campaigns.find(c => c.id === deal.campaignId)?.channel || '',
            status: 'Active',
            createdAt: new Date().toISOString(),
            googleResourceName: resourceName
          });

          // Delete from wherever it was
          if (sourceCollection === 'active') await deleteActiveDealFromDB(dealId);
          else if (sourceCollection === 'nurturing') await deleteNurturedLeadFromDB(dealId);
          else if (sourceCollection === 'silent') await deleteSilentLeadFromDB(dealId);

          setSelectedProspect(null);
          console.log("Deal successfully converted to Client and removed from pipeline.");
          return;
        } catch (dbErr) {
          console.error('Failed to create client in DB:', dbErr);
          alert("Failed to create client entry in DB. Please try again.");
          return;
        }
      }
    }

    updatedDeal.leadScore = newScore;
    updatedDeal.activities = [newActivity, ...(deal.activities || [])];

    // Push the changes to Firebase
    try {
      const finalUpdates = {
        ...updates,
        leadScore: newScore,
        activities: updatedDeal.activities
      };

      // If moving BACK to active pipeline from Nurturing or Silent
      if (
        (sourceCollection === 'nurturing' || sourceCollection === 'silent') &&
        updates.outboundStage &&
        updates.outboundStage !== 'Nurturing' &&
        updates.outboundStage !== 'Closed Lost'
      ) {
        // 1. Add to Active
        await addActiveDealToDB({ ...deal, ...finalUpdates });
        // 2. Delete from Old
        if (sourceCollection === 'nurturing') await deleteNurturedLeadFromDB(dealId);
        else await deleteSilentLeadFromDB(dealId);

        console.log(`Moved lead back to active pipeline from ${sourceCollection}`);
      } else {
        // Just a normal update within the same collection
        if (sourceCollection === 'active') await updateActiveDealInDB(dealId, finalUpdates);
        else if (sourceCollection === 'nurturing') await updateNurturedLeadInDB(dealId, finalUpdates);
        else if (sourceCollection === 'silent') await updateSilentLeadInDB(dealId, finalUpdates);
      }

      console.log("Deal successfully updated in DB.");
    } catch (e) {
      console.error("Error updating deal: ", e);
    }
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (!data || !data.length) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(obj =>
      Object.values(obj).map(val =>
        typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val
      ).join(',')
    ).join('\n');

    const csvContent = `${headers}\n${rows}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* --- DETAILED PROSPECT MODAL --- */}
      {selectedProspect && (() => {
        // Timeline pan state using refs for performance
        const timelineRef = { current: null as HTMLDivElement | null };
        return (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
            <div className="bg-white rounded-[2rem] w-full max-w-6xl h-[88vh] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">

              {/* Panel Header */}
              <div className="px-8 py-5 border-b border-slate-100 flex items-start justify-between bg-slate-50/50 flex-none">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl flex items-center justify-center shadow-lg text-2xl font-black">
                    {(selectedProspect.contactName || selectedProspect.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 text-2xl tracking-tight">{selectedProspect.contactName || selectedProspect.name || 'Unknown Prospect'}</h3>
                    <p className="text-xs font-bold text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                      {(selectedProspect.companyName || selectedProspect.projectName) && (
                        <span className="text-indigo-600">{selectedProspect.companyName || selectedProspect.projectName}</span>
                      )}
                      {selectedProspect.mobile && <><span className="w-1 h-1 rounded-full bg-slate-300"></span><span>{selectedProspect.mobile}</span></>}
                      {selectedProspect.email && <><span className="w-1 h-1 rounded-full bg-slate-300"></span><span>{selectedProspect.email}</span></>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current Stage</p>
                    <span className="inline-flex mt-1 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-black border border-indigo-100">
                      {selectedProspect.outboundStage}
                    </span>
                  </div>
                  <button onClick={() => setSelectedProspect(null)} className="text-slate-400 hover:text-slate-600 font-bold p-2 bg-white rounded-full shadow-sm border border-slate-100 ml-2">✕</button>
                </div>
              </div>

              {/* Panel Body — 50/50 Split */}
              <div className="flex-1 flex overflow-hidden min-h-0">

                {/* LEFT 50% — Info + Follow-up */}
                <div className="w-1/2 flex flex-col overflow-y-auto p-8 gap-5 border-r border-slate-100 bg-slate-50/20">

                  {/* Meta Info Grid */}
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm grid grid-cols-2 gap-5">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Source Campaign</p>
                      <p className="font-bold text-sm text-slate-700 flex items-center gap-2">
                        <Megaphone size={14} className="text-indigo-400" />
                        {campaigns.find(c => c.id === selectedProspect.campaignId)?.name || 'Unknown'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Channel</p>
                      <p className="font-bold text-sm text-slate-700 flex items-center gap-2">
                        <Inbox size={14} className="text-indigo-400" />
                        {campaigns.find(c => c.id === selectedProspect.campaignId)?.channel || '--'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Lead Score</p>
                      <p className={`font-black text-sm flex items-center gap-1 ${(selectedProspect.leadScore || 0) >= 20 ? 'text-amber-600' : 'text-slate-700'}`}>
                        {selectedProspect.leadScore || 0}
                        {(selectedProspect.leadScore || 0) >= 20 && <TrendingUp size={14} />}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Deal Value</p>
                      <p className="font-black text-sm text-emerald-600">
                        {selectedProspect.value ? `₹${selectedProspect.value.toLocaleString()}` : 'Not Set'}
                      </p>
                    </div>
                    {selectedProspect.categoryBadge && (
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Category</p>
                        <span className="px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border bg-purple-50 text-purple-700 border-purple-200">{selectedProspect.categoryBadge}</span>
                      </div>
                    )}
                    {selectedProspect.potentialBadge && (
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Potential</p>
                        <span className="px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border bg-emerald-50 text-emerald-700 border-emerald-200">⚡ {selectedProspect.potentialBadge}</span>
                      </div>
                    )}
                  </div>

                  {/* ── Update Contact Info (Toggle) ── */}
                  <div className="shrink-0 rounded-2xl overflow-hidden" style={{ border: '2px dashed #818cf8', background: '#f5f3ff' }}>
                    <div
                      onClick={() => setShowContactEdit(prev => !prev)}
                      style={{
                        background: showContactEdit ? '#4f46e5' : '#ede9fe',
                        color: showContactEdit ? 'white' : '#4338ca',
                        padding: '12px 20px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontWeight: '900',
                        fontSize: '11px',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        userSelect: 'none'
                      }}
                    >
                      <span>{showContactEdit ? '✕  Cancel' : '✎  Update Contact Info'}</span>
                      <span style={{ fontSize: '9px', opacity: 0.7 }}>Name · Mobile · Email · WhatsApp</span>
                    </div>

                    {showContactEdit && (
                      <form
                        className="p-6 space-y-4"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const form = e.currentTarget;
                          const getName = (n: string) => (form.elements.namedItem(n) as HTMLInputElement).value.trim();
                          const contactName = getName('ci_name');
                          const mobile = getName('ci_mobile');
                          const email = getName('ci_email');
                          const whatsapp = getName('ci_whatsapp');

                          const contactUpdates: any = {};
                          if (contactName) { contactUpdates.contactName = contactName; contactUpdates.name = contactName; }
                          if (mobile) { contactUpdates.mobile = mobile; }
                          if (email) { contactUpdates.email = email; }

                          // Merge/update contactMethods array
                          const existingMethods: any[] = selectedProspect.contactMethods ? [...selectedProspect.contactMethods] : [];
                          const upsertMethod = (type: string, value: string) => {
                            if (!value) return;
                            const idx = existingMethods.findIndex((m: any) => m.type === type);
                            if (idx >= 0) existingMethods[idx] = { type, value };
                            else existingMethods.push({ type, value });
                          };
                          if (mobile) upsertMethod('phone', mobile);
                          if (email) upsertMethod('email', email);
                          if (whatsapp) upsertMethod('whatsapp', whatsapp);
                          contactUpdates.contactMethods = existingMethods;

                          // 1. Save to Firebase
                          try {
                            await updateActiveDealInDB(selectedProspect.id, contactUpdates);
                          } catch (err) {
                            console.error('Failed to update contact info in DB:', err);
                          }

                          // 2. Auto-sync to Google Contacts immediately
                          if (googleToken) {
                            try {
                              const { saveContactToGoogle } = await import('../lib/googleContacts');
                              await saveContactToGoogle(googleToken, {
                                firstName: contactName || selectedProspect.contactName || selectedProspect.name || 'Unknown',
                                email: email || selectedProspect.email || '',
                                phone: mobile || selectedProspect.mobile || '',
                                company: selectedProspect.companyName || selectedProspect.projectName || '',
                                jobTitle: 'Prospect'
                              });
                              console.log('Contact info updated and synced to Google Contacts.');
                            } catch (err) {
                              console.warn('Google sync failed (non-blocking):', err);
                            }
                          }

                          setSelectedProspect({ ...selectedProspect, ...contactUpdates });
                          setShowContactEdit(false);
                        }}
                      >
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Client Name</label>
                            <input name="ci_name" type="text"
                              defaultValue={selectedProspect.contactName || selectedProspect.name || ''}
                              placeholder="e.g. Raj Kumar"
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Mobile Number</label>
                            <input name="ci_mobile" type="tel"
                              defaultValue={selectedProspect.mobile || ''}
                              placeholder="e.g. +91 9876543210"
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Email Address</label>
                            <input name="ci_email" type="email"
                              defaultValue={selectedProspect.email || selectedProspect.contactMethods?.find((m: any) => m.type === 'email')?.value || ''}
                              placeholder="e.g. raj@business.com"
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">WhatsApp Number</label>
                            <input name="ci_whatsapp" type="tel"
                              defaultValue={selectedProspect.contactMethods?.find((m: any) => m.type === 'whatsapp')?.value || ''}
                              placeholder="e.g. +91 9876543210"
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20" />
                          </div>
                        </div>
                        <button type="submit" className="w-full mt-2 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2">
                          ✓ Save &amp; Sync to Google Contacts
                        </button>
                      </form>
                    )}
                  </div>

                  {/* Follow-Up & Notes */}
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex-1">
                    <h4 className="font-black text-slate-800 text-sm tracking-tight mb-5 flex items-center gap-2">
                      <Calendar size={16} className="text-indigo-600" />
                      Follow-Up &amp; Notes
                    </h4>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const nextDate = (form.elements.namedItem('nextFollowUp') as HTMLInputElement).value;
                      const stage = panelSelectedStage || selectedProspect.outboundStage;
                      const note = (form.elements.namedItem('logNote') as HTMLTextAreaElement).value;
                      const updates: Partial<Lead> & { nurtureReason?: string } = {};
                      if (nextDate) updates.nextFollowUp = nextDate;
                      if (stage && stage !== selectedProspect.outboundStage) updates.outboundStage = stage as Lead['outboundStage'];
                      if (stage === 'Nurturing') updates.nurtureReason = panelNurtureReason;
                      if (Object.keys(updates).length > 0 || note.trim()) {
                        const actionType = stage !== selectedProspect.outboundStage ? 'stage_move' : 'note';
                        const desc = note.trim() || (stage === 'Nurturing' ? `Moved to Nurturing: ${panelNurtureReason}` : stage === 'Closed Lost' ? 'Deal marked as Closed Lost.' : 'Details updated via control panel.');
                        updateDeal(selectedProspect.id, updates, actionType, desc);
                        (form.elements.namedItem('logNote') as HTMLTextAreaElement).value = '';
                        if (stage !== 'Nurturing' && stage !== 'Closed Lost') {
                          setSelectedProspect({ ...selectedProspect, ...updates });
                        }
                      }
                    }}>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Next Follow-Up</label>
                          <input type="datetime-local" name="nextFollowUp"
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
                            defaultValue={selectedProspect.nextFollowUp ? new Date(selectedProspect.nextFollowUp).toISOString().slice(0, 16) : ''} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Update Stage</label>
                          <select name="updateStage"
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
                            value={panelSelectedStage || selectedProspect.outboundStage}
                            onChange={(e) => setPanelSelectedStage(e.target.value)}>
                            <option value="New Prospect">New Prospect</option>
                            <option value="Contacted">Contacted</option>
                            <option value="Qualified">Qualified</option>
                            <option value="Proposal Sent">Proposal Sent</option>
                            <option value="Negotiation">Negotiation</option>
                            <option value="Nurturing">🌱 Move to Nurturing</option>
                            <option value="Closed Won">Closed Won</option>
                            <option value="Closed Lost">❌ Closed Lost</option>
                          </select>
                        </div>
                      </div>

                      {/* Inline Nurture Reason — appears only when Nurturing is selected */}
                      {panelSelectedStage === 'Nurturing' && (
                        <div className="space-y-1.5 p-4 bg-emerald-50 border border-emerald-200 rounded-xl mt-1">
                          <label className="block text-[10px] font-black text-emerald-700 uppercase tracking-widest">🌱 Nurture Reason</label>
                          <select
                            value={panelNurtureReason}
                            onChange={(e) => setPanelNurtureReason(e.target.value)}
                            className="w-full p-2.5 bg-white border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 outline-none focus:ring-2 focus:ring-emerald-500/20">
                            <option value="Timing">Wrong Timing — Will revisit later</option>
                            <option value="Budget Issue">Budget Issue — Needs more budget</option>
                            <option value="Knows Price">Knows Price — Just inquiring</option>
                            <option value="Revisit Later">Revisit Later — Follow up in future</option>
                          </select>
                          <p className="text-[9px] text-emerald-600 font-bold mt-1">This prospect will be removed from the pipeline and moved to Nurturing section.</p>
                        </div>
                      )}
                      <div className="space-y-1.5 mt-4">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Log Activity / Note</label>
                        <textarea name="logNote" rows={4}
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
                          placeholder="What did the client say? What happened on the call?" />
                      </div>
                      <button type="submit"
                        className={`w-full mt-4 py-3.5 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg ${panelSelectedStage === 'Nurturing'
                          ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                          : panelSelectedStage === 'Closed Lost'
                            ? 'bg-red-500 hover:bg-red-600 shadow-red-600/20'
                            : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
                          }`}>
                        {panelSelectedStage === 'Nurturing' ? '🌱 Move to Nurturing' :
                          panelSelectedStage === 'Closed Lost' ? '❌ Mark as Closed Lost' :
                            'Save Activity & Updates'}
                      </button>
                    </form>
                  </div>
                </div>

                {/* RIGHT 50% — Activity Timeline (Drag-to-Pan Canvas) */}
                <div className="w-1/2 flex flex-col p-6 bg-white min-h-0">
                  <h4 className="font-black text-slate-800 text-sm tracking-tight mb-4 flex items-center gap-2 flex-none">
                    <Activity size={16} className="text-indigo-600" />
                    Activity Timeline
                    <span className="ml-auto text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      ✋ Drag to explore
                    </span>
                  </h4>

                  {/* Pannable Canvas Container */}
                  <div
                    className="flex-1 rounded-2xl border border-slate-100 bg-slate-50/50 overflow-hidden relative cursor-grab active:cursor-grabbing select-none min-h-0"
                    style={{ userSelect: 'none' }}
                    onMouseDown={(e) => {
                      const container = e.currentTarget;
                      const inner = container.querySelector('.timeline-inner') as HTMLElement;
                      if (!inner) return;
                      const startX = e.clientX - parseInt(inner.style.left || '0');
                      const startY = e.clientY - parseInt(inner.style.top || '0');
                      const onMove = (me: MouseEvent) => {
                        const maxX = 0;
                        const maxY = 0;
                        const minX = Math.min(0, container.clientWidth - inner.scrollWidth - 40);
                        const minY = Math.min(0, container.clientHeight - inner.scrollHeight - 40);
                        const newX = Math.min(maxX, Math.max(minX, me.clientX - startX));
                        const newY = Math.min(maxY, Math.max(minY, me.clientY - startY));
                        inner.style.left = newX + 'px';
                        inner.style.top = newY + 'px';
                      };
                      const onUp = () => {
                        window.removeEventListener('mousemove', onMove);
                        window.removeEventListener('mouseup', onUp);
                      };
                      window.addEventListener('mousemove', onMove);
                      window.addEventListener('mouseup', onUp);
                    }}
                  >
                    {(!selectedProspect.activities || selectedProspect.activities.length === 0) ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <p className="text-xs text-slate-400 font-medium">No activity logged yet.</p>
                      </div>
                    ) : (
                      <div
                        className="timeline-inner absolute p-6"
                        style={{ left: 0, top: 0, position: 'absolute', minWidth: '100%', minHeight: '100%' }}
                      >
                        {/* Vertical line */}
                        <div className="absolute left-10 top-6 bottom-6 w-0.5 bg-gradient-to-b from-transparent via-indigo-200 to-transparent" />
                        <div className="space-y-6 relative">
                          {[...selectedProspect.activities].reverse().map((activity: any) => (
                            <div key={activity.id} className="flex items-start gap-4 pl-2">
                              {/* Icon on the line */}
                              <div className="flex-none w-9 h-9 rounded-full border-4 border-white bg-indigo-100 text-indigo-600 shadow-md flex items-center justify-center z-10 mt-0.5">
                                {activity.type === 'stage_move' ? <Target size={14} /> :
                                  activity.type === 'status_change' ? <Activity size={14} /> :
                                    activity.type === 'campaign_added' ? <Megaphone size={12} /> :
                                      <Inbox size={14} />}
                              </div>
                              {/* Card */}
                              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex-1 min-w-[240px]">
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="font-black text-xs text-slate-800">
                                    {activity.type === 'stage_move' ? 'Stage Updated' :
                                      activity.type === 'status_change' ? 'Status Changed' :
                                        activity.type === 'campaign_added' ? 'Added to Campaign' : 'Note Added'}
                                  </span>
                                  <span className="text-[9px] font-bold text-slate-400 uppercase ml-3 whitespace-nowrap">
                                    {new Date(activity.date).toLocaleDateString('en-GB')}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-600 font-medium leading-relaxed">{activity.description}</p>
                                {activity.oldValue && activity.newValue && (
                                  <p className="text-[10px] mt-2 font-bold bg-slate-50 px-2 py-1 rounded-lg inline-block text-slate-500 border border-slate-200">
                                    <span className="line-through mr-1 opacity-60">{activity.oldValue}</span>
                                    → <span className="text-indigo-600 ml-1">{activity.newValue}</span>
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>
        );
      })()}


      {/* --- SEQUENCE MODAL --- */}
      {showSequenceModal && sequenceCampaignId && (() => {
        const campSequences = campaignSequences
          .filter(s => s.campaignId === sequenceCampaignId)
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); // FIFO: oldest first
        const campName = campaigns.find(c => c.id === sequenceCampaignId)?.name || 'Campaign';

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[88vh] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">

              {/* Modal Header */}
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center shadow-inner">
                    <AlignLeft size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 text-lg tracking-tight">Sequences</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{campName} · {campSequences.length} script{campSequences.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setShowSeqAddForm(true); setEditingSeqId(null); setSeqForm({ title: '', body: '' }); }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20"
                  >
                    <Plus size={14} /> New Sequence
                  </button>
                  <button onClick={() => { setShowSequenceModal(false); setShowSeqAddForm(false); setEditingSeqId(null); }} className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors">
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">

                {/* Add Form */}
                {showSeqAddForm && (
                  <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 space-y-3 shadow-sm">
                    <h4 className="text-xs font-black text-amber-800 uppercase tracking-widest flex items-center gap-2">
                      <Plus size={12} /> New Sequence
                    </h4>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-amber-700 uppercase tracking-widest">Title</label>
                      <input
                        type="text"
                        autoFocus
                        value={seqForm.title}
                        onChange={e => setSeqForm(f => ({ ...f, title: e.target.value }))}
                        placeholder="e.g. First Cold Message"
                        className="w-full px-4 py-2.5 bg-white border border-amber-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-amber-700 uppercase tracking-widest">Message / Script</label>
                      <textarea
                        rows={5}
                        value={seqForm.body}
                        onChange={e => setSeqForm(f => ({ ...f, body: e.target.value }))}
                        placeholder="Type your outreach script here..."
                        className="w-full px-4 py-3 bg-white border border-amber-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 resize-none transition-all"
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setShowSeqAddForm(false)} className="px-4 py-2 text-xs font-black text-slate-500 hover:bg-slate-100 rounded-xl uppercase tracking-widest transition-colors">
                        Cancel
                      </button>
                      <button onClick={handleAddSequence} className="px-5 py-2 bg-amber-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20">
                        Save Sequence
                      </button>
                    </div>
                  </div>
                )}

                {/* Sequence List (FIFO) */}
                {campSequences.length === 0 && !showSeqAddForm && (
                  <div className="py-16 text-center">
                    <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <AlignLeft size={32} className="text-amber-300" />
                    </div>
                    <p className="font-black text-xs uppercase tracking-[0.3em] text-slate-400">No Sequences Yet</p>
                    <p className="text-[10px] text-slate-400 mt-2 font-medium">Click "+ New Sequence" to create your first outreach script.</p>
                  </div>
                )}

                {campSequences.map((seq, idx) => (
                  <div key={seq.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:border-amber-300 transition-colors group">
                    {editingSeqId === seq.id ? (
                      /* Edit Mode */
                      <div className="p-5 space-y-3 bg-indigo-50 border border-indigo-200 rounded-2xl">
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-black text-indigo-700 uppercase tracking-widest">Title</label>
                          <input
                            type="text"
                            autoFocus
                            value={seqForm.title}
                            onChange={e => setSeqForm(f => ({ ...f, title: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-white border border-indigo-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-400/30 transition-all"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-black text-indigo-700 uppercase tracking-widest">Message / Script</label>
                          <textarea
                            rows={5}
                            value={seqForm.body}
                            onChange={e => setSeqForm(f => ({ ...f, body: e.target.value }))}
                            className="w-full px-4 py-3 bg-white border border-indigo-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-400/30 resize-none transition-all"
                          />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => { setEditingSeqId(null); setSeqForm({ title: '', body: '' }); }} className="px-4 py-2 text-xs font-black text-slate-500 hover:bg-slate-100 rounded-xl uppercase tracking-widest transition-colors">
                            Cancel
                          </button>
                          <button onClick={() => handleEditSequence(seq)} className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20">
                            Save Changes
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* View Mode */
                      <>
                        <div className="px-5 pt-4 pb-2 flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="flex-none w-7 h-7 rounded-lg bg-amber-100 text-amber-700 text-xs font-black flex items-center justify-center border border-amber-200">
                              {idx + 1}
                            </span>
                            <h4 className="font-black text-slate-800 text-sm truncate">{seq.title}</h4>
                          </div>
                          <div className="flex items-center gap-1.5 flex-none opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => { setEditingSeqId(seq.id); setSeqForm({ title: seq.title, body: seq.body }); setShowSeqAddForm(false); }}
                              title="Edit"
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteSequence(seq.id)}
                              title="Delete"
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                        <div className="px-5 pb-2">
                          <p className="text-xs text-slate-600 font-medium leading-relaxed whitespace-pre-wrap line-clamp-4">{seq.body}</p>
                        </div>
                        <div className="px-5 pb-4 flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-400">
                            {new Date(seq.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <button
                            onClick={() => handleCopySequence(seq)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${copiedSeqId === seq.id
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                              : 'bg-slate-100 text-slate-600 hover:bg-amber-100 hover:text-amber-700 border border-slate-200 hover:border-amber-300'
                              }`}
                          >
                            {copiedSeqId === seq.id
                              ? <><Check size={11} /> Copied!</>
                              : <><Copy size={11} /> Copy Text</>
                            }
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* --- CSV COLUMN MAPPING MODAL --- */}
      {
        csvFileToMap && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shadow-inner">
                    <FileSpreadsheet size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 text-lg tracking-tight">Review CSV Columns</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Auto-detected · Remove columns you don't need</p>
                  </div>
                </div>
                <button onClick={() => setCsvFileToMap(null)} className="text-slate-400 hover:text-slate-600 font-bold p-2">✕</button>
              </div>

              <div className="p-8 max-h-[60vh] overflow-y-auto">
                <p className="text-sm font-medium text-slate-600 mb-6">
                  Found <span className="font-bold text-slate-800">{csvFileToMap.headers.length}</span> columns and <span className="font-bold text-slate-800">{csvFileToMap.rows.length}</span> prospects.
                  Columns shown in green will be imported. Click <strong>Remove</strong> to skip any column.
                </p>

                <div className="space-y-3">
                  {csvFileToMap.headers.map((header, idx) => {
                    const isHidden = hiddenColumns.has(header);
                    const detectedType = columnMapping[header];

                    // Human-readable label for recognized types only
                    const typeLabels: Record<string, { label: string; color: string }> = {
                      contactName: { label: 'Contact Name', color: 'bg-blue-50 text-blue-700 border-blue-200' },
                      companyName: { label: 'Company Name', color: 'bg-purple-50 text-purple-700 border-purple-200' },
                      decisionMakerName: { label: 'Decision Maker', color: 'bg-violet-50 text-violet-700 border-violet-200' },
                      email: { label: 'Email', color: 'bg-orange-50 text-orange-700 border-orange-200' },
                      phone: { label: 'Phone Number', color: 'bg-green-50 text-green-700 border-green-200' },
                      whatsapp: { label: 'WhatsApp', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                      instagram: { label: 'Instagram Handle', color: 'bg-pink-50 text-pink-700 border-pink-200' },
                      linkedin: { label: 'LinkedIn', color: 'bg-sky-50 text-sky-700 border-sky-200' },
                    };
                    // Only show badge if we recognized this column specifically — otherwise no badge
                    const typeInfo = typeLabels[detectedType] || null;

                    return (
                      <div key={idx} className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${isHidden ? 'bg-slate-50 border-slate-200 opacity-50' : 'bg-white border-slate-200 shadow-sm'
                        }`}>
                        {/* Toggle button */}
                        <button
                          onClick={() => {
                            const newHidden = new Set(hiddenColumns);
                            if (isHidden) newHidden.delete(header);
                            else newHidden.add(header);
                            setHiddenColumns(newHidden);
                          }}
                          className={`flex-none flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-wider transition-all ${isHidden
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-red-50 text-red-500 border-red-200 hover:bg-red-100'
                            }`}
                        >
                          {isHidden ? <><Plus size={11} /> Add</> : <><Trash2 size={11} /> Remove</>}
                        </button>

                        {/* Column info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`text-sm font-black uppercase tracking-wide ${isHidden ? 'text-slate-400 line-through' : 'text-slate-800'
                              }`}>{header}</p>
                            {typeInfo && (
                              <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${typeInfo.color}`}>
                                {typeInfo.label}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] font-medium text-slate-400 mt-0.5 truncate">
                            e.g., {csvFileToMap.rows[0]?.[idx] || '—'}{csvFileToMap.rows[1]?.[idx] ? `, ${csvFileToMap.rows[1]?.[idx]}` : ''}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="px-8 py-5 bg-slate-50/80 border-t border-slate-100 flex justify-between items-center">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  {csvFileToMap.headers.length - hiddenColumns.size} of {csvFileToMap.headers.length} columns will be imported
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setCsvFileToMap(null)}
                    className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={processMappedCSV}
                    className="px-8 py-2.5 bg-emerald-600 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 hover:-translate-y-0.5 transition-all"
                  >
                    Confirm &amp; Import
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* --- NEW CAMPAIGN MODAL --- */}
      {
        showNewCampaignModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shadow-inner">
                    <Megaphone size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 text-lg tracking-tight">Launch New Campaign</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Outreach Setup</p>
                  </div>
                </div>
                <button onClick={() => setShowNewCampaignModal(false)} className="text-slate-400 hover:text-slate-600 font-bold p-2">✕</button>
              </div>

              <div className="p-8">
                <form onSubmit={handleCreateCampaign} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Campaign Name</label>
                      <input type="text" className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        value={newCampaign.name} onChange={e => setNewCampaign({ ...newCampaign, name: e.target.value })} required placeholder="e.g. Q1 UAE SEO Push" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Region</label>
                      <input type="text" className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        value={newCampaign.targetRegion} onChange={e => setNewCampaign({ ...newCampaign, targetRegion: e.target.value })} required placeholder="e.g. Dubai, UAE" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Promoted Service</label>
                      <select className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer"
                        value={newCampaign.serviceId} onChange={e => setNewCampaign({ ...newCampaign, serviceId: e.target.value })} required>
                        <option value="">Select Service</option>
                        {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Outreach Channel</label>
                      <select className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer"
                        value={newCampaign.channel} onChange={e => setNewCampaign({ ...newCampaign, channel: e.target.value })} required>
                        {channels.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        {channels.length === 0 && <option value="Email">Email (Default)</option>}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Start Date</label>
                      <input type="date" className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        value={newCampaign.startDate} onChange={e => setNewCampaign({ ...newCampaign, startDate: e.target.value })} required />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">End Date</label>
                      <input type="date" className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        value={newCampaign.endDate} onChange={e => setNewCampaign({ ...newCampaign, endDate: e.target.value })} required />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Campaign Budget / Cost (₹)</label>
                      <div className="relative">
                        <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="number" min="0" className="w-full p-3 pl-8 border border-slate-200 rounded-xl bg-slate-50 font-bold text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                          value={newCampaign.cost} onChange={e => setNewCampaign({ ...newCampaign, cost: Number(e.target.value) })} required />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-6 mt-6 border-t border-slate-100">
                    <button type="button" onClick={() => setShowNewCampaignModal(false)} className="flex-1 py-3.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all">
                      Cancel
                    </button>
                    <button type="submit" className="flex-[2] py-3.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20">
                      Launch Campaign
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )
      }

      {/* Outbound Top Navigation (Internal) */}
      {(() => {
        const tabOverviewCount = (activeDeals || []).length;
        const tabCampaignsCount = (campaigns || []).filter((c: any) => c.status === 'Active').length;
        const tabNegotiationCount = (activeDeals || []).filter((d: any) => d.outboundStage === 'Negotiation').length;
        const tabNurturingCount = (nurturingLeads || []).length;
        const tabNoResponseCount = (noResponseLeads || []).length;

        const Badge = ({ count, color = 'indigo' }: { count: number; color?: string }) => count > 0 ? (
          <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-black flex items-center justify-center leading-none ${color === 'red' ? 'bg-red-500 text-white' :
            color === 'emerald' ? 'bg-emerald-500 text-white' :
              color === 'amber' ? 'bg-amber-500 text-white' :
                'bg-indigo-500 text-white'
            }`}>{count}</span>
        ) : null;

        return (
          <div className="flex p-1.5 bg-slate-100 rounded-2xl w-fit">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${activeTab === 'overview'
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/60'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
            >
              <Activity size={14} />
              Overview
              <Badge count={tabOverviewCount} />
            </button>
            <button
              onClick={() => setActiveTab('campaigns')}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${activeTab === 'campaigns'
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/60'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
            >
              <Megaphone size={14} />
              Campaigns
              <Badge count={tabCampaignsCount} color="amber" />
            </button>
            <button
              onClick={() => setActiveTab('prospects')}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${activeTab === 'prospects'
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/60'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
            >
              <Target size={14} />
              Prospects
              <Badge count={tabNegotiationCount} color="amber" />
            </button>
            <button
              onClick={() => setActiveTab('nurturing')}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${activeTab === 'nurturing'
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/60'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
            >
              <Inbox size={14} />
              Nurturing
              <Badge count={tabNurturingCount} color="emerald" />
            </button>
            <button
              onClick={() => setActiveTab('noResponsePool')}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${activeTab === 'noResponsePool'
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/60'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
            >
              <Target size={14} />
              No Response Pool
              <Badge count={tabNoResponseCount} color="red" />
            </button>
          </div>
        );
      })()}

      {/* Tab Content Areas */}
      <div className="animate-in fade-in duration-300">

        {/* --- OVERVIEW TAB --- */}
        {activeTab === 'overview' && (() => {
          // KPI Calculations mapping over new databases
          const totalProspects = (campaignProspects || []).length;
          const activeDealsCount = (activeDeals || []).filter(l => l.outboundStage !== 'Closed Won' && l.outboundStage !== 'Closed Lost').length;
          const inNurturingCount = (nurturingLeads || []).length;
          const closedWonCount = (activeDeals || []).filter(l => l.outboundStage === 'Closed Won').length;

          return (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xl flex items-center gap-4 animate-in slide-in-from-bottom-2 duration-300">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
                    <Users size={20} />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-slate-800">{totalProspects}</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Prospects</p>
                  </div>
                </div>
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xl flex items-center gap-4 animate-in slide-in-from-bottom-3 duration-300">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
                    <Target size={20} />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-slate-800">{activeDealsCount}</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Active Deals</p>
                  </div>
                </div>
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xl flex items-center gap-4 animate-in slide-in-from-bottom-4 duration-300">
                  <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shadow-inner">
                    <Inbox size={20} />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-slate-800">{inNurturingCount}</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">In Nurturing</p>
                  </div>
                </div>
                <div className="bg-slate-900 rounded-3xl p-6 shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-5 duration-300">
                  <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center shadow-inner">
                    <TrendingUp size={20} />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-white">{closedWonCount}</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Closed Won</p>
                  </div>
                </div>
              </div>

              {/* Global Filters */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Filter size={16} className="text-slate-400" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">Global Overview Filters</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 ring-indigo-500/20 transition-all cursor-pointer">
                    <option value="all">All Campaigns</option>
                    {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 ring-indigo-500/20 transition-all cursor-pointer">
                    <option value="all">All Channels</option>
                    <option value="Email">Email</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="LinkedIn">LinkedIn</option>
                    <option value="Facebook">Facebook</option>
                  </select>
                  <input type="date" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 ring-indigo-500/20 transition-all cursor-pointer" />
                  <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 ring-indigo-500/20 transition-all cursor-pointer">
                    <option value="all">All Statuses</option>
                    <option value="Active">Active</option>
                    <option value="Paused">Paused</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>
            </div>
          );
        })()}

        {/* --- CAMPAIGNS TAB --- */}
        {activeTab === 'campaigns' && (
          <div className="space-y-6">
            {!activeCampaignId ? (
              <>
                <div className="flex items-center justify-between bg-white rounded-3xl p-6 border border-slate-100 shadow-xl">
                  <div>
                    <h2 className="text-xl font-black text-slate-800 tracking-tight mb-1">Outreach Management</h2>
                    <p className="text-xs text-slate-500 font-medium">Create and monitor outbound campaigns and their ROI.</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => exportToCSV(
                        campaigns.map(c => {
                          const campProps = campaignProspects.filter(p => p.campaignId === c.id);
                          const campDeals = activeDeals.filter(d => d.campaignId === c.id);
                          const campNurturing = nurturingLeads.filter(n => n.campaignId === c.id);
                          const campNoResp = noResponseLeads.filter(r => r.campaignId === c.id);
                          const campSuppr = suppressedLeads.filter(s => s.campaignId === c.id);

                          const totalCampProspects = campProps.length + campDeals.length + campNurturing.length + campNoResp.length + campSuppr.length;
                          const interested = campDeals.length;
                          const converted = campDeals.filter(l => l.outboundStage === 'Closed Won').length;
                          const revenue = campDeals.filter(l => l.outboundStage === 'Closed Won').reduce((sum, l) => sum + (l.value || 0), 0);

                          return {
                            Campaign: c.name,
                            Channel: c.channel,
                            Region: c.targetRegion,
                            Status: c.status,
                            Prospects: totalCampProspects,
                            'Interested': interested,
                            'Converted': converted,
                            Cost: c.cost,
                            Revenue: revenue,
                            'ROI %': c.cost > 0 ? (((revenue - c.cost) / c.cost) * 100).toFixed(1) : 0
                          };
                        }),
                        'campaigns_performance'
                      )}
                      className="flex items-center gap-2 px-5 py-3 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-100 border border-emerald-200 transition-all shadow-lg shadow-emerald-600/10"
                    >
                      <FileSpreadsheet size={16} />
                      Export
                    </button>
                    <button
                      onClick={() => setShowNewCampaignModal(true)}
                      className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
                    >
                      <Plus size={16} />
                      New Campaign
                    </button>
                  </div>
                </div>

                {/* Campaign List Placeholder */}
                {campaigns.length === 0 ? (
                  <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl py-24 text-center">
                    <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Megaphone size={32} className="text-indigo-300" />
                    </div>
                    <p className="font-black text-xs uppercase tracking-[0.3em] text-slate-400">No Active Campaigns</p>
                    <p className="text-[10px] text-slate-300 mt-2 font-medium">Create your first outbound campaign to start tracking outreach.</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Campaign</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Channel / Region</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Prospects</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Conversions</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Cost / Revenue</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">ROI %</th>
                            <th className="px-6 py-4 w-12 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {campaigns.map(c => {
                            const campProps = campaignProspects.filter(p => p.campaignId === c.id);
                            const campDeals = activeDeals.filter(d => d.campaignId === c.id);
                            const campNurturing = nurturingLeads.filter(n => n.campaignId === c.id);
                            const campNoResp = noResponseLeads.filter(r => r.campaignId === c.id);
                            const campSuppr = suppressedLeads.filter(s => s.campaignId === c.id);

                            const totalCampProspects = campProps.length + campDeals.length + campNurturing.length + campNoResp.length + campSuppr.length;
                            const interested = campDeals.length;
                            const converted = campDeals.filter(l => l.outboundStage === 'Closed Won').length;
                            const revenue = campDeals.filter(l => l.outboundStage === 'Closed Won').reduce((sum, l) => sum + (l.value || 0), 0);

                            const cost = Number(c.cost) || 0;
                            const roi = cost > 0 ? ((revenue - cost) / cost) * 100 : 0;

                            return (
                              <tr key={c.id || Math.random().toString()} onClick={() => setActiveCampaignId(c.id)} className="hover:bg-slate-50/50 transition-colors cursor-pointer group">
                                <td className="px-6 py-4">
                                  <p className="font-black text-slate-800 text-sm">{c.name || 'Unnamed Campaign'}</p>
                                  <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${c.status === 'Active' ? 'bg-emerald-50 text-emerald-600' :
                                    c.status === 'Paused' ? 'bg-amber-50 text-amber-600' :
                                      'bg-slate-100 text-slate-500'
                                    }`}>
                                    {c.status || 'Active'}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <p className="font-bold text-xs text-slate-600 flex items-center gap-1.5">
                                    {c.channel === 'Email' ? '📧' : c.channel === 'WhatsApp' ? '💬' : c.channel === 'LinkedIn' ? '💼' : '📱'}
                                    {c.channel || 'Email'}
                                  </p>
                                  <p className="text-[10px] font-medium text-slate-400 mt-0.5">{c.targetRegion || 'No Region'}</p>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div>
                                      <p className="font-black text-slate-800">{totalCampProspects}</p>
                                      <p className="text-[10px] text-slate-400 font-bold">Total</p>
                                    </div>
                                    <div className="w-px h-6 bg-slate-200"></div>
                                    <div>
                                      <p className="font-black text-indigo-600">{interested}</p>
                                      <p className="text-[10px] text-slate-400 font-bold">Interested</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <p className="font-black text-emerald-600">{converted}</p>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Won</p>
                                </td>
                                <td className="px-6 py-4">
                                  <p className="text-xs font-bold text-slate-500 line-through decoration-red-400">₹{cost.toLocaleString()}</p>
                                  <p className="text-sm font-black text-emerald-600">₹{revenue.toLocaleString()}</p>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <span className={`inline-flex px-3 py-1 rounded-xl text-xs font-black ${roi > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                    roi < 0 ? 'bg-red-50 text-red-700 border border-red-200' :
                                      'bg-slate-100 text-slate-600 border border-slate-200'
                                    }`}>
                                    {roi > 0 ? '+' : ''}{roi.toFixed(1)}%
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex justify-end">
                                    <button
                                      onClick={(e) => handleDeleteCampaign(c.id, e)}
                                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                      title="Delete Campaign and all uploaded Prospects"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            ) : (() => {
              const activeCamp = campaigns.find(c => c.id === activeCampaignId);
              if (!activeCamp) return null;

              return (
                <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
                  <div className="flex items-center justify-between bg-white rounded-3xl p-6 border border-slate-100 shadow-xl">
                    <div className="flex items-center gap-4">
                      <button onClick={() => setActiveCampaignId(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                        &larr; Back
                      </button>
                      <div>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight mb-1">{activeCamp.name}</h2>
                        <p className="text-xs text-slate-500 font-medium">Campaign Configuration & Prospect Uploads</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => openSequenceModal(activeCamp.id)}
                        className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-amber-50 hover:border-amber-400 hover:text-amber-700 transition-all shadow-sm"
                      >
                        <AlignLeft size={16} />
                        Sequences
                      </button>
                      <label className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 cursor-pointer">
                        <Plus size={16} />
                        Upload CSV
                        <input
                          type="file"
                          accept=".csv"
                          onChange={(e) => handleCSVUpload(e, activeCamp.id)}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Prospect Management UI */}
                  {(() => {
                    const prospectsInCamp = campaignProspects.filter(p => p.campaignId === activeCamp.id);
                    return (
                      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                          <h3 className="font-black text-slate-800 tracking-tight">Campaign Prospects ({prospectsInCamp.length})</h3>
                        </div>
                        {prospectsInCamp.length === 0 ? (
                          <div className="py-24 text-center">
                            <p className="font-black text-xs uppercase tracking-[0.3em] text-slate-400">No Prospects Yet</p>
                            <p className="text-[10px] text-slate-400 mt-2 font-medium">Upload a CSV to start outbound tracking.</p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Name / Contact</th>
                                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Company</th>
                                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Badges</th>
                                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Attempts</th>
                                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Update Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {prospectsInCamp.map(p => {
                                  // Potential badge color
                                  const potentialColor = (() => {
                                    const v = (p.potentialBadge || '').toLowerCase();
                                    if (v.includes('high') || v.includes('great') || v.includes('good')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
                                    if (v.includes('medium') || v.includes('mid')) return 'bg-amber-50 text-amber-700 border-amber-200';
                                    if (v.includes('low') || v.includes('bad') || v.includes('cold')) return 'bg-red-50 text-red-600 border-red-200';
                                    return 'bg-slate-100 text-slate-600 border-slate-200';
                                  })();

                                  return (
                                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                      <td className="px-6 py-4">
                                        <p className="font-black text-slate-800 text-sm">{(p.contactName || p.companyName || p.name) || 'Unknown'}</p>
                                        <p className="text-[10px] text-indigo-600 font-bold mt-0.5">{getPrimaryContact(p)}</p>
                                        {(() => { const ph = p.mobile || p.contactMethods?.find((m: any) => m.type === 'phone' || m.type === 'whatsapp')?.value; return ph ? <button onClick={(e) => { e.stopPropagation(); copyPhone(ph); }} title="Click to copy" className={`text-[10px] font-semibold mt-0.5 transition-all cursor-pointer select-none ${copiedPhone === ph ? 'text-emerald-500' : 'text-slate-400 hover:text-indigo-500'}`}>{copiedPhone === ph ? '✓ Copied!' : ph}</button> : null; })()}
                                      </td>
                                      <td className="px-6 py-4 text-xs font-bold text-slate-600">
                                        {p.companyName || p.projectName || <span className="text-slate-300">—</span>}
                                      </td>
                                      <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1.5 items-center">
                                          {p.categoryBadge && (
                                            <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border bg-purple-50 text-purple-700 border-purple-200">
                                              {p.categoryBadge}
                                            </span>
                                          )}
                                          {p.potentialBadge && (
                                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${potentialColor}`}>
                                              ⚡ {p.potentialBadge}
                                            </span>
                                          )}
                                          {p.notes && (
                                            <button
                                              onClick={() => setViewNotesProspect(p)}
                                              className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 transition-all flex items-center gap-1"
                                              title="View Notes"
                                            >
                                              📝 Notes
                                            </button>
                                          )}
                                          {!p.categoryBadge && !p.potentialBadge && !p.notes && (
                                            <span className="text-slate-300 text-[10px]">—</span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-6 py-4 text-center">
                                        <span className="font-black text-indigo-600 border border-indigo-200 bg-indigo-50 w-8 h-8 rounded-full inline-flex items-center justify-center">
                                          {p.attemptCount || 0}
                                        </span>
                                      </td>
                                      <td className="px-6 py-4">
                                        <select
                                          className="w-full max-w-[200px] px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-bold text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer"
                                          value={p.outboundStatus}
                                          onChange={(e) => handleProspectStatusChange(p, e.target.value)}
                                        >
                                          <option value="Not Contacted">Not Contacted</option>
                                          <option value="Message Sent">Message Sent / Follow Up</option>
                                          <option value="Replied">Replied (Engaging)</option>
                                          <optgroup label="Pipeline Actions">
                                            <option value="Interested">Move to Active Deals</option>
                                            <option value="Not Now (Nurture)">Move to Nurturing</option>
                                            <option value="No Response">Move to No-Response Pool</option>
                                            <option value="Not Interested (Suppress)">Move to Suppression List</option>
                                          </optgroup>
                                        </select>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })()}
          </div>
        )}

        {/* --- NOTES POPUP MODAL --- */}
        {viewNotesProspect && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setViewNotesProspect(null)}>
            <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-amber-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center text-xl">📝</div>
                  <div>
                    <h3 className="font-black text-slate-800 text-lg tracking-tight">{viewNotesProspect.contactName || viewNotesProspect.companyName || viewNotesProspect.name || 'Prospect'}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Notes & Extra Info</p>
                  </div>
                </div>
                <button onClick={() => setViewNotesProspect(null)} className="text-slate-400 hover:text-slate-600 font-bold p-2">✕</button>
              </div>
              <div className="p-8 space-y-4">
                {viewNotesProspect.notes ? (
                  viewNotesProspect.notes.split(' | ').map((note: string, i: number) => (
                    <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-sm text-slate-700 font-medium leading-relaxed">{note}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400 text-sm text-center py-8">No notes available for this prospect.</p>
                )}
                {viewNotesProspect.categoryBadge && (
                  <div className="flex items-center gap-2 pt-2">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Category:</span>
                    <span className="px-2 py-1 rounded-lg text-xs font-black uppercase tracking-wider border bg-purple-50 text-purple-700 border-purple-200">{viewNotesProspect.categoryBadge}</span>
                  </div>
                )}
                {viewNotesProspect.potentialBadge && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Potential:</span>
                    <span className="px-2 py-1 rounded-lg text-xs font-black uppercase tracking-wider border bg-emerald-50 text-emerald-700 border-emerald-200">⚡ {viewNotesProspect.potentialBadge}</span>
                  </div>
                )}
              </div>
              <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button onClick={() => setViewNotesProspect(null)} className="px-6 py-2.5 bg-slate-900 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-slate-700 transition-all">Close</button>
              </div>
            </div>
          </div>
        )}


        {/* --- PROSPECTS TAB --- */}
        {
          activeTab === 'prospects' && (() => {
            const stages = ['New Prospect', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation'];

            // Filter to only show deals from the activeDeals collection
            const activeDealsList = activeDeals || [];

            return (
              <div className="space-y-6">
                <div className="flex items-center justify-between bg-white rounded-3xl p-6 border border-slate-100 shadow-xl">
                  <div>
                    <h2 className="text-xl font-black text-slate-800 tracking-tight mb-1">Active Deals Pipeline</h2>
                    <p className="text-xs text-slate-500 font-medium">Manage and move outbound prospects through the sales stages.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <select className="px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 font-bold text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer">
                      <option value="all">All Campaigns</option>
                      {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button
                      onClick={() => exportToCSV(
                        activeDealsList.map(p => ({
                          Name: p.contactName || p.name || 'Unknown',
                          Company: p.companyName || p.projectName || '',
                          Phone: p.mobile || p.contactMethods?.find((m: any) => m.type === 'phone' || m.type === 'whatsapp')?.value || '',
                          Email: p.email || p.contactMethods?.find((m: any) => m.type === 'email')?.value || '',
                          Stage: p.outboundStage || '',
                          Score: p.leadScore || 0,
                          Value: p.value || 0,
                          Campaign: campaigns.find(c => c.id === p.campaignId)?.name || ''
                        })),
                        'active_prospects'
                      )}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-100 border border-emerald-200 transition-all">
                      <FileSpreadsheet size={16} />
                      Export
                    </button>
                  </div>
                </div>

                {/* Kanban Board */}
                <div className="flex gap-4 overflow-x-auto pb-6 -mx-2 px-2 snap-x">
                  {stages.map(stage => {
                    const columnProspects = activeDealsList.filter(p => p.outboundStage === stage);

                    return (
                      <div key={stage} className="flex-none w-80 bg-slate-50/50 rounded-3xl border border-slate-200/60 flex flex-col snap-start h-[calc(100vh-300px)]">
                        <div className="p-4 border-b border-slate-200/60 flex items-center justify-between bg-white/50 backdrop-blur-sm rounded-t-3xl sticky top-0">
                          <h3 className="font-black text-sm text-slate-700">{stage}</h3>
                          <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px] font-black">{columnProspects.length}</span>
                        </div>
                        <div className="flex-1 p-3 overflow-y-auto space-y-3 custom-scrollbar">
                          {columnProspects.map(prospect => {
                            const campaign = campaigns.find(c => c.id === prospect.campaignId);

                            return (
                              <div
                                key={prospect.id}
                                onClick={() => setSelectedProspect(prospect)}
                                className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300/50 transition-all cursor-pointer group"
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <div>
                                    <h4 className="font-black text-slate-800 text-sm leading-tight group-hover:text-indigo-600 transition-colors">{(prospect.contactName || prospect.companyName || prospect.name) || 'Unknown'}</h4>
                                    <p className="text-[10px] font-bold text-slate-400 mt-0.5">{prospect.companyName || prospect.projectName || getPrimaryContact(prospect)}</p>
                                  </div>
                                  {prospect.leadScore && prospect.leadScore >= 20 && (
                                    <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-600 text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
                                      <TrendingUp size={10} /> Hot
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center justify-between mt-4">
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded-lg">
                                    <Megaphone size={10} className="text-slate-400" />
                                    {campaign?.name || 'Unknown Campaign'}
                                  </span>
                                  <span className="text-xs font-black text-emerald-600">
                                    {prospect.value ? `₹${prospect.value.toLocaleString()}` : '--'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                          {columnProspects.length === 0 && (
                            <div className="h-24 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl">
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Empty</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()
        }

        {/* --- NURTURING TAB --- */}
        {
          activeTab === 'nurturing' && (() => {
            const nurturedLeadsList = nurturingLeads || [];

            return (
              <div className="space-y-6">
                <div className="flex items-center justify-between bg-white rounded-3xl p-6 border border-slate-100 shadow-xl">
                  <div>
                    <h2 className="text-xl font-black text-slate-800 tracking-tight mb-1">Long-Term Holding</h2>
                    <p className="text-xs text-slate-500 font-medium">Prospects categorized as "Not Interested" or "No Response".</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => exportToCSV(
                        nurturedLeadsList.map(l => ({
                          Name: l.contactName || l.name || 'Unknown',
                          Company: l.companyName || l.projectName || '',
                          Phone: l.mobile || l.contactMethods?.find((m: any) => m.type === 'phone' || m.type === 'whatsapp')?.value || '',
                          Email: l.email || l.contactMethods?.find((m: any) => m.type === 'email')?.value || '',
                          Campaign: campaigns.find(c => c.id === l.campaignId)?.name || '',
                          'Nurture Reason': l.nurtureReason || '',
                          'Next Follow-up': l.nextFollowUp ? new Date(l.nextFollowUp).toLocaleDateString() : ''
                        })),
                        'nurturing_list'
                      )}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-100 border border-emerald-200 transition-all">
                      <FileSpreadsheet size={16} />
                      Export
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
                  <div className="p-4 border-b border-slate-100 bg-slate-50/50 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <select className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer">
                      <option value="all">All Campaigns</option>
                      {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <select className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer">
                      <option value="all">All Nurture Reasons</option>
                      <option value="Budget Issue">Budget Issue</option>
                      <option value="Wrong Timing">Wrong Timing</option>
                      <option value="Not Interested">Not Interested</option>
                      <option value="No Response">No Response</option>
                    </select>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Prospect</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Contact Info</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Source Campaign</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Nurture Reason</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Next Follow-Up</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Delete</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {nurturedLeadsList.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-slate-400 text-xs font-medium">No prospects in nurturing.</td>
                          </tr>
                        ) : nurturedLeadsList.map(l => (
                          <tr key={l.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => setSelectedProspect(l)}>
                            <td className="px-6 py-4">
                              <p className="font-black text-slate-800 text-sm">{l.contactName || l.name}</p>
                              <p className="text-[10px] font-bold text-slate-400 mt-0.5">{l.companyName || l.projectName || 'No Company'}</p>
                            </td>
                            <td className="px-6 py-4">
                              <p className="font-bold text-xs text-indigo-600">{getPrimaryContact(l)}</p>
                              {(() => { const ph = l.mobile || l.contactMethods?.find((m: any) => m.type === 'phone' || m.type === 'whatsapp')?.value; return ph ? <button onClick={(e) => { e.stopPropagation(); copyPhone(ph); }} title="Click to copy" className={`text-[10px] font-semibold mt-0.5 transition-all cursor-pointer select-none ${copiedPhone === ph ? 'text-emerald-500' : 'text-slate-400 hover:text-indigo-500'}`}>{copiedPhone === ph ? '✓ Copied!' : ph}</button> : null; })()}
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded-lg">
                                <Megaphone size={10} className="text-slate-400" />
                                {campaigns.find(c => c.id === l.campaignId)?.name || '--'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${l.nurtureReason === 'Budget Issue' ? 'bg-amber-50 text-amber-600' :
                                l.nurtureReason === 'Wrong Timing' ? 'bg-blue-50 text-blue-600' :
                                  l.nurtureReason === 'No Response' ? 'bg-slate-100 text-slate-500' :
                                    'bg-red-50 text-red-600'
                                }`}>
                                {l.nurtureReason}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <Calendar size={14} className="text-slate-400" />
                                <span className="text-xs font-bold text-slate-600">
                                  {l.nextFollowUp ? new Date(l.nextFollowUp).toLocaleDateString() : 'Not Set'}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const name = l.contactName || l.name || 'this prospect';
                                  if (!window.confirm(`Delete "${name}" from Nurturing?`)) return;
                                  try {
                                    await deleteNurturedLeadFromDB(l.id);
                                    console.log('Deleted nurtured lead:', l.id);
                                  } catch (err) {
                                    console.error('Delete failed:', err);
                                    alert('Delete failed. Please try again.');
                                  }
                                }}
                                className="w-8 h-8 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center mx-auto transition-all border border-red-200"
                                title="Delete from Nurturing"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()
        }

        {/* --- NO RESPONSE POOL TAB --- */}
        {
          activeTab === 'noResponsePool' && (() => {
            const silentLeadsList = noResponseLeads || [];

            return (
              <div className="space-y-6">
                <div className="flex items-center justify-between bg-white rounded-3xl p-6 border border-slate-100 shadow-xl">
                  <div>
                    <h2 className="text-xl font-black text-slate-800 tracking-tight mb-1">No Response Pool</h2>
                    <p className="text-xs text-slate-500 font-medium">Prospects who haven't engaged across multiple attempts.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => exportToCSV(
                        silentLeadsList.map(l => ({
                          Name: l.contactName || l.name || 'Unknown',
                          Company: l.companyName || l.projectName || '',
                          Phone: l.mobile || l.contactMethods?.find((m: any) => m.type === 'phone' || m.type === 'whatsapp')?.value || '',
                          Email: l.email || l.contactMethods?.find((m: any) => m.type === 'email')?.value || '',
                          Campaign: campaigns.find(c => c.id === l.campaignId)?.name || '',
                          'Attempts': l.attemptCount || 0,
                        })),
                        'no_response_pool'
                      )}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-100 border border-emerald-200 transition-all">
                      <FileSpreadsheet size={16} />
                      Export
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Prospect</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Contact Info</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Source Campaign</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Attempts</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Delete</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {silentLeadsList.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-slate-400 text-xs font-medium">No prospects in the No Response Pool.</td>
                          </tr>
                        ) : silentLeadsList.map(l => (
                          <tr key={l.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => setSelectedProspect(l)}>
                            <td className="px-6 py-4">
                              <p className="font-black text-slate-800 text-sm">{(l.contactName || l.companyName || l.name) || 'Unknown'}</p>
                              <p className="text-[10px] font-bold text-slate-400 mt-0.5">{l.companyName || l.projectName || 'No Company'}</p>
                            </td>
                            <td className="px-6 py-4">
                              <p className="font-bold text-xs text-indigo-600">{getPrimaryContact(l)}</p>
                              {(() => { const ph = l.mobile || l.contactMethods?.find((m: any) => m.type === 'phone' || m.type === 'whatsapp')?.value; return ph ? <button onClick={(e) => { e.stopPropagation(); copyPhone(ph); }} title="Click to copy" className={`text-[10px] font-semibold mt-0.5 transition-all cursor-pointer select-none ${copiedPhone === ph ? 'text-emerald-500' : 'text-slate-400 hover:text-indigo-500'}`}>{copiedPhone === ph ? '✓ Copied!' : ph}</button> : null; })()}
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded-lg">
                                <Megaphone size={10} className="text-slate-400" />
                                {campaigns.find(c => c.id === l.campaignId)?.name || '--'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              {l.lostLead ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 text-red-600 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                                  ❌ Lost Lead
                                </span>
                              ) : (
                                <span className="font-black text-indigo-600 border border-indigo-200 bg-indigo-50 w-8 h-8 rounded-full inline-flex items-center justify-center">
                                  {l.attemptCount || 0}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const name = l.contactName || l.companyName || l.name || 'this prospect';
                                  if (!window.confirm(`Delete "${name}" from No Response Pool?`)) return;
                                  try {
                                    await deleteSilentLeadFromDB(l.id);
                                    console.log('Deleted silent lead:', l.id);
                                  } catch (err) {
                                    console.error('Delete failed:', err);
                                    alert('Delete failed. Please try again.');
                                  }
                                }}
                                className="w-8 h-8 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center mx-auto transition-all border border-red-200"
                                title="Delete from No Response Pool"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()
        }

      </div >
    </div >
  );
};

export default SalesOutbound;
