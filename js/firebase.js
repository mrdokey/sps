// Memuat SDK Firebase secara eksternal (menggunakan versi Compat agar mudah diatur)
import "https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js";
import "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js";

// Konfigurasi Project Firestore Anda
const firebaseConfig = {
  apiKey: "AIzaSyCDLuOEAGJRz4cfl8rn5JDrQOCehYE5SJg",
  authDomain: "sps-birojasa.firebaseapp.com",
  projectId: "sps-birojasa",
  storageBucket: "sps-birojasa.firebasestorage.app",
  messagingSenderId: "1076645783427",
  appId: "1:1076645783427:web:9b944d08ec4a85682838b6"
};

// Inisialisasi Firebase secara global
window.firebase.initializeApp(firebaseConfig);

// Ekspor instance Database Firestore agar bisa di-import oleh file JS controller lain
export const db = window.firebase.firestore();