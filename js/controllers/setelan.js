import { db } from '../firebase.js';
import { requestWAPairing, requestWAQr } from '../utils/wa.js';

let formConfig;
const API_BASE = "https://wa.mrdsolution.my.id/api";
const SESSION_ID = "sps";
let statusCheckInterval = null;
let listLayanan = [];

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

    // Injeksi Seluruh Seksi Setelan
    appendLayananSection();
    appendOperatorSection();
    appendPairingSection();
    appendResetDatabaseSection();

    // 🔄 Cek Status WA Gateway Langsung & Setiap 3 Detik
    checkWAStatus();
    if (!statusCheckInterval) {
        statusCheckInterval = setInterval(checkWAStatus, 3000);
    }

    // Stream Data Realtime Konfigurasi Profil
    db.collection('konfigurasi').doc('profile').onSnapshot(doc => {
        if (doc.exists) {
            const data = doc.data();
            configGlobal = { ...configGlobal, ...data };
        }
        populateForm();
    });

    // Stream Data Realtime Katalog Layanan / Jasa
    db.collection('layanan').onSnapshot(snapshot => {
        listLayanan = [];
        snapshot.forEach(doc => {
            listLayanan.push({ id: doc.id, ...doc.data() });
        });
        renderLayananUI();
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

// 📡 CEK STATUS SESI WA (NO-CACHE FETCH)
async function checkWAStatus() {
    const container = document.getElementById('wa-session-status-container');
    if (!container) return;

    try {
        const response = await fetch(`${API_BASE}/status/${SESSION_ID}?_t=${Date.now()}`, {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        });
        if (response.ok) {
            const data = await response.json();
            const rawStatus = String(data.status || 'DISCONNECTED').toUpperCase().trim();
            renderWASessionUI(rawStatus, data.qr || null);
        } else {
            renderWASessionUI('DISCONNECTED', null);
        }
    } catch (e) {
        renderWASessionUI('DISCONNECTED', null);
    }
}

// 🎨 RENDER TAMPILAN SESUAI 4 STATUS: READY, IDLE, PENDING, DISCONNECTED
function renderWASessionUI(status, qrData) {
    const container = document.getElementById('wa-session-status-container');
    if (!container) return;

    // KONDISI 1: READY / CONNECTED / IDLE (SUDAH TERHUBUNG)
    if (status === 'READY' || status === 'CONNECTED' || status === 'IDLE') {
        const isIdle = status === 'IDLE';
        const badgeColor = isIdle ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white';
        const badgeLabel = isIdle ? 'TERHUBUNG (IDLE)' : 'TERHUBUNG (READY)';
        const descText = isIdle 
            ? "Sesi 'sps' terhubung dalam mode hemat memori (Idle). Sesi akan otomatis bangun saat mengirim notifikasi WA." 
            : "Sesi 'sps' aktif & siap mengirimkan WhatsApp otomatis secara instan.";

        container.innerHTML = `
            <div class="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div class="flex items-center gap-3.5">
                    <div class="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-2xl shadow-sm">
                        <i class="fa-brands fa-whatsapp"></i>
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-gray-900 text-base">Sesi WhatsApp Biro Jasa SPS</span>
                            <span class="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${badgeColor}">${badgeLabel}</span>
                        </div>
                        <p class="text-xs text-emerald-800 font-medium mt-1">${descText}</p>
                    </div>
                </div>
                <button id="btn-disconnect-wa" type="button" class="bg-rose-50 hover:bg-rose-100 text-rose-600 px-4 py-2.5 rounded-xl text-xs font-bold border border-rose-200 transition shadow-sm whitespace-nowrap cursor-pointer">
                    <i class="fa-solid fa-power-off mr-1.5"></i>Putuskan Sesi
                </button>
            </div>
        `;
        document.getElementById('btn-disconnect-wa')?.addEventListener('click', disconnectWASession);
        return;
    }

    // KONDISI 2: BELUM TERHUBUNG (PENDING / DISCONNECTED)
    const isPending = status === 'PENDING' || status === 'CONNECTING' || status === 'PAIRING';
    const statusBadge = isPending 
        ? '<span class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 uppercase">PENDING / MENUNGGU SCAN</span>'
        : '<span class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 uppercase">DISCONNECTED (TERPUTUS)</span>';

    container.innerHTML = `
        <div class="space-y-4">
            <div class="flex items-center justify-between border-b pb-2">
                <span class="text-xs text-gray-500">Status Gateway:</span>
                ${statusBadge}
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <!-- SCAN QR BARCODE -->
                <div class="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 text-center flex flex-col justify-between">
                    <div>
                        <h4 class="font-bold text-gray-800 text-xs flex items-center justify-center gap-1.5">
                            <i class="fa-solid fa-qrcode text-orange-600"></i>Scan QR Barcode
                        </h4>
                        <p class="text-[10px] text-gray-400 mt-0.5">Buka WA HP > Perangkat Tertaut > Tautkan Perangkat</p>
                    </div>
                    
                    <div id="qr-display-box" class="my-1 flex items-center justify-center min-h-[160px] bg-white rounded-xl border p-2">
                        ${qrData ? `<img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}&_t=${Date.now()}" alt="QR Code WA" class="rounded-lg shadow-sm">` : `<p class="text-[11px] text-gray-400 italic">Klik tombol untuk memuat QR Code.</p>`}
                    </div>

                    <button id="btn-request-qr" type="button" class="w-full bg-slate-900 hover:bg-slate-800 text-white py-2 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer">
                        <i class="fa-solid fa-arrows-rotate mr-1.5"></i>${qrData ? 'Perbarui QR' : 'Tampilkan QR Code'}
                    </button>
                </div>

                <!-- 8-DIGIT PAIRING CODE -->
                <div class="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 flex flex-col justify-between">
                    <div>
                        <h4 class="font-bold text-gray-800 text-xs flex items-center gap-1.5">
                            <i class="fa-solid fa-key text-emerald-600"></i>Kode Pairing 8 Digit
                        </h4>
                        <p class="text-[10px] text-gray-400 mt-0.5">Tautkan dengan nomor telepon tanpa scan kamera</p>
                    </div>

                    <div class="space-y-2">
                        <input type="tel" id="pairing-phone" placeholder="Contoh: 085237044224" class="w-full px-3 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                        <button id="btn-request-pair" type="button" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer">
                            Minta Kode Pairing
                        </button>
                    </div>

                    <div id="display-pairing-code" class="hidden text-center p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                        <div id="pairing-code-box" class="text-2xl font-mono font-bold tracking-widest text-emerald-600">--------</div>
                        <p class="text-[9px] text-gray-400">Masukkan 8 digit kode ini di WA HP Anda</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('btn-request-qr')?.addEventListener('click', async () => {
        const btn = document.getElementById('btn-request-qr');
        btn.innerText = "Meminta QR...";
        btn.disabled = true;
        await requestWAQr();
        setTimeout(checkWAStatus, 1500);
    });

    document.getElementById('btn-request-pair')?.addEventListener('click', async () => {
        const phone = document.getElementById('pairing-phone')?.value;
        if (!phone) return window.showAlert("Perhatian", "Silakan masukkan nomor telepon terlebih dahulu.", "info");

        const btn = document.getElementById('btn-request-pair');
        btn.innerText = "Memproses...";
        btn.disabled = true;

        const code = await requestWAPairing(phone);
        btn.innerText = "Minta Kode Pairing";
        btn.disabled = false;

        if (code) {
            document.getElementById('pairing-code-box').innerText = code;
            document.getElementById('display-pairing-code').classList.remove('hidden');
            checkWAStatus();
        } else {
            window.showAlert("Gagal", "Gagal mendapatkan kode pairing. Pastikan nomor benar & server aktif.", "error");
        }
    });
}

async function disconnectWASession() {
    if (window.showConfirm) {
        window.showConfirm("Putuskan Sesi WA", "Apakah Anda yakin ingin memutuskan koneksi WhatsApp sesi 'sps'?", async () => {
            try {
                await fetch(`${API_BASE}/delete/${SESSION_ID}?t=${Date.now()}`);
                if (window.showAlert) window.showAlert("Terputus", "Sesi WhatsApp berhasil dihentikan.", "info");
                checkWAStatus();
            } catch(e) {
                if (window.showAlert) window.showAlert("Gagal", e.message, "error");
            }
        });
    }
}

// 🏷️ MANAJEMEN KATALOG LAYANAN & TARIF JASA (CRUD LAYANAN)
function appendLayananSection() {
    const parent = formConfig?.parentElement;
    if (!parent) return;

    const container = document.createElement('div');
    container.className = "bg-white p-6 rounded-2xl shadow-sm border border-gray-100 max-w-2xl mt-6 space-y-4";
    container.innerHTML = `
        <div class="flex justify-between items-center border-b pb-3">
            <h3 class="text-base font-bold text-gray-800 flex items-center gap-2">
                <i class="fa-solid fa-list-check text-orange-600"></i>Katalog Layanan & Tarif Dasar Jasa
            </h3>
        </div>
        
        <form id="form-add-layanan" class="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <input type="text" id="layanan-nama-input" placeholder="Nama Layanan (Contoh: SAMSAT BALI)" class="px-3 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-orange-500" required>
            <input type="number" id="layanan-tarif-input" placeholder="Tarif Jasa (Rp)" class="px-3 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-orange-500" required>
            <button type="submit" class="bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-xl text-xs py-2 shadow-sm transition cursor-pointer">
                + Tambah Layanan
            </button>
        </form>

        <div id="container-list-layanan" class="space-y-2 pt-2">
            <p class="text-xs text-gray-400 italic">Memuat daftar layanan...</p>
        </div>
    `;
    parent.appendChild(container);

    document.getElementById('form-add-layanan')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nama = document.getElementById('layanan-nama-input').value.trim().toUpperCase();
        const tarif = parseInt(document.getElementById('layanan-tarif-input').value) || 0;

        try {
            await db.collection('layanan').add({ nama, tarif, createdAt: new Date().toISOString() });
            document.getElementById('form-add-layanan').reset();
            if (window.showAlert) window.showAlert("Berhasil", "Layanan baru berhasil ditambahkan!", "success");
        } catch (err) {
            if (window.showAlert) window.showAlert("Gagal", err.message, "error");
        }
    });
}

function renderLayananUI() {
    const container = document.getElementById('container-list-layanan');
    if (!container) return;

    let html = '';
    listLayanan.forEach(item => {
        html += `
            <div class="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                <div>
                    <span class="font-bold text-gray-800">${item.nama}</span>
                    <p class="text-gray-500 text-[11px] mt-0.5">Tarif Dasar Jasa: <strong class="text-emerald-600">Rp ${(item.tarif||0).toLocaleString('id-ID')}</strong></p>
                </div>
                <button onclick="window.deleteLayananItem('${item.id}')" class="text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition cursor-pointer">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
    });

    container.innerHTML = html || '<p class="text-xs text-gray-400 italic">Belum ada katalog layanan terdaftar.</p>';
}

window.deleteLayananItem = function(id) {
    if (window.showConfirm) {
        window.showConfirm("Hapus Layanan", "Hapus jenis layanan ini dari katalog?", async () => {
            try {
                await db.collection('layanan').doc(id).delete();
                if (window.showAlert) window.showAlert("Terhapus", "Layanan berhasil dihapus.", "success");
            } catch(e) {
                if (window.showAlert) window.showAlert("Gagal", e.message, "error");
            }
        });
    }
};

// 👥 DAFTAR KONTAK OPERATOR INTERNAL
function appendOperatorSection() {
    const parent = formConfig?.parentElement;
    if (!parent) return;

    const container = document.createElement('div');
    container.className = "bg-white p-6 rounded-2xl shadow-sm border border-gray-100 max-w-2xl mt-6 space-y-3";
    container.innerHTML = `
        <h3 class="text-base font-bold text-gray-800 border-b pb-2 flex items-center gap-2">
            <i class="fa-solid fa-users-gear text-orange-600"></i>Daftar Kontak Pengelola / Operator
        </h3>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
            <div class="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p class="font-bold text-gray-800">I Wayan Tiles Arnaya</p>
                <p class="text-emerald-600 font-semibold mt-1">WA: 085237044224</p>
                <span class="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded mt-2 inline-block font-medium">Owner 1</span>
            </div>
            <div class="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p class="font-bold text-gray-800">Ni Nyoman Suryani</p>
                <p class="text-emerald-600 font-semibold mt-1">WA: 085238010224</p>
                <span class="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded mt-2 inline-block font-medium">Owner 2 / Keuangan</span>
            </div>
            <div class="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p class="font-bold text-gray-800">Wulan JNE</p>
                <p class="text-emerald-600 font-semibold mt-1">WA: 082342834885</p>
                <span class="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded mt-2 inline-block font-medium">Admin JNE / Berkas</span>
            </div>
        </div>
    `;
    parent.appendChild(container);
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

// 🔴 AREA BAHAYA: DUA TOMBOL RESET AMAN
function appendResetDatabaseSection() {
    const parent = formConfig?.parentElement;
    if (!parent) return;

    const resetDiv = document.createElement('div');
    resetDiv.className = "bg-white p-6 rounded-2xl shadow-sm border border-rose-100 max-w-2xl mt-6 space-y-4 bg-rose-50/20";
    resetDiv.innerHTML = `
        <h3 class="text-base font-bold text-rose-800 border-b border-rose-100 pb-2 flex items-center gap-2">
            <i class="fa-solid fa-triangle-exclamation text-rose-600"></i>Area Bahaya: Manajemen & Reset Data
        </h3>
        
        <div class="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-2">
            <div class="flex items-center gap-2">
                <i class="fa-solid fa-coins text-amber-600 text-base"></i>
                <h4 class="font-bold text-amber-900 text-sm">Opsi 1: Nol-kan Piutang & Reset Pembukuan (Data Berkas Tersimpan)</h4>
            </div>
            <p class="text-xs text-amber-800 leading-relaxed">
                Menyetel seluruh tagihan lama menjadi <strong>Rp 0</strong> dan piutang menjadi <strong>Lunas/Rp 0</strong>. 
                <br>✅ <em>Semua 778 data nama klien, plat nomor, tanggal masuk, dan jatuh tempo tetap utuh/tersimpan (alarm & reminder tetap aktif). Sangat cocok untuk persiapan Go-Live awal September!</em>
            </p>
            <button id="btn-reset-financials-only" type="button" class="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer">
                <i class="fa-solid fa-rotate mr-1.5"></i>Nol-kan Piutang & Mulai Pembukuan Baru
            </button>
        </div>

        <div class="p-4 bg-rose-50/80 border border-rose-200 rounded-2xl space-y-2">
            <div class="flex items-center gap-2">
                <i class="fa-solid fa-trash-can text-rose-600 text-base"></i>
                <h4 class="font-bold text-rose-900 text-sm">Opsi 2: Reset Total Database (Hapus Bersih)</h4>
            </div>
            <p class="text-xs text-rose-800 leading-relaxed">
                Menghapus seluruh data Transaksi, Klien, dan Pengeluaran secara permanen dari server.
            </p>
            <button id="btn-reset-db-all" type="button" class="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer">
                <i class="fa-solid fa-trash mr-1.5"></i>Hapus Bersih Seluruh Data
            </button>
        </div>
    `;
    parent.appendChild(resetDiv);

    document.getElementById('btn-reset-financials-only')?.addEventListener('click', () => {
        if (window.showConfirm) {
            window.showConfirm(
                "NOL-KAN PIUTANG & RESET PEMBUKUAN?",
                "Tindakan ini akan menyetel semua Tagihan lama menjadi Rp 0 dan Piutang menjadi Rp 0. Data nama klien, plat kendaraan, dan tanggal jatuh tempo TETAP DISIMPAN AMAN. Lanjutkan?",
                async () => {
                    try {
                        const btn = document.getElementById('btn-reset-financials-only');
                        if (btn) { btn.disabled = true; btn.innerText = "Memproses..."; }

                        const trxSnap = await db.collection('transaksi').get();
                        const batchPromises = [];
                        let currentBatch = db.batch();
                        let count = 0;

                        trxSnap.forEach(doc => {
                            currentBatch.update(doc.ref, {
                                total: 0,
                                bayar: 0,
                                biaya_riil: 0,
                                status_bayar: 'LUNAS',
                                riwayat_pembayaran: []
                            });
                            count++;
                            if (count === 400) {
                                batchPromises.push(currentBatch.commit());
                                currentBatch = db.batch();
                                count = 0;
                            }
                        });

                        if (count > 0) {
                            batchPromises.push(currentBatch.commit());
                        }

                        await Promise.all(batchPromises);

                        const pSnap = await db.collection('pengeluaran').get();
                        const pBatch = db.batch();
                        pSnap.forEach(doc => pBatch.delete(doc.ref));
                        await pBatch.commit();

                        if (btn) { btn.disabled = false; btn.innerText = "Nol-kan Piutang & Mulai Pembukuan Baru"; }
                        if (window.showAlert) {
                            window.showAlert("Berhasil Reset Pembukuan!", "Seluruh piutang & omset lama telah disetel ke Rp 0. Semua data berkas klien tetap aman dan sistem siap Go-Live untuk September!", "success");
                        }
                    } catch (e) {
                        if (window.showAlert) window.showAlert("Gagal Reset", e.message, "error");
                    }
                }
            );
        }
    });

    document.getElementById('btn-reset-db-all')?.addEventListener('click', () => {
        if (window.showConfirm) {
            window.showConfirm(
                "⚠️ HAPUS BERSIH SEMUA DATA?",
                "Apakah Anda YAKIN ingin menghapus SELURUH data Transaksi, Klien, dan Buku Kas secara permanen? Data tidak dapat dikembalikan!",
                async () => {
                    try {
                        const trxSnap = await db.collection('transaksi').get();
                        trxSnap.forEach(doc => doc.ref.delete());

                        const klienSnap = await db.collection('klien').get();
                        klienSnap.forEach(doc => doc.ref.delete());

                        const pSnap = await db.collection('pengeluaran').get();
                        pSnap.forEach(doc => doc.ref.delete());

                        if (window.showAlert) window.showAlert("Berhasil!", "Seluruh database telah dihapus bersih total.", "success");
                    } catch (e) {
                        if (window.showAlert) window.showAlert("Gagal Reset", e.message, "error");
                    }
                }
            );
        }
    });
}