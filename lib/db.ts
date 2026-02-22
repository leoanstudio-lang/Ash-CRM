
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
            data.push({ id: doc.id, ...doc.data() } as T);
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
