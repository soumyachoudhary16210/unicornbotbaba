// ==============================================================================
// UNICORN GOODS - Firebase Modular SDK Configuration & Exports
// Firebase Web SDK v10 (Modular ESM via CDN)
// ==============================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getDatabase, 
  ref, 
  set, 
  push, 
  onValue, 
  update, 
  remove, 
  get, 
  child,
  query, 
  orderByChild, 
  equalTo, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// ==============================================================================
// 🔑 FIREBASE CREDENTIALS
// ==============================================================================
export const firebaseConfig = {
  apiKey: "AIzaSyCCyDfF_T_I2wYlUY7NSfwvZav0x9m9DwY",
  authDomain: "unicorn-goods.firebaseapp.com",
  projectId: "unicorn-goods",
  storageBucket: "unicorn-goods.firebasestorage.app",
  messagingSenderId: "604136267406",
  appId: "1:604136267406:web:4d0d03101a869812b273df",
  databaseURL: "https://unicorn-goods-default-rtdb.firebaseio.com"
};

// Initialize Firebase Core
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
const auth = getAuth(app);

// Initialize Realtime Database
const db = getDatabase(app);

// Export instances and helper methods
export { 
  app, 
  auth, 
  db, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut, 
  onAuthStateChanged,
  ref, 
  set, 
  push, 
  onValue, 
  update, 
  remove, 
  get, 
  child,
  query, 
  orderByChild, 
  equalTo, 
  serverTimestamp 
};
