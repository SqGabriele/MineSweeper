import { initializeApp } from "firebase/app";
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyD0J4eGRZr5sAVVkRaco99BwTUZVeV5xX8",
  authDomain: "minesweeperonline-57e90.firebaseapp.com",
  projectId: "minesweeperonline-57e90",
  storageBucket: "minesweeperonline-57e90.firebasestorage.app",
  messagingSenderId: "276325476741",
  appId: "1:276325476741:web:65b3c464635fc5c2217cec",
  measurementId: "G-YJ42NS63Z3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app)
export const db = getFirestore(app)