// lib/googleDocsService.ts
import jsPDF from 'jspdf';
import { getCompanyProfile } from './db';
import { loadWatermarkBase64, stampWatermarkAllPages } from './pdfWatermark';

const DOCS_CLIENT_ID = import.meta.env.VITE_GOOGLE_DOCS_CLIENT_ID || '';

export interface GoogleTokenInfo {
    accessToken: string;
    expiresAt: number;
}

export interface GoogleUserInfo {
    email: string;
    name: string;
    picture?: string;
}

export interface GoogleDocMetadata {
    id: string;
    title: string;
    lastEditedTime: string;
    owner: string;
    webViewLink: string;
    tabs?: Array<{ tabId: string; title: string }>;
}

let gsiScriptLoaded = false;
let gsiResolve: (() => void) | null = null;

// Dynamic script loader for Google Identity Services
export const loadGsiScript = (): Promise<void> => {
    if (gsiScriptLoaded) return Promise.resolve();
    if (typeof window === 'undefined') return Promise.resolve();

    if (document.getElementById('google-gsi-client')) {
        return new Promise((resolve) => {
            const check = () => {
                if ((window as any).google?.accounts?.oauth2) {
                    gsiScriptLoaded = true;
                    resolve();
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }

    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.id = 'google-gsi-client';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => {
            const check = () => {
                if ((window as any).google?.accounts?.oauth2) {
                    gsiScriptLoaded = true;
                    resolve();
                } else {
                    setTimeout(check, 50);
                }
            };
            check();
        };
        document.body.appendChild(script);
    });
};

// Retrieve token from local storage if valid
export const getStoredToken = (): GoogleTokenInfo | null => {
    const tokenStr = localStorage.getItem('google_doc_oauth_token');
    if (!tokenStr) return null;

    try {
        const token: GoogleTokenInfo = JSON.parse(tokenStr);
        // If token has more than 5 minutes left, it is valid
        if (token.expiresAt > Date.now() + 300000) {
            return token;
        }
    } catch (e) {
        console.error('Failed to parse stored Google token', e);
    }
    return null;
};

// Save token to local storage
export const saveToken = (accessToken: string, expiresInSeconds: number) => {
    const token: GoogleTokenInfo = {
        accessToken,
        expiresAt: Date.now() + (expiresInSeconds * 1000)
    };
    localStorage.setItem('google_doc_oauth_token', JSON.stringify(token));
};

// Clear Google OAuth token
export const clearToken = () => {
    localStorage.removeItem('google_doc_oauth_token');
    localStorage.removeItem('google_doc_user_info');
};

// Prompt user for Google OAuth login via GIS Popup
export const loginWithGoogle = async (): Promise<string> => {
    const stored = getStoredToken();
    if (stored) return stored.accessToken;

    // 1. Attempt silent token refresh via Firestore company profile or env vars
    const co = await getCompanyProfile();
    const clientId = co?.googleClientId || import.meta.env.VITE_GOOGLE_DOCS_CLIENT_ID || import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
    const clientSecret = co?.googleClientSecret || import.meta.env.VITE_GOOGLE_DOCS_CLIENT_SECRET || import.meta.env.VITE_GOOGLE_CLIENT_SECRET || '';
    const refreshToken = co?.googleRefreshToken || import.meta.env.VITE_GOOGLE_REFRESH_TOKEN || '';

    if (clientId && clientSecret && refreshToken) {
        try {
            const params = new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: refreshToken,
                grant_type: 'refresh_token'
            });
            
            let response: Response;
            try {
                response = await fetch('/google-token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: params.toString()
                });
                
                if (!response.ok || response.status === 404) {
                    // Fallback to direct request if proxy fails or returns 404
                    response = await fetch('https://oauth2.googleapis.com/token', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        },
                        body: params.toString()
                    });
                }
            } catch (proxyErr) {
                // Fallback to direct request on proxy network error
                response = await fetch('https://oauth2.googleapis.com/token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: params.toString()
                });
            }

            if (response.ok) {
                const data = await response.json();
                if (data.access_token) {
                    saveToken(data.access_token, data.expires_in || 3600);
                    // Fetch user info quietly to store
                    try {
                        const userInfo = await fetchUserInfo(data.access_token);
                        localStorage.setItem('google_doc_user_info', JSON.stringify(userInfo));
                    } catch (err) {
                        console.error('Failed to fetch user info quietly', err);
                    }
                    return data.access_token;
                }
            } else {
                const errText = await response.text();
                console.warn(`Silent refresh returned status ${response.status}: ${errText}`);
            }
        } catch (err) {
            console.error("Automated token exchange failed, falling back to popup:", err);
        }
    }

    // 2. Fallback to GIS Popup
    await loadGsiScript();

    return new Promise((resolve, reject) => {
        try {
            const client = (window as any).google.accounts.oauth2.initTokenClient({
                client_id: DOCS_CLIENT_ID,
                scope: 'email profile https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly',
                callback: async (response: any) => {
                    if (response.error) {
                        reject(new Error(response.error_description || response.error));
                        return;
                    }
                    if (response.access_token) {
                        saveToken(response.access_token, response.expires_in || 3600);
                        // Fetch user info quietly to store
                        try {
                            const userInfo = await fetchUserInfo(response.access_token);
                            localStorage.setItem('google_doc_user_info', JSON.stringify(userInfo));
                        } catch (err) {
                            console.error('Failed to fetch user info', err);
                        }
                        resolve(response.access_token);
                    } else {
                        reject(new Error('No access token received'));
                    }
                }
            });
            client.requestAccessToken();
        } catch (error) {
            reject(error);
        }
    });
};

// Fetch Google Account details
export const fetchUserInfo = async (token: string): Promise<GoogleUserInfo> => {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    if (!response.ok) {
        throw new Error('Failed to fetch Google user info');
    }
    return response.json();
};

export const getStoredUserInfo = (): GoogleUserInfo | null => {
    const info = localStorage.getItem('google_doc_user_info');
    if (!info) return null;
    try {
        return JSON.parse(info);
    } catch (e) {
        return null;
    }
};

// Helper for making authenticated fetch requests with auto login/retry
const authenticatedFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    let token = getStoredToken()?.accessToken;
    if (!token) {
        token = await loginWithGoogle();
    }

    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    
    let response = await fetch(url, { ...options, headers });

    // Handle token expiration / unauthorized error by attempting a re-login once
    if (response.status === 401) {
        clearToken();
        token = await loginWithGoogle();
        headers.set('Authorization', `Bearer ${token}`);
        response = await fetch(url, { ...options, headers });
    }

    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`Google API Error for ${url}:`, errorBody);
        throw new Error(errorBody || `HTTP error! status: ${response.status}`);
    }

    return response;
};

// Create a new Google Document
export const createGoogleDocument = async (title: string): Promise<{ documentId: string; webViewLink: string }> => {
    const createResponse = await authenticatedFetch('https://docs.googleapis.com/v1/documents', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title })
    });
    const docData = await createResponse.json();
    const documentId = docData.documentId;

    // Retrieve file metadata to get webViewLink
    const metaResponse = await authenticatedFetch(`https://www.googleapis.com/drive/v3/files/${documentId}?fields=webViewLink`);
    const metaData = await metaResponse.json();

    return {
        documentId,
        webViewLink: metaData.webViewLink
    };
};

// Fetch Google Document details and tabs
export const getDocumentMetadata = async (documentId: string): Promise<GoogleDocMetadata> => {
    // 1. Fetch file properties from Drive API
    const driveRes = await authenticatedFetch(`https://www.googleapis.com/drive/v3/files/${documentId}?fields=name,modifiedTime,owners,webViewLink`);
    const driveData = await driveRes.json();

    // 2. Fetch document tabs from Docs API
    const docsRes = await authenticatedFetch(`https://docs.googleapis.com/v1/documents/${documentId}?includeTabsContent=true`);
    const docsData = await docsRes.json();

    const tabsList: Array<{ tabId: string; title: string }> = [];
    if (docsData.tabs) {
        const traverseTabs = (tabs: any[]) => {
            tabs.forEach(tab => {
                if (tab.tabProperties) {
                    tabsList.push({
                        tabId: tab.tabProperties.tabId,
                        title: tab.tabProperties.title
                    });
                }
                if (tab.childTabs) {
                    traverseTabs(tab.childTabs);
                }
            });
        };
        traverseTabs(docsData.tabs);
    }

    return {
        id: documentId,
        title: driveData.name,
        lastEditedTime: driveData.modifiedTime,
        owner: driveData.owners?.[0]?.displayName || driveData.owners?.[0]?.emailAddress || 'Unknown',
        webViewLink: driveData.webViewLink,
        tabs: tabsList
    };
};

// Rename a document file
export const renameDocument = async (documentId: string, newName: string): Promise<void> => {
    await authenticatedFetch(`https://www.googleapis.com/drive/v3/files/${documentId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: newName })
    });
};

// Export Google Doc as PDF or DOCX and trigger direct download
export const exportDocument = async (documentId: string, format: 'pdf' | 'docx', filename: string): Promise<void> => {
    const mimeTypes = {
        pdf: 'application/pdf',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };

    const res = await authenticatedFetch(`https://www.googleapis.com/drive/v3/files/${documentId}/export?mimeType=${encodeURIComponent(mimeTypes[format])}`);
    const blob = await res.blob();
    
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
};

// Create a new tab in a Google Doc and insert the template body
export const createTabAndPopulate = async (
    documentId: string, 
    tabTitle: string,
    templateData: {
        clientName: string;
        campaignName: string;
        serviceName: string;
        specialistName: string;
        dateStr: string;
    }
): Promise<string> => {
    // 1. Add tab via batchUpdate
    const addTabRes = await authenticatedFetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            requests: [
                {
                    addDocumentTab: {
                        tabProperties: {
                            title: tabTitle
                        }
                    }
                }
            ]
        })
    });
    const addTabData = await addTabRes.json();
    const tabId = addTabData.replies[0].addDocumentTab.tabProperties.tabId;

    // 2. Populate new tab with formatted template text
    await populateTabTemplate(documentId, tabId, templateData);

    return tabId;
};

// Rename a tab inside the Document
export const renameTab = async (documentId: string, tabId: string, newTitle: string): Promise<void> => {
    await authenticatedFetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            requests: [
                {
                    updateDocumentTabProperties: {
                        tabProperties: {
                            tabId: tabId,
                            title: newTitle
                        },
                        fields: 'title'
                    }
                }
            ]
        })
    });
};

// Insert daily report structure into the designated tab
export const populateTabTemplate = async (
    documentId: string,
    tabId: string,
    data: {
        clientName: string;
        campaignName: string;
        serviceName: string;
        specialistName: string;
        dateStr: string;
    }
): Promise<void> => {
    const text = `DAILY REPORT

Client: ${data.clientName}
Campaign: ${data.campaignName}
Service: ${data.serviceName}
Specialist: ${data.specialistName}
Date: ${data.dateStr}

Summary
--------------------------------------------------
[Type daily report summary here]

Tasks Completed
--------------------------------------------------
- Task 1
- Task 2

Work Details
--------------------------------------------------


Attachments
--------------------------------------------------


Next Actions
--------------------------------------------------


Notes
--------------------------------------------------
`;

    // Construct request to insert text at start index 1 targeting the specific tab
    await authenticatedFetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            requests: [
                {
                    insertText: {
                        text,
                        location: {
                            index: 1,
                            tabId: tabId
                        }
                    }
                }
            ]
        })
    });
};

// Orchestrator: Check if tab exists, rename default tab if appropriate, or create a new one.
export const checkAndAllocateTab = async (
    documentId: string,
    serviceName: string,
    templateData: {
        clientName: string;
        campaignName: string;
        serviceName: string;
        specialistName: string;
        dateStr: string;
    }
): Promise<string> => {
    const metadata = await getDocumentMetadata(documentId);
    
    // Check if the service tab already exists
    const existingTab = metadata.tabs?.find(t => t.title.toLowerCase().trim() === serviceName.toLowerCase().trim());
    if (existingTab) {
        return existingTab.tabId;
    }

    // Special behavior: If only 1 tab exists and its title is generic (e.g. "Tab 1", "Document", "Untitled tab"),
    // let's rename it to this service and populate it, to avoid empty placeholder tabs.
    if (metadata.tabs && metadata.tabs.length === 1) {
        const firstTab = metadata.tabs[0];
        const genericTitles = ['tab 1', 'document', 'untitled tab', 'untitled'];
        if (genericTitles.includes(firstTab.title.toLowerCase().trim())) {
            await renameTab(documentId, firstTab.tabId, serviceName);
            await populateTabTemplate(documentId, firstTab.tabId, templateData);
            return firstTab.tabId;
        }
    }

    // Otherwise, create a new tab for this service
    return createTabAndPopulate(documentId, serviceName, templateData);
};

// Helper to convert Google Doc Tab JSON content to clean styled HTML
export const convertGoogleDocTabToHtml = (docJson: any, tabId: string): string => {
    let targetTab: any = null;
    const findTab = (tabs: any[]) => {
        if (targetTab) return;
        for (const tab of tabs) {
            if (tab.tabProperties?.tabId === tabId) {
                targetTab = tab;
                break;
            }
            if (tab.childTabs) {
                findTab(tab.childTabs);
            }
        }
    };
    findTab(docJson.tabs || []);

    const content = targetTab?.documentTab?.body?.content || docJson.body?.content || [];
    return parseStructuralElements(content);
};

const parseStructuralElements = (elements: any[]): string => {
    let html = '';
    elements.forEach(element => {
        if (element.paragraph) {
            html += parseParagraph(element.paragraph);
        } else if (element.table) {
            html += parseTable(element.table);
        }
    });
    return html;
};

const parseParagraph = (paragraph: any): string => {
    let text = '';
    paragraph.elements?.forEach((el: any) => {
        if (el.textRun) {
            let runText = el.textRun.content || '';
            const style = el.textRun.textStyle || {};
            
            // Escape HTML entities to prevent rendering bugs
            runText = runText
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');

            // Apply style wrappers
            if (style.bold) runText = `<strong>${runText}</strong>`;
            if (style.italic) runText = `<em>${runText}</em>`;
            if (style.underline) runText = `<u>${runText}</u>`;
            if (style.link?.url) runText = `<a href="${style.link.url}" target="_blank" style="color: #6c2ef7; text-decoration: underline;">${runText}</a>`;

            // Replace linebreaks with <br>
            runText = runText.replace(/\n/g, '<br/>');
            text += runText;
        }
    });

    const styleType = paragraph.paragraphStyle?.namedStyleType || 'NORMAL_TEXT';
    
    // Clean empty paragraphs or standalone brs
    if (text.trim() === '' || text === '<br/>') {
        return '<br/>';
    }

    switch (styleType) {
        case 'HEADING_1':
            return `<h1 style="font-size: 20px; font-weight: bold; color: #0a0028; margin-top: 18px; margin-bottom: 8px;">${text}</h1>`;
        case 'HEADING_2':
            return `<h2 style="font-size: 16px; font-weight: bold; color: #0a0028; margin-top: 14px; margin-bottom: 6px;">${text}</h2>`;
        case 'HEADING_3':
            return `<h3 style="font-size: 13px; font-weight: bold; color: #0a0028; margin-top: 12px; margin-bottom: 4px;">${text}</h3>`;
        case 'HEADING_4':
        case 'HEADING_5':
        case 'HEADING_6':
            return `<h4 style="font-size: 11px; font-weight: bold; color: #0a0028; margin-top: 10px; margin-bottom: 4px;">${text}</h4>`;
        default:
            return `<p style="font-size: 11px; line-height: 1.6; color: #334155; margin-bottom: 8px; font-weight: 500;">${text}</p>`;
    }
};

const parseTable = (table: any): string => {
    let html = '<table style="width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; font-size: 10px;">';
    table.tableRows?.forEach((row: any) => {
        html += '<tr>';
        row.tableCells?.forEach((cell: any) => {
            html += '<td style="border: 1px solid #cbd5e1; padding: 8px; color: #334155; vertical-align: top;">';
            html += parseStructuralElements(cell.content || []);
            html += '</td>';
        });
        html += '</tr>';
    });
    html += '</table>';
    return html;
};

// Main exporter: Fetches the Doc tab content, formats as branded HTML letterhead, and generates the PDF via jsPDF + html2canvas
export const exportDocToLetterheadPDF = async (
    documentId: string,
    tabId: string,
    filename: string,
    metadata: {
        clientName: string;
        serviceName: string;
        specialistName: string;
        dateStr: string;
    }
): Promise<void> => {
    // 1. Fetch document content
    const res = await authenticatedFetch(`https://docs.googleapis.com/v1/documents/${documentId}?includeTabsContent=true`);
    const docJson = await res.json();
    
    // 2. Parse Google Doc Tab content into clean HTML
    let reportHtml = '';
    if (tabId === 'ALL_TABS') {
        const getAllTabs = (tabs: any[]): any[] => {
            let result: any[] = [];
            for (const tab of tabs) {
                result.push(tab);
                if (tab.childTabs) {
                    result.push(...getAllTabs(tab.childTabs));
                }
            }
            return result;
        };

        const allTabs = getAllTabs(docJson.tabs || []);
        let actualIndex = 0;
        allTabs.forEach((tab) => {
            const content = tab.documentTab?.body?.content || [];
            const tabHtml = parseStructuralElements(content);
            if (tabHtml.trim()) {
                const title = tab.tabProperties?.title || `Section`;
                const pageBreakStyle = actualIndex > 0 ? 'page-break-before: always; padding-top: 15px;' : '';
                reportHtml += `
                    <div style="${pageBreakStyle}">
                        <h1 style="font-size: 18px; font-weight: bold; border-bottom: 2px solid #6c2ef7; padding-bottom: 5px; color: #0a0028; margin-top: 10px; margin-bottom: 15px; text-transform: uppercase;">
                            ${title}
                        </h1>
                        ${tabHtml}
                    </div>
                `;
                actualIndex++;
            }
        });
        if (!reportHtml) {
            reportHtml = '<p style="text-align: center; color: #94a3b8;">No content found in any document tab.</p>';
        }
    } else {
        reportHtml = convertGoogleDocTabToHtml(docJson, tabId);
    }
    
    // 3. Fetch Company Profile configuration
    const co = await getCompanyProfile();

    // Preload social icons
    const socialsWithB64: Array<{ b64: string, value: string }> = [];
    const fallbackIconMap: Record<string, string> = {
        instagram: 'instagram.png',
        facebook: 'Facebook.png',
        youtube: 'YouTube.png',
        linkedin: 'linkedin.png',
        behance: 'Behance.png',
        x: 'X.png',
        twitter: 'X.png',
        website: 'Website.png',
        whats: 'whatsapp.png',
        whatsapp: 'whatsapp.png',
    };

    if (co?.socials) {
        for (const social of co.socials) {
            const rawLabel = social.label ? social.label.toLowerCase().trim() : '';
            if (!rawLabel) continue;
            const labelKey = rawLabel.replace(/\s+/g, '_');
            const iconFile = fallbackIconMap[labelKey] || `${labelKey}.png`;
            const iconUrl = `/${iconFile}`;
            try {
                const resp = await fetch(iconUrl);
                if (resp.ok) {
                    const blob = await resp.blob();
                    const b64: string = await new Promise((res, rej) => {
                        const reader = new FileReader();
                        reader.onloadend = () => typeof reader.result === 'string' ? res(reader.result) : rej();
                        reader.onerror = rej;
                        reader.readAsDataURL(blob);
                    });
                    socialsWithB64.push({ b64, value: social.value });
                }
            } catch (err) {
                console.warn(`Failed to preload social icon ${iconUrl}:`, err);
            }
        }
    }
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    
    // Colors
    const deepEclipse: [number, number, number] = [10, 0, 40];   // #0A0028
    const textMuted: [number, number, number] = [100, 116, 139]; // Slate 500
    const lightGray: [number, number, number] = [226, 232, 240]; // Slate 200
    const royalPurple: [number, number, number] = [108, 46, 247]; // #6C2EF7
    const white: [number, number, number] = [255, 255, 255];

    // ==========================================
    // 1. DRAW BRAND BANNER (PAGE 1)
    // ==========================================
    doc.setFillColor(...deepEclipse);
    doc.rect(0, 0, pageWidth, 46, 'F');

    // Draw Company Name Text directly instead of logo
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...white);
    doc.text(co?.companyName || 'Ash Creative Studio', 14, 18);
    let bandTextY = 23;

    if (co?.tagline) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(200, 190, 230);
        doc.text(co.tagline, 14, bandTextY);
        bandTextY += 5;
    }

    // Company contacts
    if (co?.contacts && co.contacts.length > 0) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(180, 170, 210);
        co.contacts.slice(0, 3).forEach(contact => {
            if (bandTextY < 42) {
                doc.text(contact.value, 14, bandTextY);
                bandTextY += 4.5;
            }
        });
    }

    // REPORT Title (on right side of band)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(...white);
    doc.text("REPORT", pageWidth - 14, 28, { align: 'right' });

    // ==========================================
    // 2. METADATA ROW & SEPARATOR (PAGE 1)
    // ==========================================
    const detailsY = 56;
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...deepEclipse);
    doc.text("Service:", 14, detailsY);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textMuted);
    doc.text(metadata.serviceName, 34, detailsY);

    const hasSpecialist = metadata.specialistName && 
                          metadata.specialistName.trim() !== '' && 
                          metadata.specialistName.toLowerCase() !== 'specialist';

    if (hasSpecialist) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...deepEclipse);
        doc.text("Specialist:", 90, detailsY);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(...textMuted);
        doc.text(metadata.specialistName, 110, detailsY);
    }

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...deepEclipse);
    doc.text("Date:", 155, detailsY);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textMuted);
    doc.text(metadata.dateStr, 175, detailsY);

    // Separator line
    doc.setDrawColor(...lightGray);
    doc.setLineWidth(0.5);
    doc.line(14, detailsY + 5, pageWidth - 14, detailsY + 5);

    // Client Details (Report For)
    let maxHeaderY = detailsY + 15;
    doc.setFontSize(8);
    doc.setTextColor(...textMuted);
    doc.setFont("helvetica", "bold");
    doc.text("REPORT FOR", 14, maxHeaderY);

    maxHeaderY += 6;
    doc.setFontSize(14);
    doc.setTextColor(...deepEclipse);
    doc.setFont("helvetica", "bold");
    doc.text(metadata.clientName, 14, maxHeaderY);

    // ==========================================
    // 3. RENDER GOOGLE DOC BODY HTML CONTENT
    // ==========================================
    const container = document.createElement('div');
    container.style.width = '688px'; // 182mm at 96dpi
    container.style.padding = '0px';
    container.style.position = 'absolute';
    container.style.top = '0px';
    container.style.left = '0px';
    container.style.zIndex = '-9999';
    container.style.backgroundColor = 'white';
    container.style.color = '#0f172a';

    container.innerHTML = `
        <style>
            * { box-sizing: border-box; font-family: 'Inter', sans-serif; }
            h1, h2, h3, p, li, img, table { page-break-inside: avoid !important; break-inside: avoid !important; }
            *:first-child { margin-top: 0 !important; margin-block-start: 0 !important; padding-top: 0 !important; }
            h1 { font-size: 16px; font-weight: bold; color: #0a0028; margin-top: 15px; margin-bottom: 6px; }
            h2 { font-size: 13px; font-weight: bold; color: #0a0028; margin-top: 12px; margin-bottom: 5px; }
            h3 { font-size: 11px; font-weight: bold; color: #0a0028; margin-top: 10px; margin-bottom: 4px; }
            p { line-height: 1.6; color: #334155; font-size: 11px; margin-bottom: 8px; }
            ul { margin-top: 4px; padding-left: 18px; color: #334155; font-size: 11px; line-height: 1.6; list-style-type: disc; margin-bottom: 8px; }
            ol { margin-top: 4px; padding-left: 18px; color: #334155; font-size: 11px; line-height: 1.6; list-style-type: decimal; margin-bottom: 8px; }
            li { margin-bottom: 3px; }
            b, strong { font-weight: bold; }
            i, em { font-style: italic; }
            u { text-decoration: underline; }
        </style>
        <div style="width: 100%;">
            ${reportHtml}
        </div>
    `;

    document.body.appendChild(container);

    try {
        const topMargin = 25; // clear top margin on subsequent pages
        await doc.html(container, {
            x: 14,
            y: (maxHeaderY + 6) - topMargin, // starts below client title, adjusted for margin
            width: 182,
            windowWidth: 688,
            margin: [topMargin, 0, 38, 0], // top margin=25mm, bottom=38mm for footer
            autoPaging: 'slice',
            html2canvas: {
                useCORS: true,
                logging: false
            }
        });

        // ==========================================
        // 4. DRAW PAGINATED FOOTER & HEADERS
        // ==========================================
        // Load watermark and stamp on all pages (behind footer content)
        const watermarkB64 = await loadWatermarkBase64();
        stampWatermarkAllPages(doc, watermarkB64);

        const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            const footerY = pageHeight - 24;

            // Draw continuation header on pages 2+
            if (i > 1) {
                doc.setFillColor(...deepEclipse);
                doc.rect(0, 0, pageWidth, 12, 'F');
                doc.setFontSize(8);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(255, 255, 255);
                doc.text(co?.companyName || 'Ash Creative Studio', 14, 8);
                doc.text(`${metadata.clientName} - ${metadata.serviceName} Report`, pageWidth - 14, 8, { align: 'right' });
            }

            // Separator accent line
            doc.setDrawColor(...royalPurple);
            doc.setLineWidth(0.5);
            doc.line(14, footerY, pageWidth - 14, footerY);

            // Footer brand info
            doc.setFontSize(8);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(...deepEclipse);
            doc.text(co?.companyName || 'Ash Creative Studio', 14, footerY + 6);
            
            doc.setFontSize(6.5);
            doc.setFont("helvetica", "italic");
            doc.setTextColor(...textMuted);
            doc.text(co?.tagline || 'Built to Be Seen.', 14, footerY + 10);
            
            // Centered page numbering
            doc.setFontSize(8);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(...royalPurple);
            doc.text(`${i}/${pageCount}`, pageWidth / 2, footerY + 7, { align: 'center' });

            // Right: Social Icons
            const iconSize = 5;
            const iconSpacing = 3;
            let rightX = pageWidth - 14;
            const iconY = footerY + 3.5;

            for (let s = socialsWithB64.length - 1; s >= 0; s--) {
                const social = socialsWithB64[s];
                const iconX = rightX - iconSize;
                try {
                    doc.addImage(social.b64, 'PNG', iconX, iconY, iconSize, iconSize);
                    const url = social.value.startsWith('http') ? social.value : `https://${social.value}`;
                    doc.link(iconX, iconY, iconSize, iconSize, { url });
                    rightX -= (iconSize + iconSpacing);
                } catch (err) {
                    console.warn("Failed to add social image to PDF:", err);
                }
            }
        }

        // Save PDF
        doc.save(`${filename}.pdf`);
    } catch (err) {
        console.error("HTML rendering to PDF failed", err);
    } finally {
        document.body.removeChild(container);
    }
};
