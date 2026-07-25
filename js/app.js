import { db } from './firebase.js';
import { initKlienController } from './controllers/klien.js';
import { initSetelanController } from './controllers/setelan.js';
import { initTransaksiController } from './controllers/transaksi.js';
import { initDashboardController } from './controllers/dashboard.js';

export let isSidebarCollapsed = false;
let isUserLoggedIn = false;

// Kredensial WhatsApp Target Terkunci
const TARGET_PHONE_WA = "62895428400665"; 
const WA_API_SEND = "https://wa.mrdsolution.my.id/api/send-message";
const WA_API_KEY = "7BC82018076500360255A4E0F78D52C7";
const SENDER_SESSION = "botmrd"; 

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

// FUNGSI REQUEST KODE OTP BARU VIA WHATSAPP
async function handleRequestOTP(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    const btn = document.getElementById('btn-request-otp');
    if (btn) {
        btn.disabled = true;
        btn.innerText = "Mengirim...";
    }

    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 300000; // Aktif 5 menit

    try {
        // 1. Simpan OTP ke Firestore
        await db.collection('login_otp').doc('sps_owner').set({
            code: generatedOtp,
            expiresAt: expiresAt
        });

        // 2. Kirim pesan OTP via botmrd WA Gateway
        const messageText = `🔑 *VERIFIKASI AKSES BIRO JASA SPS*\n\nKode OTP login Anda adalah: *${generatedOtp}*\n\n_Kode ini berlaku selama 5 menit. Jangan bagikan kepada siapa pun demi keamanan data._`;
        const endpoint = `${WA_API_SEND}?key=${WA_API_KEY}&session=${SENDER_SESSION}&to=${TARGET_PHONE_WA}&text=${encodeURIComponent(messageText)}`;
        
        await fetch(endpoint);

        // 3. Tampilkan kolom input OTP
        document.getElementById('area-request-otp')?.classList.add('hidden');
        document.getElementById('area-verify-otp')?.classList.remove('hidden');
        startOtpTimer(300);
    } catch (err) {
        alert("Gagal memproses OTP: " + err.message);
        if (btn) {
            btn.disabled = false;
            btn.innerText = "Minta Kode OTP";
        }
    }
}

// FUNGSI VERIFIKASI KODE OTP
async function handleVerifyOTP(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    const inputEl = document.getElementById('input-otp');
    const inputOtp = inputEl ? inputEl.value.trim() : '';
    
    if (!inputOtp) return alert("Silakan masukkan kode OTP!");

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
                switchPage('dashboard');
            } else {
                if (currentTime >= data.expiresAt) {
                    alert("❌ Kode OTP sudah kedaluwarsa! Silakan minta kode baru.");
                } else {
                    alert("❌ Kode OTP yang Anda masukkan salah!");
                }
            }
        } else {
            alert("❌ Sesi OTP tidak ditemukan di server!");
        }
    } catch (err) {
        alert("Gagal verifikasi: " + err.message);
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
    if (confirm("Apakah Anda yakin ingin keluar dari aplikasi?")) {
        isUserLoggedIn = false;
        try { localStorage.removeItem('sps_logged_in'); } catch(e) {}
        try { sessionStorage.removeItem('sps_logged_in'); } catch(e) {}
        checkAuth();
        document.getElementById('area-request-otp')?.classList.remove('hidden');
        document.getElementById('area-verify-otp')?.classList.add('hidden');
        const btn = document.getElementById('btn-request-otp');
        if (btn) {
            btn.disabled = false;
            btn.innerText = "Minta Kode OTP";
        }
        clearInterval(timerInterval);
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
    // 1. Injeksi komponen sisa
    await includeHTML();

    // 2. Cek status otentikasi login
    checkAuth();

    // 3. Hubungkan event listener login OTP
    document.getElementById('btn-request-otp')?.addEventListener('click', handleRequestOTP);
    document.getElementById('btn-verify-otp')?.addEventListener('click', handleVerifyOTP);

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