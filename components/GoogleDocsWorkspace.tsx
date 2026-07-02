import React, { useState, useEffect } from 'react';
import { Project, MarketingServiceAllocation, Client, Employee } from '../types';
import { updateProjectInDB } from '../lib/db';
import {
  clearToken,
  loginWithGoogle,
  getStoredToken,
  getStoredUserInfo,
  getDocumentMetadata,
  createGoogleDocument,
  checkAndAllocateTab,
  renameDocument,
  exportDocument,
  exportDocToLetterheadPDF,
  GoogleUserInfo,
  GoogleDocMetadata
} from '../lib/googleDocsService';
import {
  FileText, ExternalLink, RefreshCw, Edit2, Download, Copy, Check,
  AlertTriangle, ShieldAlert, LogOut, ChevronRight, Loader2, Sparkles
} from 'lucide-react';

interface GoogleDocsWorkspaceProps {
  project: Project;
  serviceAlloc: MarketingServiceAllocation;
  client: Client | undefined;
  employee: Employee;
  readOnly?: boolean;
}

export const GoogleDocsWorkspace: React.FC<GoogleDocsWorkspaceProps> = ({
  project,
  serviceAlloc,
  client,
  employee,
  readOnly = false
}) => {
  const [isConnected, setIsConnected] = useState<boolean>(!!getStoredToken());
  const [googleUser, setGoogleUser] = useState<GoogleUserInfo | null>(getStoredUserInfo());
  const [loading, setLoading] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [docMeta, setDocMeta] = useState<GoogleDocMetadata | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [renameMode, setRenameMode] = useState<boolean>(false);
  const [newDocName, setNewDocName] = useState<string>('');
  const [autoAllocating, setAutoAllocating] = useState<boolean>(false);
  const [allocAttempted, setAllocAttempted] = useState<boolean>(false);

  // Reset attempted flag if project/service changes
  useEffect(() => {
    setAllocAttempted(false);
  }, [project.id, serviceAlloc.serviceId]);

  // Automatically allocate missing Google Doc tabs in background
  useEffect(() => {
    const autoAllocateAll = async () => {
      if (allocAttempted || autoAllocating || loading) return;

      const unallocated = (project.servicesAllocated || []).filter(alloc => !alloc.googleDocTabId);
      const docIdMissing = !project.googleDocumentId;

      if (unallocated.length > 0 || docIdMissing) {
        setAllocAttempted(true);
        setAutoAllocating(true);
        setLoading(true);
        setErrorMsg(null);
        try {
          let docId = project.googleDocumentId;
          let webViewLink = project.googleDocWebLink || '';

          const today = new Date();
          const dateStr = today.toLocaleDateString('en-US', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
          });

          // 1. Create document if it does not exist
          if (!docId) {
            const clientName = client?.name || client?.companyName || 'Client';
            const docTitle = `${clientName} - Marketing Workspace`;
            console.log('Auto-creating Google Doc:', docTitle);
            const docInfo = await createGoogleDocument(docTitle);
            docId = docInfo.documentId;
            webViewLink = docInfo.webViewLink;

            await updateProjectInDB(project.id, {
              googleDocumentId: docId,
              googleDocTitle: docTitle,
              googleDocWebLink: webViewLink,
              googleDocLastEdited: new Date().toLocaleString()
            });
            
            project.googleDocumentId = docId;
          }

          // 2. Allocate tabs for ALL services sequentially
          const updatedAllocations = [...(project.servicesAllocated || [])];
          let changed = false;
          for (let i = 0; i < updatedAllocations.length; i++) {
            const alloc = updatedAllocations[i];
            if (!alloc.googleDocTabId) {
              const specialistName = employee.name || 'Specialist';
              const campaignName = project.description || 'Marketing Campaign';
              const serviceName = alloc.serviceName;

              console.log('Auto-allocating tab for:', serviceName);
              const tabId = await checkAndAllocateTab(docId, serviceName, {
                clientName: client?.name || client?.companyName || 'Client',
                campaignName,
                serviceName,
                specialistName,
                dateStr
              });

              updatedAllocations[i] = {
                ...alloc,
                googleDocTabId: tabId,
                googleDocTabTitle: serviceName
              };
              changed = true;
            }
          }

          if (changed || docIdMissing) {
            await updateProjectInDB(project.id, {
              servicesAllocated: updatedAllocations
            });
          }

          await fetchMetadata();
        } catch (err: any) {
          console.error('Auto allocation failed:', err);
          setErrorMsg(err.message || 'Failed to auto-allocate Google Doc tabs.');
        } finally {
          setLoading(false);
          setAutoAllocating(false);
        }
      }
    };

    autoAllocateAll();
  }, [project.servicesAllocated, project.googleDocumentId]);

  // Automatically fetch doc metadata if documentId exists
  useEffect(() => {
    if (project.googleDocumentId) {
      fetchMetadata();
    } else {
      setDocMeta(null);
    }
  }, [project.googleDocumentId, serviceAlloc.serviceId]);

  const fetchMetadata = async () => {
    if (!project.googleDocumentId) return;
    setSyncing(true);
    setErrorMsg(null);
    try {
      const meta = await getDocumentMetadata(project.googleDocumentId);
      setDocMeta(meta);
      // Sync to project in Firestore if properties changed
      if (
        project.googleDocTitle !== meta.title ||
        project.googleDocOwner !== meta.owner ||
        project.googleDocWebLink !== meta.webViewLink
      ) {
        await updateProjectInDB(project.id, {
          googleDocTitle: meta.title,
          googleDocOwner: meta.owner,
          googleDocWebLink: meta.webViewLink,
          googleDocLastEdited: new Date(meta.lastEditedTime).toLocaleString()
        });
      }
    } catch (err: any) {
      console.error('Error fetching doc metadata:', err);
      setErrorMsg('Failed to sync metadata. Access token may be expired or permission denied.');
    } finally {
      setSyncing(false);
    }
  };

  const handleOAuthConnect = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await loginWithGoogle();
      setIsConnected(true);
      setGoogleUser(getStoredUserInfo());
      if (project.googleDocumentId) {
        await fetchMetadata();
      }
    } catch (err: any) {
      console.error('OAuth connect failed:', err);
      setErrorMsg(err.message || 'OAuth Connection Failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    clearToken();
    setIsConnected(false);
    setGoogleUser(null);
    setDocMeta(null);
  };

  const handleCreateAndAllocate = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      let docId = project.googleDocumentId;
      let webViewLink = project.googleDocWebLink || '';

      const today = new Date();
      const dateStr = today.toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });

      // 1. Create document if it does not exist
      if (!docId) {
        const clientName = client?.name || client?.companyName || 'Client';
        const docTitle = `${clientName} - Marketing Workspace`;
        
        const docInfo = await createGoogleDocument(docTitle);
        docId = docInfo.documentId;
        webViewLink = docInfo.webViewLink;

        await updateProjectInDB(project.id, {
          googleDocumentId: docId,
          googleDocTitle: docTitle,
          googleDocWebLink: webViewLink,
          googleDocLastEdited: new Date().toLocaleString()
        });
      }

      // 2. Allocate / find the service tab in the document
      const specialistName = employee.name || 'Specialist';
      const campaignName = project.description || 'Marketing Campaign';
      const serviceName = serviceAlloc.serviceName;

      const tabId = await checkAndAllocateTab(docId, serviceName, {
        clientName: client?.name || client?.companyName || 'Client',
        campaignName,
        serviceName,
        specialistName,
        dateStr
      });

      // 3. Update Service Allocation tab reference in Firestore
      const updatedAllocations = (project.servicesAllocated || []).map(alloc => {
        if (alloc.serviceId === serviceAlloc.serviceId) {
          return {
            ...alloc,
            googleDocTabId: tabId,
            googleDocTabTitle: serviceName
          };
        }
        return alloc;
      });

      await updateProjectInDB(project.id, {
        servicesAllocated: updatedAllocations
      });

      // 4. Force metadata refresh to render embed
      await fetchMetadata();
    } catch (err: any) {
      console.error('Error creating Google doc tab:', err);
      setErrorMsg(err.message || 'Failed to initialize Google Doc workspace tab.');
    } finally {
      setLoading(false);
    }
  };

  const handleRenameDoc = async () => {
    if (!project.googleDocumentId || !newDocName.trim()) return;
    setLoading(true);
    try {
      await renameDocument(project.googleDocumentId, newDocName);
      setRenameMode(false);
      await fetchMetadata();
    } catch (err: any) {
      setErrorMsg('Failed to rename document. Drive permission denied.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'pdf' | 'docx', scope: 'active' | 'all' = 'active') => {
    if (!project.googleDocumentId) return;
    if (scope === 'active' && !serviceAlloc.googleDocTabId) return;
    setLoading(true);
    try {
      const serviceName = scope === 'active' ? serviceAlloc.serviceName : 'All Channels';
      const filename = `${client?.name || client?.companyName || 'Client'}_${serviceName.replace(/\s+/g, '_')}_Report`;
      if (format === 'pdf') {
        const today = new Date();
        const dateStr = today.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
        await exportDocToLetterheadPDF(
          project.googleDocumentId,
          scope === 'active' ? serviceAlloc.googleDocTabId : 'ALL_TABS',
          filename,
          {
            clientName: client?.name || client?.companyName || 'Client',
            serviceName,
            specialistName: employee.name || 'Specialist',
            dateStr
          }
        );
      } else {
        await exportDocument(project.googleDocumentId, format, filename);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Failed to export as ${format.toUpperCase()}.`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!project.googleDocumentId) return;
    const tabUrl = `${project.googleDocWebLink}#tab=${serviceAlloc.googleDocTabId || ''}`;
    navigator.clipboard.writeText(tabUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tabUrl = project.googleDocumentId
    ? `https://docs.google.com/document/d/${project.googleDocumentId}/edit?usp=drivesdk&rm=minimal#tab=${serviceAlloc.googleDocTabId || ''}`
    : '';

  const docUrlForOpening = project.googleDocumentId
    ? `https://docs.google.com/document/d/${project.googleDocumentId}/edit#tab=${serviceAlloc.googleDocTabId || ''}`
    : '';

  return (
    <div className="space-y-4">
      {errorMsg && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-[10px] font-bold">
          <AlertTriangle size={14} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Workspace Actions */}
      {!project.googleDocumentId || !serviceAlloc.googleDocTabId ? (
        <div className="flex flex-col items-center justify-center p-16 border border-dashed border-slate-200 bg-white rounded-lg text-center space-y-4">
          {loading ? (
            <>
              <Loader2 size={24} className="animate-spin text-slate-400" />
              <div>
                <h4 className="font-extrabold text-xs text-slate-850 uppercase tracking-wider">Initializing Workspace</h4>
                <p className="text-[10px] text-slate-400 max-w-sm mx-auto mt-1 leading-relaxed font-bold">
                  Automatically allocating Google Doc tabs for active campaign services. Please wait a few seconds...
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center border border-red-100 shadow-inner">
                <AlertTriangle size={22} className="text-red-400" />
              </div>
              <div>
                <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">Workspace Initialization Failed</h4>
                <p className="text-[10px] text-slate-400 max-w-sm mx-auto mt-1 leading-relaxed">
                  {errorMsg || 'Failed to auto-allocate Google Doc tabs. Make sure your company Google account is linked in Settings.'}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setAllocAttempted(false);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-md transition"
                >
                  <RefreshCw size={12} /> Retry Initialization
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Action Toolbar */}
          <div className="flex items-center justify-between gap-3 p-2 bg-slate-50 border border-slate-200 rounded-lg shadow-inner">
            <button
              onClick={fetchMetadata}
              disabled={syncing}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 rounded text-[10px] font-bold transition shadow-sm disabled:opacity-50"
            >
              <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} /> Refresh Info
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExport('pdf', 'active')}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-[10px] font-extrabold transition shadow-sm uppercase tracking-wider disabled:opacity-50"
              >
                <Download size={11} /> Export Active Tab
              </button>
              <button
                onClick={() => handleExport('pdf', 'all')}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-extrabold transition shadow-sm uppercase tracking-wider disabled:opacity-50"
              >
                <Download size={11} /> Export All Tabs
              </button>
            </div>
          </div>

          {/* Interactive Document Iframe Embedding */}
          <div className="border border-slate-250 rounded-lg overflow-hidden bg-white shadow-md relative">
            <div className="p-2 bg-slate-100/75 border-b border-slate-200 flex justify-between items-center text-[10px] text-slate-500 font-bold shrink-0">
              <span>Google Docs Preview Workspace (Tabbed Mode)</span>
              <span className="flex items-center gap-1 text-[9px] text-emerald-600">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span> Live Integration Active
              </span>
            </div>
            {tabUrl ? (
              <iframe
                key={serviceAlloc.googleDocTabId || 'default'}
                src={tabUrl}
                className="w-full h-[550px] border-none bg-slate-50"
                allow="autoplay; encrypted-media"
                allowFullScreen
                title="Google Docs Editor"
              />
            ) : (
              <div className="p-24 text-center text-slate-400 font-bold uppercase tracking-wider">
                Preview Loading...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GoogleDocsWorkspace;
