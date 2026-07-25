import { db } from '../firebase.js';
import { requestWAPairing } from '../utils/wa.js';

let formConfig;
export let configGlobal = {};

export function initSetelanController() {
    formConfig = document.getElementById('form-config');
    formConfig?.addEventListener('submit', saveConfig);

    appendPairingSection();

    db.collection('konfigurasi').doc('profile').onSnapshot(doc => {
        if (doc.exists) {
            configGlobal = doc.data();
            document.getElementById('cfg-nama').value = configGlobal.nama || '';
            document.getElementById('cfg-bca').value = configGlobal.bca || '';
            document.getElementById('cfg-bpd').value = configGlobal.bpd || '';
            document.getElementById('cfg-wa-template').value = configGlobal.wa_template || '';
        }
    });
}

async function saveConfig(e) {
    e.preventDefault();
    const payload = {
        nama: document.getElementById('cfg-nama').value,
        bca: document.getElementById('cfg-bca').value,
        bpd: document.getElementById('cfg-bpd').value,
        wa_template: document.getElementById('cfg-wa-template').value
    };

    try {
        await db.collection('konfigurasi').doc('profile').set(payload);
        alert("Setelan profil dan template berhasil disimpan!");
    } catch (err) {
        alert("Gagal menyimpan: " + err.message);
    }
}

function appendPairingSection() {
    const parent = formConfig?.parentElement;
    if (!parent) return;

    const pairingDiv = document.createElement('div');
    pairingDiv.className = "bg-white p-6 rounded-2xl shadow-sm border border-gray-100 max-w-2xl mt-6 space-y-4";
    pairingDiv.innerHTML = `
        <h3 class="text-base font-bold text-gray-800 border-b pb-2"><i class="fa-brands fa-whatsapp text-emerald-600 mr-2"></i>Tautkan WhatsApp Biro Jasa (Sesi SPS)</h3>
        <p class="text-xs text-gray-500 leading-relaxed">Sesi ini bersifat terisolasi tanpa potongan harian VPS. Silakan gunakan nomor HP Biro Jasa Anda untuk dikoneksikan ke gateway.</p>
        <div class="flex gap-2">
            <input type="tel" id="pairing-phone" placeholder="Contoh: 085237044224" class="flex-1 px-3 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-orange-500">
            <button id="btn-request-pair" type="button" class="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition shadow-sm">Minta Kode</button>
        </div>
        <div id="display-pairing-code" class="hidden text-center p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
            <span class="text-xs text-emerald-800 font-semibold uppercase tracking-wider">Kode Pairing WhatsApp Anda</span>
            <div id="pairing-code-box" class="text-3xl font-mono font-bold tracking-widest text-emerald-600">--------</div>
            <p class="text-[10px] text-gray-400">Masukkan kode ini pada opsi "Tautkan Perangkat > Tautkan dengan nomor telepon" di aplikasi WA HP Anda.</p>
        </div>
    `;
    parent.appendChild(pairingDiv);

    document.getElementById('btn-request-pair')?.addEventListener('click', async () => {
        const phone = document.getElementById('pairing-phone').value;
        if (!phone) return alert("Silakan masukkan nomor telepon terlebih dahulu.");

        const btn = document.getElementById('btn-request-pair');
        btn.innerText = "Memproses...";
        btn.disabled = true;

        const code = await requestWAPairing(phone);
        btn.innerText = "Minta Kode";
        btn.disabled = false;

        if (code) {
            document.getElementById('pairing-code-box').innerText = code;
            document.getElementById('display-pairing-code').classList.remove('hidden');
        } else {
            alert("Gagal mendapatkan kode. Pastikan server VPS aktif dan status belum tersambung.");
        }
    });
}