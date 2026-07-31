import { db } from './firebase.js';
import { initKlienController } from './controllers/klien.js';
import { initSetelanController } from './controllers/setelan.js';
import { initTransaksiController } from './controllers/transaksi.js';
import { initDashboardController } from './controllers/dashboard.js';
import { initKeuanganController } from './controllers/keuangan.js';

export let isSidebarCollapsed = false;
let isUserLoggedIn = false;

// Kredensial WA Gateway
const WA_API_SEND = "https://wa.mrdsolution.my.id/api/send-message";
const WA_API_KEY = "7BC82018076500360255A4E0F78D52C7";
const SENDER_SESSION = "botmrd"; 

// DAFTAR NOMOR WA TERDAFTAR SEBAGAI PENGELOLA (DEVELOPER + OWNER)
const ALLOWED_NUMBERS = [
    "62895428400665", // Nomor Kontrol Developer Anda
    "6285237044224", // Owner 1 (I Wayan Tiles Arnaya)
    "6285238010224", // Owner 2 (Ni Nyoman Suryani)
    "6282342834885"  // Wulan JNE
];

// VAPID Public Key Web Push FCM
const VAPID_PUBLIC_KEY = "BDHfqsMB-LXzpqeAdSasAmCZggCw4a0mHG0AVTayWbuUn3Hh11YOGeeGjtBC1mAvStBpyHGiEU-Kum8Hk5JNZKM";

// 🧹 FUNGSI PEMBERSIH FORMAT NOMOR HANDPHONE
function cleanPhoneNumber(phone) {
    let cleaned = String(phone || '').replace(/\D/g, ''); 
    if (cleaned.startsWith('0')) {
        cleaned = '62' + cleaned.substring(1);
    } else if (cleaned.startsWith('8')) {
        cleaned = '62' + cleaned;
    }
    return cleaned;
}

// =======================================================
// 🛡️ CUSTOM DIALOG MODAL (TANPA TULISAN URL BROWSER)
// =======================================================
window.showAlert = function(title, message, type = 'info') {
    const modal = document.getElementById('custom-dialog-modal');
    const titleEl = document.getElementById('dialog-title');
    const msgEl = document.getElementById('dialog-message');
    const iconEl = document.getElementById('dialog-icon');
    const btnBox = document.getElementById('dialog-buttons');

    if (!modal) return;

    titleEl.innerText = title;
    msgEl.innerText = message;

    if (type === 'success') {
        iconEl.className = "fa-solid fa-circle-check text-emerald-600";
    } else if (type === 'error') {
        iconEl.className = "fa-solid fa-circle-exclamation text-rose-600";
    } else {
        iconEl.className = "fa-solid fa-circle-info text-orange-600";
    }

    btnBox.innerHTML = `
        <button onclick="closeCustomDialog()" class="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-xl text-xs transition">
            OK, Mengerti
        </button>
    `;

    modal.classList.remove('hidden');
};

window.showConfirm = function(title, message, onConfirmCallback) {
    const modal = document.getElementById('custom-dialog-modal');
    const titleEl = document.getElementById('dialog-title');
    const msgEl = document.getElementById('dialog-message');
    const iconEl = document.getElementById('dialog-icon');
    const btnBox = document.getElementById('dialog-buttons');

    if (!modal) return;

    titleEl.innerText = title;
    msgEl.innerText = message;
    iconEl.className = "fa-solid fa-triangle-exclamation text-amber-500";

    btnBox.innerHTML = `
        <button id="btn-dialog-cancel" class="flex-1 border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl text-xs hover:bg-gray-50 transition">
            Batal
        </button>
        <button id="btn-dialog-confirm" class="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2.5 rounded-xl text-xs transition shadow-sm">
            Ya, Lanjutkan
        </button>
    `;

    document.getElementById('btn-dialog-cancel').onclick = () => closeCustomDialog();
    document.getElementById('btn-dialog-confirm').onclick = () => {
        closeCustomDialog();
        if (onConfirmCallback) onConfirmCallback();
    };

    modal.classList.remove('hidden');
};

window.closeCustomDialog = function() {
    document.getElementById('custom-dialog-modal')?.classList.add('hidden');
};

// =======================================================
// 📲 FCM PUSH NOTIFICATION REGISTRATION
// =======================================================
async function initFCM() {
    try {
        if ('serviceWorker' in navigator && window.firebase && window.firebase.messaging) {
            await navigator.serviceWorker.register('./firebase-messaging-sw.js');
            const messaging = window.firebase.messaging();
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                const token = await messaging.getToken({ vapidKey: VAPID_PUBLIC_KEY });
                if (token) {
                    await db.collection('admin_tokens').doc('owner').set({
                        fcm_token: token,
                        updatedAt: new Date().toISOString()
                    });
                    console.log("✅ FCM Token HP Owner terdaftar!");
                }
            }
        }
    } catch (e) {
        console.warn("FCM tidak aktif:", e.message);
    }
}

// =======================================================
// 🔗 EJS-STYLE PARSER: INJEKSI KOMPONEN DENGAN ANTI-CACHE
// =======================================================
async function includeHTML() {
    const elements = document.querySelectorAll('[data-include]');
    for (const el of elements) {
        const file = el.getAttribute('data-include');
        try {
            const cacheBuster = `?v=${Date.now()}`;
            const response = await fetch(file + cacheBuster);
            if (response.ok) {
                const htmlContent = await response.text();
                el.outerHTML = htmlContent;
            }
        } catch (err) {
            console.error("Gagal memuat komponen anak index:", file, err.message);
        }
    }
}

// --- LOGIKA UTAMA OTENTIKASI STATUS ---
function checkAuth() {
    let storageLogged = false;
    try {
        storageLogged = (localStorage.getItem('sps_logged_in') === 'true') || (sessionStorage.getItem('sps_logged_in') === 'true');
    } catch(e) {}

    const isLogged = isUserLoggedIn || storageLogged;
    const loginScreen = document.getElementById('login-screen');
    const appLayout = document.getElementById('app-layout');

    if (isLogged) {
        if (loginScreen) {
            loginScreen.style.setProperty('display', 'none', 'important');
            loginScreen.classList.add('hidden');
        }
        if (appLayout) {
            appLayout.classList.remove('hidden');
            appLayout.style.setProperty('display', 'flex', 'important');
        }
    } else {
        if (loginScreen) {
            loginScreen.style.setProperty('display', 'flex', 'important');
            loginScreen.classList.remove('hidden');
        }
        if (appLayout) {
            appLayout.classList.add('hidden');
            appLayout.style.setProperty('display', 'none', 'important');
        }
    }
}

// 🔑 FUNGSI MINTA KODE OTP
async function handleRequestOTP(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    const rawPhone = document.getElementById('input-phone')?.value;
    const cleanPhone = cleanPhoneNumber(rawPhone);

    if (!cleanPhone) {
        return window.showAlert("Perhatian", "Silakan masukkan nomor WhatsApp Anda terlebih dahulu!", "info");
    }

    if (!ALLOWED_NUMBERS.includes(cleanPhone)) {
        return window.showAlert("Akses Ditolak", `Nomor ${cleanPhone} tidak terdaftar sebagai pengelola Biro Jasa SPS.`, "error");
    }

    const btn = document.getElementById('btn-request-otp');
    if (btn) {
        btn.disabled = true;
        btn.innerText = "Mengirim...";
    }

    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 300000;

    try {
        await db.collection('login_otp').doc('sps_owner').set({
            code: generatedOtp,
            targetPhone: cleanPhone,
            expiresAt: expiresAt
        });

        const messageText = `🔑 *VERIFIKASI AKSES BIRO JASA SPS*\n\nKode OTP login Anda adalah: *${generatedOtp}*\n\n_Kode ini berlaku selama 5 menit. Jangan bagikan kepada siapa pun demi keamanan data._`;
        const endpoint = `${WA_API_SEND}?key=${WA_API_KEY}&session=${SENDER_SESSION}&to=${cleanPhone}&text=${encodeURIComponent(messageText)}`;
        
        await fetch(endpoint);

        window.showAlert("OTP Terkirim", `Kode OTP telah dikirimkan ke WhatsApp (${cleanPhone}).`, "success");

        document.getElementById('area-request-otp')?.classList.add('hidden');
        document.getElementById('area-verify-otp')?.classList.remove('hidden');
        startOtpTimer(300);
    } catch (err) {
        window.showAlert("Gagal", "Gagal memproses OTP: " + err.message, "error");
        if (btn) {
            btn.disabled = false;
            btn.innerText = "Minta Kode OTP";
        }
    }
}

// 🔐 FUNGSI VERIFIKASI KODE OTP
async function handleVerifyOTP(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    const inputEl = document.getElementById('input-otp');
    const inputOtp = inputEl ? inputEl.value.trim() : '';
    
    if (!inputOtp) return window.showAlert("Perhatian", "Silakan masukkan 6 digit kode OTP!", "info");

    try {
        const doc = await db.collection('login_otp').doc('sps_owner').get();
        if (doc.exists) {
            const data = doc.data();
            const currentTime = Date.now();

            const savedCode = String(data.code || '').trim();
            const userCode = String(inputOtp).trim();

            if (savedCode === userCode && currentTime < data.expiresAt) {
                clearInterval(timerInterval);
                
                isUserLoggedIn = true;
                try { sessionStorage.setItem('sps_logged_in', 'true'); } catch(e) {}
                try { localStorage.setItem('sps_logged_in', 'true'); } catch(e) {}

                checkAuth();
                
                let targetPage = 'dashboard';
                const savedPage = sessionStorage.getItem('sps_active_page');
                if (savedPage) targetPage = savedPage;
                switchPage(targetPage);
            } else {
                if (currentTime >= data.expiresAt) {
                    window.showAlert("Kedaluwarsa", "Kode OTP sudah kedaluwarsa! Silakan minta kode baru.", "error");
                } else {
                    window.showAlert("Salah", "Kode OTP yang Anda masukkan tidak cocok!", "error");
                }
            }
        } else {
            window.showAlert("Error", "Sesi OTP tidak ditemukan di server!", "error");
        }
    } catch (err) {
        window.showAlert("Gagal", "Gagal verifikasi: " + err.message, "error");
    }
}

let timerInterval;
function startOtpTimer(duration) {
    let timer = duration, minutes, seconds;
    const timerDisplay = document.getElementById('otp-timer');
    clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        minutes = parseInt(timer / 60, 10);
        seconds = parseInt(timer % 60, 10);

        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;

        if (timerDisplay) timerDisplay.textContent = `Kode kedaluwarsa dalam: ${minutes}:${seconds}`;

        if (--timer < 0) {
            clearInterval(timerInterval);
            document.getElementById('area-request-otp')?.classList.remove('hidden');
            document.getElementById('area-verify-otp')?.classList.add('hidden');
            const btn = document.getElementById('btn-request-otp');
            if (btn) {
                btn.disabled = false;
                btn.innerText = "Minta Kode OTP";
            }
        }
    }, 1000);
}

function handleLogout() {
    window.showConfirm("Konfirmasi Keluar", "Apakah Anda yakin ingin keluar dari aplikasi Biro Jasa SPS?", () => {
        isUserLoggedIn = false;
        try { localStorage.removeItem('sps_logged_in'); } catch(e) {}
        try { sessionStorage.removeItem('sps_logged_in'); } catch(e) {}
        try { sessionStorage.removeItem('sps_active_page'); } catch(e) {}
        checkAuth();
        document.getElementById('area-request-otp')?.classList.remove('hidden');
        document.getElementById('area-verify-otp')?.classList.add('hidden');
        const btn = document.getElementById('btn-request-otp');
        if (btn) {
            btn.disabled = false;
            btn.innerText = "Minta Kode OTP";
        }
        clearInterval(timerInterval);
    });
}

// 🔒 LOGIKA NAVIGASI PAGE DENGAN SISTEM KUNCI REFRESH
export function switchPage(pageId) {
    const validPages = ['dashboard', 'transaksi', 'keuangan', 'klien', 'setelan'];
    if (!validPages.includes(pageId)) pageId = 'dashboard';

    document.querySelectorAll('.page-section').forEach(el => el.classList.add('hidden'));
    const targetPage = document.getElementById(`page-${pageId}`);
    if (targetPage) targetPage.classList.remove('hidden');

    // 🌟 KUNCI MEMORI REFRESH PENTING
    try {
        history.replaceState(null, null, `#${pageId}`);
        sessionStorage.setItem('sps_active_page', pageId);
    } catch(e) {}

    document.querySelectorAll('.nav-btn').forEach(btn => {
        if (btn.getAttribute('data-page') === pageId) {
            btn.classList.add('bg-orange-600', 'text-white');
            btn.classList.remove('text-gray-300', 'hover:bg-slate-800');
        } else {
            btn.classList.remove('bg-orange-600', 'text-white');
            btn.classList.add('text-gray-300', 'hover:bg-slate-800');
        }
    });

    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
        if (btn.getAttribute('data-page') === pageId) {
            btn.classList.add('text-orange-500');
            btn.classList.remove('text-gray-400');
        } else {
            btn.classList.remove('text-orange-500');
            btn.classList.add('text-gray-400');
        }
    });
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const logoText = document.getElementById('logo-text');
    const menuTexts = document.querySelectorAll('.menu-text');

    if (!isSidebarCollapsed) {
        sidebar?.classList.remove('w-64');
        sidebar?.classList.add('w-20');
        logoText?.classList.add('hidden');
        menuTexts.forEach(text => text.classList.add('hidden'));
        isSidebarCollapsed = true;
    } else {
        sidebar?.classList.remove('w-20');
        sidebar?.classList.add('w-64');
        logoText?.classList.remove('hidden');
        menuTexts.forEach(text => text.classList.remove('hidden'));
        isSidebarCollapsed = false;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await includeHTML();

    checkAuth();

    initFCM();

    document.getElementById('btn-request-otp')?.addEventListener('click', handleRequestOTP);
    document.getElementById('btn-verify-otp')?.addEventListener('click', handleVerifyOTP);

    document.getElementById('btn-logout-desktop')?.addEventListener('click', handleLogout);
    document.getElementById('btn-logout-mobile')?.addEventListener('click', handleLogout);

    initDashboardController();
    initTransaksiController();
    initKeuanganController();
    initKlienController();
    initSetelanController();

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchPage(btn.getAttribute('data-page')));
    });

    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchPage(btn.getAttribute('data-page')));
    });

    const btnToggle = document.getElementById('btn-toggle-sidebar');
    if (btnToggle) btnToggle.addEventListener('click', toggleSidebar);

    // 🔒 BUKA HALAMAN TERAKHIR SEBELUM DIREFRESH
    let initialPage = 'dashboard';
    const hashPage = window.location.hash.replace('#', '').trim();
    const savedPage = sessionStorage.getItem('sps_active_page');

    if (hashPage && ['dashboard', 'transaksi', 'keuangan', 'klien', 'setelan'].includes(hashPage)) {
        initialPage = hashPage;
    } else if (savedPage && ['dashboard', 'transaksi', 'keuangan', 'klien', 'setelan'].includes(savedPage)) {
        initialPage = savedPage;
    }

    switchPage(initialPage);
});