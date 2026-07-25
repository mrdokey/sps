import { db } from '../firebase.js';

let listTransaksi = [];
let containerTrx, formTrx, modalTrx, selectLayanan, fieldKendaraan, fieldSlf;

export function initTransaksiController() {
    // Mengambil elemen setelah HTML anak index selesai di-inject
    containerTrx = document.getElementById('container-transaksi');
    formTrx = document.getElementById('form-trx');
    modalTrx = document.getElementById('modal-trx');
    selectLayanan = document.getElementById('trx-layanan');
    fieldKendaraan = document.getElementById('field-kendaraan');
    fieldSlf = document.getElementById('field-slf');

    // Modal Buka-Tutup
    document.getElementById('btn-open-add-trx')?.addEventListener('click', () => openModal());
    document.getElementById('btn-close-modal-trx')?.addEventListener('click', closeModal);
    document.getElementById('btn-cancel-trx')?.addEventListener('click', closeModal);

    // Form change & submit
    selectLayanan?.addEventListener('change', handleLayananUiChange);
    formTrx?.addEventListener('submit', saveTransaksi);

    // Filter event listeners
    document.getElementById('search-input')?.addEventListener('keyup', runFilter);
    document.getElementById('filter-date')?.addEventListener('change', runFilter);
    document.getElementById('btn-reset-filter')?.addEventListener('click', resetFilter);

    // Listener Real-time data Transaksi Firestore
    db.collection('transaksi').orderBy('tgl_masuk', 'desc').onSnapshot(snapshot => {
        listTransaksi = [];
        snapshot.forEach(doc => {
            listTransaksi.push({ id: doc.id, ...doc.data() });
        });
        renderTransaksiList(listTransaksi);
    });
}

function handleLayananUiChange() {
    const layanan = selectLayanan ? selectLayanan.value : '';
    if (layanan === 'SLF') {
        fieldKendaraan?.classList.add('hidden');
        fieldSlf?.classList.remove('hidden');
    } else {
        fieldKendaraan?.classList.remove('hidden');
        fieldSlf?.classList.add('hidden');
    }
}

function openModal(data = null) {
    formTrx?.reset();
    document.getElementById('trx-id').value = '';
    document.getElementById('trx-tgl-masuk').value = new Date().toISOString().split('T')[0];
    document.getElementById('modal-trx-title').innerText = 'Tambah Transaksi Baru';

    if (data) {
        document.getElementById('modal-trx-title').innerText = 'Edit Transaksi';
        document.getElementById('trx-id').value = data.id;
        document.getElementById('trx-nama').value = data.nama;
        document.getElementById('trx-wa').value = data.wa;
        document.getElementById('trx-layanan').value = data.layanan;
        document.getElementById('trx-plat').value = data.plat || '';
        document.getElementById('trx-unit').value = data.unit || ''; // Tipe motor
        document.getElementById('trx-bangunan').value = data.bangunan || '';
        document.getElementById('trx-tgl-masuk').value = data.tgl_masuk || '';
        document.getElementById('trx-tgl-tempo').value = data.tgl_tempo || '';
        document.getElementById('trx-total').value = data.total || 0;
        document.getElementById('trx-bayar').value = data.bayar || 0;
        document.getElementById('trx-status-bayar').value = data.status_bayar;
        document.getElementById('trx-status-berkas').value = data.status_berkas;
    }

    handleLayananUiChange();
    modalTrx?.classList.remove('hidden');
}

function closeModal() { modalTrx?.classList.add('hidden'); }

async function saveTransaksi(e) {
    e.preventDefault();
    const id = document.getElementById('trx-id').value;
    const nama = document.getElementById('trx-nama').value;
    const wa = document.getElementById('trx-wa').value;
    const unit = document.getElementById('trx-unit').value;

    const payload = {
        nama: nama,
        wa: wa,
        layanan: document.getElementById('trx-layanan').value,
        plat: document.getElementById('trx-plat').value,
        unit: unit, // Merek motor
        bangunan: document.getElementById('trx-bangunan').value,
        tgl_masuk: document.getElementById('trx-tgl-masuk').value,
        tgl_tempo: document.getElementById('trx-tgl-tempo').value,
        total: parseInt(document.getElementById('trx-total').value) || 0,
        bayar: parseInt(document.getElementById('trx-bayar').value) || 0,
        status_bayar: document.getElementById('trx-status-bayar').value,
        status_berkas: document.getElementById('trx-status-berkas').value
    };

    try {
        // Simpan transaksi
        if (id) {
            await db.collection('transaksi').doc(id).update(payload);
        } else {
            await db.collection('transaksi').add(payload);
        }

        // Otomatis simpan sebagai klien baru jika belum terdaftar
        const clientQuery = await db.collection('klien').where('wa', '==', wa).get();
        if (clientQuery.empty) {
            await db.collection('klien').add({
                nama: nama,
                wa: wa,
                alamat: '-'
            });
            console.log(`[AUTO-SAVE] Klien ${nama} otomatis didaftarkan.`);
        }

        closeModal();
    } catch (err) {
        alert("Gagal menyimpan data: " + err.message);
    }
}

function renderTransaksiList(data) {
    let html = '';
    data.forEach(t => {
        const detailInfo = t.layanan === 'SLF' ? (t.bangunan || '-') : (t.plat || '-');
        const unitText = t.unit ? ` (${t.unit})` : '';
        const badgeBayar = t.status_bayar === 'LUNAS' ? 'bg-emerald-100 text-emerald-800' : (t.status_bayar === 'DP' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800');
        const badgeBerkas = t.status_berkas === 'SELESAI' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800';

        html += `
            <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
                <div>
                    <div class="flex justify-between items-start mb-2">
                        <span class="text-xs px-2.5 py-1 rounded-full font-bold ${badgeBayar}">${t.status_bayar}</span>
                        <span class="text-xs px-2.5 py-1 rounded-full font-bold ${badgeBerkas}">${t.status_berkas}</span>
                    </div>
                    <h3 class="font-bold text-gray-800 text-base mt-1">${t.nama}</h3>
                    <p class="text-xs text-orange-600 font-semibold mt-0.5">${t.layanan} • ${detailInfo}${unitText}</p>
                    <p class="text-xs text-gray-400 mt-1"><i class="fa-solid fa-calendar mr-1"></i>Masuk: ${t.tgl_masuk}</p>
                    
                    <div class="mt-4 pt-3 border-t text-xs space-y-1">
                        <div class="flex justify-between text-gray-500"><span>Total:</span><span>Rp ${(t.total||0).toLocaleString('id-ID')}</span></div>
                        <div class="flex justify-between text-gray-500"><span>Bayar:</span><span>Rp ${(t.bayar||0).toLocaleString('id-ID')}</span></div>
                    </div>
                </div>

                <div class="flex items-center justify-between gap-2 mt-4 pt-3 border-t">
                    <button onclick='window.printInvoice(${JSON.stringify(t)})' class="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold">
                        <i class="fa-solid fa-print mr-1"></i>Cetak
                    </button>
                    <div class="flex gap-1.5">
                        <button onclick='window.editTransaksi(${JSON.stringify(t)})' class="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium">Edit</button>
                        <button onclick="window.deleteTransaksi('${t.id}')" class="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-medium">Hapus</button>
                    </div>
                </div>
            </div>
        `;
    });
    if (containerTrx) {
        containerTrx.innerHTML = html || '<p class="text-sm text-gray-400 italic col-span-full text-center py-8">Transaksi tidak ditemukan.</p>';
    }
}

function runFilter() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const date = document.getElementById('filter-date').value;

    const filtered = listTransaksi.filter(t => {
        const matchQuery = t.nama.toLowerCase().includes(query) || 
                           t.layanan.toLowerCase().includes(query) || 
                           (t.plat && t.plat.toLowerCase().includes(query)) ||
                           (t.bangunan && t.bangunan.toLowerCase().includes(query));
        const matchDate = date ? t.tgl_masuk === date : true;
        return matchQuery && matchDate;
    });
    renderTransaksiList(filtered);
}

function resetFilter() {
    document.getElementById('search-input').value = '';
    document.getElementById('filter-date').value = '';
    renderTransaksiList(listTransaksi);
}

window.editTransaksi = function(data) { openModal(data); }

window.deleteTransaksi = async function(id) {
    if (confirm("Hapus data transaksi ini secara permanen?")) {
        try {
            await db.collection('transaksi').doc(id).delete();
        } catch (err) { alert("Gagal menghapus: " + err.message); }
    }
}

window.printInvoice = function(t) {
    const printWindow = window.open('', '_blank');
    const sisa = t.total - t.bayar;
    const detail = t.layanan === 'SLF' ? `Bangunan: ${t.bangunan}` : `Plat Kendaraan: ${t.plat} ${t.unit ? `(${t.unit})` : ''}`;

    printWindow.document.write(`
        <html>
        <head>
            <title>Invoice - ${t.nama}</title>
            <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="p-8 text-gray-800" onload="window.print(); window.close();">
            <div class="max-w-xl mx-auto border p-6 rounded-2xl shadow-sm">
                <div class="flex justify-between items-center border-b pb-4">
                    <div>
                        <h1 class="font-bold text-xl text-orange-600">BIRO JASA SPS</h1>
                        <p class="text-xs text-gray-400">Sedana Permata Sari</p>
                    </div>
                    <div class="text-right">
                        <span class="text-xs bg-slate-100 px-3 py-1 rounded-full font-bold uppercase text-gray-600">${t.status_bayar}</span>
                        <p class="text-[10px] text-gray-400 mt-2">Tanggal: ${t.tgl_masuk}</p>
                    </div>
                </div>

                <div class="my-6 text-sm">
                    <p class="font-semibold">Nama Klien: <span class="font-normal text-gray-600">${t.nama}</span></p>
                    <p class="font-semibold">Layanan: <span class="font-normal text-gray-600">${t.layanan} (${detail})</span></p>
                </div>

                <table class="w-full text-sm my-6 border-t border-b py-3">
                    <thead>
                        <tr class="text-left text-gray-400 uppercase text-[10px] tracking-wider"><th class="py-2">Rincian Layanan</th><th class="text-right">Nominal</th></tr>
                    </thead>
                    <tbody>
                        <tr><td class="py-2">${t.layanan}</td><td class="text-right font-medium">Rp ${t.total.toLocaleString('id-ID')}</td></tr>
                        <tr class="border-t"><td class="py-2 font-bold">Total Pembayaran</td><td class="text-right font-bold text-orange-600">Rp ${t.total.toLocaleString('id-ID')}</td></tr>
                        <tr><td class="py-2 text-gray-500">Jumlah Dibayarkan</td><td class="text-right text-emerald-600 font-semibold">Rp ${t.bayar.toLocaleString('id-ID')}</td></tr>
                        <tr class="border-t"><td class="py-2 font-bold">Sisa Tagihan (Piutang)</td><td class="text-right font-bold text-rose-600">Rp ${sisa.toLocaleString('id-ID')}</td></tr>
                    </tbody>
                </table>

                <div class="text-[10px] text-gray-400 leading-relaxed border-t pt-4">
                    <p class="font-bold text-gray-600 mb-1">Metode Pembayaran:</p>
                    <p>• BCA: 7720648207 a/n Ni Nyoman Suryani</p>
                    <p>• BPD: 013 02.02.18264-3 a/n Ni Nyoman Suryani</p>
                </div>
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
}