import { db } from '../firebase.js';
import { sendWA } from '../utils/wa.js';
import { configGlobal } from './setelan.js';

let listTransaksi = [];
let uploadedPhotos = [];
let currentPelunasanTrx = null;
let containerTrx, formTrx, modalTrx, selectLayanan;
let formPelunasan, modalPelunasan;

export function initTransaksiController() {
    containerTrx = document.getElementById('container-transaksi');
    formTrx = document.getElementById('form-trx');
    modalTrx = document.getElementById('modal-trx');
    selectLayanan = document.getElementById('trx-layanan');

    formPelunasan = document.getElementById('form-pelunasan');
    modalPelunasan = document.getElementById('modal-pelunasan');

    document.getElementById('btn-open-add-trx')?.addEventListener('click', () => openModal());
    document.getElementById('btn-close-modal-trx')?.addEventListener('click', closeModal);
    document.getElementById('btn-cancel-trx')?.addEventListener('click', closeModal);

    document.getElementById('btn-close-modal-pelunasan')?.addEventListener('click', closeModalPelunasan);
    document.getElementById('btn-cancel-pelunasan')?.addEventListener('click', closeModalPelunasan);

    selectLayanan?.addEventListener('change', handleLayananUiChange);
    formTrx?.addEventListener('submit', saveTransaksi);
    formPelunasan?.addEventListener('submit', savePelunasan);

    document.getElementById('trx-foto-input')?.addEventListener('change', handleFotoUpload);

    document.getElementById('search-input')?.addEventListener('keyup', runFilterAndSort);
    document.getElementById('filter-date-start')?.addEventListener('change', runFilterAndSort);
    document.getElementById('filter-date-end')?.addEventListener('change', runFilterAndSort);
    document.getElementById('sort-select')?.addEventListener('change', runFilterAndSort);
    document.getElementById('btn-reset-filter')?.addEventListener('click', resetFilter);

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
        document.getElementById('trx-field-1').value = data.field1 || '';
        document.getElementById('trx-field-2').value = data.field2 || '';
        document.getElementById('trx-tgl-masuk').value = data.tgl_masuk || '';
        document.getElementById('trx-tgl-tempo').value = data.tgl_tempo || '';
        document.getElementById('trx-total').value = data.total || 0;
        document.getElementById('trx-bayar').value = data.bayar || 0;
        document.getElementById('trx-biaya-riil').value = data.biaya_riil || 0;
        document.getElementById('trx-status-bayar').value = data.status_bayar;
        document.getElementById('trx-status-berkas').value = data.status_berkas;

        if (Array.isArray(data.fotos)) uploadedPhotos = [...data.fotos];
        renderPhotoPreviews();
    }

    handleLayananUiChange();
    modalTrx?.classList.remove('hidden');
}

function closeModal() { modalTrx?.classList.add('hidden'); }

// 💵 BUKA MODAL ACTION PELUNASAN
window.openPelunasanModal = function(tData) {
    currentPelunasanTrx = tData;
    formPelunasan?.reset();

    const sisa = (tData.total || 0) - (tData.bayar || 0);

    document.getElementById('pelunasan-trx-id').value = tData.id;
    document.getElementById('pelunasan-nama').innerText = tData.nama;
    document.getElementById('pelunasan-layanan').innerText = `${tData.layanan} (${tData.field1 || '-'})`;
    document.getElementById('pelunasan-sisa').innerText = `Rp ${sisa.toLocaleString('id-ID')}`;
    document.getElementById('pelunasan-tgl').value = new Date().toISOString().split('T')[0];
    document.getElementById('pelunasan-nominal').value = sisa > 0 ? sisa : 0;

    modalPelunasan?.classList.remove('hidden');
};

function closeModalPelunasan() { modalPelunasan?.classList.add('hidden'); }

// 💵 SIMPAN PELUNASAN & KIRIM NOTA TERUPDATE KE WA
async function savePelunasan(e) {
    e.preventDefault();
    if (!currentPelunasanTrx) return;

    const nominalTambah = parseInt(document.getElementById('pelunasan-nominal').value) || 0;
    if (nominalTambah <= 0) {
        if (window.showAlert) window.showAlert("Perhatian", "Nominal pembayaran pelunasan harus lebih dari 0!", "info");
        return;
    }

    const totalBaruBayar = (currentPelunasanTrx.bayar || 0) + nominalTambah;
    const isLunas = totalBaruBayar >= currentPelunasanTrx.total;
    const statusBayarBaru = isLunas ? "LUNAS" : "DP";

    try {
        // 1. Update data transaksi di Firestore
        await db.collection('transaksi').doc(currentPelunasanTrx.id).update({
            bayar: totalBaruBayar,
            status_bayar: statusBayarBaru
        });

        // 2. Kirim WA Nota Terupdate ke Klien
        const publicInvoiceUrl = `https://mrdokey.github.io/sps/invoice.html?id=${currentPelunasanTrx.id}`;
        const infoDetail = currentPelunasanTrx.field1 || '-';
        
        const pesanWA = `Halo *${currentPelunasanTrx.nama}*, terima kasih!\n\nPembayaran pelunasan sebesar *Rp ${nominalTambah.toLocaleString('id-ID')}* untuk pengurusan *${currentPelunasanTrx.layanan}* (${infoDetail}) telah *KAMI TERIMA*.\n\n• Status Pembayaran: *${statusBayarBaru}*\n• Total Sudah Dibayar: *Rp ${totalBaruBayar.toLocaleString('id-ID')}*\n\n📄 *Nota / Invoice Terupdate Anda dapat diakses di tautan berikut:*\n${publicInvoiceUrl}\n\nTerima kasih atas kepercayaannya pada Biro Jasa SPS.`;
        
        sendWA(currentPelunasanTrx.wa, pesanWA);

        closeModalPelunasan();
        if (window.showAlert) window.showAlert("Pelunasan Berhasil!", `Pembayaran Rp ${nominalTambah.toLocaleString('id-ID')} berhasil dicatat & WA Nota Terupdate telah terkirim!`, "success");
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

    const payload = {
        nama: nama,
        wa: wa,
        alamat: alamat,
        layanan: layanan,
        field1: field1,
        field2: document.getElementById('trx-field-2').value,
        tgl_masuk: document.getElementById('trx-tgl-masuk').value,
        tgl_tempo: document.getElementById('trx-tgl-tempo').value,
        total: parseInt(document.getElementById('trx-total').value) || 0,
        bayar: parseInt(document.getElementById('trx-bayar').value) || 0,
        biaya_riil: parseInt(document.getElementById('trx-biaya-riil').value) || 0,
        status_bayar: document.getElementById('trx-status-bayar').value,
        status_berkas: document.getElementById('trx-status-berkas').value,
        fotos: uploadedPhotos
    };

    try {
        let docRefId = id;
        if (id) {
            await db.collection('transaksi').doc(id).update(payload);
        } else {
            const docRef = await db.collection('transaksi').add(payload);
            docRefId = docRef.id;

            const publicInvoiceUrl = `https://mrdokey.github.io/sps/invoice.html?id=${docRefId}`;
            const pesanWaBaru = `Halo *${nama}*, terima kasih telah mendaftarkan pengurusan berkas *${layanan}* (${field1}) di Biro Jasa SPS.\n\n📄 *Rincian Invoice & Tagihan Anda dapat dilihat pada tautan berikut:*\n${publicInvoiceUrl}\n\nTerima kasih.`;
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

window.updateStatusBerkas = function(id, newStatus, tData) {
    if (window.showConfirm) {
        window.showConfirm("Ubah Status Berkas", `Ubah status berkas ${tData.nama} menjadi ${newStatus}?`, async () => {
            try {
                await db.collection('transaksi').doc(id).update({ status_berkas: newStatus });

                let infoBerkas = tData.field1 || '-';
                let pesanStatus = "";

                if (newStatus === 'PROSES') {
                    pesanStatus = `Halo *${tData.nama}*, menginfokan bahwa berkas *${tData.layanan}* (${infoBerkas}) Anda saat ini *SEDANG DIPROSES* oleh tim Biro Jasa SPS. Terima kasih.`;
                } else if (newStatus === 'SELESAI') {
                    pesanStatus = `Halo *${tData.nama}*, menginfokan bahwa berkas *${tData.layanan}* (${infoBerkas}) Anda sudah *SELESAI DIPROSES* dan siap diambil / diserahkan. Terima kasih.`;
                }

                if (pesanStatus) {
                    const sendRes = await sendWA(tData.wa, pesanStatus);
                    if (sendRes) {
                        if (window.showAlert) window.showAlert("Berhasil", `Status diperbarui ke ${newStatus} & WA notifikasi terkirim!`, "success");
                    } else {
                        if (window.showAlert) window.showAlert("Perhatian", `Status diperbarui ke ${newStatus}, namun gagal mengirim WA.`, "info");
                    }
                }
            } catch (e) {
                if (window.showAlert) window.showAlert("Gagal", e.message, "error");
            }
        });
    }
};

function renderTransaksiList(data) {
    let html = '';
    data.forEach(t => {
        const info1 = t.field1 || '-';
        const info2 = t.field2 ? ` (${t.field2})` : '';
        const sisa = (t.total || 0) - (t.bayar || 0);

        const badgeBayar = t.status_bayar === 'LUNAS' ? 'bg-emerald-100 text-emerald-800' : (t.status_bayar === 'DP' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800');
        const badgeBerkas = t.status_berkas === 'SELESAI' ? 'bg-emerald-100 text-emerald-800' : (t.status_berkas === 'PROSES' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800');
        
        const fotosList = Array.isArray(t.fotos) ? t.fotos : [];
        const fotoBadge = fotosList.length > 0 ? `<span class="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-semibold"><i class="fa-solid fa-paperclip mr-1"></i>${fotosList.length} Foto</span>` : '';

        const btnActionProses = t.status_berkas !== 'PROSES' ? `<button onclick='window.updateStatusBerkas("${t.id}", "PROSES", ${JSON.stringify(t)})' class="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold">Proses</button>` : '';
        const btnActionSelesai = t.status_berkas !== 'SELESAI' ? `<button onclick='window.updateStatusBerkas("${t.id}", "SELESAI", ${JSON.stringify(t)})' class="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold">Selesai</button>` : '';

        // 🌟 TOMBOL PELUNASAN: Wajib tampil jika status_bayar BUKAN LUNAS
        const btnPelunasan = (t.status_bayar !== 'LUNAS') ? `
            <button onclick='window.openPelunasanModal(${JSON.stringify(t)})' class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center gap-1 cursor-pointer">
                <i class="fa-solid fa-hand-holding-dollar"></i>Pelunasan
            </button>
        ` : '';

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
                        <div class="flex justify-between font-bold text-rose-600"><span>Sisa Piutang:</span><span>Rp ${sisa.toLocaleString('id-ID')}</span></div>
                    </div>
                </div>

                <div class="flex flex-col gap-2 mt-4 pt-3 border-t">
                    <div class="flex gap-2 items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <span class="text-[10px] font-bold text-gray-400 uppercase">Aksi Berkas:</span>
                        <div class="flex gap-1.5 items-center">
                            ${btnPelunasan}
                            ${btnActionProses}
                            ${btnActionSelesai}
                        </div>
                    </div>

                    <div class="flex items-center justify-between gap-2 mt-1">
                        <button onclick='window.printPrimaNota(${JSON.stringify(t)})' class="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold shadow-sm transition">
                            <i class="fa-solid fa-file-contract mr-1"></i>Prima Nota
                        </button>

                        <div class="flex gap-1.5">
                            <button onclick='window.editTransaksi(${JSON.stringify(t)})' class="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium">Edit</button>
                            <button onclick="window.deleteTransaksi('${t.id}')" class="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-medium">Hapus</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    if (containerTrx) {
        containerTrx.innerHTML = html || '<p class="text-sm text-gray-400 italic col-span-full text-center py-8">Transaksi tidak ditemukan.</p>';
    }
}

function runFilterAndSort() {
    const query = (document.getElementById('search-input')?.value || '').toLowerCase();
    const startDate = document.getElementById('filter-date-start')?.value || '';
    const endDate = document.getElementById('filter-date-end')?.value || '';
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

        return matchQuery && matchDate;
    });

    filtered.sort((a, b) => {
        if (sortBy === 'date-desc') return (b.tgl_masuk || '').localeCompare(a.tgl_masuk || '');
        if (sortBy === 'date-asc') return (a.tgl_masuk || '').localeCompare(b.tgl_masuk || '');
        if (sortBy === 'nama-asc') return (a.nama || '').localeCompare(b.nama || '');
        if (sortBy === 'nama-desc') return (b.nama || '').localeCompare(a.nama || '');
        if (sortBy === 'total-desc') return (b.total || 0) - (a.total || 0);
        if (sortBy === 'total-asc') return (a.total || 0) - (b.total || 0);
        return 0;
    });

    renderTransaksiList(filtered);
}

function resetFilter() {
    if (document.getElementById('search-input')) document.getElementById('search-input').value = '';
    if (document.getElementById('filter-date-start')) document.getElementById('filter-date-start').value = '';
    if (document.getElementById('filter-date-end')) document.getElementById('filter-date-end').value = '';
    if (document.getElementById('sort-select')) document.getElementById('sort-select').value = 'date-desc';
    runFilterAndSort();
}

window.editTransaksi = function(data) { openModal(data); }

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

window.printPrimaNota = function(t) {
    const infoDetail = t.field1 || '-';
    const unitDetail = t.field2 ? ` (${t.field2})` : '';
    const sisa = (t.total || 0) - (t.bayar || 0);

    const namaUsaha = (configGlobal && configGlobal.nama) ? configGlobal.nama : "BIRO JASA SPS (SEDANA PERMATA SARI)";
    const alamatKantor = (configGlobal && configGlobal.alamat) ? configGlobal.alamat : "JALAN ULUWATU, BALI";
    const kontakKantor = (configGlobal && configGlobal.kontak) ? configGlobal.kontak : "085237044224 / 085238010224";

    const element = document.createElement('div');
    element.style.padding = '20px';
    element.style.fontFamily = 'Arial, sans-serif';
    element.innerHTML = `
        <div style="border: 1px solid #000; padding: 20px; max-width: 650px; margin: 0 auto; background: white; color: #000;">
            <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px;">
                <h2 style="margin: 0; font-size: 15px; font-weight: bold; text-transform: uppercase;">${namaUsaha}</h2>
                <p style="margin: 2px 0 0 0; font-size: 10px;">${alamatKantor} • Telp/WA: ${kontakKantor}</p>
                <h3 style="margin: 8px 0 0 0; font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">PRIMA NOTA TRANSAKSI BERKAS</h3>
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
                        <tr><td style="font-weight: bold;">Jatuh Tempo</td><td>: ${t.tgl_tempo || '-'}</td></tr>
                    </table>
                </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 20px;">
                <thead>
                    <tr style="background: #f1f5f9; text-align: center; font-weight: bold;">
                        <th style="padding: 6px; border: 1px solid #000; width: 25px;">No</th>
                        <th style="padding: 6px; border: 1px solid #000; width: 75px;">Tanggal</th>
                        <th style="padding: 6px; border: 1px solid #000; width: 45px;">Kode</th>
                        <th style="padding: 6px; border: 1px solid #000;">Keterangan Transaksi</th>
                        <th style="padding: 6px; border: 1px solid #000; width: 85px;">Total Tagihan</th>
                        <th style="padding: 6px; border: 1px solid #000; width: 85px;">Jumlah Dibayar</th>
                        <th style="padding: 6px; border: 1px solid #000; width: 85px;">Sisa Saldo</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="text-align: center;">
                        <td style="padding: 8px 4px; border: 1px solid #000;">1</td>
                        <td style="padding: 8px 4px; border: 1px solid #000;">${t.tgl_masuk}</td>
                        <td style="padding: 8px 4px; border: 1px solid #000;">${t.layanan ? t.layanan.substring(0,3) : 'SPS'}</td>
                        <td style="padding: 8px 6px; border: 1px solid #000; text-align: left;">Pengurusan ${t.layanan} (${infoDetail}${unitDetail})</td>
                        <td style="padding: 8px 4px; border: 1px solid #000; text-align: right;">Rp ${(t.total||0).toLocaleString('id-ID')}</td>
                        <td style="padding: 8px 4px; border: 1px solid #000; text-align: right;">Rp ${(t.bayar||0).toLocaleString('id-ID')}</td>
                        <td style="padding: 8px 4px; border: 1px solid #000; text-align: right; font-weight: bold;">Rp ${sisa.toLocaleString('id-ID')}</td>
                    </tr>
                    <tr style="font-weight: bold; background: #f8fafc;">
                        <td colspan="4" style="padding: 6px; border: 1px solid #000; text-align: right;">TOTAL:</td>
                        <td style="padding: 6px; border: 1px solid #000; text-align: right;">Rp ${(t.total||0).toLocaleString('id-ID')}</td>
                        <td style="padding: 6px; border: 1px solid #000; text-align: right;">Rp ${(t.bayar||0).toLocaleString('id-ID')}</td>
                        <td style="padding: 6px; border: 1px solid #000; text-align: right;">Rp ${sisa.toLocaleString('id-ID')}</td>
                    </tr>
                </tbody>
            </table>

            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 25px; font-size: 10px;">
                <div style="text-align: center; width: 180px;">
                    <p style="margin: 0;">Penerima Berkas / Klien,</p>
                    <div style="height: 50px;"></div>
                    <p style="margin: 0; font-weight: bold; border-bottom: 1px solid #000; display: inline-block; padding: 0 10px;">( ${t.nama} )</p>
                </div>
                <div style="text-align: center; width: 200px;">
                    <p style="margin: 0;">Petugas Biro Jasa SPS,</p>
                    <div style="height: 50px;"></div>
                    <p style="margin: 0; font-weight: bold; border-bottom: 1px solid #000; display: inline-block; padding: 0 10px;">( Ni Nyoman Suryani )</p>
                </div>
            </div>
        </div>
    `;

    const opt = {
        margin:       0.2,
        filename:     `PrimaNota_${t.nama.replace(/\s+/g, '_')}_${t.tgl_masuk}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
};