importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Inisialisasi Firebase di latar belakang
firebase.initializeApp({
  apiKey: "AIzaSyCDLuOEAGJRz4cfl8rn5JDrQOCehYE5SJg",
  authDomain: "sps-birojasa.firebaseapp.com",
  projectId: "sps-birojasa",
  storageBucket: "sps-birojasa.firebasestorage.app",
  messagingSenderId: "1076645783427",
  appId: "1:1076645783427:web:9b944d08ec4a85682838b6"
});

const messaging = firebase.messaging();

// Menangani Pesan Pop-up saat Aplikasi Ditutup / Mati
messaging.onBackgroundMessage((payload) => {
  console.log('[Service Worker] Menerima Notifikasi Latar Belakang:', payload);

  const title = payload.notification?.title || 'Pemberitahuan - Biro Jasa SPS';
  const options = {
    body: payload.notification?.body || 'Ada pembaruan status transaksi.',
    icon: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
    badge: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
    vibrate: [200, 100, 200, 100, 200],
    data: payload.data
  };

  self.registration.showNotification(title, options);
});