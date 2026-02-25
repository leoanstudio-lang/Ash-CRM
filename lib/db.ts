
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
import { Project, Client, Lead, Employee, Service, Package, PaymentAlert, CompanyProfile, Quotation } from "../types";

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
        await addDoc(collection(db, "clients"), client);
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
