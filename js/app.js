import { db } from './firebase.js';
import { initKlienController } from './controllers/klien.js';
import { initSetelanController } from './controllers/setelan.js';
import { initTransaksiController } from './controllers/transaksi.js';
import { initDashboardController } from './controllers/dashboard.js';
import { initKeuanganController } from './controllers/keuangan.js';

export let isSidebarCollapsed = false;
let isUserLoggedIn = false;

const VALID_USERNAME = "SpsBir0Jasa";
const VALID_PASSWORD = "Sukses123#";

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

function handleLogin(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }

    const usernameInput = document.getElementById('login-username')?.value.trim();
    const passwordInput = document.getElementById('login-password')?.value;

    if (!usernameInput || !passwordInput) {
        return window.showAlert("Perhatian", "Silakan isi Username dan Password terlebih dahulu.", "info");
    }

    if (usernameInput === VALID_USERNAME && passwordInput === VALID_PASSWORD) {
        isUserLoggedIn = true;
        try { sessionStorage.setItem('sps_logged_in', 'true'); } catch(e) {}
        try { localStorage.setItem('sps_logged_in', 'true'); } catch(e) {}

        checkAuth();
        switchPage('dashboard');
    } else {
        window.showAlert("Login Gagal", "Username atau Password yang Anda masukkan salah!", "error");
    }
}

function handleLogout() {
    window.showConfirm("Konfirmasi Keluar", "Apakah Anda yakin ingin keluar dari aplikasi Biro Jasa SPS?", () => {
        isUserLoggedIn = false;
        try { localStorage.removeItem('sps_logged_in'); } catch(e) {}
        try { sessionStorage.removeItem('sps_logged_in'); } catch(e) {}
        checkAuth();
        const userEl = document.getElementById('login-username');
        const passEl = document.getElementById('login-password');
        if (userEl) userEl.value = '';
        if (passEl) passEl.value = '';
    });
}

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

document.addEventListener('DOMContentLoaded', async () => {
    await includeHTML();

    checkAuth();

    document.getElementById('btn-login')?.addEventListener('click', handleLogin);
    document.getElementById('form-login')?.addEventListener('submit', handleLogin);

    document.getElementById('btn-logout-desktop')?.addEventListener('click', handleLogout);
    document.getElementById('btn-logout-mobile')?.addEventListener('click', handleLogout);

    initDashboardController();
    initTransaksiController();
    initKeuanganController(); // Inisialisasi Controller Keuangan
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

    switchPage('dashboard');
});