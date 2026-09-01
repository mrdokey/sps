import { db } from '../firebase.js?v=2';
import { requestWAPairing, requestWAQr } from '../wa.js?v=2';

let formConfig;
const API_BASE = "https://wa.mrdsolution.my.id/api";
const SESSION_ID = "sps";
let statusCheckInterval = null;
let activePollingTimeout = null;
let lastWAState = '';
let listLayanan = [];

// DATA DEFAULT PROFIL & KOP SURAT
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

    // 🛡️ PROTEKSI: Pasang komponen hanya jika belum ada di DOM
    if (!document.getElementById('wa-session-status-container')) {
        appendLayananSection();
        appendOperatorSection();
        appendPairingSection();
        appendResetDatabaseSection();
    }

    // Cek status pertama kali & mulai mode hemat (25 detik)
    checkWAStatus();
    startSmartWAPolling('slow');

    // Stream Data Profil Realtime
    db.collection('konfigurasi').doc('profile').onSnapshot(doc => {
        if (doc.exists) {
            const data = doc.data();
            configGlobal = { ...configGlobal, ...data };
        }
        populateForm();
    });

    // Stream Katalog Layanan Realtime
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

// 🧠 SMART POLLING: Lambat saat idle (25s), Cepat hanya saat pairing aktif (3s selama max 60s)
export function startSmartWAPolling(mode = 'slow') {
    stopWAPolling();
    
    const intervalTime = mode === 'fast' ? 3000 : 25000;
    statusCheckInterval = setInterval(checkWAStatus, intervalTime);

    if (mode === 'fast') {
        if (activePollingTimeout) clearTimeout(activePollingTimeout);
        activePollingTimeout = setTimeout(() => {
            stopWAPolling();
            startSmartWAPolling('slow');
            const qrBox = document.getElementById('qr-display-box');
            if (qrBox && !lastWAState.startsWith('CONNECTED')) {
                qrBox.innerHTML = `<p class="text-[11px] text-amber-600 font-medium p-2">⏱️ Waktu scan selesai untuk menghemat server. Klik tombol di bawah jika ingin muat QR baru.</p>`;
            }
        }, 60000);
    }
}

export function stopWAPolling() {
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        statusCheckInterval = null;
    }
}

// 📡 CEK STATUS SESI WA TANPA ME-RELOAD DOM (ANTI-KEDIP)
async function checkWAStatus() {
    const badgeEl = document.getElementById('wa-status-badge');
    const qrDisplay = document.getElementById('qr-display-box');
    const btnDisconnect = document.getElementById('btn-disconnect-wa');
    if (!badgeEl) return;

    try {
        const response = await fetch(`${API_BASE}/status/${SESSION_ID}?_t=${Date.now()}`, {
            cache: 'no-store'
        });
        
        if (response.ok) {
            const data = await response.json();
            const rawStatus = String(data.status || 'DISCONNECTED').toUpperCase().trim();
            const isConnected = (rawStatus === 'READY' || rawStatus === 'CONNECTED' || rawStatus === 'IDLE');

            if (isConnected) {
                lastWAState = 'CONNECTED';
                badgeEl.className = "text-xs font-extrabold px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 uppercase";
                badgeEl.innerText = `🟢 TERHUBUNG (${rawStatus})`;
                if (btnDisconnect) btnDisconnect.classList.remove('hidden');
                if (qrDisplay) qrDisplay.innerHTML = `<p class="text-xs text-emerald-600 font-bold">✅ Sesi WhatsApp Sudah Terhubung</p>`;
                
                if (activePollingTimeout) clearTimeout(activePollingTimeout);
                startSmartWAPolling('slow');
            } else {
                lastWAState = 'DISCONNECTED';
                badgeEl.className = "text-xs font-extrabold px-3 py-1 rounded-full bg-rose-100 text-rose-700 uppercase";
                badgeEl.innerText = "🔴 DISCONNECTED (TERPUTUS)";
                if (btnDisconnect) btnDisconnect.classList.add('hidden');

                if (data.qr && qrDisplay && !qrDisplay.querySelector('img')) {
                    qrDisplay.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(data.qr)}" alt="QR WA" class="rounded-lg shadow-sm">`;
                }
            }
        }
    } catch (e) {
        // Abaikan error koneksi sementara
    }
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

// 🏷️ KATALOG LAYANAN & TARIF JASA
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

// 👥 KONTAK PENGELOLA
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

// 📲 SEKSI PAIRING & QR WA
function appendPairingSection() {
    const parent = formConfig?.parentElement;
    if (!parent) return;

    const pairingDiv = document.createElement('div');
    pairingDiv.className = "bg-white p-6 rounded-2xl shadow-sm border border-gray-100 max-w-2xl mt-6 space-y-4";
    pairingDiv.innerHTML = `
        <div class="flex items-center justify-between border-b pb-3">
            <h3 class="text-base font-bold text-gray-800 flex items-center gap-2">
                <i class="fa-brands fa-whatsapp text-emerald-600 text-lg"></i>Tautkan WhatsApp Biro Jasa (Sesi SPS)
            </h3>
            <div class="flex items-center gap-2">
                <span id="wa-status-badge" class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 uppercase">
                    MEMERIKSA...
                </span>
                <button id="btn-disconnect-wa" type="button" class="hidden bg-rose-50 hover:bg-rose-100 text-rose-600 px-3 py-1 rounded-xl text-[11px] font-bold border border-rose-200 transition">
                    Putuskan
                </button>
            </div>
        </div>
        <p class="text-xs text-gray-500 leading-relaxed">Sesi ini bersifat terisolasi tanpa potongan harian VPS. Gunakan salah satu opsi di bawah untuk menautkan perangkat:</p>
        
        <div id="wa-session-status-container" class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <!-- SCAN QR BARCODE -->
            <div class="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 text-center flex flex-col justify-between">
                <div>
                    <h4 class="font-bold text-gray-800 text-xs flex items-center justify-center gap-1.5">
                        <i class="fa-solid fa-qrcode text-orange-600"></i>Scan QR Barcode
                    </h4>
                    <p class="text-[10px] text-gray-400 mt-0.5">Buka WA HP > Perangkat Tertaut > Scan</p>
                </div>
                
                <div id="qr-display-box" class="my-1 flex items-center justify-center min-h-[160px] bg-white rounded-xl border p-2">
                    <p class="text-[11px] text-gray-400 italic">Klik tombol untuk memuat QR Code.</p>
                </div>

                <button id="btn-request-qr" type="button" class="w-full bg-slate-900 hover:bg-slate-800 text-white py-2 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer">
                    <i class="fa-solid fa-arrows-rotate mr-1.5"></i>Tampilkan QR Code
                </button>
            </div>

            <!-- 8-DIGIT PAIRING CODE -->
            <div class="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 flex flex-col justify-between">
                <div>
                    <h4 class="font-bold text-gray-800 text-xs flex items-center gap-1.5">
                        <i class="fa-solid fa-key text-emerald-600"></i>Kode Pairing 8 Digit
                    </h4>
                    <p class="text-[10px] text-gray-400 mt-0.5">Tautkan dengan nomor HP tanpa kamera</p>
                </div>

                <div class="space-y-2">
                    <input type="tel" id="pairing-phone" placeholder="Contoh: 085237044224" class="w-full px-3 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white">
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
    `;
    parent.appendChild(pairingDiv);

    document.getElementById('btn-disconnect-wa')?.addEventListener('click', disconnectWASession);

    document.getElementById('btn-request-qr')?.addEventListener('click', async () => {
        const btn = document.getElementById('btn-request-qr');
        const qrBox = document.getElementById('qr-display-box');
        btn.innerText = "Meminta QR...";
        btn.disabled = true;
        if (qrBox) qrBox.innerHTML = `<p class="text-[11px] text-gray-400 italic">Menghubungkan ke VPS...</p>`;

        await requestWAQr();
        btn.disabled = false;
        btn.innerText = "Perbarui QR Code";
        startSmartWAPolling('fast');
        setTimeout(checkWAStatus, 1500);
    });

    document.getElementById('btn-request-pair')?.addEventListener('click', async () => {
        const phone = document.getElementById('pairing-phone')?.value;
        if (!phone) return window.showAlert("Perhatian", "Silakan masukkan nomor telepon!", "info");

        const btn = document.getElementById('btn-request-pair');
        btn.innerText = "Memproses...";
        btn.disabled = true;

        const code = await requestWAPairing(phone);
        btn.innerText = "Minta Kode Pairing";
        btn.disabled = false;

        if (code) {
            document.getElementById('pairing-code-box').innerText = code;
            document.getElementById('display-pairing-code').classList.remove('hidden');
            startSmartWAPolling('fast');
        } else {
            window.showAlert("Gagal", "Gagal meminta kode pairing ke VPS.", "error");
        }
    });
}

// 🔴 MANAJEMEN & RESET DATA
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

                        if (count > 0) batchPromises.push(currentBatch.commit());
                        await Promise.all(batchPromises);

                        const pSnap = await db.collection('pengeluaran').get();
                        const pBatch = db.batch();
                        pSnap.forEach(doc => pBatch.delete(doc.ref));
                        await pBatch.commit();

                        if (btn) { btn.disabled = false; btn.innerText = "Nol-kan Piutang & Mulai Pembukuan Baru"; }
                        if (window.showAlert) {
                            window.showAlert("Berhasil Reset Pembukuan!", "Seluruh piutang & omset lama telah disetel ke Rp 0. Semua data berkas klien tetap aman!", "success");
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