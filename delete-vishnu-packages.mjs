import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where, deleteDoc, doc } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBvg1b2iowObmpiIr4-SFvoXlHw2H08ET0",
    authDomain: "aerp-46a6c.firebaseapp.com",
    projectId: "aerp-46a6c"
};

const docDb = getFirestore(initializeApp(firebaseConfig));

async function run() {
    const clientId = "qkPIj00EVpCLoHc74oik";
    console.log(`Searching packages for client ID: ${clientId}`);

    let found = false;
    const pkgs = await getDocs(query(collection(docDb, "packages"), where("clientId", "==", clientId)));
    for (const p of pkgs.docs) {
        found = true;
        console.log(`Deleting package ID: ${p.id} - ${p.data().packageName}`);
        await deleteDoc(doc(docDb, "packages", p.id));
    }

    if (!found) {
        console.log("No packages found linked to Vishnu's Client ID.");
    }
    process.exit(0);
}

run().catch(console.error);
