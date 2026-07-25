import { db } from '../firebase.js';

let listTransaksi = [];
let uploadedPhotos = []; // Array menampung banyak foto Base64
let containerTrx, formTrx, modalTrx, selectLayanan;

export function initTransaksiController() {
    containerTrx = document.getElementById('container-transaksi');
    formTrx = document.getElementById('form-trx');
    modalTrx = document.getElementById('modal-trx');
    selectLayanan = document.getElementById('trx-layanan');

    document.getElementById('btn-open-add-trx')?.addEventListener('click', () => openModal());
    document.getElementById('btn-close-modal-trx')?.addEventListener('click', closeModal);
    document.getElementById('btn-cancel-trx')?.addEventListener('click', closeModal);

    selectLayanan?.addEventListener('change', handleLayananUiChange);
    formTrx?.addEventListener('submit', saveTransaksi);

    // Event handler penambahan foto dokumen
    document.getElementById('trx-foto-input')?.addEventListener('change', handleFotoUpload);

    document.getElementById('search-input')?.addEventListener('keyup', runFilter);
    document.getElementById('filter-date')?.addEventListener('change', runFilter);
    document.getElementById('btn-reset-filter')?.addEventListener('click', resetFilter);

    db.collection('transaksi').orderBy('tgl_masuk', 'desc').onSnapshot(snapshot => {
        listTransaksi = [];
        snapshot.forEach(doc => {
            listTransaksi.push({ id: doc.id, ...doc.data() });
        });
        renderTransaksiList(listTransaksi);
    });
}

// LOGIKA UPLOAD & KOMPRESI BANYAK FOTO
function handleFotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800; // Kompresi resolusi
            const scaleSize = MAX_WIDTH / img.width;
            canvas.width = MAX_WIDTH;
            canvas.height = img.height * scaleSize;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
            
            // Tambahkan ke daftar array foto
            uploadedPhotos.push(compressedBase64);
            renderPhotoPreviews();

            // Reset input file agar bisa pilih foto lain lagi
            e.target.value = '';
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

function renderPhotoPreviews() {
    const grid = document.getElementById('container-preview-fotos');
    const countBadge = document.getElementById('count-fotos');
    if (countBadge) countBadge.innerText = `${uploadedPhotos.length} Foto`;

    if (!grid) return;
    let html = '';
    uploadedPhotos.forEach((src, index) => {
        html += `
            <div class="relative group rounded-xl overflow-hidden border shadow-sm h-20 bg-gray-100">
                <img src="${src}" class="w-full h-full object-cover">
                <button type="button" onclick="window.removePhoto(${index})" class="absolute top-1 right-1 bg-rose-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] shadow">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        `;
    });
    grid.innerHTML = html;
}

window.removePhoto = function(index) {
    uploadedPhotos.splice(index, 1);
    renderPhotoPreviews();
};

// LOGIKA PERUBAHAN LABEL FORMsesuai LAYANAN
function handleLayananUiChange() {
    const layanan = selectLayanan ? selectLayanan.value : 'SAMSAT';
    const label1 = document.getElementById('label-field-1');
    const field1 = document.getElementById('trx-field-1');
    const label2 = document.getElementById('label-field-2');
    const field2 = document.getElementById('trx-field-2');

    if (layanan === 'SIM') {
        if (label1) label1.innerText = 'NIK / Nomor KTP Klien';
        if (field1) field1.placeholder = '5101012304900001';
        if (label2) label2.innerText = 'Golongan / Jenis SIM';
        if (field2) field2.placeholder = 'SIM C / SIM A / SIM B1';
    } else if (layanan === 'SLF') {
        if (label1) label1.innerText = 'Nomor Izin / PBG / Sertifikat';
        if (field1) field1.placeholder = '503/123/SLF/2026';
        if (label2) label2.innerText = 'Nama & Alamat Bangunan';
        if (field2) field2.placeholder = 'Gedung Pemuda / Ruko Puputan';
    } else if (layanan === 'LAIN-LAIN') {
        if (label1) label1.innerText = 'Nomor Dokumen / Referensi';
        if (field1) field1.placeholder = 'REF-001 / NO. 123';
        if (label2) label2.innerText = 'Keterangan Layanan';
        if (field2) field2.placeholder = 'Catatan rincian berkas';
    } else {
        // SAMSAT, BALIK NAMA, MUTASI, KIR
        if (label1) label1.innerText = 'Plat Nomor / No. Polisi';
        if (field1) field1.placeholder = 'DK 1234 AB';
        if (label2) label2.innerText = 'Merek / Tipe Kendaraan';
        if (field2) field2.placeholder = 'Honda Vario 150 / Yamaha NMAX';
    }
}

function openModal(data = null) {
    formTrx?.reset();
    uploadedPhotos = [];
    renderPhotoPreviews();
    document.getElementById('trx-id').value = '';
    document.getElementById('trx-tgl-masuk').value = new Date().toISOString().split('T')[0];
    document.getElementById('modal-trx-title').innerText = 'Tambah Transaksi Baru';

    if (data) {
        document.getElementById('modal-trx-title').innerText = 'Edit Transaksi';
        document.getElementById('trx-id').value = data.id;
        document.getElementById('trx-nama').value = data.nama;
        document.getElementById('trx-wa').value = data.wa;
        document.getElementById('trx-alamat').value = data.alamat || '';
        document.getElementById('trx-layanan').value = data.layanan;
        document.getElementById('trx-field-1').value = data.field1 || '';
        document.getElementById('trx-field-2').value = data.field2 || '';
        document.getElementById('trx-tgl-masuk').value = data.tgl_masuk || '';
        document.getElementById('trx-tgl-tempo').value = data.tgl_tempo || '';
        document.getElementById('trx-total').value = data.total || 0;
        document.getElementById('trx-bayar').value = data.bayar || 0;
        document.getElementById('trx-status-bayar').value = data.status_bayar;
        document.getElementById('trx-status-berkas').value = data.status_berkas;

        if (Array.isArray(data.fotos)) {
            uploadedPhotos = [...data.fotos];
        } else if (data.foto) {
            uploadedPhotos = [data.foto];
        }
        renderPhotoPreviews();
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
    const alamat = document.getElementById('trx-alamat').value || '-';

    const payload = {
        nama: nama,
        wa: wa,
        alamat: alamat,
        layanan: document.getElementById('trx-layanan').value,
        field1: document.getElementById('trx-field-1').value,
        field2: document.getElementById('trx-field-2').value,
        tgl_masuk: document.getElementById('trx-tgl-masuk').value,
        tgl_tempo: document.getElementById('trx-tgl-tempo').value,
        total: parseInt(document.getElementById('trx-total').value) || 0,
        bayar: parseInt(document.getElementById('trx-bayar').value) || 0,
        status_bayar: document.getElementById('trx-status-bayar').value,
        status_berkas: document.getElementById('trx-status-berkas').value,
        fotos: uploadedPhotos
    };

    try {
        if (id) {
            await db.collection('transaksi').doc(id).update(payload);
        } else {
            await db.collection('transaksi').add(payload);
        }

        // Auto-save/update ke Database Klien
        const clientQuery = await db.collection('klien').where('wa', '==', wa).get();
        if (clientQuery.empty) {
            await db.collection('klien').add({ nama: nama, wa: wa, alamat: alamat });
        } else {
            clientQuery.forEach(doc => {
                db.collection('klien').doc(doc.id).update({ nama: nama, alamat: alamat });
            });
        }

        closeModal();
    } catch (err) {
        alert("Gagal menyimpan data: " + err.message);
    }
}

function renderTransaksiList(data) {
    let html = '';
    data.forEach(t => {
        const info1 = t.field1 || '-';
        const info2 = t.field2 ? ` (${t.field2})` : '';
        const badgeBayar = t.status_bayar === 'LUNAS' ? 'bg-emerald-100 text-emerald-800' : (t.status_bayar === 'DP' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800');
        const badgeBerkas = t.status_berkas === 'SELESAI' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800';
        
        // Foto preview di kartu
        const fotosList = Array.isArray(t.fotos) ? t.fotos : (t.foto ? [t.foto] : []);
        const fotoBadge = fotosList.length > 0 ? `<span class="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-semibold"><i class="fa-solid fa-paperclip mr-1"></i>${fotosList.length} Lampiran</span>` : '';

        html += `
            <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
                <div>
                    <div class="flex justify-between items-start mb-2">
                        <span class="text-xs px-2.5 py-1 rounded-full font-bold ${badgeBayar}">${t.status_bayar}</span>
                        <span class="text-xs px-2.5 py-1 rounded-full font-bold ${badgeBerkas}">${t.status_berkas}</span>
                    </div>
                    <div>
                        <h3 class="font-bold text-gray-800 text-base mt-1">${t.nama}</h3>
                        <p class="text-xs text-orange-600 font-semibold mt-0.5">${t.layanan} • ${info1}${info2}</p>
                        <p class="text-xs text-gray-400 mt-1"><i class="fa-solid fa-location-dot mr-1"></i>Alamat: ${t.alamat || '-'}</p>
                        <div class="mt-2 flex items-center gap-2">
                            <span class="text-xs text-gray-400"><i class="fa-solid fa-calendar mr-1"></i>${t.tgl_masuk}</span>
                            ${fotoBadge}
                        </div>
                    </div>
                    
                    <div class="mt-4 pt-3 border-t text-xs space-y-1">
                        <div class="flex justify-between text-gray-500"><span>Total Tagihan:</span><span>Rp ${(t.total||0).toLocaleString('id-ID')}</span></div>
                        <div class="flex justify-between text-gray-500"><span>Sudah Dibayar:</span><span>Rp ${(t.bayar||0).toLocaleString('id-ID')}</span></div>
                    </div>
                </div>

                <div class="flex items-center justify-between gap-2 mt-4 pt-3 border-t">
                    <button onclick='window.printInvoice(${JSON.stringify(t)})' class="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold">
                        <i class="fa-solid fa-download mr-1"></i>PDF
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
                           (t.field1 && t.field1.toLowerCase().includes(query)) ||
                           (t.field2 && t.field2.toLowerCase().includes(query));
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

// CETAK PDF INVOICE LANGSUNG DOWNLOAD
window.printInvoice = function(t) {
    const sisa = t.total - t.bayar;
    const info1 = t.field1 || '-';
    const info2 = t.field2 ? ` (${t.field2})` : '';

    const element = document.createElement('div');
    element.style.padding = '20px';
    element.style.fontFamily = 'sans-serif';
    element.innerHTML = `
        <div style="border: 1px solid #e2e8f0; padding: 24px; border-radius: 16px; max-width: 500px; margin: 0 auto; background: white;">
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px;">
                <div>
                    <h1 style="color: #ea580c; font-size: 20px; font-weight: bold; margin: 0;">BIRO JASA SPS</h1>
                    <p style="color: #94a3b8; font-size: 11px; margin: 0;">Sedana Permata Sari</p>
                </div>
                <div style="text-align: right;">
                    <span style="background: #f1f5f9; padding: 4px 10px; border-radius: 12px; font-size: 10px; font-weight: bold; text-transform: uppercase;">${t.status_bayar}</span>
                    <p style="color: #94a3b8; font-size: 10px; margin-top: 6px;">Tanggal: ${t.tgl_masuk}</p>
                </div>
            </div>

            <div style="margin: 20px 0; font-size: 13px; line-height: 1.6;">
                <p style="margin: 2px 0;"><strong>Nama Klien:</strong> ${t.nama}</p>
                <p style="margin: 2px 0;"><strong>Alamat:</strong> ${t.alamat || '-'}</p>
                <p style="margin: 2px 0;"><strong>Layanan:</strong> ${t.layanan} • ${info1}${info2}</p>
            </div>

            <table style="width: 100%; font-size: 12px; border-collapse: collapse; margin: 20px 0;">
                <thead>
                    <tr style="border-bottom: 1px solid #e2e8f0; text-align: left; color: #94a3b8; font-size: 10px;">
                        <th style="padding: 8px 0;">RINCIAN LAYANAN</th>
                        <th style="padding: 8px 0; text-align: right;">NOMINAL</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td style="padding: 8px 0;">Biaya ${t.layanan}</td><td style="padding: 8px 0; text-align: right;">Rp ${(t.total||0).toLocaleString('id-ID')}</td></tr>
                    <tr style="border-top: 1px solid #f1f5f9;"><td style="padding: 8px 0; font-weight: bold;">Total Tagihan</td><td style="padding: 8px 0; text-align: right; font-weight: bold; color: #ea580c;">Rp ${(t.total||0).toLocaleString('id-ID')}</td></tr>
                    <tr><td style="padding: 8px 0; color: #64748b;">Jumlah Dibayar</td><td style="padding: 8px 0; text-align: right; color: #10b981; font-weight: 600;">Rp ${(t.bayar||0).toLocaleString('id-ID')}</td></tr>
                    <tr style="border-top: 1px solid #f1f5f9;"><td style="padding: 8px 0; font-weight: bold;">Sisa Tagihan (Piutang)</td><td style="padding: 8px 0; text-align: right; font-weight: bold; color: #e11d48;">Rp ${sisa.toLocaleString('id-ID')}</td></tr>
                </tbody>
            </table>

            <div style="font-size: 10px; color: #94a3b8; line-height: 1.5; border-top: 1px solid #e2e8f0; padding-top: 12px;">
                <p style="font-weight: bold; color: #475569; margin: 0 0 4px 0;">Metode Pembayaran Transfer:</p>
                <p style="margin: 1px 0;">• BCA: 7720648207 a/n Ni Nyoman Suryani</p>
                <p style="margin: 1px 0;">• BPD: 013 02.02.18264-3 a/n Ni Nyoman Suryani</p>
            </div>
        </div>
    `;

    const opt = {
        margin:       0.3,
        filename:     `Invoice_${t.nama.replace(/\s+/g, '_')}_${t.tgl_masuk}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
}