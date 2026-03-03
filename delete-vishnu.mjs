import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBvg1b2iowObmpiIr4-SFvoXlHw2H08ET0",
    authDomain: "aerp-46a6c.firebaseapp.com",
    projectId: "aerp-46a6c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
    const querySnapshot = await getDocs(collection(db, "packages"));
    let found = false;
    for (const d of querySnapshot.docs) {
        const data = d.data();
        const clientNameMatch = (data.clientName || "").toLowerCase().includes("vishnu") || (data.clientName || "").toLowerCase().includes("vinu");
        const pkgNameMatch = (data.packageName || "").toLowerCase().includes("vishnu") || (data.packageName || "").toLowerCase().includes("vinu");

        if (clientNameMatch || pkgNameMatch) {
            found = true;
            console.log(`Deleting package: ID=${d.id}, Client=${data.clientName}, Package=${data.packageName}`);
            await deleteDoc(doc(db, "packages", d.id));
        }
    }

    if (!found) {
        console.log("No package matching 'vishnu' or 'vinu' found.");
    } else {
        console.log("Deletion complete.");
    }
    process.exit(0);
}

run().catch(console.error);
