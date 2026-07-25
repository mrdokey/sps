import { db } from '../firebase.js';

// Elements
const containerKlien = document.getElementById('container-klien');
const formKlien = document.getElementById('form-klien');
const modalKlien = document.getElementById('modal-klien');

// Inisialisasi Event Listener
export function initKlienController() {
    // Tombol buka modal tambah klien
    document.getElementById('btn-open-add-klien')?.addEventListener('click', openModal);
    document.getElementById('btn-close-modal-klien')?.addEventListener('click', closeModal);
    document.getElementById('btn-cancel-klien')?.addEventListener('click', closeModal);

    // Form submit
    formKlien?.addEventListener('submit', saveKlien);

    // Listener Real-time data dari Firestore
    db.collection('klien').orderBy('nama', 'asc').onSnapshot(snapshot => {
        let html = '';
        snapshot.forEach(doc => {
            const k = doc.data();
            html += `
                <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <h4 class="font-bold text-gray-800 text-base">${k.nama}</h4>
                        <p class="text-xs text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                            <i class="fa-brands fa-whatsapp text-sm"></i>${k.wa}
                        </p>
                        <p class="text-xs text-gray-400 mt-2"><i class="fa-solid fa-location-dot mr-1"></i>${k.alamat || '-'}</p>
                    </div>
                    <button onclick="window.deleteKlien('${doc.id}')" class="text-rose-500 hover:bg-rose-50 p-2.5 rounded-xl transition text-sm">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;
        });
        if (containerKlien) {
            containerKlien.innerHTML = html || '<p class="text-sm text-gray-400 italic col-span-full text-center py-8">Belum ada data klien terdaftar.</p>';
        }
    });
}

function openModal() {
    formKlien?.reset();
    modalKlien?.classList.remove('hidden');
}

function closeModal() {
    modalKlien?.classList.add('hidden');
}

async function saveKlien(e) {
    e.preventDefault();
    const payload = {
        nama: document.getElementById('klien-nama').value,
        wa: document.getElementById('klien-wa').value,
        alamat: document.getElementById('klien-alamat').value
    };

    try {
        await db.collection('klien').add(payload);
        closeModal();
    } catch (err) {
        alert("Gagal menyimpan klien: " + err.message);
    }
}

// Global scope binder agar onclick di HTML bisa mendeteksi fungsi hapus
window.deleteKlien = async function(id) {
    if (confirm("Apakah Anda yakin ingin menghapus pelanggan tetap ini?")) {
        try {
            await db.collection('klien').doc(id).delete();
        } catch (err) {
            alert("Gagal menghapus: " + err.message);
        }
    }
}