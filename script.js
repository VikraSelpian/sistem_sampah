async function fetchStatus() {
    try {
        // Ganti 'http://alamat-ip-arduino/status' dengan IP atau URL server Arduino yang benar
        const response = await fetch('http://alamat-ip-arduino/status'); 
        const data = await response.json();
        
        // Memperbarui status di HTML dengan data dari Arduino (organik, non-organik, metal)
        document.getElementById('organik-status').innerText = data.organik || '0';
        document.getElementById('non-organik-status').innerText = data.non_organik || '0';
        document.getElementById('metal-status').innerText = data.metal || '0';
    } catch (error) {
        console.error('Error fetching status:', error);
    }
}

// Memperbarui status setiap 5 detik
setInterval(fetchStatus, 5000);
fetchStatus();
