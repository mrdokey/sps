import { db } from '../firebase.js';
import { requestWAPairing } from '../utils/wa.js';

let formConfig;
const API_BASE = "https://wa.mrdsolution.my.id/api";
const SESSION_ID = "sps";
let statusCheckInterval = null;

// DATA DEFAULT OTOMATIS BERDASARKAN FOTO KARTU NAMA & DESK SIGN
export let configGlobal = {
    nama: "BIRO JASA SPS (SEDANA PERMATA SARI)",
    alamat: "Jl. Utama Biro Jasa SPS, Denpasar - Bali",
    kontak: "085237044224 / 085238010224",
    bca: "7720648207 a/n Ni Nyoman Suryani",
    bpd: "013 02.02.18264 - 3 a/n Ni Nyoman Suryani",
    wa_template: "Halo {nama}, menginfokan bahwa pengurusan berkas {layanan} ({detail}) Anda di Biro Jasa SPS akan jatuh tempo pada tanggal {tanggal}. Mohon konfirmasinya untuk proses selanjutnya. Terima kasih."
};

export function initSetelanController() {
    formConfig = document.getElementById('form-config');
    formConfig?.addEventListener('submit', saveConfig);

    appendPairingSection();
    appendResetDatabaseSection();

    // 🔄 Cek Status WA Gateway Langsung & Setiap 5 Detik
    checkWAStatus();
    if (!statusCheckInterval) {
        statusCheckInterval = setInterval(checkWAStatus, 5000);
    }

    // Stream Data Realtime Konfigurasi Profil
    db.collection('konfigurasi').doc('profile').onSnapshot(doc => {
        if (doc.exists) {
            const data = doc.data();
            configGlobal = { ...configGlobal, ...data };
        }
        populateForm();
    });
}

function populateForm() {
    if (!formConfig) return;
    if (document.getElementById('cfg-nama')) document.getElementById('cfg-nama').value = configGlobal.nama;
    if (document.getElementById('cfg-alamat')) document.getElementById('cfg-alamat').value = configGlobal.alamat;
    if (document.getElementById('cfg-kontak')) document.getElementById('cfg-kontak').value = configGlobal.kontak;
    if (document.getElementById('cfg-bca')) document.getElementById('cfg-bca').value = configGlobal.bca;
    if (document.getElementById('cfg-bpd')) document.getElementById('cfg-bpd').value = configGlobal.bpd;
    if (document.getElementById('cfg-wa-template')) document.getElementById('cfg-wa-template').value = configGlobal.wa_template;
}

async function saveConfig(e) {
    e.preventDefault();
    const payload = {
        nama: document.getElementById('cfg-nama').value,
        alamat: document.getElementById('cfg-alamat').value,
        kontak: document.getElementById('cfg-kontak').value,
        bca: document.getElementById('cfg-bca').value,
        bpd: document.getElementById('cfg-bpd').value,
        wa_template: document.getElementById('cfg-wa-template').value
    };

    try {
        await db.collection('konfigurasi').doc('profile').set(payload);
        configGlobal = { ...payload };
        if (window.showAlert) {
            window.showAlert("Berhasil", "Setelan profil usaha dan kop surat berhasil disimpan!", "success");
        }
    } catch (err) {
        if (window.showAlert) {
            window.showAlert("Gagal", err.message, "error");
        }
    }
}

// 📡 CEK STATUS SESI WA DARI SERVER VPS REALTIME
async function checkWAStatus() {
    const container = document.getElementById('wa-session-status-container');
    if (!container) return;

    try {
        const response = await fetch(`${API_BASE}/status/${SESSION_ID}`);
        if (response.ok) {
            const data = await response.json();
            const status = (data.status || 'DISCONNECTED').toUpperCase();
            renderWASessionUI(status);
        } else {
            renderWASessionUI('DISCONNECTED');
        }
    } catch (e) {
        renderWASessionUI('DISCONNECTED');
    }
}

// 🎨 RENDER TAMPILAN SESUAI STATUS VPS REALTIME
function renderWASessionUI(status) {
    const container = document.getElementById('wa-session-status-container');
    if (!container) return;

    if (status === 'CONNECTED') {
        container.innerHTML = `
            <div class="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-lg">
                        <i class="fa-brands fa-whatsapp"></i>
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-gray-800 text-sm">Sesi WhatsApp Biro Jasa SPS</span>
                            <span class="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Terhubung</span>
                        </div>
                        <p class="text-xs text-gray-500 mt-0.5">Gateway aktif & siap mengirimkan pengingat otomatis ke klien.</p>
                    </div>
                </div>
                <button id="btn-disconnect-wa" type="button" class="bg-rose-50 hover:bg-rose-100 text-rose-600 px-4 py-2 rounded-xl text-xs font-semibold border border-rose-200 transition shadow-sm whitespace-nowrap">
                    <i class="fa-solid fa-power-off mr-1.5"></i>Putuskan Sesi
                </button>
            </div>
        `;

        document.getElementById('btn-disconnect-wa')?.addEventListener('click', disconnectWASession);
    } else {
        container.innerHTML = `
            <div class="space-y-3">
                <div class="flex items-center justify-between">
                    <span class="text-xs text-gray-500">Status Sesi: <strong class="text-rose-600 uppercase">${status}</strong></span>
                </div>
                <div class="flex gap-2">
                    <input type="tel" id="pairing-phone" placeholder="Masukkan No. HP Biro Jasa (Contoh: 085237044224)" class="flex-1 px-3.5 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none">
                    <button id="btn-request-pair" type="button" class="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition shadow-sm whitespace-nowrap">Minta Kode</button>
                </div>
                <div id="display-pairing-code" class="hidden text-center p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2 mt-2">
                    <span class="text-xs text-emerald-800 font-semibold uppercase tracking-wider">Kode Pairing WhatsApp Anda</span>
                    <div id="pairing-code-box" class="text-3xl font-mono font-bold tracking-widest text-emerald-600">--------</div>
                    <p class="text-[10px] text-gray-400">Masukkan kode ini pada opsi "Tautkan Perangkat > Tautkan dengan nomor telepon" di aplikasi WA HP Anda.</p>
                </div>
            </div>
        `;

        document.getElementById('btn-request-pair')?.addEventListener('click', async () => {
            const phone = document.getElementById('pairing-phone')?.value;
            if (!phone) return window.showAlert("Perhatian", "Silakan masukkan nomor telepon terlebih dahulu.", "info");

            const btn = document.getElementById('btn-request-pair');
            btn.innerText = "Memproses...";
            btn.disabled = true;

            const code = await requestWAPairing(phone);
            btn.innerText = "Minta Kode";
            btn.disabled = false;

            if (code) {
                document.getElementById('pairing-code-box').innerText = code;
                document.getElementById('display-pairing-code').classList.remove('hidden');
                checkWAStatus();
            } else {
                window.showAlert("Gagal", "Gagal mendapatkan kode. Pastikan server VPS aktif.", "error");
            }
        });
    }
}

async function disconnectWASession() {
    window.showConfirm("Putuskan Sesi WA", "Apakah Anda yakin ingin memutuskan koneksi WhatsApp sesi 'sps'?", async () => {
        try {
            await fetch(`${API_BASE}/delete/${SESSION_ID}`);
            if (window.showAlert) window.showAlert("Terputus", "Sesi WhatsApp berhasil dihentikan.", "info");
            checkWAStatus();
        } catch(e) {
            if (window.showAlert) window.showAlert("Gagal", e.message, "error");
        }
    });
}

function appendPairingSection() {
    const parent = formConfig?.parentElement;
    if (!parent) return;

    const pairingDiv = document.createElement('div');
    pairingDiv.className = "bg-white p-6 rounded-2xl shadow-sm border border-gray-100 max-w-2xl mt-6 space-y-4";
    pairingDiv.innerHTML = `
        <h3 class="text-base font-bold text-gray-800 border-b pb-2"><i class="fa-brands fa-whatsapp text-emerald-600 mr-2"></i>Tautkan WhatsApp Biro Jasa (Sesi SPS)</h3>
        <p class="text-xs text-gray-500 leading-relaxed">Sesi ini bersifat terisolasi tanpa potongan harian VPS. Silakan gunakan nomor HP Biro Jasa Anda untuk dikoneksikan ke gateway.</p>
        <div id="wa-session-status-container">
            <p class="text-xs text-gray-400 italic">Memeriksa status sesi WA...</p>
        </div>
    `;
    parent.appendChild(pairingDiv);
}

function appendResetDatabaseSection() {
    const parent = formConfig?.parentElement;
    if (!parent) return;

    const resetDiv = document.createElement('div');
    resetDiv.className = "bg-white p-6 rounded-2xl shadow-sm border border-rose-100 max-w-2xl mt-6 space-y-3 bg-rose-50/20";
    resetDiv.innerHTML = `
        <h3 class="text-base font-bold text-rose-800 border-b border-rose-100 pb-2"><i class="fa-solid fa-triangle-exclamation text-rose-600 mr-2"></i>Area Bahaya: Reset Database</h3>
        <p class="text-xs text-gray-500 leading-relaxed">Gunakan tombol ini setelah masa pengujian selesai untuk membersihkan seluruh data dummy (Transaksi, Klien, dan Pengeluaran) sebelum aplikasi diserahkan ke klien.</p>
        <button id="btn-reset-db-all" type="button" class="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm">
            <i class="fa-solid fa-trash-can mr-2"></i>Bersihkan Semua Data Uji Coba
        </button>
    `;
    parent.appendChild(resetDiv);

    document.getElementById('btn-reset-db-all')?.addEventListener('click', () => {
        window.showConfirm(
            "⚠️ HAPUS SEMUA DATA DUMMY",
            "Apakah Anda YAKIN ingin menghapus SELURUH data Transaksi, Klien, dan Buku Kas secara permanen? Tindakan ini tidak dapat dibatalkan!",
            async () => {
                try {
                    const trxSnap = await db.collection('transaksi').get();
                    trxSnap.forEach(doc => doc.ref.delete());

                    const klienSnap = await db.collection('klien').get();
                    klienSnap.forEach(doc => doc.ref.delete());

                    const pSnap = await db.collection('pengeluaran').get();
                    pSnap.forEach(doc => doc.ref.delete());

                    window.showAlert("Berhasil Reset!", "Seluruh data uji coba telah dibersihkan total. Database sekarang 100% bersih dan siap digunakan produksi!", "success");
                } catch (e) {
                    window.showAlert("Gagal Reset", e.message, "error");
                }
            }
        );
    });
}