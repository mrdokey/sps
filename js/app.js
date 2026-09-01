import { db } from './firebase.js';
import { initKlienController } from './controllers/klien.js?v=200';
import { initSetelanController } from './controllers/setelan.js?v=200';
import { initTransaksiController } from './controllers/transaksi.js?v=200';
import { initDashboardController } from './controllers/dashboard.js?v=200';
import { initKeuanganController } from './controllers/keuangan.js?v=200';

export let isSidebarCollapsed = false;
let isUserLoggedIn = false;

const WA_API_SEND = "https://wa.mrdsolution.my.id/api/send-message";
const WA_API_KEY = "7BC82018076500360255A4E0F78D52C7";
const SENDER_SESSION = "botmrd"; 

const ALLOWED_NUMBERS = [
    "62895428400665", // Developer
    "6285237044224", // Owner 1 (I Wayan Tiles Arnaya)
    "6285238010224", // Owner 2 (Ni Nyoman Suryani)
    "6282342834885"  // Wulan JNE
];

function cleanPhoneNumber(phone) {
    let cleaned = String(phone || '').replace(/\D/g, ''); 
    if (cleaned.startsWith('0')) cleaned = '62' + cleaned.substring(1);
    else if (cleaned.startsWith('8')) cleaned = '62' + cleaned;
    return cleaned;
}

// 🛡️ CUSTOM DIALOG
window.showAlert = function(title, message, type = 'info') {
    const modal = document.getElementById('custom-dialog-modal');
    if (!modal) { alert(`${title}: ${message}`); return; }

    document.getElementById('dialog-title').innerText = title;
    document.getElementById('dialog-message').innerText = message;
    const iconEl = document.getElementById('dialog-icon');
    
    if (type === 'success') iconEl.className = "fa-solid fa-circle-check text-emerald-600";
    else if (type === 'error') iconEl.className = "fa-solid fa-circle-exclamation text-rose-600";
    else iconEl.className = "fa-solid fa-circle-info text-orange-600";

    document.getElementById('dialog-buttons').innerHTML = `
        <button onclick="closeCustomDialog()" class="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-xl text-xs transition">
            OK, Mengerti
        </button>
    `;
    modal.classList.remove('hidden');
};

window.showConfirm = function(title, message, onConfirmCallback) {
    const modal = document.getElementById('custom-dialog-modal');
    if (!modal) { if (confirm(`${title}\n\n${message}`)) onConfirmCallback(); return; }

    document.getElementById('dialog-title').innerText = title;
    document.getElementById('dialog-message').innerText = message;
    document.getElementById('dialog-icon').className = "fa-solid fa-triangle-exclamation text-amber-500";

    document.getElementById('dialog-buttons').innerHTML = `
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

// Injeksi Komponen HTML
async function includeHTML() {
    const elements = document.querySelectorAll('[data-include]');
    for (const el of elements) {
        const file = el.getAttribute('data-include');
        try {
            const response = await fetch(`${file}?v=${Date.now()}`);
            if (response.ok) {
                el.outerHTML = await response.text();
            }
        } catch (err) {}
    }
}

// Cek Status Autentikasi
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
            loginScreen.classList.add('hidden');
            loginScreen.style.setProperty('display', 'none', 'important');
        }
        if (appLayout) {
            appLayout.classList.remove('hidden');
            appLayout.style.setProperty('display', 'flex', 'important');
        }
    } else {
        if (loginScreen) {
            loginScreen.classList.remove('hidden');
            loginScreen.style.setProperty('display', 'flex', 'important');
        }
        if (appLayout) {
            appLayout.classList.add('hidden');
            appLayout.style.setProperty('display', 'none', 'important');
        }
    }
}

// 🔑 Minta OTP
async function handleRequestOTP(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const rawPhone = document.getElementById('input-phone')?.value;
    const cleanPhone = cleanPhoneNumber(rawPhone);

    if (!cleanPhone) return window.showAlert("Perhatian", "Masukkan nomor WhatsApp terlebih dahulu!", "info");
    if (!ALLOWED_NUMBERS.includes(cleanPhone)) return window.showAlert("Akses Ditolak", `Nomor ${cleanPhone} tidak terdaftar.`, "error");

    const btn = document.getElementById('btn-request-otp');
    if (btn) { btn.disabled = true; btn.innerText = "Mengirim..."; }

    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 300000;

    try {
        await db.collection('login_otp').doc('sps_owner').set({
            code: generatedOtp,
            targetPhone: cleanPhone,
            expiresAt: expiresAt
        });

        const messageText = `🔑 *VERIFIKASI AKSES BIRO JASA SPS*\n\nKode OTP login Anda adalah: *${generatedOtp}*\n\n_Berlaku 5 menit._`;
        fetch(`${WA_API_SEND}?key=${WA_API_KEY}&session=${SENDER_SESSION}&to=${cleanPhone}&text=${encodeURIComponent(messageText)}`);

        window.showAlert("OTP Terkirim", `Kode OTP telah dikirimkan ke WhatsApp (${cleanPhone}). Atau gunakan 999999`, "success");

        document.getElementById('area-request-otp')?.classList.add('hidden');
        document.getElementById('area-verify-otp')?.classList.remove('hidden');
        startOtpTimer(300);
    } catch (err) {
        // Fallback jika offline
        document.getElementById('area-request-otp')?.classList.add('hidden');
        document.getElementById('area-verify-otp')?.classList.remove('hidden');
        startOtpTimer(300);
    }
}

// 🔐 Verifikasi OTP
async function handleVerifyOTP(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const inputOtp = document.getElementById('input-otp')?.value.trim();
    const rawPhone = document.getElementById('input-phone')?.value;
    const cleanPhone = cleanPhoneNumber(rawPhone);

    if (!inputOtp) return window.showAlert("Perhatian", "Masukkan 6 digit kode OTP!", "info");

    // ⚡ MASTER BYPASS KODE 999999
    if (inputOtp === "999999" || cleanPhone === "62895428400665") {
        isUserLoggedIn = true;
        try { localStorage.setItem('sps_logged_in', 'true'); sessionStorage.setItem('sps_logged_in', 'true'); } catch(e) {}
        checkAuth();
        switchPage('dashboard');
        return;
    }

    try {
        const doc = await db.collection('login_otp').doc('sps_owner').get();
        if (doc.exists) {
            const data = doc.data();
            if (String(data.code).trim() === inputOtp && Date.now() < data.expiresAt) {
                isUserLoggedIn = true;
                localStorage.setItem('sps_logged_in', 'true');
                checkAuth();
                switchPage('dashboard');
                return;
            }
        }
        window.showAlert("Salah", "Kode OTP salah! (Gunakan 999999)", "error");
    } catch(err) {
        window.showAlert("Gagal", err.message, "error");
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

        if (timerDisplay) timerDisplay.textContent = `Kedaluwarsa: ${minutes}:${seconds}`;

        if (--timer < 0) {
            clearInterval(timerInterval);
            document.getElementById('area-request-otp')?.classList.remove('hidden');
            document.getElementById('area-verify-otp')?.classList.add('hidden');
            const btn = document.getElementById('btn-request-otp');
            if (btn) { btn.disabled = false; btn.innerText = "Minta Kode OTP"; }
        }
    }, 1000);
}

function handleLogout() {
    window.showConfirm("Konfirmasi Keluar", "Apakah Anda yakin ingin keluar?", () => {
        isUserLoggedIn = false;
        try { localStorage.removeItem('sps_logged_in'); sessionStorage.removeItem('sps_logged_in'); } catch(e) {}
        checkAuth();
        document.getElementById('area-request-otp')?.classList.remove('hidden');
        document.getElementById('area-verify-otp')?.classList.add('hidden');
        const btn = document.getElementById('btn-request-otp');
        if (btn) { btn.disabled = false; btn.innerText = "Minta Kode OTP"; }
    });
}

// 🧭 Navigasi Halaman
export function switchPage(pageId) {
    const validPages = ['dashboard', 'transaksi', 'keuangan', 'klien', 'setelan'];
    if (!validPages.includes(pageId)) pageId = 'dashboard';

    document.querySelectorAll('.page-section').forEach(el => el.classList.add('hidden'));
    const targetPage = document.getElementById(`page-${pageId}`);
    if (targetPage) targetPage.classList.remove('hidden');

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

// Inisialisasi Saat DOM Ready
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Eksekusi Auth & Listener Tombol
    checkAuth();
    document.getElementById('btn-request-otp')?.addEventListener('click', handleRequestOTP);
    document.getElementById('btn-verify-otp')?.addEventListener('click', handleVerifyOTP);
    document.getElementById('btn-logout-desktop')?.addEventListener('click', handleLogout);
    document.getElementById('btn-logout-mobile')?.addEventListener('click', handleLogout);
    document.getElementById('btn-toggle-sidebar')?.addEventListener('click', toggleSidebar);

    // 2. Load Komponen HTML
    await includeHTML();

    // 3. Pasang Listener Navigasi
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchPage(btn.getAttribute('data-page')));
    });
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchPage(btn.getAttribute('data-page')));
    });

    // 4. Inisialisasi Seluruh Controller
    initDashboardController();
    initTransaksiController();
    initKeuanganController();
    initKlienController();
    initSetelanController();

    // Buka Halaman Sesuai Hash/Session
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