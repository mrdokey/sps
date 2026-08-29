import { db } from '../firebase.js';
import { sendWA } from '../utils/wa.js';
import { configGlobal } from './setelan.js';

let listTransaksi = [];
let uploadedPhotos = [];
let currentPelunasanTrx = null;
let currentTetapkanTrx = null;
let containerTrx, formTrx, modalTrx, selectLayanan;
let formPelunasan, modalPelunasan;
let formTetapkan, modalTetapkan;

let groupCollapsed = {
    PENDING: false,
    PROSES: false,
    SELESAI: true
};

window.toggleGroup = function(statusGroup) {
    groupCollapsed[statusGroup] = !groupCollapsed[statusGroup];
    runFilterAndSort();
};

export function initTransaksiController() {
    containerTrx = document.getElementById('container-transaksi');
    formTrx = document.getElementById('form-trx');
    modalTrx = document.getElementById('modal-trx');
    selectLayanan = document.getElementById('trx-layanan');

    formPelunasan = document.getElementById('form-pelunasan');
    modalPelunasan = document.getElementById('modal-pelunasan');

    formTetapkan = document.getElementById('form-tetapkan-biaya');
    modalTetapkan = document.getElementById('modal-tetapkan-biaya');

    document.getElementById('btn-open-add-trx')?.addEventListener('click', () => openModal());
    document.getElementById('btn-close-modal-trx')?.addEventListener('click', closeModal);
    document.getElementById('btn-cancel-trx')?.addEventListener('click', closeModal);

    document.getElementById('btn-close-modal-pelunasan')?.addEventListener('click', closeModalPelunasan);
    document.getElementById('btn-cancel-pelunasan')?.addEventListener('click', closeModalPelunasan);

    document.getElementById('btn-close-modal-tetapkan')?.addEventListener('click', closeModalTetapkan);
    document.getElementById('btn-cancel-tetapkan')?.addEventListener('click', closeModalTetapkan);

    selectLayanan?.addEventListener('change', handleLayananUiChange);
    formTrx?.addEventListener('submit', saveTransaksi);
    formPelunasan?.addEventListener('submit', savePelunasan);
    formTetapkan?.addEventListener('submit', saveTetapkanBiaya);

    document.getElementById('trx-foto-input')?.addEventListener('change', handleFotoUpload);

    // Filter & Sorting Listeners
    document.getElementById('search-input')?.addEventListener('keyup', runFilterAndSort);
    document.getElementById('filter-date-start')?.addEventListener('change', runFilterAndSort);
    document.getElementById('filter-date-end')?.addEventListener('change', runFilterAndSort);
    document.getElementById('filter-bayar-status')?.addEventListener('change', runFilterAndSort);
    document.getElementById('sort-select')?.addEventListener('change', runFilterAndSort);
    document.getElementById('btn-reset-filter')?.addEventListener('click', resetFilter);

    if (containerTrx && !containerTrx.getAttribute('data-event-attached')) {
        containerTrx.setAttribute('data-event-attached', 'true');
        containerTrx.addEventListener('click', (e) => {
            const headerBtn = e.target.closest('.group-header-btn');
            if (headerBtn) {
                const groupKey = headerBtn.getAttribute('data-group-key');
                if (groupKey) {
                    groupCollapsed[groupKey] = !groupCollapsed[groupKey];
                    runFilterAndSort();
                }
            }
        });
    }

    db.collection('transaksi').onSnapshot(snapshot => {
        listTransaksi = [];
        snapshot.forEach(doc => {
            listTransaksi.push({ id: doc.id, ...doc.data() });
        });
        runFilterAndSort();
    });
}

function handleFotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            const scaleSize = MAX_WIDTH / img.width;
            canvas.width = MAX_WIDTH;
            canvas.height = img.height * scaleSize;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
            uploadedPhotos.push(compressedBase64);
            renderPhotoPreviews();
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
        document.getElementById('trx-field-1').value = data.field1 || data.plat || '';
        document.getElementById('trx-field-2').value = data.field2 || data.unit || data.bangunan || '';
        document.getElementById('trx-tgl-masuk').value = data.tgl_masuk || '';
        document.getElementById('trx-tgl-tempo').value = data.tgl_tempo || '';
        document.getElementById('trx-total').value = data.total || 0;
        document.getElementById('trx-bayar').value = data.bayar || 0;
        document.getElementById('trx-biaya-riil').value = data.biaya_riil || 0;
        document.getElementById('trx-status-bayar').value = data.status_bayar || 'MENUNGGU CEK BIAYA';
        document.getElementById('trx-status-berkas').value = data.status_berkas;

        if (Array.isArray(data.fotos)) uploadedPhotos = [...data.fotos];
        renderPhotoPreviews();
    }

    handleLayananUiChange();
    modalTrx?.classList.remove('hidden');
}

function closeModal() { modalTrx?.classList.add('hidden'); }

// 💰 BUKA MODAL TETAPKAN BIAYA
window.openTetapkanBiayaModal = function(id) {
    const tData = listTransaksi.find(item => item.id === id);
    if (!tData) return;

    currentTetapkanTrx = tData;
    formTetapkan?.reset();

    const infoDetail = tData.field1 || tData.plat || '-';

    document.getElementById('tetapkan-trx-id').value = tData.id;
    document.getElementById('tetapkan-nama').innerText = tData.nama;
    document.getElementById('tetapkan-layanan').innerText = `${tData.layanan} (${infoDetail})`;
    document.getElementById('tetapkan-total').value = tData.total > 0 ? tData.total : '';
    document.getElementById('tetapkan-biaya-riil').value = tData.biaya_riil > 0 ? tData.biaya_riil : '';
    document.getElementById('tetapkan-bayar').value = tData.bayar || 0;
    document.getElementById('tetapkan-status-berkas').value = tData.status_berkas || 'PROSES';

    modalTetapkan?.classList.remove('hidden');
};

function closeModalTetapkan() { modalTetapkan?.classList.add('hidden'); }

async function saveTetapkanBiaya(e) {
    e.preventDefault();
    if (!currentTetapkanTrx) return;

    const total = parseInt(document.getElementById('tetapkan-total').value) || 0;
    const biaya_riil = parseInt(document.getElementById('tetapkan-biaya-riil').value) || 0;
    const bayar = parseInt(document.getElementById('tetapkan-bayar').value) || (currentTetapkanTrx.bayar || 0);
    const status_berkas = document.getElementById('tetapkan-status-berkas').value;

    if (total <= 0) {
        if (window.showAlert) window.showAlert("Perhatian", "Total tagihan harus lebih dari Rp 0!", "info");
        return;
    }

    const sisa = total - bayar;
    const status_bayar = (bayar >= total) ? "LUNAS" : (bayar > 0 ? "DP" : "BELUM BAYAR");

    // Update / inisialisasi riwayat pembayaran jika ada bayar
    let riwayat = Array.isArray(currentTetapkanTrx.riwayat_pembayaran) ? [...currentTetapkanTrx.riwayat_pembayaran] : [];
    if (bayar > 0 && riwayat.length === 0) {
        riwayat.push({
            id_bayar: 'PAY-1',
            tgl: currentTetapkanTrx.tgl_masuk || new Date().toISOString().split('T')[0],
            nominal: bayar,
            keterangan: (bayar >= total) ? 'Pembayaran Penuh (Lunas)' : 'Uang Muka / DP',
            metode: 'Tunai / Transfer'
        });
    }

    try {
        await db.collection('transaksi').doc(currentTetapkanTrx.id).update({
            total: total,
            biaya_riil: biaya_riil,
            bayar: bayar,
            status_bayar: status_bayar,
            status_berkas: status_berkas,
            riwayat_pembayaran: riwayat
        });

        // 🌟 KIRIM WA INVOICE RESMI SETELAH BIAYA SELESAI DICEK DI SAMSAT
        const publicInvoiceUrl = `https://mrdokey.github.io/sps/invoice.html?id=${currentTetapkanTrx.id}`;
        const infoDetail = currentTetapkanTrx.field1 || currentTetapkanTrx.plat || '-';

        const pesanTagihan = `Halo *${currentTetapkanTrx.nama}*,\n\n` +
                             `Biaya pengurusan berkas *${currentTetapkanTrx.layanan}* (${infoDetail}) Anda telah *SELESAI KAMI CEK* di loket Samsat dengan rincian sebagai berikut:\n\n` +
                             `• Total Biaya Tagihan: *Rp ${total.toLocaleString('id-ID')}*\n` +
                             `• Sudah Dibayar: *Rp ${bayar.toLocaleString('id-ID')}*\n` +
                             `• Sisa Pembayaran: *Rp ${sisa > 0 ? sisa.toLocaleString('id-ID') : '0 (LUNAS)'}*\n\n` +
                             `📄 *Rincian Invoice & Rekening Transfer:* ${publicInvoiceUrl}\n\n` +
                             `Mohon konfirmasinya untuk proses selanjutnya. Terima kasih.`;

        sendWA(currentTetapkanTrx.wa, pesanTagihan);

        closeModalTetapkan();
        if (window.showAlert) window.showAlert("Biaya Ditetapkan!", "Total biaya berhasil disimpan & Invoice WA telah terkirim ke klien!", "success");
    } catch (err) {
        if (window.showAlert) window.showAlert("Gagal", err.message, "error");
    }
}

// 💵 BUKA MODAL MULTI-PAYMENT & RIWAYAT PEMBAYARAN
window.openPelunasanModal = function(id) {
    const tData = listTransaksi.find(item => item.id === id);
    if (!tData) return;

    currentPelunasanTrx = tData;
    formPelunasan?.reset();

    const sisa = (tData.total || 0) - (tData.bayar || 0);
    const detailInfo = tData.field1 || tData.plat || '-';

    document.getElementById('pelunasan-trx-id').value = tData.id;
    document.getElementById('pelunasan-nama').innerText = tData.nama;
    document.getElementById('pelunasan-layanan').innerText = `${tData.layanan} (${detailInfo})`;
    document.getElementById('pelunasan-total').innerText = `Rp ${(tData.total || 0).toLocaleString('id-ID')}`;
    document.getElementById('pelunasan-terbayar').innerText = `Rp ${(tData.bayar || 0).toLocaleString('id-ID')}`;
    document.getElementById('pelunasan-sisa').innerText = `Rp ${sisa.toLocaleString('id-ID')}`;
    document.getElementById('pelunasan-tgl').value = new Date().toISOString().split('T')[0];
    document.getElementById('pelunasan-nominal').value = sisa > 0 ? sisa : 0;
    
    const paymentCount = Array.isArray(tData.riwayat_pembayaran) ? tData.riwayat_pembayaran.length : (tData.bayar > 0 ? 1 : 0);
    document.getElementById('pelunasan-keterangan').value = sisa <= 0 ? "Pelunasan Tagihan" : `Pembayaran Cicilan ke-${paymentCount + 1}`;

    renderRiwayatPembayaranModal(tData);
    modalPelunasan?.classList.remove('hidden');
};

function closeModalPelunasan() { modalPelunasan?.classList.add('hidden'); }

function renderRiwayatPembayaranModal(tData) {
    const container = document.getElementById('container-riwayat-pembayaran');
    const badgeCount = document.getElementById('pelunasan-count-badge');
    if (!container) return;

    const riwayat = Array.isArray(tData.riwayat_pembayaran) ? tData.riwayat_pembayaran : (tData.bayar > 0 ? [{
        id_bayar: 'PAY-1',
        tgl: tData.tgl_masuk || '-',
        nominal: tData.bayar,
        keterangan: 'Pembayaran Awal / DP',
        metode: 'Tunai / Transfer'
    }] : []);

    if (badgeCount) badgeCount.innerText = `${riwayat.length}x Pembayaran`;

    let html = '';
    riwayat.forEach((p, idx) => {
        html += `
            <div class="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 text-xs shadow-sm">
                <div>
                    <div class="flex items-center gap-1.5">
                        <span class="font-bold text-gray-800">${p.keterangan || `Pembayaran #${idx + 1}`}</span>
                        <span class="text-[9px] bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.5 rounded border border-emerald-200">${p.metode || 'Kas'}</span>
                    </div>
                    <p class="text-[11px] text-gray-400 mt-0.5"><i class="fa-solid fa-calendar-check mr-1"></i>${p.tgl} • <strong class="text-emerald-600">Rp ${(p.nominal || 0).toLocaleString('id-ID')}</strong></p>
                </div>
                <button type="button" onclick='window.printKwitansi("${tData.id}", ${idx})' class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition flex items-center gap-1">
                    <i class="fa-solid fa-print"></i>Kwitansi
                </button>
            </div>
        `;
    });

    container.innerHTML = html || '<p class="text-xs text-gray-400 italic text-center py-2">Belum ada riwayat pembayaran.</p>';
}

async function savePelunasan(e) {
    e.preventDefault();
    if (!currentPelunasanTrx) return;

    const nominalTambah = parseInt(document.getElementById('pelunasan-nominal').value) || 0;
    const tglBayar = document.getElementById('pelunasan-tgl').value;
    const ketBayar = document.getElementById('pelunasan-keterangan').value.trim() || 'Pembayaran Cicilan';
    const metodeBayar = document.getElementById('pelunasan-metode').value;

    if (nominalTambah <= 0) {
        if (window.showAlert) window.showAlert("Perhatian", "Nominal pembayaran harus lebih dari 0!", "info");
        return;
    }

    let riwayat = Array.isArray(currentPelunasanTrx.riwayat_pembayaran) ? [...currentPelunasanTrx.riwayat_pembayaran] : (currentPelunasanTrx.bayar > 0 ? [{
        id_bayar: 'PAY-1',
        tgl: currentPelunasanTrx.tgl_masuk || tglBayar,
        nominal: currentPelunasanTrx.bayar,
        keterangan: 'Pembayaran Awal / DP',
        metode: 'Tunai / Transfer'
    }] : []);

    const newPayment = {
        id_bayar: `PAY-${riwayat.length + 1}`,
        tgl: tglBayar,
        nominal: nominalTambah,
        keterangan: ketBayar,
        metode: metodeBayar
    };
    riwayat.push(newPayment);

    const totalBaruBayar = riwayat.reduce((acc, cur) => acc + (cur.nominal || 0), 0);
    const sisaAkhir = (currentPelunasanTrx.total || 0) - totalBaruBayar;
    const isLunas = sisaAkhir <= 0;
    const statusBayarBaru = isLunas ? "LUNAS" : "DP";

    try {
        await db.collection('transaksi').doc(currentPelunasanTrx.id).update({
            bayar: totalBaruBayar,
            status_bayar: statusBayarBaru,
            riwayat_pembayaran: riwayat
        });

        const publicInvoiceUrl = `https://mrdokey.github.io/sps/invoice.html?id=${currentPelunasanTrx.id}`;
        const infoDetail = currentPelunasanTrx.field1 || currentPelunasanTrx.plat || '-';
        
        const pesanWA = `Halo *${currentPelunasanTrx.nama}*, terima kasih!\n\n` +
                        `Pembayaran sebesar *Rp ${nominalTambah.toLocaleString('id-ID')}* (${ketBayar} - ${metodeBayar}) untuk pengurusan *${currentPelunasanTrx.layanan}* (${infoDetail}) telah *KAMI TERIMA* pada tanggal ${tglBayar}.\n\n` +
                        `• Total Biaya: *Rp ${(currentPelunasanTrx.total || 0).toLocaleString('id-ID')}*\n` +
                        `• Total Terbayar: *Rp ${totalBaruBayar.toLocaleString('id-ID')}*\n` +
                        `• Sisa Tagihan: *Rp ${sisaAkhir > 0 ? sisaAkhir.toLocaleString('id-ID') : '0 (LUNAS)'}*\n` +
                        `• Status: *${statusBayarBaru}*\n\n` +
                        `📄 *Kwitansi & Rincian Pembayaran Terupdate:* ${publicInvoiceUrl}\n\n` +
                        `Terima kasih atas kepercayaannya pada Biro Jasa SPS.`;
        
        sendWA(currentPelunasanTrx.wa, pesanWA);

        closeModalPelunasan();
        if (window.showAlert) window.showAlert("Pembayaran Berhasil!", `Pembayaran Rp ${nominalTambah.toLocaleString('id-ID')} berhasil dicatat & Kwitansi WA telah terkirim!`, "success");
    } catch (err) {
        if (window.showAlert) window.showAlert("Gagal", err.message, "error");
    }
}

async function saveTransaksi(e) {
    e.preventDefault();
    const id = document.getElementById('trx-id').value;
    const nama = document.getElementById('trx-nama').value;
    const wa = document.getElementById('trx-wa').value;
    const alamat = document.getElementById('trx-alamat').value || '-';
    const layanan = document.getElementById('trx-layanan').value;
    const field1 = document.getElementById('trx-field-1').value;
    const field2 = document.getElementById('trx-field-2').value;
    const tgl_masuk = document.getElementById('trx-tgl-masuk').value;
    const tgl_tempo = document.getElementById('trx-tgl-tempo').value;
    const total = parseInt(document.getElementById('trx-total').value) || 0;
    const bayar = parseInt(document.getElementById('trx-bayar').value) || 0;
    const biaya_riil = parseInt(document.getElementById('trx-biaya-riil').value) || 0;
    const status_berkas = document.getElementById('trx-status-berkas').value;
    
    // Penentuan Status Bayar Fleksibel
    let status_bayar = document.getElementById('trx-status-bayar').value;
    if (total === 0) {
        status_bayar = "MENUNGGU CEK BIAYA";
    } else if (bayar >= total && total > 0) {
        status_bayar = "LUNAS";
    } else if (bayar > 0) {
        status_bayar = "DP";
    } else {
        status_bayar = "BELUM BAYAR";
    }

    let riwayat = [];
    if (bayar > 0) {
        riwayat.push({
            id_bayar: 'PAY-1',
            tgl: tgl_masuk,
            nominal: bayar,
            keterangan: (bayar >= total && total > 0) ? 'Pembayaran Penuh (Lunas)' : 'Uang Muka / DP',
            metode: 'Tunai / Transfer'
        });
    }

    const payload = {
        nama: nama,
        wa: wa,
        alamat: alamat,
        layanan: layanan,
        field1: field1,
        field2: field2,
        tgl_masuk: tgl_masuk,
        tgl_tempo: tgl_tempo,
        total: total,
        bayar: bayar,
        biaya_riil: biaya_riil,
        status_bayar: status_bayar,
        status_berkas: status_berkas,
        fotos: uploadedPhotos
    };

    try {
        let docRefId = id;
        if (id) {
            const oldData = listTransaksi.find(item => item.id === id);
            if (oldData && Array.isArray(oldData.riwayat_pembayaran)) {
                payload.riwayat_pembayaran = oldData.riwayat_pembayaran;
            }
            await db.collection('transaksi').doc(id).update(payload);

            if (oldData && oldData.status_berkas !== 'SELESAI' && status_berkas === 'SELESAI') {
                const unitDetail = field2 ? ` (${field2})` : '';
                const pesanSelesai = `Halo *${nama}*, menginfokan bahwa berkas *${layanan}* (${field1}${unitDetail}) Anda sudah *SELESAI DIPROSES* dan siap diambil / diserahkan. Terima kasih.`;
                sendWA(wa, pesanSelesai);
            }
        } else {
            payload.riwayat_pembayaran = riwayat;
            const docRef = await db.collection('transaksi').add(payload);
            docRefId = docRef.id;

            const publicInvoiceUrl = `https://mrdokey.github.io/sps/invoice.html?id=${docRefId}`;
            const unitDetail = field2 ? ` (${field2})` : '';

            // 🌟 LOGIKA PESAN WA: TITIP BERKAS vs INVOICE TAGIHAN LANGSUNG
            let pesanWaBaru = "";
            if (total === 0) {
                // Pesan Surat Tanda Terima Titip Berkas
                pesanWaBaru = `Halo *${nama}*,\n\n` +
                              `Dokumen fisik pengurusan berkas *${layanan}* (${field1}${unitDetail}) Anda telah *KAMI TERIMA DENGAN AMAN* di kantor Biro Jasa SPS dan sedang dalam proses pengecekan biaya pajak di loket Samsat.\n\n` +
                              `📄 *Surat Tanda Terima Titip Berkas:* ${publicInvoiceUrl}\n\n` +
                              `Kami akan segera menginfokan rincian total biayanya setelah pengecekan selesai. Terima kasih.`;
            } else {
                // Pesan Invoice Tagihan Normal
                pesanWaBaru = `Halo *${nama}*, terima kasih telah mendaftarkan pengurusan berkas *${layanan}* (${field1}${unitDetail}) di Biro Jasa SPS.\n\n` +
                              `• Total Tagihan: *Rp ${total.toLocaleString('id-ID')}*\n` +
                              `• Pembayaran Awal (DP): *Rp ${bayar.toLocaleString('id-ID')}*\n` +
                              `• Sisa Tagihan: *Rp ${(total - bayar).toLocaleString('id-ID')}*\n\n` +
                              `📄 *Rincian Invoice & Kwitansi Digital:* ${publicInvoiceUrl}\n\nTerima kasih.`;
            }

            sendWA(wa, pesanWaBaru);
        }

        const clientQuery = await db.collection('klien').where('wa', '==', wa).get();
        if (clientQuery.empty) {
            await db.collection('klien').add({ nama: nama, wa: wa, alamat: alamat });
        } else {
            clientQuery.forEach(doc => db.collection('klien').doc(doc.id).update({ nama: nama, alamat: alamat }));
        }

        closeModal();
        if (window.showAlert) window.showAlert("Sukses", "Data transaksi berhasil disimpan!", "success");
    } catch (err) {
        if (window.showAlert) window.showAlert("Gagal", err.message, "error");
    }
}

window.updateStatusBerkas = function(id, newStatus) {
    const tData = listTransaksi.find(item => item.id === id);
    if (!tData) return;

    if (window.showConfirm) {
        window.showConfirm("Ubah Status Berkas", `Ubah status berkas ${tData.nama} menjadi ${newStatus}?`, async () => {
            try {
                await db.collection('transaksi').doc(id).update({ status_berkas: newStatus });

                const infoDetail = tData.field1 || tData.plat || tData.bangunan || '-';
                const unitDetail = tData.field2 ? ` (${tData.field2})` : (tData.unit ? ` (${tData.unit})` : '');

                if (newStatus === 'SELESAI') {
                    const pesanStatus = `Halo *${tData.nama}*, menginfokan bahwa berkas *${tData.layanan}* (${infoDetail}${unitDetail}) Anda sudah *SELESAI DIPROSES* dan siap diambil / diserahkan. Terima kasih.`;
                    const sendRes = await sendWA(tData.wa, pesanStatus);
                    if (sendRes) {
                        if (window.showAlert) window.showAlert("Berhasil", `Status diperbarui ke SELESAI & WA notifikasi sukses terkirim ke klien!`, "success");
                    } else {
                        if (window.showAlert) window.showAlert("Perhatian", `Status diperbarui ke SELESAI, namun gagal mengirim WA ke klien.`, "info");
                    }
                } else {
                    if (window.showAlert) window.showAlert("Berhasil", `Status berkas berhasil diperbarui ke ${newStatus}.`, "success");
                }
            } catch (e) {
                if (window.showAlert) window.showAlert("Gagal", e.message, "error");
            }
        });
    }
};

function renderTransaksiList(data) {
    if (!containerTrx) return;

    const groups = [
        { key: 'PENDING', label: 'Berkas PENDING', bg: 'bg-amber-500', text: 'text-amber-900', bgLight: 'bg-amber-50/80 border-amber-200', icon: 'fa-regular fa-clock', items: [] },
        { key: 'PROSES', label: 'Berkas PROSES', bg: 'bg-blue-600', text: 'text-blue-900', bgLight: 'bg-blue-50/80 border-blue-200', icon: 'fa-solid fa-spinner', items: [] },
        { key: 'SELESAI', label: 'Berkas SELESAI', bg: 'bg-emerald-600', text: 'text-emerald-900', bgLight: 'bg-emerald-50/80 border-emerald-200', icon: 'fa-solid fa-circle-check', items: [] }
    ];

    data.forEach(t => {
        const statusKey = (t.status_berkas || 'PENDING').toUpperCase();
        const group = groups.find(g => g.key === statusKey) || groups[0];
        group.items.push(t);
    });

    let mainHtml = '';
    let totalAllItems = data.length;

    if (totalAllItems === 0) {
        containerTrx.innerHTML = '<p class="text-sm text-gray-400 italic text-center py-8">Transaksi tidak ditemukan.</p>';
        return;
    }

    groups.forEach(g => {
        const count = g.items.length;
        const isCollapsed = groupCollapsed[g.key];
        const chevronIcon = isCollapsed ? 'fa-chevron-right' : 'fa-chevron-down';

        let cardsHtml = '';
        g.items.forEach(t => {
            const info1 = t.field1 || t.plat || '-';
            const info2 = t.field2 ? ` (${t.field2})` : (t.unit ? ` (${t.unit})` : '');
            const sisa = (t.total || 0) - (t.bayar || 0);

            // Badge Status Bayar Dinamis
            let badgeBayar = 'bg-rose-100 text-rose-800';
            if (t.status_bayar === 'LUNAS') badgeBayar = 'bg-emerald-100 text-emerald-800';
            else if (t.status_bayar === 'DP') badgeBayar = 'bg-amber-100 text-amber-800';
            else if (t.status_bayar === 'MENUNGGU CEK BIAYA' || t.total === 0) badgeBayar = 'bg-purple-100 text-purple-800';

            const badgeBerkas = t.status_berkas === 'SELESAI' ? 'bg-emerald-100 text-emerald-800' : (t.status_berkas === 'PROSES' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800');
            
            const fotosList = Array.isArray(t.fotos) ? t.fotos : [];
            const fotoBadge = fotosList.length > 0 ? `<span class="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-semibold"><i class="fa-solid fa-paperclip mr-1"></i>${fotosList.length} Foto</span>` : '';

            const payCount = Array.isArray(t.riwayat_pembayaran) ? t.riwayat_pembayaran.length : (t.bayar > 0 ? 1 : 0);
            const payBadge = `<span class="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded border border-emerald-200">${payCount}x Bayar</span>`;

            const btnActionProses = t.status_berkas !== 'PROSES' ? `<button onclick='window.updateStatusBerkas("${t.id}", "PROSES")' class="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold cursor-pointer">Proses</button>` : '';
            const btnActionSelesai = t.status_berkas !== 'SELESAI' ? `<button onclick='window.updateStatusBerkas("${t.id}", "SELESAI")' class="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold cursor-pointer">Selesai</button>` : '';

            // 💰 TOMBOL TETAPKAN BIAYA vs TOMBOL BAYAR CICILAN
            let btnBiayaAction = '';
            if (t.total === 0 || t.status_bayar === 'MENUNGGU CEK BIAYA') {
                btnBiayaAction = `
                    <button onclick='window.openTetapkanBiayaModal("${t.id}")' class="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center gap-1 cursor-pointer">
                        <i class="fa-solid fa-coins"></i>Tetapkan Biaya
                    </button>
                `;
            } else {
                btnBiayaAction = `
                    <button onclick='window.openPelunasanModal("${t.id}")' class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center gap-1 cursor-pointer">
                        <i class="fa-solid fa-hand-holding-dollar"></i>${sisa <= 0 ? 'Riwayat Bayar' : 'Bayar / Cicil'}
                    </button>
                `;
            }

            // Teks Rincian Tagihan
            let textBiayaSection = '';
            if (t.total === 0 || t.status_bayar === 'MENUNGGU CEK BIAYA') {
                textBiayaSection = `
                    <div class="mt-4 pt-3 border-t text-xs bg-purple-50/50 p-2.5 rounded-xl text-purple-900 border border-purple-100">
                        <p class="font-bold flex items-center gap-1"><i class="fa-solid fa-hourglass-half text-purple-600"></i>Biaya Belum Ditetapkan</p>
                        <p class="text-[11px] text-purple-700 mt-0.5">Berkas fisik sedang dalam proses pengecekan di loket Samsat.</p>
                    </div>
                `;
            } else {
                textBiayaSection = `
                    <div class="mt-4 pt-3 border-t text-xs space-y-1">
                        <div class="flex justify-between text-gray-500"><span>Total Tagihan:</span><span>Rp ${(t.total||0).toLocaleString('id-ID')}</span></div>
                        <div class="flex justify-between text-gray-500"><span>Sudah Dibayar:</span><span>Rp ${(t.bayar||0).toLocaleString('id-ID')}</span></div>
                        <div class="flex justify-between font-bold text-rose-600"><span>Sisa Piutang:</span><span>Rp ${sisa.toLocaleString('id-ID')}</span></div>
                    </div>
                `;
            }

            cardsHtml += `
                <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
                    <div>
                        <div class="flex justify-between items-start mb-2">
                            <div class="flex items-center gap-1.5">
                                <span class="text-xs px-2.5 py-1 rounded-full font-bold ${badgeBayar}">${t.status_bayar || 'MENUNGGU CEK BIAYA'}</span>
                                ${payBadge}
                            </div>
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
                        ${textBiayaSection}
                    </div>

                    <div class="flex flex-col gap-2 mt-4 pt-3 border-t">
                        <div class="flex gap-2 items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-100">
                            <span class="text-[10px] font-bold text-gray-400 uppercase">Aksi:</span>
                            <div class="flex gap-1.5 items-center">
                                ${btnBiayaAction}
                                ${btnActionProses}
                                ${btnActionSelesai}
                            </div>
                        </div>

                        <div class="flex items-center justify-between gap-2 mt-1">
                            <button onclick='window.printPrimaNota("${t.id}")' class="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer flex items-center gap-1">
                                <i class="fa-solid fa-file-contract"></i>${t.total === 0 ? 'Tanda Terima' : 'Prima Nota'}
                            </button>

                            <div class="flex gap-1.5">
                                <button onclick='window.editTransaksi("${t.id}")' class="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium cursor-pointer">Edit</button>
                                <button onclick="window.deleteTransaksi('${t.id}')" class="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-medium cursor-pointer">Hapus</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        const contentDisplayClass = isCollapsed ? 'hidden' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-3';

        mainHtml += `
            <div class="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                <button type="button" data-group-key="${g.key}" class="group-header-btn w-full flex items-center justify-between p-4 ${g.bgLight} transition hover:opacity-90 cursor-pointer">
                    <div class="flex items-center gap-3 pointer-events-none">
                        <span class="w-8 h-8 rounded-xl ${g.bg} text-white flex items-center justify-center text-sm shadow-sm">
                            <i class="${g.icon}"></i>
                        </span>
                        <div class="text-left">
                            <h3 class="font-bold ${g.text} text-sm tracking-wide">${g.label}</h3>
                            <span class="text-[11px] text-gray-500 font-medium">${count} Berkas Terdaftar</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 pointer-events-none">
                        <span class="text-xs bg-white/90 px-3 py-1 rounded-full text-gray-700 font-extrabold border shadow-sm">${count}</span>
                        <i class="fa-solid ${chevronIcon} text-gray-400 text-sm ml-1"></i>
                    </div>
                </button>
                
                <div class="${contentDisplayClass} p-4 bg-slate-50/50 border-t border-gray-100">
                    ${count > 0 ? cardsHtml : '<p class="text-xs text-gray-400 italic col-span-full text-center py-4">Tidak ada berkas di status ini.</p>'}
                </div>
            </div>
        `;
    });

    containerTrx.innerHTML = mainHtml;
}

function runFilterAndSort() {
    const query = (document.getElementById('search-input')?.value || '').toLowerCase();
    const startDate = document.getElementById('filter-date-start')?.value || '';
    const endDate = document.getElementById('filter-date-end')?.value || '';
    const statusBayarFilter = document.getElementById('filter-bayar-status')?.value || 'ALL';
    const sortBy = document.getElementById('sort-select')?.value || 'date-desc';

    let filtered = listTransaksi.filter(t => {
        const matchQuery = (t.nama || '').toLowerCase().includes(query) || 
                           (t.layanan || '').toLowerCase().includes(query) || 
                           (t.field1 && t.field1.toLowerCase().includes(query)) ||
                           (t.field2 && t.field2.toLowerCase().includes(query));
        
        let matchDate = true;
        if (startDate && endDate) matchDate = t.tgl_masuk >= startDate && t.tgl_masuk <= endDate;
        else if (startDate) matchDate = t.tgl_masuk >= startDate;
        else if (endDate) matchDate = t.tgl_masuk <= endDate;

        let matchBayar = true;
        if (statusBayarFilter === 'LUNAS') {
            matchBayar = t.status_bayar === 'LUNAS';
        } else if (statusBayarFilter === 'BELUM_LUNAS') {
            matchBayar = t.status_bayar !== 'LUNAS';
        }

        return matchQuery && matchDate && matchBayar;
    });

    filtered.sort((a, b) => {
        const sisaA = (a.total || 0) - (a.bayar || 0);
        const sisaB = (b.total || 0) - (b.bayar || 0);

        if (sortBy === 'date-desc') return (b.tgl_masuk || '').localeCompare(a.tgl_masuk || '');
        if (sortBy === 'date-asc') return (a.tgl_masuk || '').localeCompare(b.tgl_masuk || '');
        if (sortBy === 'nama-asc') return (a.nama || '').localeCompare(b.nama || '');
        if (sortBy === 'nama-desc') return (b.nama || '').localeCompare(a.nama || '');
        if (sortBy === 'total-desc') return (b.total || 0) - (a.total || 0);
        if (sortBy === 'total-asc') return (a.total || 0) - (b.total || 0);
        if (sortBy === 'piutang-desc') return sisaB - sisaA;
        return 0;
    });

    renderTransaksiList(filtered);
}

function resetFilter() {
    if (document.getElementById('search-input')) document.getElementById('search-input').value = '';
    if (document.getElementById('filter-date-start')) document.getElementById('filter-date-start').value = '';
    if (document.getElementById('filter-date-end')) document.getElementById('filter-date-end').value = '';
    if (document.getElementById('filter-bayar-status')) document.getElementById('filter-bayar-status').value = 'ALL';
    if (document.getElementById('sort-select')) document.getElementById('sort-select').value = 'date-desc';
    runFilterAndSort();
}

window.editTransaksi = function(id) {
    const data = typeof id === 'object' ? id : listTransaksi.find(item => item.id === id);
    if (data) openModal(data);
};

window.deleteTransaksi = function(id) {
    if (window.showConfirm) {
        window.showConfirm("Hapus Transaksi", "Hapus data transaksi ini secara permanen?", async () => {
            try {
                await db.collection('transaksi').doc(id).delete();
                if (window.showAlert) window.showAlert("Terhapus", "Data transaksi berhasil dihapus.", "success");
            } catch (err) { if (window.showAlert) window.showAlert("Gagal", err.message, "error"); }
        });
    }
};

// 📄 FUNGSI CETAK PRIMA NOTA / TANDA TERIMA TITIP BERKAS
window.printPrimaNota = function(id) {
    const t = typeof id === 'object' ? id : listTransaksi.find(item => item.id === id);
    if (!t) return;

    const isTitipBerkas = (t.total === 0 || t.status_bayar === 'MENUNGGU CEK BIAYA');
    const infoDetail = t.field1 || t.plat || t.bangunan || '-';
    const unitDetail = t.field2 ? ` (${t.field2})` : (t.unit ? ` (${t.unit})` : '');
    const sisa = (t.total || 0) - (t.bayar || 0);

    const namaUsaha = (configGlobal && configGlobal.nama) ? configGlobal.nama : "BIRO JASA SPS (SEDANA PERMATA SARI)";
    const alamatKantor = (configGlobal && configGlobal.alamat) ? configGlobal.alamat : "JALAN ULUWATU, BALI";
    const kontakKantor = (configGlobal && configGlobal.kontak) ? configGlobal.kontak : "085237044224 / 085238010224";

    const riwayat = Array.isArray(t.riwayat_pembayaran) ? t.riwayat_pembayaran : (t.bayar > 0 ? [{
        id_bayar: 'PAY-1',
        tgl: t.tgl_masuk || '-',
        nominal: t.bayar,
        keterangan: 'Pembayaran Awal / DP',
        metode: 'Tunai / Transfer'
    }] : []);

    let rowsRiwayatHtml = '';
    riwayat.forEach((p, idx) => {
        rowsRiwayatHtml += `
            <tr style="text-align: center;">
                <td style="padding: 6px; border: 1px solid #000;">${idx + 1}</td>
                <td style="padding: 6px; border: 1px solid #000;">${p.tgl}</td>
                <td style="padding: 6px; border: 1px solid #000;">${p.id_bayar || `PAY-${idx+1}`}</td>
                <td style="padding: 6px; border: 1px solid #000; text-align: left;">${p.keterangan} (${p.metode || 'Kas'})</td>
                <td style="padding: 6px; border: 1px solid #000; text-align: right; font-weight: bold; color: #047857;">Rp ${(p.nominal||0).toLocaleString('id-ID')}</td>
            </tr>
        `;
    });

    const docTitle = isTitipBerkas ? "SURAT TANDA TERIMA PENITIPAN DOKUMEN" : "PRIMA NOTA TRANSAKSI BERKAS";

    let tableSectionHtml = '';
    if (isTitipBerkas) {
        tableSectionHtml = `
            <div style="border: 1px dashed #000; padding: 12px; border-radius: 6px; background: #fafafa; margin: 15px 0; font-size: 10.5px; line-height: 1.6;">
                <p style="margin: 0; font-weight: bold;">KETERANGAN PENITIPAN DOKUMEN:</p>
                <p style="margin: 3px 0 0 0;">Dokumen fisik kendaraan / berkas asli telah diterima lengkap oleh petugas Biro Jasa SPS untuk dilakukan pengecekan tarif pajak, denda, dan biaya di loket Samsat. Total biaya tagihan resmi akan diterbitkan segera setelah proses pengecekan selesai.</p>
            </div>
        `;
    } else {
        tableSectionHtml = `
            <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 10px;">
                <thead>
                    <tr style="background: #f1f5f9; text-align: center; font-weight: bold;">
                        <th style="padding: 6px; border: 1px solid #000;">Rincian Pengurusan Berkas</th>
                        <th style="padding: 6px; border: 1px solid #000; width: 100px;">Total Tagihan</th>
                        <th style="padding: 6px; border: 1px solid #000; width: 100px;">Total Terbayar</th>
                        <th style="padding: 6px; border: 1px solid #000; width: 100px;">Sisa Piutang</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="text-align: center;">
                        <td style="padding: 8px; border: 1px solid #000; text-align: left;">Pengurusan ${t.layanan} (${infoDetail}${unitDetail})</td>
                        <td style="padding: 8px; border: 1px solid #000; text-align: right; font-weight: bold;">Rp ${(t.total||0).toLocaleString('id-ID')}</td>
                        <td style="padding: 8px; border: 1px solid #000; text-align: right; color: #047857; font-weight: bold;">Rp ${(t.bayar||0).toLocaleString('id-ID')}</td>
                        <td style="padding: 8px; border: 1px solid #000; text-align: right; color: #b91c1c; font-weight: bold;">Rp ${sisa.toLocaleString('id-ID')}</td>
                    </tr>
                </tbody>
            </table>

            <p style="font-size: 10px; font-weight: bold; margin: 8px 0 4px 0;">TABEL TAHAPAN PEMBAYARAN (CICILAN):</p>
            <table style="width: 100%; border-collapse: collapse; font-size: 9.5px; margin-bottom: 15px;">
                <thead>
                    <tr style="background: #f8fafc; text-align: center; font-weight: bold;">
                        <th style="padding: 5px; border: 1px solid #000; width: 25px;">No</th>
                        <th style="padding: 5px; border: 1px solid #000; width: 75px;">Tgl Bayar</th>
                        <th style="padding: 5px; border: 1px solid #000; width: 60px;">Kode</th>
                        <th style="padding: 5px; border: 1px solid #000;">Keterangan & Metode</th>
                        <th style="padding: 5px; border: 1px solid #000; width: 95px;">Nominal Masuk</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsRiwayatHtml || '<tr><td colspan="5" style="padding: 6px; text-align: center; border: 1px solid #000;">Belum ada cicilan masuk.</td></tr>'}
                </tbody>
            </table>
        `;
    }

    const element = document.createElement('div');
    element.style.padding = '20px';
    element.style.fontFamily = 'Arial, sans-serif';
    element.innerHTML = `
        <div style="border: 1px solid #000; padding: 20px; max-width: 650px; margin: 0 auto; background: white; color: #000;">
            <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px;">
                <h2 style="margin: 0; font-size: 15px; font-weight: bold; text-transform: uppercase;">${namaUsaha}</h2>
                <p style="margin: 2px 0 0 0; font-size: 10px;">${alamatKantor} • Telp/WA: ${kontakKantor}</p>
                <h3 style="margin: 8px 0 0 0; font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">${docTitle}</h3>
            </div>

            <div style="display: flex; gap: 8px; margin-bottom: 12px; font-size: 11px;">
                <div style="flex: 1; border: 1px solid #000; padding: 8px; border-radius: 6px;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="width: 85px; font-weight: bold;">No. Order</td><td>: ${t.id ? t.id.substring(0, 8).toUpperCase() : 'SPS-001'}</td></tr>
                        <tr><td style="font-weight: bold;">Nama Klien</td><td>: <strong>${t.nama}</strong></td></tr>
                        <tr><td style="font-weight: bold;">Alamat KTP</td><td>: ${t.alamat || '-'}</td></tr>
                        <tr><td style="font-weight: bold;">No. Telp/HP</td><td>: ${t.wa}</td></tr>
                    </table>
                </div>
                <div style="flex: 1; border: 1px solid #000; padding: 8px; border-radius: 6px;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="width: 85px; font-weight: bold;">Layanan</td><td>: <strong>${t.layanan}</strong></td></tr>
                        <tr><td style="font-weight: bold;">Detail Berkas</td><td>: ${infoDetail}${unitDetail}</td></tr>
                        <tr><td style="font-weight: bold;">Tgl Masuk</td><td>: ${t.tgl_masuk}</td></tr>
                        <tr><td style="font-weight: bold;">Status Bayar</td><td>: <strong>${t.status_bayar || 'MENUNGGU CEK BIAYA'}</strong></td></tr>
                    </table>
                </div>
            </div>

            ${tableSectionHtml}

            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 20px; font-size: 10px;">
                <div style="text-align: center; width: 180px;">
                    <p style="margin: 0;">Penyetor Berkas / Klien,</p>
                    <div style="height: 45px;"></div>
                    <p style="margin: 0; font-weight: bold; border-bottom: 1px solid #000; display: inline-block; padding: 0 10px;">( ${t.nama} )</p>
                </div>
                <div style="text-align: center; width: 200px;">
                    <p style="margin: 0;">Petugas Penerima SPS,</p>
                    <div style="height: 45px;"></div>
                    <p style="margin: 0; font-weight: bold; border-bottom: 1px solid #000; display: inline-block; padding: 0 10px;">( Ni Nyoman Suryani )</p>
                </div>
            </div>
        </div>
    `;

    const opt = {
        margin:       0.2,
        filename:     `${isTitipBerkas ? 'TandaTerima' : 'PrimaNota'}_${t.nama.replace(/\s+/g, '_')}_${t.tgl_masuk}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
};

// 🧾 CETAK KWITANSI RESMI PER-CICILAN
window.printKwitansi = function(trxId, paymentIndex) {
    const t = listTransaksi.find(item => item.id === trxId);
    if (!t) return;

    const riwayat = Array.isArray(t.riwayat_pembayaran) ? t.riwayat_pembayaran : [{
        id_bayar: 'PAY-1',
        tgl: t.tgl_masuk || '-',
        nominal: t.bayar,
        keterangan: 'Pembayaran Awal / DP',
        metode: 'Tunai / Transfer'
    }];

    const p = riwayat[paymentIndex];
    if (!p) return;

    const namaUsaha = (configGlobal && configGlobal.nama) ? configGlobal.nama : "BIRO JASA SPS (SEDANA PERMATA SARI)";
    const alamatKantor = (configGlobal && configGlobal.alamat) ? configGlobal.alamat : "JALAN ULUWATU, BALI";
    const infoDetail = t.field1 || t.plat || '-';

    const element = document.createElement('div');
    element.style.padding = '20px';
    element.style.fontFamily = 'Arial, sans-serif';
    element.innerHTML = `
        <div style="border: 2px solid #000; padding: 20px; max-width: 600px; margin: 0 auto; background: white; color: #000;">
            <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 8px;">
                <div>
                    <h2 style="margin: 0; font-size: 16px; font-weight: bold; text-transform: uppercase;">${namaUsaha}</h2>
                    <p style="margin: 2px 0 0 0; font-size: 10px;">${alamatKantor}</p>
                </div>
                <div style="text-align: right;">
                    <h3 style="margin: 0; font-size: 14px; font-weight: bold;">KWITANSI PEMBAYARAN</h3>
                    <p style="margin: 2px 0 0 0; font-size: 10px; font-family: monospace;">No: ${p.id_bayar || `KW-${paymentIndex+1}`}</p>
                </div>
            </div>

            <div style="margin: 15px 0; font-size: 11px; line-height: 1.8;">
                <table style="width: 100%;">
                    <tr><td style="width: 130px;">Telah Diterima Dari</td><td>: <strong>${t.nama}</strong></td></tr>
                    <tr><td>Uang Sejumlah</td><td>: <strong style="font-size: 13px; color: #047857; background: #ecfdf5; padding: 2px 6px; border-radius: 4px;">Rp ${(p.nominal||0).toLocaleString('id-ID')}</strong></td></tr>
                    <tr><td>Untuk Pembayaran</td><td>: ${p.keterangan} pengurusan berkas <strong>${t.layanan} (${infoDetail})</strong></td></tr>
                    <tr><td>Metode Pembayaran</td><td>: ${p.metode || 'Tunai'}</td></tr>
                    <tr><td>Tanggal Pembayaran</td><td>: ${p.tgl}</td></tr>
                </table>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px dashed #000; padding-top: 15px; font-size: 10px;">
                <div>
                    <p style="margin: 0; font-size: 12px; font-weight: bold; background: #f1f5f9; padding: 6px 12px; border: 1px solid #cbd5e1; display: inline-block;">
                        TERBILANG: Rp ${(p.nominal||0).toLocaleString('id-ID')}
                    </p>
                </div>
                <div style="text-align: center; width: 180px;">
                    <p style="margin: 0;">Penerima / Kasir SPS,</p>
                    <div style="height: 40px;"></div>
                    <p style="margin: 0; font-weight: bold; border-bottom: 1px solid #000;">( Ni Nyoman Suryani )</p>
                </div>
            </div>
        </div>
    `;

    const opt = {
        margin:       0.2,
        filename:     `Kwitansi_${p.id_bayar || 'Bayar'}_${t.nama.replace(/\s+/g, '_')}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'in', format: 'a5', orientation: 'landscape' }
    };

    html2pdf().set(opt).from(element).save();
};