import { db } from './firebase.js'; // <--- TAMBAHKAN BARIS INI PADA BARIS PERTAMA!
import { initKlienController } from './controllers/klien.js';
import { initSetelanController } from './controllers/setelan.js';
import { initTransaksiController } from './controllers/transaksi.js';
import { initDashboardController } from './controllers/dashboard.js';

export let isSidebarCollapsed = false;

// Kredensial Tunggal Owner Terkunci (Sesuai Permintaan Anda)
const TARGET_PHONE_WA = "62895428400665"; 
const WA_API_SEND = "https://wa.mrdsolution.my.id/api/send-message";
const WA_API_KEY = "7BC82018076500360255A4E0F78D52C7";
const SENDER_SESSION = "botmrd"; 

// =======================================================
// 🔗 EJS-STYLE PARSER: FUNGSI INJEKSI ANAK INDEX AUTOMATIC
// =======================================================
async function includeHTML() {
    const elements = document.querySelectorAll('[data-include]');
    for (const el of elements) {
        const file = el.getAttribute('data-include');
        try {
            const response = await fetch(file);
            if (response.ok) {
                const htmlContent = await response.text();
                // Gantikan tag penanda dengan isi file HTML anak index
                el.outerHTML = htmlContent;
            }
        } catch (err) {
            console.error("Gagal memuat komponen anak index:", file, err.message);
        }
    }
}

// --- LOGIKA UTAMA OTENTIKASI OTP ---
function checkAuth() {
    const isLogged = localStorage.getItem('sps_logged_in') === 'true';
    const loginScreen = document.getElementById('login-screen');
    const appLayout = document.getElementById('app-layout');

    if (isLogged) {
        loginScreen?.classList.add('hidden');
        appLayout?.classList.remove('hidden');
    } else {
        loginScreen?.classList.remove('hidden');
        appLayout?.classList.add('hidden');
    }
}

async function handleRequestOTP() {
    const btn = document.getElementById('btn-request-otp');
    btn.disabled = true;
    btn.innerText = "Mengirim...";

    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 300000; // Aktif 5 menit

    try {
        await db.collection('login_otp').doc('sps_owner').set({
            code: generatedOtp,
            expiresAt: expiresAt
        });

        const messageText = `🔑 *VERIFIKASI AKSES BIRO JASA SPS*\n\nKode OTP login Anda adalah: *${generatedOtp}*\n\n_Kode ini berlaku selama 5 menit. Jangan bagikan kepada siapa pun demi keamanan data._`;
        const endpoint = `${WA_API_SEND}?key=${WA_API_KEY}&session=${SENDER_SESSION}&to=${TARGET_PHONE_WA}&text=${encodeURIComponent(messageText)}`;
        
        await fetch(endpoint);

        document.getElementById('area-request-otp').classList.add('hidden');
        document.getElementById('area-verify-otp').classList.remove('hidden');
        startOtpTimer(300);
    } catch (err) {
        alert("Gagal memproses OTP: " + err.message);
        btn.disabled = false;
        btn.innerText = "Minta Kode OTP";
    }
}

async function handleVerifyOTP() {
    const inputOtp = document.getElementById('input-otp').value.trim();
    if (!inputOtp) return alert("Silakan masukkan kode OTP!");

    try {
        const doc = await db.collection('login_otp').doc('sps_owner').get();
        if (doc.exists) {
            const data = doc.data();
            const currentTime = Date.now();

            if (data.code === inputOtp && currentTime < data.expiresAt) {
                localStorage.setItem('sps_logged_in', 'true');
                checkAuth();
            } else {
                alert("Kode OTP salah atau telah kedaluwarsa!");
            }
        } else {
            alert("Sesi OTP tidak valid!");
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
            document.getElementById('area-request-otp').classList.remove('hidden');
            document.getElementById('area-verify-otp').classList.add('hidden');
            document.getElementById('btn-request-otp').disabled = false;
            document.getElementById('btn-request-otp').innerText = "Minta Kode OTP";
        }
    }, 1000);
}

function handleLogout() {
    if (confirm("Apakah Anda yakin ingin keluar dari aplikasi?")) {
        localStorage.removeItem('sps_logged_in');
        checkAuth();
        document.getElementById('area-request-otp').classList.remove('hidden');
        document.getElementById('area-verify-otp').classList.add('hidden');
        document.getElementById('btn-request-otp').disabled = false;
        document.getElementById('btn-request-otp').innerText = "Minta Kode OTP";
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
        sidebar.classList.remove('w-64');
        sidebar.classList.add('w-20');
        logoText.classList.add('hidden');
        menuTexts.forEach(text => text.classList.add('hidden'));
        isSidebarCollapsed = true;
    } else {
        sidebar.classList.remove('w-20');
        sidebar.classList.add('w-64');
        logoText.classList.remove('hidden');
        menuTexts.forEach(text => text.classList.remove('hidden'));
        isSidebarCollapsed = false;
    }
}

// Inisialisasi Event Listener Utama (Setelah Seluruh Anak Index Selesai Di-Inject)
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Eksekusi penyatuan file anak index (EJS-Style)
    await includeHTML();

    // 2. Jalankan pengecekan otentikasi login
    checkAuth();

    // 3. Hubungkan tombol otentikasi OTP
    document.getElementById('btn-request-otp')?.addEventListener('click', handleRequestOTP);
    document.getElementById('btn-verify-otp')?.addEventListener('click', handleVerifyOTP);

    // 4. Hubungkan tombol logout
    document.getElementById('btn-logout-desktop')?.addEventListener('click', handleLogout);
    document.getElementById('btn-logout-mobile')?.addEventListener('click', handleLogout);

    // 5. Inisialisasi Seluruh Controller Dinamis
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

    // Halaman default saat pertama kali dibuka
    switchPage('dashboard');
});