import { db } from '../firebase.js';

let listTrxKeuangan = [];
let listPengeluaran = [];
let formPengeluaran, modalPengeluaran;

export function initKeuanganController() {
    formPengeluaran = document.getElementById('form-pengeluaran');
    modalPengeluaran = document.getElementById('modal-pengeluaran');

    document.getElementById('btn-open-add-pengeluaran')?.addEventListener('click', openModalPengeluaran);
    document.getElementById('btn-close-modal-pengeluaran')?.addEventListener('click', closeModalPengeluaran);
    document.getElementById('btn-cancel-pengeluaran')?.addEventListener('click', closeModalPengeluaran);

    formPengeluaran?.addEventListener('submit', savePengeluaran);

    // Event listener Filter Keuangan
    document.getElementById('fin-search-input')?.addEventListener('keyup', renderKeuanganUI);
    document.getElementById('fin-filter-date-start')?.addEventListener('change', renderKeuanganUI);
    document.getElementById('fin-filter-date-end')?.addEventListener('change', renderKeuanganUI);
    document.getElementById('fin-filter-layanan')?.addEventListener('change', renderKeuanganUI);
    document.getElementById('fin-btn-reset')?.addEventListener('click', resetKeuanganFilter);

    // Stream Data Realtime Transaksi
    db.collection('transaksi').onSnapshot(snapshot => {
        listTrxKeuangan = [];
        snapshot.forEach(doc => listTrxKeuangan.push({ id: doc.id, ...doc.data() }));
        renderKeuanganUI();
    });

    // Stream Data Realtime Pengeluaran
    db.collection('pengeluaran').onSnapshot(snapshot => {
        listPengeluaran = [];
        snapshot.forEach(doc => listPengeluaran.push({ id: doc.id, type: 'PENGELUARAN', ...doc.data() }));
        renderKeuanganUI();
    });
}

function openModalPengeluaran() {
    formPengeluaran?.reset();
    document.getElementById('pengeluaran-tgl').value = new Date().toISOString().split('T')[0];
    modalPengeluaran?.classList.remove('hidden');
}

function closeModalPengeluaran() {
    modalPengeluaran?.classList.add('hidden');
}

async function savePengeluaran(e) {
    e.preventDefault();
    const payload = {
        kategori: document.getElementById('pengeluaran-kategori').value,
        ket: document.getElementById('pengeluaran-ket').value,
        tgl: document.getElementById('pengeluaran-tgl').value,
        nominal: parseInt(document.getElementById('pengeluaran-nominal').value) || 0
    };

    try {
        await db.collection('pengeluaran').add(payload);
        closeModalPengeluaran();
        if (window.showAlert) window.showAlert("Berhasil!", "Pengeluaran kantor berhasil dicatat di Buku Kas.", "success");
    } catch (err) {
        if (window.showAlert) window.showAlert("Gagal", err.message, "error");
    }
}

// 🌟 RENDERING BUKU KAS HARIAN MULTI-PAYMENT
function renderKeuanganUI() {
    const query = (document.getElementById('fin-search-input')?.value || '').toLowerCase();
    const startDate = document.getElementById('fin-filter-date-start')?.value || '';
    const endDate = document.getElementById('fin-filter-date-end')?.value || '';
    const filterType = document.getElementById('fin-filter-layanan')?.value || 'ALL';

    let combinedLedger = [];

    // 1. Pecah Setiap Pembayaran Cicilan Menjadi Baris Buku Kas Sesuai Tanggal Bayarnya
    listTrxKeuangan.forEach(t => {
        const riwayat = Array.isArray(t.riwayat_pembayaran) && t.riwayat_pembayaran.length > 0 ? t.riwayat_pembayaran : (t.bayar > 0 ? [{
            id_bayar: 'PAY-1',
            tgl: t.tgl_masuk || '',
            nominal: t.bayar,
            keterangan: 'Pembayaran DP / Awal',
            metode: 'Tunai / Transfer'
        }] : []);

        const detailInfo = t.field1 || t.plat || '-';

        riwayat.forEach(p => {
            const tglBayar = p.tgl || t.tgl_masuk || '';
            const ketStr = `${t.nama} - ${t.layanan} (${detailInfo}) - ${p.keterangan || ''} - ${p.metode || ''}`.toLowerCase();

            let matchDate = true;
            if (startDate && endDate) matchDate = tglBayar >= startDate && tglBayar <= endDate;
            else if (startDate) matchDate = tglBayar >= startDate;
            else if (endDate) matchDate = tglBayar <= endDate;

            let matchQuery = ketStr.includes(query);
            let matchType = filterType === 'ALL' || filterType === 'PEMASUKAN';

            if (matchDate && matchQuery && matchType) {
                combinedLedger.push({
                    id: t.id,
                    tgl: tglBayar,
                    ket: `${t.nama} (${t.layanan} • ${detailInfo}) - ${p.keterangan || 'Pembayaran'} [${p.metode || 'Kas'}]`,
                    kategori: `Pemasukan (${t.layanan})`,
                    nominal: p.nominal || 0,
                    isMasuk: true
                });
            }
        });
    });

    // 2. Masukkan Pengeluaran Kantor
    listPengeluaran.forEach(p => {
        const tgl = p.tgl || '';
        const ketStr = `${p.ket} - ${p.kategori}`.toLowerCase();

        let matchDate = true;
        if (startDate && endDate) matchDate = tgl >= startDate && tgl <= endDate;
        else if (startDate) matchDate = tgl >= startDate;
        else if (endDate) matchDate = tgl <= endDate;

        let matchQuery = ketStr.includes(query);
        let matchType = filterType === 'ALL' || filterType === 'PENGELUARAN';

        if (matchDate && matchQuery && matchType) {
            combinedLedger.push({
                id: p.id,
                tgl: tgl,
                ket: p.ket,
                kategori: p.kategori,
                nominal: p.nominal || 0,
                isMasuk: false
            });
        }
    });

    // Urutkan Tanggal Terbaru di Atas
    combinedLedger.sort((a, b) => b.tgl.localeCompare(a.tgl));

    // 3. Hitung Rekap Statistik Keuangan
    let totalOmset = 0;
    let totalPengeluaranKantor = 0;

    combinedLedger.forEach(item => {
        if (item.isMasuk) totalOmset += item.nominal;
        else totalPengeluaranKantor += item.nominal;
    });

    // Total Modal Berkas dari Transaksi yang Masuk Filter
    let totalModalBerkas = 0;
    listTrxKeuangan.forEach(t => {
        const tgl = t.tgl_masuk || '';
        let matchDate = true;
        if (startDate && endDate) matchDate = tgl >= startDate && tgl <= endDate;
        else if (startDate) matchDate = tgl >= startDate;
        else if (endDate) matchDate = tgl <= endDate;

        if (matchDate) {
            totalModalBerkas += (t.biaya_riil || 0);
        }
    });

    const labaBersih = totalOmset - totalModalBerkas - totalPengeluaranKantor;

    // Update Widget Keuangan di UI
    document.getElementById('fin-stat-pemasukan').innerText = `Rp ${totalOmset.toLocaleString('id-ID')}`;
    document.getElementById('fin-stat-modal').innerText = `Rp ${totalModalBerkas.toLocaleString('id-ID')}`;
    document.getElementById('fin-stat-pengeluaran').innerText = `Rp ${totalPengeluaranKantor.toLocaleString('id-ID')}`;
    document.getElementById('fin-stat-laba').innerText = `Rp ${labaBersih.toLocaleString('id-ID')}`;

    // Render Tabel Buku Kas
    const tbody = document.getElementById('container-buku-kas');
    if (!tbody) return;

    let html = '';
    combinedLedger.forEach(item => {
        const colorClass = item.isMasuk ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold';
        const prefix = item.isMasuk ? '+ ' : '- ';
        const badgeClass = item.isMasuk ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700';

        const btnDelete = !item.isMasuk ? `
            <button onclick="window.deletePengeluaran('${item.id}')" class="text-rose-500 hover:bg-rose-50 p-2 rounded-lg text-xs"><i class="fa-solid fa-trash"></i></button>
        ` : '-';

        html += `
            <tr class="border-b hover:bg-slate-50 transition text-xs">
                <td class="p-4 text-gray-500">${item.tgl}</td>
                <td class="p-4 font-semibold text-gray-800">${item.ket}</td>
                <td class="p-4"><span class="px-2.5 py-1 rounded-full text-[10px] font-bold ${badgeClass}">${item.kategori}</span></td>
                <td class="p-4 text-right ${colorClass}">${prefix}Rp ${item.nominal.toLocaleString('id-ID')}</td>
                <td class="p-4 text-center">${btnDelete}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html || '<tr><td colspan="5" class="p-8 text-center text-gray-400 italic">Tidak ada catatan keuangan pada periode ini.</td></tr>';
}

function resetKeuanganFilter() {
    if (document.getElementById('fin-search-input')) document.getElementById('fin-search-input').value = '';
    if (document.getElementById('fin-filter-date-start')) document.getElementById('fin-filter-date-start').value = '';
    if (document.getElementById('fin-filter-date-end')) document.getElementById('fin-filter-date-end').value = '';
    if (document.getElementById('fin-filter-layanan')) document.getElementById('fin-filter-layanan').value = 'ALL';
    renderKeuanganUI();
}

window.deletePengeluaran = function(id) {
    if (window.showConfirm) {
        window.showConfirm("Hapus Pengeluaran", "Apakah Anda yakin ingin menghapus catatan pengeluaran ini?", async () => {
            try {
                await db.collection('pengeluaran').doc(id).delete();
                if (window.showAlert) window.showAlert("Terhapus", "Data pengeluaran berhasil dihapus.", "success");
            } catch (e) {
                if (window.showAlert) window.showAlert("Gagal", e.message, "error");
            }
        });
    }
};