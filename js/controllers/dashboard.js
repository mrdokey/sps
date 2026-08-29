import { db } from '../firebase.js';
import { sendWA } from '../utils/wa.js';
import { configGlobal } from './setelan.js';

let rawTransaksiList = [];
let activePreset = 'THIS_MONTH'; // Default: Bulan Ini

export function initDashboardController() {
    const presetSelect = document.getElementById('dash-filter-preset');
    const customBox = document.getElementById('dash-custom-date-container') || document.getElementById('dash-custom-date-box');
    const btnApply = document.getElementById('dash-btn-apply');

    presetSelect?.addEventListener('change', () => {
        activePreset = presetSelect.value;
        if (activePreset === 'CUSTOM') {
            customBox?.classList.remove('hidden');
        } else {
            customBox?.classList.add('hidden');
            recalculateDashboardStats();
        }
    });

    btnApply?.addEventListener('click', () => {
        recalculateDashboardStats();
    });

    // Realtime Listener Transaksi
    db.collection('transaksi').onSnapshot(snapshot => {
        rawTransaksiList = [];
        snapshot.forEach(doc => {
            rawTransaksiList.push({ id: doc.id, ...doc.data() });
        });
        recalculateDashboardStats();
    });
}

function recalculateDashboardStats() {
    const now = new Date();
    
    // 1. Format Bulan Ini (YYYY-MM)
    const currentYear = now.getFullYear();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    const thisMonthPrefix = `${currentYear}-${currentMonth}`;

    // 2. Format Bulan Lalu (YYYY-MM)
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastYear = lastMonthDate.getFullYear();
    const lastMonth = String(lastMonthDate.getMonth() + 1).padStart(2, '0');
    const lastMonthPrefix = `${lastYear}-${lastMonth}`;

    // Variabel Komparasi Tetap (Bulan Ini vs Bulan Lalu)
    let thisMonthOrders = 0, thisMonthSelesai = 0;
    let lastMonthOrders = 0, lastMonthSelesai = 0;
    let allTimePiutang = 0;

    rawTransaksiList.forEach(t => {
        const tgl = t.tgl_masuk || '';
        const sisa = (t.total || 0) - (t.bayar || 0);
        if (sisa > 0) allTimePiutang += sisa;

        if (tgl.startsWith(thisMonthPrefix)) {
            thisMonthOrders++;
            if (t.status_berkas === 'SELESAI') thisMonthSelesai++;
        } else if (tgl.startsWith(lastMonthPrefix)) {
            lastMonthOrders++;
            if (t.status_berkas === 'SELESAI') lastMonthSelesai++;
        }
    });

    // 3. Filter Data Berdasarkan Preset yang Sedang Dipilih
    let filteredList = [];
    let customStart = document.getElementById('dash-date-start')?.value || '';
    let customEnd = document.getElementById('dash-date-end')?.value || '';

    if (activePreset === 'THIS_MONTH') {
        filteredList = rawTransaksiList.filter(t => (t.tgl_masuk || '').startsWith(thisMonthPrefix));
        updateLabelPeriod('Bulan Ini');
    } else if (activePreset === 'LAST_MONTH') {
        filteredList = rawTransaksiList.filter(t => (t.tgl_masuk || '').startsWith(lastMonthPrefix));
        updateLabelPeriod('Bulan Lalu');
    } else if (activePreset === 'CUSTOM') {
        filteredList = rawTransaksiList.filter(t => {
            const tgl = t.tgl_masuk || '';
            if (customStart && customEnd) return tgl >= customStart && tgl <= customEnd;
            if (customStart) return tgl >= customStart;
            if (customEnd) return tgl <= customEnd;
            return true;
        });
        updateLabelPeriod('Kustom');
    } else {
        // ALL TIME
        filteredList = [...rawTransaksiList];
        updateLabelPeriod('Semua Waktu');
    }

    // 4. Hitung Statistik Periode Terpilih
    let totalOrderFilter = filteredList.length;
    let countProsesActive = rawTransaksiList.filter(t => t.status_berkas === 'PROSES').length; // Proses selalu pantau yang aktif
    let countSelesaiFilter = filteredList.filter(t => t.status_berkas === 'SELESAI').length;
    let totalPiutangFilter = 0;

    filteredList.forEach(t => {
        const sisa = (t.total || 0) - (t.bayar || 0);
        if (sisa > 0) totalPiutangFilter += sisa;
    });

    // 5. Update Angka ke DOM
    updateDashboardDom('stat-total-trx', totalOrderFilter);
    updateDashboardDom('stat-proses-trx', countProsesActive);
    updateDashboardDom('stat-selesai-trx', countSelesaiFilter);
    updateDashboardDom('stat-piutang-trx', `Rp ${totalPiutangFilter.toLocaleString('id-ID')}`);

    // Update Sub-info Pembanding
    updateDashboardDom('dash-sub-order-now', thisMonthOrders);
    updateDashboardDom('dash-sub-order-last', lastMonthOrders);
    updateDashboardDom('dash-sub-selesai-now', thisMonthSelesai);
    updateDashboardDom('dash-sub-selesai-last', lastMonthSelesai);
    updateDashboardDom('dash-sub-piutang-all', `Rp ${allTimePiutang.toLocaleString('id-ID')}`);

    // 6. Susun Daftar Pengingat Jatuh Tempo (Diurutkan yang Paling Dekat)
    renderSortedReminders(rawTransaksiList);
}

function updateLabelPeriod(text) {
    const lblOrder = document.getElementById('dash-label-order');
    const lblSelesai = document.getElementById('dash-label-selesai');
    const lblPiutang = document.getElementById('dash-label-piutang');

    if (lblOrder) lblOrder.innerText = `Total Order (${text})`;
    if (lblSelesai) lblSelesai.innerText = `Selesai (${text})`;
    if (lblPiutang) lblPiutang.innerText = `Piutang (${text})`;
}

function renderSortedReminders(data) {
    const listReminderEl = document.getElementById('list-reminder');
    if (!listReminderEl) return;

    // Ambil yang punya tanggal jatuh tempo dan belum lewat jauh
    let reminderItems = data.filter(item => Boolean(item.tgl_tempo));

    // Urutkan dari tanggal jatuh tempo paling dekat ke depan
    reminderItems.sort((a, b) => (a.tgl_tempo || '').localeCompare(b.tgl_tempo || ''));

    // Ambil 10 terdekat agar rapi
    const topReminders = reminderItems.slice(0, 10);

    let reminderHtml = '';
    topReminders.forEach(item => {
        const detailInfo = item.field1 || item.plat || item.bangunan || '-';
        const unitText = item.field2 ? ` (${item.field2})` : (item.unit ? ` (${item.unit})` : '');

        reminderHtml += `
            <div class="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-slate-50 rounded-2xl text-sm border border-gray-100 gap-2">
                <div>
                    <span class="font-bold text-gray-800">${item.nama}</span>
                    <span class="text-xs text-gray-500"> (${item.layanan} - ${detailInfo}${unitText})</span>
                    <p class="text-xs text-orange-600 font-semibold mt-0.5"><i class="fa-solid fa-clock mr-1"></i>Jatuh Tempo: ${item.tgl_tempo}</p>
                </div>
                <button onclick="window.kirimReminder('${item.wa}', '${item.nama}', '${item.layanan}', '${detailInfo}', '${item.tgl_tempo}')" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3.5 py-2 rounded-xl font-bold shadow-sm transition whitespace-nowrap self-end sm:self-center">
                    <i class="fa-brands fa-whatsapp mr-1.5 text-sm"></i>Kirim Reminder
                </button>
            </div>
        `;
    });

    listReminderEl.innerHTML = reminderHtml || '<p class="text-sm text-gray-400 italic text-center py-4">Tidak ada agenda jatuh tempo terdekat.</p>';
}

function updateDashboardDom(elementId, value) {
    const el = document.getElementById(elementId);
    if (el) el.innerText = value;
}

window.kirimReminder = async function(wa, nama, layanan, detail, tgl) {
    let template = (configGlobal && configGlobal.wa_template) 
        ? configGlobal.wa_template 
        : "Halo {nama}, menginfokan berkas {layanan} ({detail}) akan jatuh tempo pada {tanggal}. Mohon konfirmasinya. Terima kasih.";
        
    let pesan = template.replace('{nama}', nama)
                        .replace('{layanan}', layanan)
                        .replace('{detail}', detail || '-')
                        .replace('{tanggal}', tgl);

    const success = await sendWA(wa, pesan);
    if (success) {
        if (window.showAlert) {
            window.showAlert("Pesan Terkirim", `Pesan pengingat otomatis sukses dikirim ke WhatsApp ${nama}!`, "success");
        }
    } else {
        if (window.showAlert) {
            window.showAlert("Gagal", "Gagal mengirim WA otomatis. Silakan periksa koneksi internet atau status WA di setelan.", "error");
        }
    }
};