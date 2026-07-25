import { initKlienController } from './controllers/klien.js';
import { initSetelanController } from './controllers/setelan.js';
import { initTransaksiController } from './controllers/transaksi.js';
import { initDashboardController } from './controllers/dashboard.js';

export let isSidebarCollapsed = false;

// Pintu Navigasi Utama
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

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inisialisasi Seluruh Controller Dinamis
    initDashboardController();
    initTransaksiController();
    initKlienController();
    initSetelanController();

    // 2. Pasang Navigasi Event Listener
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