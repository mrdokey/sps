import { db } from '../firebase.js';
import { sendWA } from '../utils/wa.js';
import { configGlobal } from './setelan.js';

export function initDashboardController() {
    // Memantau snapshot database transaksi untuk menghitung data statistik secara real-time
    db.collection('transaksi').onSnapshot(snapshot => {
        let totalOrders = 0;
        let countProses = 0;
        let countSelesai = 0;
        let totalPiutang = 0;
        let reminderHtml = '';

        snapshot.forEach(doc => {
            const item = doc.data();
            totalOrders++;

            const sisa = (item.total || 0) - (item.bayar || 0);
            if (sisa > 0) totalPiutang += sisa;
            if (item.status_berkas === 'PROSES') countProses++;
            if (item.status_berkas === 'SELESAI') countSelesai++;

            // Jika ada tanggal jatuh tempo, susun daftar alarm di dashboard
            if (item.tgl_tempo) {
                const detailInfo = item.layanan === 'SLF' ? item.bangunan : item.plat;
                reminderHtml += `
                    <div class="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl text-sm border border-gray-100">
                        <div>
                            <span class="font-bold text-gray-800">${item.nama}</span>
                            <span class="text-xs text-gray-500"> (${item.layanan} - ${detailInfo || '-'})</span>
                            <p class="text-xs text-orange-600 font-semibold mt-1"><i class="fa-solid fa-clock mr-1"></i>Jatuh Tempo: ${item.tgl_tempo}</p>
                        </div>
                        <button onclick="window.kirimReminder('${item.wa}', '${item.nama}', '${item.layanan}', '${detailInfo}', '${item.tgl_tempo}')" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3.5 py-2 rounded-lg font-medium shadow-sm transition">
                            <i class="fa-brands fa-whatsapp mr-1.5 text-sm"></i>Kirim Reminder
                        </button>
                    </div>
                `;
            }
        });

        // Tulis ulang statistik di DOM dashboard
        updateDashboardDom('stat-total-trx', totalOrders);
        updateDashboardDom('stat-proses-trx', countProses);
        updateDashboardDom('stat-selesai-trx', countSelesai);
        updateDashboardDom('stat-piutang-trx', `Rp ${totalPiutang.toLocaleString('id-ID')}`);
        
        const listReminderEl = document.getElementById('list-reminder');
        if (listReminderEl) {
            listReminderEl.innerHTML = reminderHtml || '<p class="text-sm text-gray-400 italic text-center py-4">Tidak ada agenda jatuh tempo terdekat.</p>';
        }
    });
}

function updateDashboardDom(elementId, value) {
    const el = document.getElementById(elementId);
    if (el) el.innerText = value;
}

// Global scope binder untuk kirim WA dari baris reminder di dashboard
window.kirimReminder = async function(wa, nama, layanan, detail, tgl) {
    let template = configGlobal.wa_template || "Halo {nama}, menginfokan berkas {layanan} ({detail}) akan jatuh tempo pada {tanggal}. Mohon konfirmasinya. Terima kasih.";
    let pesan = template.replace('{nama}', nama)
                        .replace('{layanan}', layanan)
                        .replace('{detail}', detail || '-')
                        .replace('{tanggal}', tgl);

    const success = await sendWA(wa, pesan);
    if (success) {
        alert(`Pesan pengingat otomatis sukses dikirim ke ${nama}!`);
    } else {
        alert("Gagal mengirim WA otomatis. Silakan periksa koneksi internet atau status pairing di setelan.");
    }
}