const API_URL = "/api/products";
let cart = [];
let currentCartTotal = 0;

// Load produk dari database
async function loadProducts() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("Gagal mengambil data");
    const products = await res.json();
    const container = document.getElementById("productsContainer");
    
    if (products.length === 0) {
      container.innerHTML = '<div class="loading">Belum ada produk. Silakan tambah produk pertama!</div>';
      return;
    }
    
    container.innerHTML = "";
    
    products.forEach(prod => {
      const card = document.createElement("div");
      card.className = "card";
      
      const barcodeId = `barcode-${prod.id}-${Date.now()}`;
      
      card.innerHTML = `
        <h3>🏷️ ${escapeHtml(prod.name)}</h3>
        <p>💰 Harga: Rp ${prod.price.toLocaleString('id-ID')}</p>
        <p>📦 Stok: ${prod.stock} pcs</p>
        <p>🆔 ID Produk: ${prod.id}</p>
        <div class="barcode">
          <svg id="${barcodeId}"></svg>
        </div>
        <div class="card-actions">
          <button class="edit-btn" onclick="event.stopPropagation(); openEditModal(${prod.id}, '${escapeHtml(prod.name)}', ${prod.price}, ${prod.stock})">✏️ Edit</button>
          <button class="delete-btn" onclick="event.stopPropagation(); deleteProduct(${prod.id}, '${escapeHtml(prod.name)}')">🗑️ Hapus</button>
        </div>
      `;
      
      // Klik pada card (selain tombol) untuk tambah ke keranjang
      card.addEventListener('click', (e) => {
        if (!e.target.classList.contains('edit-btn') && !e.target.classList.contains('delete-btn')) {
          addToCart(prod);
        }
      });
      
      container.appendChild(card);
      
      setTimeout(() => {
        try {
          JsBarcode(`#${barcodeId}`, `${prod.id}-${prod.name}`, {
            format: "CODE128",
            lineColor: "#000000",
            width: 1.2,
            height: 40,
            displayValue: true,
            fontSize: 12,
            margin: 5
          });
        } catch(e) {
          console.error("Gagal generate barcode:", e);
        }
      }, 10);
    });
  } catch (error) {
    console.error("Error loading products:", error);
    document.getElementById("productsContainer").innerHTML = 
      '<div class="loading" style="color:#ff6666">❌ Gagal memuat produk. Pastikan server backend berjalan di port 5000</div>';
  }
}

// Buka modal edit produk
function openEditModal(id, name, price, stock) {
  document.getElementById("editProductId").value = id;
  document.getElementById("editProductName").value = name;
  document.getElementById("editProductPrice").value = price;
  document.getElementById("editProductStock").value = stock;
  document.getElementById("editModal").style.display = "block";
}

// Simpan perubahan edit produk
async function saveEditProduct() {
  const id = document.getElementById("editProductId").value;
  const name = document.getElementById("editProductName").value.trim();
  const price = parseInt(document.getElementById("editProductPrice").value);
  const stock = parseInt(document.getElementById("editProductStock").value);
  
  if (!name || isNaN(price) || isNaN(stock)) {
    alert("⚠️ Isi semua data dengan benar!");
    return;
  }
  
  if (price <= 0 || stock < 0) {
    alert("⚠️ Harga harus > 0 dan Stok tidak boleh negatif!");
    return;
  }
  
  try {
    const res = await fetch(`${API_URL}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, price, stock })
    });
    
    if (res.ok) {
      alert(`✅ Produk "${name}" berhasil diupdate!`);
      closeEditModal();
      loadProducts();
      
      // Update stok di keranjang jika produk ada di keranjang
      const cartItem = cart.find(item => item.id == id);
      if (cartItem) {
        cartItem.name = name;
        cartItem.price = price;
        cartItem.stock = stock;
        updateCartDisplay();
      }
    } else {
      const error = await res.json();
      alert(`❌ Gagal mengupdate produk: ${error.error || "Unknown error"}`);
    }
  } catch (error) {
    console.error("Error updating product:", error);
    alert("❌ Gagal terhubung ke server");
  }
}

// Hapus produk
async function deleteProduct(id, name) {
  if (confirm(`⚠️ Yakin ingin menghapus produk "${name}"?\n\nProduk yang dihapus tidak dapat dikembalikan!`)) {
    // Cek apakah produk ada di keranjang
    const cartItem = cart.find(item => item.id === id);
    if (cartItem) {
      if (confirm(`Produk "${name}" sedang ada di keranjang belanja. Hapus dari keranjang juga?`)) {
        cart = cart.filter(item => item.id !== id);
        updateCartDisplay();
      }
    }
    
    try {
      const res = await fetch(`${API_URL}/${id}`, {
        method: "DELETE"
      });
      
      if (res.ok) {
        alert(`✅ Produk "${name}" berhasil dihapus!`);
        loadProducts();
      } else {
        const error = await res.json();
        alert(`❌ Gagal menghapus produk: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error deleting product:", error);
      alert("❌ Gagal terhubung ke server");
    }
  }
}

function closeEditModal() {
  document.getElementById("editModal").style.display = "none";
  document.getElementById("editProductId").value = "";
  document.getElementById("editProductName").value = "";
  document.getElementById("editProductPrice").value = "";
  document.getElementById("editProductStock").value = "";
}

// Tambah produk ke keranjang
function addToCart(product) {
  const existingItem = cart.find(item => item.id === product.id);
  const currentQty = existingItem ? existingItem.quantity : 0;
  
  if (currentQty >= product.stock) {
    alert(`⚠️ Stok ${product.name} hanya tersisa ${product.stock} pcs!`);
    return;
  }
  
  if (existingItem) {
    existingItem.quantity++;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
      stock: product.stock
    });
  }
  
  updateCartDisplay();
}

// Update tampilan keranjang
function updateCartDisplay() {
  const cartContainer = document.getElementById("cartItems");
  const cartTotalSpan = document.getElementById("cartTotal");
  const checkoutBtn = document.getElementById("checkoutBtn");
  
  if (cart.length === 0) {
    cartContainer.innerHTML = '<div class="empty-cart">Keranjang masih kosong</div>';
    cartTotalSpan.innerHTML = "Rp 0";
    checkoutBtn.disabled = true;
    return;
  }
  
  let total = 0;
  cartContainer.innerHTML = "";
  
  cart.forEach((item, index) => {
    const subtotal = item.price * item.quantity;
    total += subtotal;
    
    const itemDiv = document.createElement("div");
    itemDiv.className = "cart-item";
    itemDiv.innerHTML = `
      <div class="cart-item-info">
        <span class="cart-item-name">${escapeHtml(item.name)}</span>
        <span class="cart-item-price">Rp ${item.price.toLocaleString('id-ID')}</span>
      </div>
      <div class="cart-item-quantity">
        <button onclick="updateQuantity(${item.id}, -1)">-</button>
        <span>${item.quantity}</span>
        <button onclick="updateQuantity(${item.id}, 1)">+</button>
      </div>
      <div class="cart-item-subtotal">
        Rp ${subtotal.toLocaleString('id-ID')}
      </div>
      <button class="cart-item-remove" onclick="removeFromCart(${item.id})">✖</button>
    `;
    cartContainer.appendChild(itemDiv);
  });
  
  currentCartTotal = total;
  cartTotalSpan.innerHTML = `Rp ${total.toLocaleString('id-ID')}`;
  checkoutBtn.disabled = false;
}

// Update quantity item di keranjang
function updateQuantity(productId, delta) {
  const itemIndex = cart.findIndex(item => item.id === productId);
  if (itemIndex === -1) return;
  
  const item = cart[itemIndex];
  const newQuantity = item.quantity + delta;
  
  if (newQuantity < 1) {
    removeFromCart(productId);
    return;
  }
  
  if (newQuantity > item.stock) {
    alert(`⚠️ Stok ${item.name} hanya tersisa ${item.stock} pcs!`);
    return;
  }
  
  item.quantity = newQuantity;
  updateCartDisplay();
}

// Hapus item dari keranjang
function removeFromCart(productId) {
  cart = cart.filter(item => item.id !== productId);
  updateCartDisplay();
}

// Kosongkan keranjang
function clearCart() {
  if (cart.length > 0 && confirm("Yakin ingin mengosongkan keranjang?")) {
    cart = [];
    updateCartDisplay();
  }
}

// Lanjut ke pembayaran
function checkout() {
  if (cart.length === 0) {
    alert("Keranjang masih kosong!");
    return;
  }
  openOrderModal();
}

// Buka modal pesanan
function openOrderModal() {
  if (cart.length === 0) {
    alert("Keranjang masih kosong!");
    return;
  }
  
  selectedPaymentMethod = null;
  document.getElementById("cashAmount").value = "";
  document.getElementById("changeAmount").innerHTML = "Rp 0";
  document.getElementById("selectedPayment").innerHTML = "";
  document.getElementById("cashPaymentSection").classList.add("hidden");
  document.getElementById("nonCashSection").classList.add("hidden");
  
  document.querySelectorAll('.payment-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  document.getElementById("confirmPaymentBtn").disabled = true;
  
  const orderItemsContainer = document.getElementById("orderItemsList");
  orderItemsContainer.innerHTML = '<div class="order-items-list"></div>';
  const itemsListDiv = orderItemsContainer.querySelector('.order-items-list');
  
  let total = 0;
  cart.forEach(item => {
    const subtotal = item.price * item.quantity;
    total += subtotal;
    
    const itemRow = document.createElement("div");
    itemRow.className = "order-item-row";
    itemRow.innerHTML = `
      <span class="order-item-name">${escapeHtml(item.name)}</span>
      <span class="order-item-qty">${item.quantity} x</span>
      <span class="order-item-price">Rp ${item.price.toLocaleString('id-ID')}</span>
    `;
    itemsListDiv.appendChild(itemRow);
  });
  
  document.getElementById("orderTotalAmount").innerHTML = `Rp ${total.toLocaleString('id-ID')}`;
  document.getElementById("totalPriceDisplay").innerHTML = `Rp ${total.toLocaleString('id-ID')}`;
  document.getElementById("nonCashTotal").innerHTML = `Rp ${total.toLocaleString('id-ID')}`;
  
  const cashInput = document.getElementById("cashAmount");
  cashInput.oninput = function() {
    calculateChange(total);
  };
  
  document.getElementById("orderModal").style.display = "block";
}

function calculateChange(totalPrice) {
  const cashAmount = parseInt(document.getElementById("cashAmount").value);
  const changeSpan = document.getElementById("changeAmount");
  
  if (isNaN(cashAmount) || cashAmount < totalPrice) {
    changeSpan.innerHTML = "Rp 0";
    changeSpan.style.color = "#ff6666";
    document.getElementById("confirmPaymentBtn").disabled = true;
    return false;
  }
  
  const change = cashAmount - totalPrice;
  changeSpan.innerHTML = `Rp ${change.toLocaleString('id-ID')}`;
  changeSpan.style.color = "#44ffaa";
  document.getElementById("confirmPaymentBtn").disabled = false;
  return true;
}

function setupPaymentMethods() {
  document.querySelectorAll('.payment-btn').forEach(btn => {
    btn.onclick = () => {
      const method = btn.getAttribute('data-method');
      selectedPaymentMethod = method;
      
      document.querySelectorAll('.payment-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      document.getElementById("selectedPayment").innerHTML = `Metode pembayaran: <strong>${method}</strong>`;
      
      const total = currentCartTotal;
      
      if (method === 'CASH') {
        document.getElementById("cashPaymentSection").classList.remove("hidden");
        document.getElementById("nonCashSection").classList.add("hidden");
        calculateChange(total);
      } else {
        document.getElementById("cashPaymentSection").classList.add("hidden");
        document.getElementById("nonCashSection").classList.remove("hidden");
        document.getElementById("confirmPaymentBtn").disabled = false;
      }
    };
  });
}

// Update fungsi checkout untuk mencatat transaksi member
async function confirmPayment() {
  if (cart.length === 0) {
    alert("Keranjang kosong!");
    closeModal();
    return;
  }
  
  if (!selectedPaymentMethod) {
    alert("⚠️ Pilih metode pembayaran terlebih dahulu!");
    return;
  }
  
  let total = currentCartTotal;
  let finalTotal = total - currentDiscount;
  
  if (finalTotal < 0) finalTotal = 0;
  
  let paymentDetails = {
    items: [...cart],
    total: total,
    finalTotal: finalTotal,
    method: selectedPaymentMethod,
    memberId: selectedMember ? selectedMember.id : null,
    usedPoints: currentUsedPoints,
    discount: currentDiscount
  };
  
  if (selectedPaymentMethod === 'CASH') {
    const cashAmount = parseInt(document.getElementById("cashAmount").value);
    const change = cashAmount - finalTotal;
    
    if (isNaN(cashAmount) || cashAmount < finalTotal) {
      alert("⚠️ Uang yang dimasukkan kurang!");
      return;
    }
    
    paymentDetails.cashAmount = cashAmount;
    paymentDetails.change = change;
  }
  
  // Hitung poin yang didapat (setiap Rp 1.000 = 10 poin, dibulatkan ke bawah)
  const pointsEarned = selectedMember ? Math.floor(finalTotal / 1000) * 10 : 0;
  
  let confirmMessage = `✅ Konfirmasi Pembayaran\n\n`;
  confirmMessage += `Total Items: ${cart.length} produk\n`;
  confirmMessage += `Total Belanja: Rp ${total.toLocaleString('id-ID')}\n`;
  if (currentDiscount > 0) {
    confirmMessage += `Diskon Poin: Rp ${currentDiscount.toLocaleString('id-ID')}\n`;
    confirmMessage += `Total Bayar: Rp ${finalTotal.toLocaleString('id-ID')}\n`;
  }
  confirmMessage += `Metode: ${selectedPaymentMethod}\n`;
  
  if (selectedMember) {
    confirmMessage += `\n👤 Member: ${selectedMember.name}\n`;
    confirmMessage += `⭐ Poin yang didapat: +${pointsEarned}\n`;
    confirmMessage += `⭐ Total poin setelah transaksi: ${selectedMember.points + pointsEarned - currentUsedPoints}\n`;
  }
  
  if (selectedPaymentMethod === 'CASH') {
    confirmMessage += `Uang Dibayar: Rp ${paymentDetails.cashAmount.toLocaleString('id-ID')}\n`;
    confirmMessage += `Kembalian: Rp ${paymentDetails.change.toLocaleString('id-ID')}\n`;
  }
  
  confirmMessage += `\nLanjutkan transaksi?`;
  
  if (confirm(confirmMessage)) {
    try {
      // Update stok produk
      for (let item of cart) {
        const newStock = item.stock - item.quantity;
        await fetch(`${API_URL}/${item.id}/stock`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stock: newStock })
        });
      }
      
      // Catat transaksi ke database
await fetch('/api/transactions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    memberId: selectedMember ? selectedMember.id : null,
    userId: currentUser ? currentUser.id : null,  // TAMBAHKAN INI
    totalAmount: finalTotal,
    pointsEarned: pointsEarned,
    paymentMethod: selectedPaymentMethod,
    items: cart,
    usedDiscount: currentDiscount
  })
});      
      // Cetak struk dengan info member
      printReceipt(paymentDetails, pointsEarned);
      
      // Reset member selection jika bukan member tetap
      if (!selectedMember) {
        selectedMember = null;
        updateMemberInfoInCart();
      } else {
        // Refresh member data
        const memberRes = await fetch(`/api/members/${selectedMember.id}`);
        selectedMember = await memberRes.json();
        updateMemberInfoInCart();
      }
      
      // Reset discount
      currentDiscount = 0;
      currentUsedPoints = 0;
      
      // Kosongkan keranjang
      cart = [];
      updateCartDisplay();
      loadProducts();
      closeModal();
      
    } catch (error) {
      console.error("Error processing payment:", error);
      alert("❌ Gagal memproses pembayaran");
    }
  }
}

// Update printReceipt dengan info member
function printReceipt(paymentDetails, pointsEarned) {
  let receipt = `╔══════════════════════════════╗\n`;
  receipt += `║        KIOS IRON             ║\n`;
  receipt += `║    Sistem Barcode & Kasir     ║\n`;
  receipt += `╠══════════════════════════════╣\n`;
  receipt += `║ 📅 ${new Date().toLocaleString()} ║\n`;
  
  if (paymentDetails.memberId) {
    receipt += `║ 👤 Member: ${selectedMember.name.substring(0, 18).padEnd(18)} ║\n`;
    receipt += `║ ⭐ Poin: ${selectedMember.points} → ${selectedMember.points + pointsEarned - currentUsedPoints} ║\n`;
  }
  
  receipt += `╠══════════════════════════════╣\n`;
  receipt += `║        DAFTAR BELANJA         ║\n`;
  receipt += `╠══════════════════════════════╣\n`;
  
  paymentDetails.items.forEach(item => {
    const subtotal = item.price * item.quantity;
    receipt += `║ ${item.name.substring(0, 20).padEnd(20)} ║\n`;
    receipt += `║   ${item.quantity} x Rp ${item.price.toLocaleString('id-ID')} = Rp ${subtotal.toLocaleString('id-ID').padStart(12)} ║\n`;
  });
  
  receipt += `╠══════════════════════════════╣\n`;
  receipt += `║ SUBTOTAL: Rp ${paymentDetails.total.toLocaleString('id-ID').padStart(16)} ║\n`;
  
  if (paymentDetails.discount > 0) {
    receipt += `║ DISKON: Rp ${paymentDetails.discount.toLocaleString('id-ID').padStart(17)} ║\n`;
  }
  
  receipt += `║ TOTAL: Rp ${paymentDetails.finalTotal.toLocaleString('id-ID').padStart(18)} ║\n`;
  receipt += `║ METODE: ${paymentDetails.method.padEnd(19)} ║\n`;
  
  if (paymentDetails.method === 'CASH') {
    receipt += `║ BAYAR: Rp ${paymentDetails.cashAmount.toLocaleString('id-ID').padStart(17)} ║\n`;
    receipt += `║ KEMBALI: Rp ${paymentDetails.change.toLocaleString('id-ID').padStart(15)} ║\n`;
  }
  
  if (paymentDetails.memberId && pointsEarned > 0) {
    receipt += `║ ⭐ Poin Didapat: +${pointsEarned} ║\n`;
  }
  
  receipt += `╠══════════════════════════════╣\n`;
  receipt += `║     Terima Kasih!            ║\n`;
  receipt += `║   Selamat Belanja Kembali     ║\n`;
  receipt += `╚══════════════════════════════╝\n`;
  
  alert(receipt);
  console.log(receipt);
}

// Update openOrderModal untuk menampilkan info member
// (Tambah fungsi ini di dalam openOrderModal yang sudah ada)
function openOrderModal() {
  if (cart.length === 0) {
    alert("Keranjang masih kosong!");
    return;
  }
  
  selectedPaymentMethod = null;
  currentDiscount = 0;
  currentUsedPoints = 0;
  
  document.getElementById("cashAmount").value = "";
  document.getElementById("changeAmount").innerHTML = "Rp 0";
  document.getElementById("selectedPayment").innerHTML = "";
  document.getElementById("cashPaymentSection").classList.add("hidden");
  document.getElementById("nonCashSection").classList.add("hidden");
  document.getElementById("discountInfo").innerHTML = "";
  document.getElementById("usePointsAmount").value = "";
  
  document.querySelectorAll('.payment-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  document.getElementById("confirmPaymentBtn").disabled = true;
  
  const orderItemsContainer = document.getElementById("orderItemsList");
  orderItemsContainer.innerHTML = '<div class="order-items-list"></div>';
  const itemsListDiv = orderItemsContainer.querySelector('.order-items-list');
  
  let total = 0;
  cart.forEach(item => {
    const subtotal = item.price * item.quantity;
    total += subtotal;
    
    const itemRow = document.createElement("div");
    itemRow.className = "order-item-row";
    itemRow.innerHTML = `
      <span class="order-item-name">${escapeHtml(item.name)}</span>
      <span class="order-item-qty">${item.quantity} x</span>
      <span class="order-item-price">Rp ${item.price.toLocaleString('id-ID')}</span>
    `;
    itemsListDiv.appendChild(itemRow);
  });
  
  currentCartTotal = total;
  document.getElementById("orderTotalAmount").innerHTML = `Rp ${total.toLocaleString('id-ID')}`;
  document.getElementById("totalPriceDisplay").innerHTML = `Rp ${total.toLocaleString('id-ID')}`;
  document.getElementById("nonCashTotal").innerHTML = `Rp ${total.toLocaleString('id-ID')}`;
  
  // Update member info di modal
  updateMemberInfoInModal();
  
  const cashInput = document.getElementById("cashAmount");
  cashInput.oninput = function() {
    const finalTotal = currentCartTotal - currentDiscount;
    calculateChange(finalTotal);
  };
  
  document.getElementById("orderModal").style.display = "block";
}

// Update fungsi showTab untuk include member tab
function showTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  document.getElementById(`${tabName}Tab`).classList.add('active');
  
  const buttons = document.querySelectorAll('.tab-btn');
  if (tabName === 'products') buttons[0].classList.add('active');
  else if (tabName === 'scanner') buttons[1].classList.add('active');
  else if (tabName === 'manual') buttons[2].classList.add('active');
  else if (tabName === 'members') buttons[3].classList.add('active');
  
  if (tabName === 'manual') {
    document.getElementById("searchResults").classList.add("hidden");
    document.getElementById("productNameSearch").value = "";
  }
  
  if (tabName === 'members') {
    if (typeof loadMembers === 'function') loadMembers();
    if (typeof loadRewards === 'function') loadRewards();
  }
}
async function searchProductsByName(keyword) {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("Gagal mengambil data");
    const allProducts = await res.json();
    
    if (!keyword.trim()) {
      return [];
    }
    
    const filtered = allProducts.filter(product => 
      product.name.toLowerCase().includes(keyword.toLowerCase())
    );
    
    return filtered;
  } catch (error) {
    console.error("Error searching products by name:", error);
    throw error;
  }
}

async function handleSearchByName() {
  const keyword = document.getElementById("productNameSearch").value.trim();
  const resultsDiv = document.getElementById("searchResults");
  const resultsListDiv = document.getElementById("resultsList");
  
  if (!keyword) {
    alert("⚠️ Masukkan nama produk yang ingin dicari!");
    return;
  }
  
  resultsDiv.classList.remove("hidden");
  resultsListDiv.innerHTML = '<div class="loading">🔍 Mencari produk...</div>';
  
  try {
    const products = await searchProductsByName(keyword);
    
    if (products.length === 0) {
      resultsListDiv.innerHTML = `
        <div class="no-results">
          ❌ Tidak ada produk dengan nama "${escapeHtml(keyword)}"
        </div>
      `;
      return;
    }
    
    resultsListDiv.innerHTML = "";
    products.forEach(product => {
      const productItem = document.createElement("div");
      productItem.className = "search-result-item";
      productItem.innerHTML = `
        <div class="result-info">
          <strong>🏷️ ${escapeHtml(product.name)}</strong>
          <span>💰 Rp ${product.price.toLocaleString('id-ID')}</span>
          <span>📦 Stok: ${product.stock} pcs</span>
        </div>
        <button class="select-product-btn" data-id="${product.id}" data-name="${escapeHtml(product.name)}" data-price="${product.price}" data-stock="${product.stock}">
          🛒 Tambah ke Keranjang
        </button>
      `;
      
      const selectBtn = productItem.querySelector('.select-product-btn');
      selectBtn.addEventListener('click', () => {
        addToCart({
          id: product.id,
          name: product.name,
          price: product.price,
          stock: product.stock
        });
      });
      
      resultsListDiv.appendChild(productItem);
    });
    
  } catch (error) {
    console.error("Error:", error);
    resultsListDiv.innerHTML = `
      <div class="no-results" style="color:#ff6666">
        ❌ Gagal mencari produk. Pastikan server berjalan.
      </div>
    `;
  }
}

async function addProduct() {
  const name = document.getElementById("productName").value.trim();
  const price = parseInt(document.getElementById("productPrice").value);
  const stock = parseInt(document.getElementById("productStock").value);
  
  if (!name || isNaN(price) || isNaN(stock)) {
    alert("⚠️ Isi semua data dengan benar!");
    return;
  }
  
  if (price <= 0 || stock < 0) {
    alert("⚠️ Harga harus > 0 dan Stok tidak boleh negatif");
    return;
  }
  
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, price, stock })
    });
    
    if (res.ok) {
      alert(`✅ Produk "${name}" berhasil ditambahkan!`);
      document.getElementById("productName").value = "";
      document.getElementById("productPrice").value = "";
      document.getElementById("productStock").value = "";
      loadProducts();
    } else {
      const error = await res.json();
      alert(`❌ Gagal menambah produk: ${error.error || "Unknown error"}`);
    }
  } catch (error) {
    console.error("Error:", error);
    alert("❌ Gagal terhubung ke server");
  }
}

function closeModal() {
  document.getElementById("orderModal").style.display = "none";
  selectedPaymentMethod = null;
}

function showTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  document.getElementById(`${tabName}Tab`).classList.add('active');
  
  const buttons = document.querySelectorAll('.tab-btn');
  if (tabName === 'products') buttons[0].classList.add('active');
  else if (tabName === 'scanner') buttons[1].classList.add('active');
  else if (tabName === 'manual') buttons[2].classList.add('active');
  
  if (tabName === 'manual') {
    document.getElementById("searchResults").classList.add("hidden");
    document.getElementById("productNameSearch").value = "";
  }
}

function escapeHtml(str) {
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

// Global functions
window.addToCart = addToCart;
window.updateQuantity = updateQuantity;
window.removeFromCart = removeFromCart;
window.clearCart = clearCart;
window.openEditModal = openEditModal;
window.deleteProduct = deleteProduct;

// Event listeners
document.getElementById("addProductBtn").addEventListener("click", addProduct);
document.getElementById("searchByNameBtn").addEventListener("click", handleSearchByName);
document.getElementById("clearCartBtn").addEventListener("click", clearCart);
document.getElementById("checkoutBtn").addEventListener("click", checkout);
document.getElementById("confirmPaymentBtn").addEventListener("click", confirmPayment);
document.getElementById("cancelOrderBtn").addEventListener("click", closeModal);
document.querySelector(".close-modal").addEventListener("click", closeModal);
document.getElementById("saveEditBtn").addEventListener("click", saveEditProduct);
document.getElementById("cancelEditBtn").addEventListener("click", closeEditModal);
document.querySelector(".close-edit-modal").addEventListener("click", closeEditModal);

document.getElementById("productNameSearch").addEventListener("keypress", (e) => {
  if (e.key === "Enter") handleSearchByName();
});

const productInputs = ['productName', 'productPrice', 'productStock'];
productInputs.forEach(id => {
  document.getElementById(id).addEventListener("keypress", (e) => {
    if (e.key === "Enter") addProduct();
  });
});

window.onclick = function(event) {
  const orderModal = document.getElementById("orderModal");
  const editModal = document.getElementById("editModal");
  if (event.target === orderModal) {
    closeModal();
  }
  if (event.target === editModal) {
    closeEditModal();
  }
};

setupPaymentMethods();
loadProducts();

// Export untuk scanner
window.openOrderModal = openOrderModal;
window.searchProductByBarcode = async (barcode) => {
  const match = barcode.match(/^(\d+)-/);
  if (match) {
    const productId = match[1];
    const res = await fetch(`${API_URL}`);
    const products = await res.json();
    return products.find(p => p.id == productId);
  }
  return null;
};
window.escapeHtml = escapeHtml;
window.showTab = showTab;
window.addToCart = addToCart;

// ============ CETAK BARCODE FUNCTIONS ============
let selectedPrintProducts = [];

// Buka modal cetak barcode untuk produk tertentu
function openPrintBarcodeModal(productIds) {
  selectedPrintProducts = Array.isArray(productIds) ? productIds : [productIds];
  
  // Load product details
  fetch(API_URL)
    .then(res => res.json())
    .then(products => {
      const selectedProducts = products.filter(p => selectedPrintProducts.includes(p.id));
      const printListDiv = document.getElementById('printProductList');
      
      printListDiv.innerHTML = `
        <div style="margin-bottom: 10px;">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input type="checkbox" id="selectAllPrint" checked> Pilih Semua
          </label>
        </div>
      `;
      
      selectedProducts.forEach(product => {
        printListDiv.innerHTML += `
          <div class="print-product-item">
            <input type="checkbox" class="print-product-checkbox" data-id="${product.id}" checked>
            <div class="print-product-info">
              <div class="print-product-name">${escapeHtml(product.name)}</div>
              <div class="print-product-price">Rp ${product.price.toLocaleString('id-ID')} | Stok: ${product.stock}</div>
            </div>
          </div>
        `;
      });
      
      // Event listener untuk select all
      const selectAllCheckbox = document.getElementById('selectAllPrint');
      if (selectAllCheckbox) {
        selectAllCheckbox.onchange = (e) => {
          document.querySelectorAll('.print-product-checkbox').forEach(cb => {
            cb.checked = e.target.checked;
          });
        };
      }
      
      document.getElementById('printBarcodeModal').style.display = 'block';
    })
    .catch(error => {
      console.error('Error loading products for print:', error);
      alert('Gagal memuat data produk');
    });
}

// Cetak barcode massal
async function printBarcodes() {
  const checkboxes = document.querySelectorAll('.print-product-checkbox:checked');
  const productIds = Array.from(checkboxes).map(cb => parseInt(cb.dataset.id));
  const copies = parseInt(document.getElementById('printCopies').value);
  
  if (productIds.length === 0) {
    alert('⚠️ Pilih minimal 1 produk untuk dicetak!');
    return;
  }
  
  if (isNaN(copies) || copies < 1) {
    alert('⚠️ Jumlah copy harus minimal 1!');
    return;
  }
  
  try {
    const response = await fetch('/api/print-barcode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productIds: productIds,
        copiesPerProduct: copies
      })
    });
    
    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'barcode-produk.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      alert(`✅ Berhasil mencetak ${productIds.length} produk dengan ${copies} copy masing-masing!`);
      closePrintModal();
    } else {
      const error = await response.json();
      alert(`❌ Gagal mencetak: ${error.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error printing barcodes:', error);
    alert('❌ Gagal terhubung ke server');
  }
}

function closePrintModal() {
  document.getElementById('printBarcodeModal').style.display = 'none';
  selectedPrintProducts = [];
}

// ============ UPDATE LOADPRODUCTS FUNCTION ============
// Update fungsi loadProducts untuk menampilkan checkbox dan tombol cetak
async function loadProducts() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("Gagal mengambil data");
    const products = await res.json();
    const container = document.getElementById("productsContainer");
    
    if (products.length === 0) {
      container.innerHTML = '<div class="loading">Belum ada produk. Silakan tambah produk pertama!</div>';
      return;
    }
    
    container.innerHTML = "";
    
    products.forEach(prod => {
      const card = document.createElement("div");
      card.className = "card";
      
      const barcodeId = `barcode-${prod.id}-${Date.now()}`;
      
      card.innerHTML = `
        <div class="card-select">
          <div class="product-checkbox">
            <input type="checkbox" class="product-select-cb" data-id="${prod.id}" onclick="event.stopPropagation()">
          </div>
          <div style="flex:1">
            <h3>🏷️ ${escapeHtml(prod.name)}</h3>
            <p>💰 Harga: Rp ${prod.price.toLocaleString('id-ID')}</p>
            <p>📦 Stok: ${prod.stock} pcs</p>
            <p>🆔 ID Produk: ${prod.id}</p>
            <div class="barcode">
              <svg id="${barcodeId}"></svg>
            </div>
            <div class="card-actions">
              <button class="edit-btn" onclick="event.stopPropagation(); openEditModal(${prod.id}, '${escapeHtml(prod.name)}', ${prod.price}, ${prod.stock})">✏️ Edit</button>
              <button class="delete-btn" onclick="event.stopPropagation(); deleteProduct(${prod.id}, '${escapeHtml(prod.name)}')">🗑️ Hapus</button>
              <button class="print-barcode-btn" onclick="event.stopPropagation(); openPrintBarcodeModal([${prod.id}])">🖨️ Cetak Barcode</button>
            </div>
          </div>
        </div>
      `;
      
      // Klik pada card (selain checkbox dan tombol) untuk tambah ke keranjang
      card.addEventListener('click', (e) => {
        if (!e.target.classList.contains('product-select-cb') && 
            !e.target.classList.contains('edit-btn') && 
            !e.target.classList.contains('delete-btn') &&
            !e.target.classList.contains('print-barcode-btn')) {
          addToCart(prod);
        }
      });
      
      container.appendChild(card);
      
      setTimeout(() => {
        try {
          JsBarcode(`#${barcodeId}`, `${prod.id}-${prod.name}`, {
            format: "CODE128",
            lineColor: "#000000",
            width: 1.2,
            height: 40,
            displayValue: true,
            fontSize: 12,
            margin: 5
          });
        } catch(e) {
          console.error("Gagal generate barcode:", e);
        }
      }, 10);
    });
  } catch (error) {
    console.error("Error loading products:", error);
    document.getElementById("productsContainer").innerHTML = 
      '<div class="loading" style="color:#ff6666">❌ Gagal memuat produk. Pastikan server backend berjalan di port 5000</div>';
  }
}

// Cetak multiple produk yang dipilih
function printSelectedProducts() {
  const selectedCheckboxes = document.querySelectorAll('.product-select-cb:checked');
  const selectedIds = Array.from(selectedCheckboxes).map(cb => parseInt(cb.dataset.id));
  
  if (selectedIds.length === 0) {
    alert('⚠️ Pilih minimal 1 produk yang akan dicetak barcode-nya!');
    return;
  }
  
  openPrintBarcodeModal(selectedIds);
}

// Event listener untuk tombol cetak massal
document.addEventListener('DOMContentLoaded', () => {
  const printMultipleBtn = document.getElementById('printMultipleBtn');
  if (printMultipleBtn) {
    printMultipleBtn.addEventListener('click', printSelectedProducts);
  }
  
  // Print modal event listeners
  const confirmPrintBtn = document.getElementById('confirmPrintBtn');
  const cancelPrintBtn = document.getElementById('cancelPrintBtn');
  const closePrintModalBtn = document.querySelector('.close-print-modal');
  
  if (confirmPrintBtn) confirmPrintBtn.addEventListener('click', printBarcodes);
  if (cancelPrintBtn) cancelPrintBtn.addEventListener('click', closePrintModal);
  if (closePrintModalBtn) closePrintModalBtn.addEventListener('click', closePrintModal);
  
  // Close modal when clicking outside
  window.onclick = function(event) {
    const printModal = document.getElementById('printBarcodeModal');
    if (event.target === printModal) {
      closePrintModal();
    }
  };
});

// Export functions
window.openPrintBarcodeModal = openPrintBarcodeModal;
window.printSelectedProducts = printSelectedProducts;
window.closePrintModal = closePrintModal;

// ============ PWA & OFFLINE FUNCTIONS ============

// Check online/offline status
function initOfflineDetection() {
  function updateOnlineStatus() {
    const body = document.body;
    const indicator = document.getElementById('offlineIndicator');
    
    if (!navigator.onLine) {
      body.classList.add('offline-mode');
      if (!indicator) {
        const div = document.createElement('div');
        div.id = 'offlineIndicator';
        div.className = 'offline-indicator';
        div.innerHTML = '📡 Mode Offline - Data mungkin tidak lengkap';
        document.body.appendChild(div);
      }
      showNotification('Anda sedang offline! Beberapa fitur mungkin terbatas.', 'warning');
    } else {
      body.classList.remove('offline-mode');
      if (indicator) indicator.remove();
      showNotification('Koneksi kembali online!', 'success');
      
      // Refresh data when back online
      loadProducts();
      if (typeof loadMembers === 'function') loadMembers();
    }
  }
  
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();
}

// Request notification permission
async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('Browser tidak support notifikasi');
    return false;
  }
  
  if (Notification.permission === 'granted') {
    return true;
  }
  
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  
  return false;
}

// Show notification
function showNotification(message, type = 'info') {
  if (document.visibilityState === 'visible') {
    // If page is visible, use toast
    const toast = document.createElement('div');
    toast.className = `hardware-notification ${type}`;
    toast.innerHTML = `
      <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}</span>
      <span>${message}</span>
      <button class="close-notif" onclick="this.parentElement.remove()">✖</button>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  } else {
    // If page is hidden, use push notification
    if (Notification.permission === 'granted') {
      navigator.serviceWorker.ready.then(registration => {
        registration.showNotification('KIOS IRON', {
          body: message,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-96.png',
          vibrate: [200, 100, 200]
        });
      });
    }
  }
}

// Send test notification
async function sendTestNotification() {
  const granted = await requestNotificationPermission();
  if (granted) {
    showNotification('Notifikasi berhasil! KIOS IRON siap digunakan.', 'success');
  } else {
    alert('Izinkan notifikasi untuk mendapatkan update terbaru');
  }
}

// Initialize PWA features
function initPWA() {
  initOfflineDetection();
  
  // Request notification permission after login
  setTimeout(() => {
    if (localStorage.getItem('notifications_requested') !== 'true') {
      requestNotificationPermission();
      localStorage.setItem('notifications_requested', 'true');
    }
  }, 5000);
}

// Call initPWA when page loads
document.addEventListener('DOMContentLoaded', () => {
  initPWA();
});