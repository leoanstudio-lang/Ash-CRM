
import {
    collection,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    getDocs,
    getDoc,
    setDoc,
    Timestamp
} from "firebase/firestore";
import { db } from "./firebase";
import { Project, Client, Lead, Employee, Service, Package, PaymentAlert, CompanyProfile, AIConfig, Quotation } from "../types";

// --- Generic Helpers ---

export const subscribeToCollection = <T>(
    collectionName: string,
    callback: (data: T[]) => void
) => {
    const q = query(collection(db, collectionName));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const data: T[] = [];
        querySnapshot.forEach((doc) => {
            data.push({ ...doc.data(), id: doc.id } as T);
        });
        callback(data);
    }, (error) => {
        console.error(`Error listening to collection ${collectionName}:`, error);
    });
    return unsubscribe;
};

// --- Generic CRUD Operations for Hub ---

export const addDocToDB = async (collectionName: string, data: any) => {
    try {
        const docRef = await addDoc(collection(db, collectionName), data);
        return docRef.id;
    } catch (e) {
        console.error(`Error adding to ${collectionName}: `, e);
        throw e;
    }
};

export const updateDocInDB = async (collectionName: string, id: string, updates: any) => {
    try {
        const docRef = doc(db, collectionName, id);
        await updateDoc(docRef, updates);
    } catch (e) {
        console.error(`Error updating in ${collectionName}: `, e);
        throw e;
    }
};

export const deleteDocFromDB = async (collectionName: string, id: string) => {
    try {
        const docRef = doc(db, collectionName, id);
        await deleteDoc(docRef);
    } catch (e) {
        console.error(`Error deleting from ${collectionName}: `, e);
        throw e;
    }
};

export const getHubRBAC = async (): Promise<any | null> => {
    try {
        const docRef = doc(db, 'config', 'internal_hub_rbac');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data();
        }
        return null;
    } catch (error) {
        console.error('Error fetching hub RBAC:', error);
        return null;
    }
};

export const saveHubRBAC = async (rbac: any) => {
    try {
        const docRef = doc(db, 'config', 'internal_hub_rbac');
        await setDoc(docRef, rbac);
    } catch (error) {
        console.error('Error saving hub RBAC:', error);
        throw error;
    }
};

// --- Projects ---

export const addProjectToDB = async (project: Omit<Project, 'id'>) => {
    try {
        // If project has a custom ID (e.g. from our manual ID generation logic), we might want to use setDoc.
        // However, Firestore auto-ID is better. 
        // BUT the current app uses `G${Date.now()}` which is useful.
        // Let's rely on Firestore IDs for new items, but if we really want custom IDs, we use setDoc.
        // To keep it simple, we'll let Firestore generate ID, OR we pass the ID if it exists.

        // Actually, looking at the code, they generate IDs like "P1", "G123123".
        // If we want to keep that format, we should use setDoc with that ID.
        // The passed 'project' might not have 'id' if we use addDoc.
        // Let's assume the caller provides the full object usually.
        // Wait, the types says id is string.

        // Strategy: Use addDoc, let Firestore assign ID. Update the UI to use that ID.
        // OR: Use setDoc with `doc(db, "projects", customId)`.

        // For now, let's use addDoc for simplicity unless specific ID format is strictly required.
        // Update: User code uses `id: \`G${Date.now()}\``. We should respect that if possible to avoid breaking ID-based logic?
        // Actually, Firestore IDs are strings too.

        const docRef = await addDoc(collection(db, "projects"), project);
        return docRef.id;
    } catch (e) {
        console.error("Error adding project: ", e);
    }
};

export const updateProjectInDB = async (id: string, updates: Partial<Project>) => {
    try {
        const docRef = doc(db, "projects", id);
        await updateDoc(docRef, updates);
    } catch (e) {
        console.error("Error updating project: ", e);
    }
};

export const deleteProjectFromDB = async (id: string) => {
    try {
        await deleteDoc(doc(db, "projects", id));
    } catch (e) {
        console.error("Error deleting project: ", e);
    }
};

// --- Clients ---

export const addClientToDB = async (client: Omit<Client, 'id'>) => {
    try {
        const docRef = await addDoc(collection(db, "clients"), client);
        return { id: docRef.id, ...client };
    } catch (e) {
        console.error("Error adding client: ", e);
    }
}

export const updateClientInDB = async (id: string, updates: Partial<Client>) => {
    try {
        const docRef = doc(db, "clients", id);
        await updateDoc(docRef, updates);
    } catch (e) {
        console.error("Error updating client: ", e);
    }
}

export const deleteClientFromDB = async (id: string) => {
    try {
        await deleteDoc(doc(db, "clients", id));
    } catch (e) {
        console.error("Error deleting client: ", e);
    }
}

// --- Leads ---
export const addLeadToDB = async (lead: Omit<Lead, 'id'>) => {
    try {
        await addDoc(collection(db, "leads"), lead);
    } catch (e) {
        console.error("Error adding lead: ", e);
    }
}

export const updateLeadInDB = async (id: string, updates: Partial<Lead>) => {
    try {
        const docRef = doc(db, "leads", id);
        await updateDoc(docRef, updates);
    } catch (e) {
        console.error("Error updating lead: ", e);
    }
}

export const deleteLeadFromDB = async (id: string) => {
    try {
        await deleteDoc(doc(db, "leads", id));
    } catch (e) {
        console.error("Error deleting lead: ", e);
    }
}

// --- Employees ---
export const addEmployeeToDB = async (employee: Omit<Employee, 'id'>) => {
    try {
        await addDoc(collection(db, "employees"), employee);
    } catch (e) {
        console.error("Error adding employee: ", e);
    }
}

export const updateEmployeeInDB = async (id: string, updates: Partial<Employee>) => {
    try {
        const docRef = doc(db, "employees", id);
        await updateDoc(docRef, updates);
    } catch (e) {
        console.error("Error updating employee: ", e);
    }
}

export const deleteEmployeeFromDB = async (id: string) => {
    try {
        await deleteDoc(doc(db, "employees", id));
    } catch (e) {
        console.error("Error deleting employee: ", e);
    }
}

// --- Services ---
export const addServiceToDB = async (service: Omit<Service, 'id'>) => {
    try {
        await addDoc(collection(db, "services"), service);
    } catch (e) {
        console.error("Error adding service: ", e);
    }
}

export const deleteServiceFromDB = async (id: string) => {
    try {
        await deleteDoc(doc(db, "services", id));
    } catch (e) {
        console.error("Error deleting service: ", e);
    }
}

// --- Outbound Channels ---
export const addChannelToDB = async (channel: { name: string }) => {
    try {
        await addDoc(collection(db, "channels"), channel);
    } catch (e) {
        console.error("Error adding channel: ", e);
    }
}

export const deleteChannelFromDB = async (id: string) => {
    try {
        await deleteDoc(doc(db, "channels", id));
    } catch (e) {
        console.error("Error deleting channel: ", e);
    }
}

// --- Packages ---
export const addPackageToDB = async (pkg: Omit<Package, 'id'>) => {
    try {
        const docRef = await addDoc(collection(db, "packages"), pkg);
        return docRef.id;
    } catch (e) {
        console.error("Error adding package: ", e);
    }
}

export const updatePackageInDB = async (id: string, updates: Partial<Package>) => {
    try {
        const docRef = doc(db, "packages", id);
        await updateDoc(docRef, updates);
    } catch (e) {
        console.error("Error updating package: ", e);
    }
}

export const deletePackageFromDB = async (id: string) => {
    try {
        await deleteDoc(doc(db, "packages", id));
    } catch (e) {
        console.error("Error deleting package: ", e);
    }
}

// --- Payment Alerts ---
export const addPaymentAlertToDB = async (alert: Omit<PaymentAlert, 'id'>) => {
    try {
        const docRef = await addDoc(collection(db, "paymentAlerts"), alert);
        return docRef.id;
    } catch (e) {
        console.error("Error adding payment alert: ", e);
    }
}

export const updatePaymentAlertInDB = async (id: string, updates: Partial<PaymentAlert>) => {
    try {
        const docRef = doc(db, "paymentAlerts", id);
        await updateDoc(docRef, updates);
    } catch (e) {
        console.error("Error updating payment alert: ", e);
    }
}

export const deletePaymentAlertFromDB = async (id: string) => {
    try {
        await deleteDoc(doc(db, "paymentAlerts", id));
    } catch (e) {
        console.error("Error deleting payment alert: ", e);
    }
}

// --- Campaigns ---
export const addCampaignToDB = async (campaign: any) => {
    try {
        const docRef = await addDoc(collection(db, "campaigns"), campaign);
        return docRef.id;
    } catch (e) {
        console.error("Error adding campaign: ", e);
    }
}

export const updateCampaignInDB = async (id: string, updates: any) => {
    try {
        const docRef = doc(db, "campaigns", id);
        await updateDoc(docRef, updates);
    } catch (e) {
        console.error("Error updating campaign: ", e);
    }
}

export const deleteCampaignFromDB = async (id: string) => {
    try {
        await deleteDoc(doc(db, "campaigns", id));
    } catch (e) {
        console.error("Error deleting campaign: ", e);
    }
}

// --- Outbound: Campaign Sequences ---
export const addCampaignSequenceToDB = async (sequence: any) => {
    try {
        const docRef = await addDoc(collection(db, "campaignSequences"), sequence);
        return docRef.id;
    } catch (e) {
        console.error("Error adding campaign sequence: ", e);
    }
}

export const updateCampaignSequenceInDB = async (id: string, updates: any) => {
    try {
        await updateDoc(doc(db, "campaignSequences", id), updates);
    } catch (e) {
        console.error("Error updating campaign sequence: ", e);
    }
}

export const deleteCampaignSequenceFromDB = async (id: string) => {
    try {
        await deleteDoc(doc(db, "campaignSequences", id));
    } catch (e) {
        console.error("Error deleting campaign sequence: ", e);
    }
}

// --- Outbound: Campaign Prospects ---
export const addCampaignProspectToDB = async (prospect: any) => {
    try {
        const docRef = await addDoc(collection(db, "campaignProspects"), prospect);
        return docRef.id;
    } catch (e) {
        console.error("Error adding campaign prospect: ", e);
    }
}

export const updateCampaignProspectInDB = async (id: string, updates: any) => {
    try {
        const docRef = doc(db, "campaignProspects", id);
        await updateDoc(docRef, updates);
    } catch (e) {
        console.error("Error updating campaign prospect: ", e);
    }
}

export const deleteCampaignProspectFromDB = async (id: string) => {
    try {
        await deleteDoc(doc(db, "campaignProspects", id));
    } catch (e) {
        console.error("Error deleting campaign prospect: ", e);
    }
}

// --- Outbound: Active Deals ---
export const addActiveDealToDB = async (deal: any) => {
    try {
        const docRef = await addDoc(collection(db, "activeDeals"), deal);
        return docRef.id;
    } catch (e) {
        console.error("Error adding active deal: ", e);
    }
}

export const updateActiveDealInDB = async (id: string, updates: any) => {
    try {
        const docRef = doc(db, "activeDeals", id);
        await updateDoc(docRef, updates);
    } catch (e) {
        console.error("Error updating active deal: ", e);
    }
}

export const deleteActiveDealFromDB = async (id: string) => {
    try {
        await deleteDoc(doc(db, "activeDeals", id));
    } catch (e) {
        console.error("Error deleting active deal: ", e);
    }
}

// --- Outbound: Nurtured Leads ---
export const addNurturedLeadToDB = async (lead: any) => {
    try {
        const docRef = await addDoc(collection(db, "nurturing"), lead);
        return docRef.id;
    } catch (e) {
        console.error("Error adding nurtured lead: ", e);
    }
}

export const updateNurturedLeadInDB = async (id: string, updates: any) => {
    try {
        const docRef = doc(db, "nurturing", id);
        await updateDoc(docRef, updates);
    } catch (e) {
        console.error("Error updating nurtured lead: ", e);
    }
}

export const deleteNurturedLeadFromDB = async (id: string) => {
    try {
        await deleteDoc(doc(db, "nurturing", id));
    } catch (e) {
        console.error("Error deleting nurtured lead: ", e);
    }
}

// --- Outbound: Silent Leads (No Response Pool) ---
export const addSilentLeadToDB = async (lead: any) => {
    try {
        const docRef = await addDoc(collection(db, "noResponsePool"), lead);
        return docRef.id;
    } catch (e) {
        console.error("Error adding silent lead: ", e);
    }
}

export const updateSilentLeadInDB = async (id: string, updates: any) => {
    try {
        const docRef = doc(db, "noResponsePool", id);
        await updateDoc(docRef, updates);
    } catch (e) {
        console.error("Error updating silent lead: ", e);
    }
}

export const deleteSilentLeadFromDB = async (id: string) => {
    try {
        await deleteDoc(doc(db, "noResponsePool", id));
    } catch (e) {
        console.error("Error deleting silent lead: ", e);
    }
}

// --- Outbound: Suppressed Leads ---
export const addSuppressedLeadToDB = async (lead: any) => {
    try {
        const docRef = await addDoc(collection(db, "suppressionList"), lead);
        return docRef.id;
    } catch (e) {
        console.error("Error adding suppressed lead: ", e);
    }
}

export const deleteSuppressedLeadFromDB = async (id: string) => {
    try {
        await deleteDoc(doc(db, "suppressionList", id));
    } catch (e) {
        console.error("Error deleting suppressed lead: ", e);
    }
}

// --- Config / Company Profile ---

export const getCompanyProfile = async (): Promise<CompanyProfile | null> => {
    try {
        const docRef = doc(db, 'config', 'company_profile');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data() as CompanyProfile;
        }
        return null;
    } catch (error) {
        console.error('Error fetching company profile:', error);
        return null;
    }
};

export const saveCompanyProfile = async (profile: CompanyProfile) => {
    try {
        const docRef = doc(db, 'config', 'company_profile');
        await setDoc(docRef, profile);
        console.log('Company Profile successfully saved!');
    } catch (error) {
        console.error('Error saving company profile:', error);
    }
};

export const getAIConfig = async (): Promise<AIConfig | null> => {
    try {
        const docRef = doc(db, 'config', 'ai_config');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data() as AIConfig;
        }
        return null;
    } catch (error) {
        console.error('Error fetching AI config:', error);
        return null;
    }
};

export const saveAIConfig = async (config: AIConfig) => {
    try {
        const docRef = doc(db, 'config', 'ai_config');
        await setDoc(docRef, config);
        console.log('AI Config successfully saved!');
    } catch (error) {
        console.error('Error saving AI config:', error);
    }
};

// --- Quotations ---

export const addQuotationToDB = async (quotation: Omit<Quotation, 'id'>) => {
    try {
        const docRef = await addDoc(collection(db, "quotations"), quotation);
        return docRef.id;
    } catch (e) {
        console.error("Error adding quotation: ", e);
    }
};

export const updateQuotationInDB = async (id: string, updates: Partial<Quotation>) => {
    try {
        const docRef = doc(db, "quotations", id);
        await updateDoc(docRef, updates);
    } catch (e) {
        console.error("Error updating quotation: ", e);
    }
};

export const deleteQuotationFromDB = async (id: string) => {
    try {
        await deleteDoc(doc(db, "quotations", id));
    } catch (e) {
        console.error("Error deleting quotation: ", e);
    }
};

// ============================================================
// --- INBOUND SALES ENGINE ---
// ============================================================

// --- Inbound: Sources (like Campaigns for Outbound) ---
export const addInboundSourceToDB = async (source: any) => {
    try { const ref = await addDoc(collection(db, "inboundSources"), source); return ref.id; }
    catch (e) { console.error("Error adding inbound source:", e); }
};
export const updateInboundSourceInDB = async (id: string, updates: any) => {
    try { await updateDoc(doc(db, "inboundSources", id), updates); }
    catch (e) { console.error("Error updating inbound source:", e); }
};
export const deleteInboundSourceFromDB = async (id: string) => {
    try { await deleteDoc(doc(db, "inboundSources", id)); }
    catch (e) { console.error("Error deleting inbound source:", e); }
};

// --- Inbound: Leads Pool (like campaignProspects for Outbound) ---
export const addInboundLeadToDB = async (lead: any) => {
    try { const ref = await addDoc(collection(db, "inboundLeads"), lead); return ref.id; }
    catch (e) { console.error("Error adding inbound lead:", e); }
};
export const updateInboundLeadInDB = async (id: string, updates: any) => {
    try { await updateDoc(doc(db, "inboundLeads", id), updates); }
    catch (e) { console.error("Error updating inbound lead:", e); }
};
export const deleteInboundLeadFromDB = async (id: string) => {
    try { await deleteDoc(doc(db, "inboundLeads", id)); }
    catch (e) { console.error("Error deleting inbound lead:", e); }
};

// --- Inbound: Active Deals Pipeline ---
export const addInboundDealToDB = async (deal: any) => {
    try { const ref = await addDoc(collection(db, "inboundActiveDeals"), deal); return ref.id; }
    catch (e) { console.error("Error adding inbound deal:", e); }
};
export const updateInboundDealInDB = async (id: string, updates: any) => {
    try { await updateDoc(doc(db, "inboundActiveDeals", id), updates); }
    catch (e) { console.error("Error updating inbound deal:", e); }
};
export const deleteInboundDealFromDB = async (id: string) => {
    try { await deleteDoc(doc(db, "inboundActiveDeals", id)); }
    catch (e) { console.error("Error deleting inbound deal:", e); }
};

// --- Inbound: Nurturing ---
export const addInboundNurturedLeadToDB = async (lead: any) => {
    try { const ref = await addDoc(collection(db, "inboundNurturing"), lead); return ref.id; }
    catch (e) { console.error("Error adding inbound nurtured lead:", e); }
};
export const updateInboundNurturedLeadInDB = async (id: string, updates: any) => {
    try { await updateDoc(doc(db, "inboundNurturing", id), updates); }
    catch (e) { console.error("Error updating inbound nurtured lead:", e); }
};
export const deleteInboundNurturedLeadFromDB = async (id: string) => {
    try { await deleteDoc(doc(db, "inboundNurturing", id)); }
    catch (e) { console.error("Error deleting inbound nurtured lead:", e); }
};

// --- Inbound: No Response Pool ---
export const addInboundSilentLeadToDB = async (lead: any) => {
    try { const ref = await addDoc(collection(db, "inboundNoResponsePool"), lead); return ref.id; }
    catch (e) { console.error("Error adding inbound silent lead:", e); }
};
export const updateInboundSilentLeadInDB = async (id: string, updates: any) => {
    try { await updateDoc(doc(db, "inboundNoResponsePool", id), updates); }
    catch (e) { console.error("Error updating inbound silent lead:", e); }
};
export const deleteInboundSilentLeadFromDB = async (id: string) => {
    try { await deleteDoc(doc(db, "inboundNoResponsePool", id)); }
    catch (e) { console.error("Error deleting inbound silent lead:", e); }
};

// --- Inbound: Suppression List ---
export const addInboundSuppressedLeadToDB = async (lead: any) => {
    try { const ref = await addDoc(collection(db, "inboundSuppressionList"), lead); return ref.id; }
    catch (e) { console.error("Error adding inbound suppressed lead:", e); }
};
export const deleteInboundSuppressedLeadFromDB = async (id: string) => {
    try { await deleteDoc(doc(db, "inboundSuppressionList", id)); }
    catch (e) { console.error("Error deleting inbound suppressed lead:", e); }
};

// --- Manual Tasks (Employee-Created) ---
export const addManualTaskToDB = async (task: any) => {
    try {
        const docRef = await addDoc(collection(db, "manualTasks"), task);
        return docRef.id;
    } catch (e) {
        console.error("Error adding manual task: ", e);
    }
};

export const updateManualTaskInDB = async (id: string, updates: any) => {
    try {
        await updateDoc(doc(db, "manualTasks", id), updates);
    } catch (e) {
        console.error("Error updating manual task: ", e);
    }
};

export const deleteManualTaskFromDB = async (id: string) => {
    try {
        await deleteDoc(doc(db, "manualTasks", id));
    } catch (e) {
        console.error("Error deleting manual task: ", e);
    }
};

// --- Employee Notifications (for Admin Panel) ---
export const addEmployeeNotificationToDB = async (notif: any) => {
    try {
        const docRef = await addDoc(collection(db, "employeeNotifications"), notif);
        return docRef.id;
    } catch (e) {
        console.error("Error adding employee notification: ", e);
    }
};

export const updateEmployeeNotificationInDB = async (id: string, updates: any) => {
    try {
        await updateDoc(doc(db, "employeeNotifications", id), updates);
    } catch (e) {
        console.error("Error updating employee notification: ", e);
    }
};

export const deleteEmployeeNotificationFromDB = async (id: string) => {
    try {
        await deleteDoc(doc(db, "employeeNotifications", id));
    } catch (e) {
        console.error("Error deleting employee notification: ", e);
    }
};

// --- Quotation Demos ---
export const addQuotationDemoToDB = async (demo: any) => {
    try {
        const docRef = await addDoc(collection(db, "quotationDemos"), demo);
        return docRef.id;
    } catch (e) {
        console.error("Error adding quotation demo: ", e);
    }
};

export const updateQuotationDemoInDB = async (id: string, updates: any) => {
    try {
        await updateDoc(doc(db, "quotationDemos", id), updates);
    } catch (e) {
        console.error("Error updating quotation demo: ", e);
    }
};

export const deleteQuotationDemoFromDB = async (id: string) => {
    try {
        await deleteDoc(doc(db, "quotationDemos", id));
    } catch (e) {
        console.error("Error deleting quotation demo: ", e);
    }
};

// --- Quotation Approval Auto-Routing from Sales ---
export const approveSalesQuotation = async (quotationId: string, salesDealId: string, salesType: 'Inbound' | 'Outbound') => {
    try {
        // 1. Find and get the deal from the various possible collections
        const collections = salesType === 'Inbound' 
            ? ['inboundActiveDeals', 'inboundNurturing', 'inboundSilent']
            : ['activeDeals', 'nurturing', 'silent'];

        let dealData: any = null;
        let foundRef: any = null;
        let originalCollectionName: string = '';

        for (const colName of collections) {
            const docRef = doc(db, colName, salesDealId);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                dealData = snap.data();
                foundRef = docRef;
                originalCollectionName = colName;
                break;
            }
        }

        if (!dealData) {
            console.warn('Sales deal does not exist, updating quotation only.');
            await updateDoc(doc(db, "quotations", quotationId), { status: 'Approved' });
            return;
        }

        // 2. Add client to client DB
        const clientData = {
            name: dealData.contactName || dealData.name || 'Unknown',
            companyName: dealData.companyName || dealData.projectName || '',
            mobile: dealData.mobile || (dealData.contactMethods?.find((m: any) => m.type === 'phone' || m.type === 'whatsapp')?.value) || '',
            email: dealData.email || (dealData.contactMethods?.find((m: any) => m.type === 'email')?.value) || '',
            source: salesType,
            status: 'Active',
            createdAt: new Date().toISOString(),
        };
        const clientRef = await addDoc(collection(db, "clients"), clientData);
        const clientId = clientRef.id;

        // 3. Auto-route to department if campaign exists
        let projectId = '';
        if (dealData.campaignId) {
            const campaignCol = salesType === 'Inbound' ? 'inboundSources' : 'campaigns';
            const campSnapshot = await getDoc(doc(db, campaignCol, dealData.campaignId));
            if (campSnapshot.exists()) {
                const campaign = campSnapshot.data();
                const targetDept = campaign.department;
                if (targetDept) {
                    const today = new Date();
                    const defaultDeadline = new Date(today);
                    defaultDeadline.setMonth(defaultDeadline.getMonth() + 1);
                    
                    const projRef = await addDoc(collection(db, "projects"), {
                        clientId: clientId,
                        clientName: clientData.name,
                        serviceId: 'SALES_ROUTED',
                        serviceName: targetDept,
                        type: targetDept === 'Development' ? 'Web'
                            : targetDept === 'Graphics Designing' ? 'Graphic'
                            : 'Marketing',
                        priority: 'Medium',
                        startDate: today.toISOString().split('T')[0],
                        deadline: defaultDeadline.toISOString().split('T')[0],
                        totalAmount: dealData.value || 0,
                        advance: 0,
                        description: `Auto-routed from ${salesType} campaign: ${campaign.name || ''}. ${dealData.notes || ''}`.trim(),
                        status: 'Pending',
                        progress: 0,
                        createdAt: new Date().toISOString()
                    });
                    projectId = projRef.id;
                }
            }
        }

        // 4. Delete deal from Sales CRM
        await deleteDoc(foundRef);

        // 5. Update quotation status to Approved and store backup/routing metadata for potential undo
        await updateDoc(doc(db, "quotations", quotationId), {
            status: 'Approved',
            salesDealBackup: dealData,
            originalCollection: originalCollectionName,
            createdClientId: clientId,
            createdProjectId: projectId || null
        });
    } catch (e) {
        console.error("Error approving sales quotation: ", e);
        throw e;
    }
};

export const revertSalesQuotation = async (quotationId: string, newStatus: string) => {
    try {
        const qtnRef = doc(db, "quotations", quotationId);
        const qtnSnapshot = await getDoc(qtnRef);
        if (!qtnSnapshot.exists()) return;

        const qtnData = qtnSnapshot.data();

        // 1. Re-create the sales deal back in its original collection
        if (qtnData.salesDealId && qtnData.salesDealBackup && qtnData.originalCollection) {
            const dealRef = doc(db, qtnData.originalCollection, qtnData.salesDealId);
            await setDoc(dealRef, qtnData.salesDealBackup);
            console.log(`Re-created sales deal in ${qtnData.originalCollection}`);
        }

        // 2. Delete auto-created Client
        if (qtnData.createdClientId) {
            await deleteDoc(doc(db, "clients", qtnData.createdClientId));
            console.log(`Deleted auto-created client: ${qtnData.createdClientId}`);
        }

        // 3. Delete auto-created Project
        if (qtnData.createdProjectId) {
            await deleteDoc(doc(db, "projects", qtnData.createdProjectId));
            console.log(`Deleted auto-created project: ${qtnData.createdProjectId}`);
        }

        // 4. Reset quotation status and clear backup/routing metadata
        await updateDoc(qtnRef, {
            status: newStatus,
            salesDealBackup: null,
            originalCollection: null,
            createdClientId: null,
            createdProjectId: null
        });
    } catch (e) {
        console.error("Error reverting sales quotation: ", e);
        throw e;
    }
};

// --- Attendance & Holiday Settings ---

export const getAttendanceSettings = async (): Promise<any> => {
  try {
    const docRef = doc(db, 'config', 'attendance_settings');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return {
      officialWorkingHours: 8,
      officialStartTime: '09:00',
      lateTrackingEnabled: false,
      lateGracePeriod: 15,
      ipRestrictionEnabled: false,
      approvedIPs: [],
      autoSundayHoliday: true,
      defaultWorkingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    };
  } catch (error) {
    console.error('Error fetching attendance settings:', error);
    return null;
  }
};

export const saveAttendanceSettings = async (settings: any) => {
  try {
    const docRef = doc(db, 'config', 'attendance_settings');
    await setDoc(docRef, settings);
  } catch (error) {
    console.error('Error saving attendance settings:', error);
    throw error;
  }
};

export const logEmployeeLoginWithReason = async (
  employeeId: string,
  employeeName: string,
  ipAddress: string,
  device: string,
  lateReason?: string | null,
  lateMinutes?: number | null
) => {
  try {
    const localDate = new Date();
    const dateYMD = localDate.getFullYear() + '-' + 
                    String(localDate.getMonth() + 1).padStart(2, '0') + '-' + 
                    String(localDate.getDate()).padStart(2, '0');
    const docId = `${employeeId}_${dateYMD}`;
    const docRef = doc(db, 'attendance', docId);
    const docSnap = await getDoc(docRef);

    const newSession = {
      loginTime: new Date().toISOString(),
      logoutTime: null,
      ipAddress,
      device,
      deviceInfo: navigator.userAgent,
      lastPingTime: new Date().toISOString()
    };

    if (!docSnap.exists()) {
      await setDoc(docRef, {
        employeeId,
        employeeName,
        date: dateYMD,
        status: 'Present',
        sessions: [newSession],
        totalWorkedMs: 0,
        lateReason: lateReason || null,
        lateMinutes: lateMinutes || null,
        adminNote: '',
        editHistory: [],
        createdAt: new Date().toISOString()
      });
    } else {
      const currentData = docSnap.data();
      const updatedSessions = [...(currentData.sessions || []), newSession];
      const updates: any = {
        sessions: updatedSessions,
        status: 'Present'
      };
      if (lateReason !== undefined) updates.lateReason = lateReason;
      if (lateMinutes !== undefined) updates.lateMinutes = lateMinutes;
      await updateDoc(docRef, updates);
    }
  } catch (err) {
    console.error("Error logging employee login:", err);
    throw err;
  }
};

export const logEmployeeLogout = async (employeeId: string) => {
  try {
    const localDate = new Date();
    const dateYMD = localDate.getFullYear() + '-' + 
                    String(localDate.getMonth() + 1).padStart(2, '0') + '-' + 
                    String(localDate.getDate()).padStart(2, '0');
    
    // We check today's and yesterday's doc to find if there is an open session.
    const checkDocs = [
      `${employeeId}_${dateYMD}`,
      // Yesterday
      `${employeeId}_${new Date(localDate.getTime() - 24 * 60 * 60 * 1000).getFullYear()}-${String(new Date(localDate.getTime() - 24 * 60 * 60 * 1000).getMonth() + 1).padStart(2, '0')}-${String(new Date(localDate.getTime() - 24 * 60 * 60 * 1000).getDate()).padStart(2, '0')}`
    ];

    for (const docId of checkDocs) {
      const docRef = doc(db, 'attendance', docId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const sessions = data.sessions || [];
        const openSessionIdx = sessions.findIndex((s: any) => s.logoutTime === null);
        
        if (openSessionIdx !== -1) {
          // Close it!
          sessions[openSessionIdx].logoutTime = new Date().toISOString();
          
          // Recalculate total worked ms
          let totalWorkedMs = 0;
          sessions.forEach((s: any) => {
            if (s.loginTime && s.logoutTime) {
              totalWorkedMs += new Date(s.logoutTime).getTime() - new Date(s.loginTime).getTime();
            }
          });
          
          await updateDoc(docRef, {
            sessions,
            totalWorkedMs
          });
          return;
        }
      }
    }
  } catch (err) {
    console.error("Error logging employee logout:", err);
    throw err;
  }
};
