import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBvg1b2iowObmpiIr4-SFvoXlHw2H08ET0",
    authDomain: "aerp-46a6c.firebaseapp.com",
    projectId: "aerp-46a6c"
};

const docDb = getFirestore(initializeApp(firebaseConfig));

async function run() {
    console.log("Searching clients...");
    const clients = await getDocs(collection(docDb, "clients"));
    clients.forEach(c => {
        const d = c.data();
        if ((d.name || "").toLowerCase().includes("vinu") || (d.name || "").toLowerCase().includes("vishnu")) {
            console.log("FOUND CLIENT:", c.id, d.name);
        }
    });

    console.log("Searching projects (tasks)...");
    const projects = await getDocs(collection(docDb, "projects"));
    projects.forEach(p => {
        const d = p.data();
        if ((d.clientName || "").toLowerCase().includes("vinu") || (d.clientName || "").toLowerCase().includes("vishnu") || (d.serviceName || "").toLowerCase().includes("vishnu")) {
            console.log("FOUND PROJECT:", p.id, d.clientName, d.serviceName);
        }
    });

    console.log("Searching packages...");
    const pkgs = await getDocs(collection(docDb, "packages"));
    pkgs.forEach(p => {
        const d = p.data();
        if ((d.clientName || "").toLowerCase().includes("vinu") || (d.clientName || "").toLowerCase().includes("vishnu") || (d.packageName || "").toLowerCase().includes("vishnu") || (d.packageName || "").toLowerCase().includes("vinu")) {
            console.log("FOUND PACKAGE:", p.id, d.clientName, d.packageName);
        }
    });

    process.exit(0);
}

run().catch(console.error);
