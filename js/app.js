import { db } from './firebase.js';
import { initKlienController } from './controllers/klien.js';
import { initSetelanController } from './controllers/setelan.js';
import { initTransaksiController } from './controllers/transaksi.js';
import { initDashboardController } from './controllers/dashboard.js';

export let isSidebarCollapsed = false;
let isUserLoggedIn = false;

// KREDENSIAL HARCODED UNTUK BYPASS
const VALID_USERNAME = "SpsBir0Jasa";
const VALID_PASSWORD = "Sukses123#";

// =======================================================
// 🔗 EJS-STYLE PARSER: INJEKSI ANAK INDEX AUTOMATIC
// =======================================================
async function includeHTML() {
    const elements = document.querySelectorAll('[data-include]');
    for (const el of elements) {
        const file = el.getAttribute('data-include');
        try {
            const response = await fetch(file);
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

// FUNGSI VERIFIKASI USERNAME & PASSWORD
function handleLogin(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }

    const usernameInput = document.getElementById('login-username')?.value.trim();
    const passwordInput = document.getElementById('login-password')?.value;

    if (!usernameInput || !passwordInput) {
        return alert("Silakan isi Username dan Password!");
    }

    if (usernameInput === VALID_USERNAME && passwordInput === VALID_PASSWORD) {
        isUserLoggedIn = true;
        try { sessionStorage.setItem('sps_logged_in', 'true'); } catch(e) {}
        try { localStorage.setItem('sps_logged_in', 'true'); } catch(e) {}

        checkAuth();
        switchPage('dashboard');
    } else {
        alert("❌ Username atau Password salah!");
    }
}

function handleLogout() {
    if (confirm("Apakah Anda yakin ingin keluar dari aplikasi?")) {
        isUserLoggedIn = false;
        try { localStorage.removeItem('sps_logged_in'); } catch(e) {}
        try { sessionStorage.removeItem('sps_logged_in'); } catch(e) {}
        checkAuth();
        const userEl = document.getElementById('login-username');
        const passEl = document.getElementById('login-password');
        if (userEl) userEl.value = '';
        if (passEl) passEl.value = '';
    }
}

// --- LOGIKA NAVIGASI PAGE ---
export function switchPage(pageId) {
    document.querySelectorAll('.page-section').forEach(el => el.classList.add('hidden'));
    const targetPage = document.getElementById(`page-${pageId}`);
    if (targetPage) targetPage.classList.remove('hidden');

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

// Inisialisasi Utama
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Injeksi anak index
    await includeHTML();

    // 2. Cek status otentikasi login
    checkAuth();

    // 3. Hubungkan event listener login
    document.getElementById('btn-login')?.addEventListener('click', handleLogin);
    document.getElementById('form-login')?.addEventListener('submit', handleLogin);

    // 4. Hubungkan tombol logout
    document.getElementById('btn-logout-desktop')?.addEventListener('click', handleLogout);
    document.getElementById('btn-logout-mobile')?.addEventListener('click', handleLogout);

    // 5. Inisialisasi Seluruh Controller
    initDashboardController();
    initTransaksiController();
    initKlienController();
    initSetelanController();

    // 6. Pasang Navigasi Event Listener
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchPage(btn.getAttribute('data-page')));
    });

    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchPage(btn.getAttribute('data-page')));
    });

    const btnToggle = document.getElementById('btn-toggle-sidebar');
    if (btnToggle) btnToggle.addEventListener('click', toggleSidebar);

    // Halaman awal
    switchPage('dashboard');
});