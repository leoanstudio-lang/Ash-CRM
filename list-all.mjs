import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
const firebaseConfig = { apiKey: "AIzaSyBvg1b2iowObmpiIr4-SFvoXlHw2H08ET0", authDomain: "aerp-46a6c.firebaseapp.com", projectId: "aerp-46a6c" };
const docDb = getFirestore(initializeApp(firebaseConfig));
console.log("Fetching packages...");
getDocs(collection(docDb, "packages")).then(s => { 
  console.log("Docs found:", s.docs.length);
  s.forEach(d => console.log(d.id, d.data().clientName, d.data().packageName)); 
  process.exit(0); 
}).catch(e => {
  console.error("ERROR", e);
  process.exit(1);
});
