import { db } from './firebase.js';
import { initKlienController } from './controllers/klien.js';
import { initSetelanController } from './controllers/setelan.js';
import { initTransaksiController } from './controllers/transaksi.js';
import { initDashboardController } from './controllers/dashboard.js';

export let isSidebarCollapsed = false;

// Kredensial Tunggal Owner Terkunci
const TARGET_PHONE_WA = "62895428400665"; // Sesuai permintaan Anda (+62 852-3704-4224)
const WA_API_SEND = "https://wa.mrdsolution.my.id/api/send-message";
const WA_API_KEY = "7BC82018076500360255A4E0F78D52C7";
const SENDER_SESSION = "botmrd"; // Dikirim oleh botmrd

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

// Request kode OTP Baru ke nomor target
async function handleRequestOTP() {
    const btn = document.getElementById('btn-request-otp');
    btn.disabled = true;
    btn.innerText = "Mengirim...";

    // Generate 6 digit nomor acak
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 300000; // Aktif 5 menit

    try {
        // 1. Simpan kode OTP ke Firestore secara aman
        await db.collection('login_otp').doc('sps_owner').set({
            code: generatedOtp,
            expiresAt: expiresAt
        });

        // 2. Kirim pesan OTP via botmrd WA Gateway
        const messageText = `🔑 *VERIFIKASI AKSES BIRO JASA SPS*\n\nKode OTP login Anda adalah: *${generatedOtp}*\n\n_Kode ini berlaku selama 5 menit. Jangan bagikan kepada siapa pun demi keamanan data._`;
        const endpoint = `${WA_API_SEND}?key=${WA_API_KEY}&session=${SENDER_SESSION}&to=${TARGET_PHONE_WA}&text=${encodeURIComponent(messageText)}`;
        
        await fetch(endpoint);

        // 3. Ubah UI ke tampilan verifikasi
        document.getElementById('area-request-otp').classList.add('hidden');
        document.getElementById('area-verify-otp').classList.remove('hidden');
        startOtpTimer(300); // 5 Menit hitung mundur
    } catch (err) {
        alert("Gagal memproses OTP: " + err.message);
        btn.disabled = false;
        btn.innerText = "Minta Kode OTP";
    }
}

// Verifikasi kode OTP dari user
async function handleVerifyOTP() {
    const inputOtp = document.getElementById('input-otp').value.trim();
    if (!inputOtp) return alert("Silakan masukkan kode OTP!");

    try {
        const doc = await db.collection('login_otp').doc('sps_owner').get();
        if (doc.exists) {
            const data = doc.data();
            const currentTime = Date.now();

            if (data.code === inputOtp && currentTime < data.expiresAt) {
                // Berhasil Login!
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

// Handler hitung mundur timer OTP
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
            // Kembalikan form jika waktu habis
            document.getElementById('area-request-otp').classList.remove('hidden');
            document.getElementById('area-verify-otp').classList.add('hidden');
            document.getElementById('btn-request-otp').disabled = false;
            document.getElementById('btn-request-otp').innerText = "Minta Kode OTP";
        }
    }, 1000);
}

// Logika logout aplikasi
function handleLogout() {
    if (confirm("Apakah Anda yakin ingin keluar dari aplikasi?")) {
        localStorage.removeItem('sps_logged_in');
        checkAuth();
        // Kembalikan form login ke default
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

// Inisialisasi Event Listener
document.addEventListener('DOMContentLoaded', () => {
    // 1. Jalankan pengecekan otentikasi login
    checkAuth();

    // 2. Hubungkan tombol otentikasi OTP
    document.getElementById('btn-request-otp')?.addEventListener('click', handleRequestOTP);
    document.getElementById('btn-verify-otp')?.addEventListener('click', handleVerifyOTP);

    // 3. Hubungkan tombol logout
    document.getElementById('btn-logout-desktop')?.addEventListener('click', handleLogout);
    document.getElementById('btn-logout-mobile')?.addEventListener('click', handleLogout);

    // 4. Inisialisasi Seluruh Controller Dinamis
    initDashboardController();
    initTransaksiController();
    initKlienController();
    initSetelanController();

    // 5. Pasang Navigasi Event Listener
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