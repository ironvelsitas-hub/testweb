// Scanner Barcode dengan HTML5 QR Code
let html5QrCode = null;
let isScanning = false;

const startScannerBtn = document.getElementById('startScannerBtn');
const stopScannerBtn = document.getElementById('stopScannerBtn');

async function startScanner() {
  if (isScanning) {
    console.log("Scanner sudah berjalan");
    return;
  }
  
  const readerElement = document.getElementById('reader');
  readerElement.innerHTML = '';
  
  html5QrCode = new Html5Qrcode("reader");
  
  try {
    const devices = await Html5Qrcode.getCameras();
    if (devices && devices.length) {
      let cameraId = devices[0].id;
      for (let device of devices) {
        if (device.label.toLowerCase().includes('back') || 
            device.label.toLowerCase().includes('environment')) {
          cameraId = device.id;
          break;
        }
      }
      
      await html5QrCode.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        onScanSuccess,
        onScanError
      );
      
      isScanning = true;
      startScannerBtn.disabled = true;
      stopScannerBtn.disabled = false;
      console.log("Scanner started successfully");
    } else {
      alert("Tidak ditemukan kamera pada device ini");
    }
  } catch (err) {
    console.error("Error starting scanner:", err);
    alert(`Gagal memulai scanner: ${err.message || "Pastikan Anda menggunakan HTTPS atau localhost"}`);
  }
}

function stopScanner() {
  if (html5QrCode && isScanning) {
    html5QrCode.stop()
      .then(() => {
        isScanning = false;
        startScannerBtn.disabled = false;
        stopScannerBtn.disabled = true;
        console.log("Scanner stopped");
      })
      .catch(err => {
        console.error("Error stopping scanner:", err);
      });
  }
}

async function onScanSuccess(decodedText, decodedResult) {
  console.log(`Barcode terdeteksi: ${decodedText}`);
  
  // Hentikan scan
  stopScanner();
  
  try {
    // Cari produk berdasarkan barcode
    const product = await window.searchProductByBarcode(decodedText);
    
    if (product) {
      // Langsung buka modal detail pesanan
      window.openOrderModal(product);
    } else {
      alert(`❌ Produk dengan barcode "${decodedText}" tidak ditemukan!`);
      // Restart scanner setelah alert
      setTimeout(() => startScanner(), 2000);
    }
  } catch (error) {
    console.error("Error searching product:", error);
    alert("❌ Gagal mencari produk. Pastikan server berjalan.");
    setTimeout(() => startScanner(), 2000);
  }
}

function onScanError(errorMessage) {
  // Abaikan error scan biasa
}

// Event listeners
if (startScannerBtn) {
  startScannerBtn.addEventListener('click', startScanner);
}
if (stopScannerBtn) {
  stopScannerBtn.addEventListener('click', stopScanner);
}

// Cleanup
window.addEventListener('beforeunload', () => {
  if (html5QrCode && isScanning) {
    html5QrCode.stop().catch(console.error);
  }
});