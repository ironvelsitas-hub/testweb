// ============ HARDWARE INTEGRATION ============
// Printer Thermal dan Scanner Barcode USB

let printerDevice = null;
let scannerActive = false;
let scannerBuffer = '';
let scannerTimeout = null;

// Load saved settings
function loadDeviceSettings() {
  const savedPrinterType = localStorage.getItem('printer_type') || 'escpos';
  const savedPaperSize = localStorage.getItem('paper_size') || '80';
  const savedAutoCut = localStorage.getItem('auto_cut') !== 'false';
  const savedScannerMode = localStorage.getItem('scanner_mode') || 'auto';
  const savedScannerBeep = localStorage.getItem('scanner_beep') !== 'false';
  
  document.getElementById('printerType').value = savedPrinterType;
  document.getElementById('paperSize').value = savedPaperSize;
  document.getElementById('autoCut').checked = savedAutoCut;
  document.getElementById('scannerMode').value = savedScannerMode;
  document.getElementById('scannerBeep').checked = savedScannerBeep;
  
  // Initialize scanner listener if auto mode
  if (savedScannerMode === 'auto' && !scannerActive) {
    initScannerListener();
  }
}

// Save device settings
function saveDeviceSettings() {
  const printerType = document.getElementById('printerType').value;
  const paperSize = document.getElementById('paperSize').value;
  const autoCut = document.getElementById('autoCut').checked;
  const scannerMode = document.getElementById('scannerMode').value;
  const scannerBeep = document.getElementById('scannerBeep').checked;
  
  localStorage.setItem('printer_type', printerType);
  localStorage.setItem('paper_size', paperSize);
  localStorage.setItem('auto_cut', autoCut);
  localStorage.setItem('scanner_mode', scannerMode);
  localStorage.setItem('scanner_beep', scannerBeep);
  
  // Reinitialize scanner if mode changed
  if (scannerActive) {
    stopScannerListener();
  }
  initScannerListener();
  
  showNotification('Pengaturan disimpan', 'success');
}

// Show notification
function showNotification(message, type = 'info') {
  const notif = document.createElement('div');
  notif.className = `hardware-notification ${type}`;
  notif.innerHTML = `
    <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
    <span>${message}</span>
    <button class="close-notif" onclick="this.parentElement.remove()">✖</button>
  `;
  document.body.appendChild(notif);
  setTimeout(() => notif.remove(), 3000);
}

// ============ PRINTER THERMAL ============
async function connectPrinter() {
  try {
    // Request USB device (for ESC/POS printers)
    const device = await navigator.usb.requestDevice({
      filters: [
        { vendorId: 0x0416 }, // Generic ESC/POS
        { vendorId: 0x0483 }, // STMicroelectronics
        { vendorId: 0x067b }, // Prolific
        { vendorId: 0x04b8 }, // Epson
        { vendorId: 0x15a2 }, // Freescale
      ]
    });
    
    await device.open();
    await device.selectConfiguration(1);
    await device.claimInterface(0);
    
    printerDevice = device;
    updatePrinterStatus(true);
    showNotification('Printer thermal berhasil terhubung!', 'success');
    
    // Test print
    setTimeout(() => {
      if (confirm('Printer terhubung! Ingin mencetak test?')) {
        testPrint();
      }
    }, 500);
    
  } catch (error) {
    console.error('Printer connection error:', error);
    showNotification('Gagal menghubungkan printer: ' + error.message, 'error');
    updatePrinterStatus(false);
  }
}

// Update printer status UI
function updatePrinterStatus(connected) {
  const statusEl = document.getElementById('printerStatus');
  const connectBtn = document.getElementById('connectPrinterBtn');
  
  if (connected) {
    statusEl.textContent = 'Terhubung';
    statusEl.className = 'status-badge connected';
    connectBtn.textContent = 'Putuskan';
    connectBtn.onclick = disconnectPrinter;
  } else {
    statusEl.textContent = 'Terputus';
    statusEl.className = 'status-badge disconnected';
    connectBtn.textContent = 'Hubungkan';
    connectBtn.onclick = connectPrinter;
  }
}

// Disconnect printer
async function disconnectPrinter() {
  if (printerDevice) {
    try {
      await printerDevice.close();
      printerDevice = null;
      showNotification('Printer diputuskan', 'info');
    } catch (error) {
      console.error('Error disconnecting printer:', error);
    }
  }
  updatePrinterStatus(false);
}

// Send ESC/POS commands to printer
async function sendToPrinter(data) {
  if (!printerDevice) {
    showNotification('Printer tidak terhubung!', 'error');
    return false;
  }
  
  try {
    await printerDevice.transferOut(1, data);
    return true;
  } catch (error) {
    console.error('Print error:', error);
    showNotification('Gagal mencetak: ' + error.message, 'error');
    return false;
  }
}

// Test print
async function testPrint() {
  const paperSize = localStorage.getItem('paper_size') || '80';
  const autoCut = localStorage.getItem('auto_cut') !== 'false';
  
  const testData = [];
  
  // Initialize printer
  testData.push(0x1B, 0x40); // ESC @ - Initialize printer
  
  // Set center alignment
  testData.push(0x1B, 0x61, 0x01); // ESC a 1 - Center
  
  // Text
  const testText = `
╔════════════════════════╗
║       KIOS IRON        ║
║    Test Print Sukses   ║
╚════════════════════════╝

Printer: ${paperSize}mm
Tanggal: ${new Date().toLocaleString()}

✅ Printer thermal berfungsi dengan baik!


`;
  
  for (let char of testText) {
    testData.push(char.charCodeAt(0));
  }
  
  // Set left alignment
  testData.push(0x1B, 0x61, 0x00); // ESC a 0 - Left
  
  // Cut paper if enabled
  if (autoCut) {
    testData.push(0x1D, 0x56, 0x42, 0x00); // GS V B 0 - Partial cut
  }
  
  await sendToPrinter(new Uint8Array(testData));
  showNotification('Test print berhasil dikirim!', 'success');
}

// Print receipt (called from confirmPayment)
async function printReceiptHardware(paymentDetails, pointsEarned) {
  if (!printerDevice) {
    showNotification('Printer tidak terhubung, struk akan ditampilkan di layar', 'info');
    return false;
  }
  
  const paperSize = localStorage.getItem('paper_size') || '80';
  const autoCut = localStorage.getItem('auto_cut') !== 'false';
  
  const printData = [];
  
  // Initialize printer
  printData.push(0x1B, 0x40); // ESC @
  
  // Set center alignment for header
  printData.push(0x1B, 0x61, 0x01); // Center
  
  // Header
  const header = `
╔══════════════════════════════╗
║         KIOS IRON            ║
║     Sistem Barcode & Kasir   ║
╠══════════════════════════════╣
║ ${new Date().toLocaleString().padEnd(28)} ║
`;
  
  for (let char of header) {
    printData.push(char.charCodeAt(0));
  }
  
  // Member info
  if (paymentDetails.memberId && window.selectedMember) {
    const memberText = `
╠══════════════════════════════╣
║ Member: ${window.selectedMember.name.substring(0, 24).padEnd(24)} ║
║ Poin: ${window.selectedMember.points} → ${window.selectedMember.points + pointsEarned - currentUsedPoints} ║
`;
    for (let char of memberText) {
      printData.push(char.charCodeAt(0));
    }
  }
  
  // Items header
  printData.push(0x1B, 0x61, 0x00); // Left align
  const itemsHeader = `
╔══════════════════════════════╗
║        DAFTAR BELANJA        ║
╠══════════════════════════════╣
`;
  for (let char of itemsHeader) {
    printData.push(char.charCodeAt(0));
  }
  
  // Items
  for (let item of paymentDetails.items) {
    const subtotal = item.price * item.quantity;
    const itemLine = `
║ ${item.name.substring(0, 20).padEnd(20)} ║
║   ${item.quantity} x Rp ${item.price.toLocaleString('id-ID')} = Rp ${subtotal.toLocaleString('id-ID').padStart(12)} ║
`;
    for (let char of itemLine) {
      printData.push(char.charCodeAt(0));
    }
  }
  
  // Total
  printData.push(0x1B, 0x61, 0x01); // Center
  let totalSection = `
╠══════════════════════════════╣
║ SUBTOTAL: Rp ${paymentDetails.total.toLocaleString('id-ID').padStart(16)} ║
`;
  if (paymentDetails.discount > 0) {
    totalSection += `║ DISKON: Rp ${paymentDetails.discount.toLocaleString('id-ID').padStart(17)} ║\n`;
  }
  totalSection += `║ TOTAL: Rp ${paymentDetails.finalTotal.toLocaleString('id-ID').padStart(18)} ║\n`;
  totalSection += `║ METODE: ${paymentDetails.method.padEnd(19)} ║\n`;
  
  if (paymentDetails.method === 'CASH') {
    totalSection += `║ BAYAR: Rp ${paymentDetails.cashAmount.toLocaleString('id-ID').padStart(17)} ║\n`;
    totalSection += `║ KEMBALI: Rp ${paymentDetails.change.toLocaleString('id-ID').padStart(15)} ║\n`;
  }
  
  if (paymentDetails.memberId && pointsEarned > 0) {
    totalSection += `║ Poin Didapat: +${pointsEarned} ║\n`;
  }
  
  totalSection += `
╠══════════════════════════════╣
║     Terima Kasih!            ║
║   Selamat Belanja Kembali    ║
╚══════════════════════════════╝

`;
  
  for (let char of totalSection) {
    printData.push(char.charCodeAt(0));
  }
  
  // Cut paper if enabled
  if (autoCut) {
    printData.push(0x1D, 0x56, 0x42, 0x00); // Partial cut
    printData.push(0x1D, 0x56, 0x41, 0x00); // Full cut (alternative)
  }
  
  await sendToPrinter(new Uint8Array(printData));
  showNotification('Struk berhasil dicetak!', 'success');
  return true;
}

// ============ SCANNER BARCODE USB ============
function initScannerListener() {
  if (scannerActive) return;
  
  scannerActive = true;
  scannerBuffer = '';
  
  // Listen for keyboard events (USB scanner acts as keyboard)
  document.addEventListener('keydown', handleScannerInput);
  
  // Show scanner active indicator
  showScannerIndicator(true);
  
  // Play beep if enabled
  const scannerBeep = localStorage.getItem('scanner_beep') !== 'false';
  if (scannerBeep) {
    playBeep();
  }
  
  showNotification('Scanner barcode siap digunakan!', 'success');
}

function stopScannerListener() {
  scannerActive = false;
  document.removeEventListener('keydown', handleScannerInput);
  showScannerIndicator(false);
}

function handleScannerInput(event) {
  if (!scannerActive) return;
  
  // Scanner biasanya mengirimkan Enter sebagai penanda akhir barcode
  if (event.key === 'Enter') {
    if (scannerBuffer.length > 0) {
      processBarcode(scannerBuffer);
      scannerBuffer = '';
      clearTimeout(scannerTimeout);
      
      // Play beep if enabled
      const scannerBeep = localStorage.getItem('scanner_beep') !== 'false';
      if (scannerBeep) {
        playBeep();
      }
    }
  } else if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
    // Hanya terima karakter biasa (bukan tombol fungsi)
    scannerBuffer += event.key;
    
    // Reset timeout setelah 100ms tanpa input baru
    clearTimeout(scannerTimeout);
    scannerTimeout = setTimeout(() => {
      scannerBuffer = '';
    }, 100);
  }
}

async function processBarcode(barcode) {
  console.log('Barcode discan:', barcode);
  
  try {
    // Cari produk berdasarkan barcode
    const res = await fetch(`${API_URL}`);
    const products = await res.json();
    
    const match = barcode.match(/^(\d+)-/);
    let product = null;
    
    if (match) {
      const productId = match[1];
      product = products.find(p => p.id == productId);
    } else {
      product = products.find(p => p.name.toLowerCase().includes(barcode.toLowerCase()));
    }
    
    if (product) {
      // Tambahkan ke keranjang
      if (typeof addToCart === 'function') {
        addToCart(product);
        showNotification(`✅ ${product.name} ditambahkan ke keranjang!`, 'success');
      }
    } else {
      showNotification(`❌ Produk dengan barcode "${barcode}" tidak ditemukan!`, 'error');
    }
  } catch (error) {
    console.error('Error processing barcode:', error);
    showNotification('Gagal memproses barcode', 'error');
  }
}

function playBeep() {
  // Play beep sound using Web Audio API
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    gainNode.gain.value = 0.5;
    
    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.2);
    oscillator.stop(audioContext.currentTime + 0.2);
  } catch(e) {
    console.log('Beep not supported');
  }
}

function showScannerIndicator(active) {
  let indicator = document.getElementById('scannerIndicator');
  
  if (active && !indicator) {
    indicator = document.createElement('div');
    indicator.id = 'scannerIndicator';
    indicator.className = 'scanner-overlay';
    indicator.innerHTML = `
      <div class="scanner-badge"></div>
      <span>📷 Scanner Aktif - Siap Scan Barcode</span>
    `;
    document.body.appendChild(indicator);
  } else if (!active && indicator) {
    indicator.remove();
  }
}

// ============ EVENT LISTENERS ============
function initHardwareListeners() {
  const deviceBtn = document.getElementById('deviceSettingsBtn');
  const closeDeviceBtn = document.getElementById('closeDeviceBtn');
  const closeDeviceModal = document.querySelector('.close-device-modal');
  const saveSettingsBtn = document.getElementById('saveDeviceSettingsBtn');
  const connectPrinterBtn = document.getElementById('connectPrinterBtn');
  const testPrintBtn = document.getElementById('testPrintBtn');
  const connectScannerBtn = document.getElementById('connectScannerBtn');
  
  if (deviceBtn) {
    deviceBtn.addEventListener('click', () => {
      document.getElementById('deviceModal').style.display = 'block';
      loadDeviceSettings();
    });
  }
  
  if (closeDeviceBtn) {
    closeDeviceBtn.addEventListener('click', () => {
      document.getElementById('deviceModal').style.display = 'none';
    });
  }
  
  if (closeDeviceModal) {
    closeDeviceModal.addEventListener('click', () => {
      document.getElementById('deviceModal').style.display = 'none';
    });
  }
  
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', saveDeviceSettings);
  }
  
  if (connectPrinterBtn) {
    connectPrinterBtn.addEventListener('click', connectPrinter);
  }
  
  if (testPrintBtn) {
    testPrintBtn.addEventListener('click', testPrint);
  }
  
  if (connectScannerBtn) {
    connectScannerBtn.addEventListener('click', () => {
      if (scannerActive) {
        stopScannerListener();
        updateScannerStatus(false);
      } else {
        initScannerListener();
        updateScannerStatus(true);
      }
    });
  }
  
  // Close modal when clicking outside
  window.onclick = function(event) {
    const deviceModal = document.getElementById('deviceModal');
    if (event.target === deviceModal) {
      deviceModal.style.display = 'none';
    }
  };
}

function updateScannerStatus(connected) {
  const statusEl = document.getElementById('scannerStatus');
  const connectBtn = document.getElementById('connectScannerBtn');
  
  if (connected) {
    statusEl.textContent = 'Terhubung';
    statusEl.className = 'status-badge connected';
    connectBtn.textContent = 'Putuskan';
  } else {
    statusEl.textContent = 'Terputus';
    statusEl.className = 'status-badge disconnected';
    connectBtn.textContent = 'Hubungkan';
  }
}

// Initialize hardware
document.addEventListener('DOMContentLoaded', () => {
  initHardwareListeners();
  loadDeviceSettings();
  
  // Check if WebUSB is supported
  if (!navigator.usb) {
    console.warn('WebUSB tidak didukung di browser ini');
    showNotification('Browser tidak mendukung WebUSB. Gunakan Chrome/Edge untuk koneksi printer.', 'info');
  }
  
  // Start scanner by default if enabled
  const savedScannerMode = localStorage.getItem('scanner_mode') || 'auto';
  if (savedScannerMode === 'auto') {
    initScannerListener();
    updateScannerStatus(true);
  }
});

// Export functions for use in script.js
window.printReceiptHardware = printReceiptHardware;
window.showNotification = showNotification;