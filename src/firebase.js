

// src/firebase.js
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  doc, 
  onSnapshot, 
  setDoc 
} from "firebase/firestore";

// paste your Firebase configuration here
const firebaseConfig = {
  apiKey: "AIzaSyDipQkxTnsGpHCowv5dTbZzIDKY236iiUY",
  authDomain: "glucotrack-80566.firebaseapp.com",
  projectId: "glucotrack-80566",
  storageBucket: "glucotrack-80566.firebasestorage.app",
  messagingSenderId: "1030501258653",
  appId: "1:1030501258653:web:00a074f3d3aef7a044cb74",
  measurementId: "G-JVL9KJ79PX"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Real-time listener helper for a Firestore document
export function subscribeToDoc(docPath, callback) {
  const docRef = doc(db, docPath);
  return onSnapshot(
    docRef, 
    (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data().data);
      } else {
        callback(null);
      }
    },
    (err) => {
      console.error(`Firestore error on ${docPath}:`, err);
    }
  );
}

// Writer helper for a Firestore document
export async function saveToDoc(docPath, payload) {
  try {
    const docRef = doc(db, docPath);
    await setDoc(docRef, { data: payload }, { merge: true });
    return true;
  } catch (err) {
    console.error(`Firestore write error on ${docPath}:`, err);
    return false;
  }
}