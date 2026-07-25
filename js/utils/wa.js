const API_BASE = "https://wa.mrdsolution.my.id/api";
const API_KEY = "7BC82018076500360255A4E0F78D52C7";
const SESSION_ID = "sps"; // Sesi khusus terisolasi dari database penagihan harian

// Kirim pesan WhatsApp
export async function sendWA(to, text) {
    try {
        let formattedPhone = to.replace(/\D/g, "");
        if (formattedPhone.startsWith("0")) formattedPhone = "62" + formattedPhone.substring(1);
        if (formattedPhone.startsWith("8")) formattedPhone = "62" + formattedPhone;

        // Menggunakan parameter GET sesuai dengan konfigurasi gateway Anda
        const url = `${API_BASE}/send-message?key=${API_KEY}&session=${SESSION_ID}&to=${formattedPhone}&text=${encodeURIComponent(text)}`;
        const response = await fetch(url);
        
        if (response.ok) {
            const result = await response.text();
            return result.toLowerCase().includes("success") || result.toLowerCase().includes("terkirim");
        }
        return false;
    } catch (err) {
        console.error("Gagal mengirim WA via VPS Gateway:", err.message);
        return false;
    }
}

// Request Pairing Code Baru via No HP (Sesi SPS)
export async function requestWAPairing(phone) {
    try {
        let formattedPhone = phone.replace(/\D/g, "");
        if (formattedPhone.startsWith("0")) formattedPhone = "62" + formattedPhone.substring(1);
        if (formattedPhone.startsWith("8")) formattedPhone = "62" + formattedPhone;

        const url = `${API_BASE}/request-pairing/${SESSION_ID}?phone=${formattedPhone}`;
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            return data.code || null; // Mengembalikan 8-digit pairing code
        }
        return null;
    } catch (err) {
        console.error("Gagal meminta pairing code dari VPS:", err.message);
        return null;
    }
}