const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const bwipjs = require('bwip-js');

// Database module
const sqlite3 = require('sqlite3').verbose();

// Hash password sederhana
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Setup database
const db = new sqlite3.Database(path.join(__dirname, 'kios.db'));

db.serialize(() => {
  // Tabel products
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      stock INTEGER NOT NULL
    )
  `);

  // Tabel members
  db.run(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      points INTEGER DEFAULT 0,
      total_spent INTEGER DEFAULT 0,
      join_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      tier TEXT DEFAULT 'REGULAR'
    )
  `);

  // Tabel users BARU untuk login system
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'CASHIER',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    )
  `);

  // Tabel transaksi
  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_code TEXT UNIQUE NOT NULL,
      member_id INTEGER,
      user_id INTEGER,
      total_amount INTEGER NOT NULL,
      points_earned INTEGER DEFAULT 0,
      payment_method TEXT,
      transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (member_id) REFERENCES members(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Tabel reward
  db.run(`
    CREATE TABLE IF NOT EXISTS rewards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      points_required INTEGER NOT NULL,
      reward_type TEXT NOT NULL,
      discount_value INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1
    )
  `);

  // Tabel penukaran reward
  db.run(`
    CREATE TABLE IF NOT EXISTS reward_redemptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER,
      reward_id INTEGER,
      points_used INTEGER,
      redemption_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'COMPLETED',
      FOREIGN KEY (member_id) REFERENCES members(id),
      FOREIGN KEY (reward_id) REFERENCES rewards(id)
    )
  `);

  // Insert default users jika kosong
  db.get(`SELECT COUNT(*) as count FROM users`, (err, row) => {
    if (err) {
      console.error("Error checking users:", err.message);
      return;
    }
    if (row.count === 0) {
      const insert = db.prepare(`INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)`);
      insert.run("admin", hashPassword("admin123"), "Administrator", "ADMIN");
      insert.run("kasir1", hashPassword("kasir123"), "Budi Kasir", "CASHIER");
      insert.run("gudang1", hashPassword("gudang123"), "Ahmad Gudang", "WAREHOUSE");
      insert.finalize();
      console.log("✅ Contoh users telah ditambahkan:");
      console.log("   Admin    - username: admin, password: admin123");
      console.log("   Kasir    - username: kasir1, password: kasir123");
      console.log("   Gudang   - username: gudang1, password: gudang123");
    }
  });

  // Insert contoh member jika kosong
  db.get(`SELECT COUNT(*) as count FROM members`, (err, row) => {
    if (err) {
      console.error("Error checking members:", err.message);
      return;
    }
    if (row.count === 0) {
      const insert = db.prepare(`INSERT INTO members (member_code, name, phone, points) VALUES (?, ?, ?, ?)`);
      insert.run("M001", "Budi Santoso", "08123456789", 150);
      insert.run("M002", "Siti Aminah", "08198765432", 75);
      insert.run("M003", "Ahmad Fauzi", "08567891234", 320);
      insert.finalize();
      console.log("✅ Contoh member telah ditambahkan");
    }
  });

  // Insert contoh reward jika kosong
  db.get(`SELECT COUNT(*) as count FROM rewards`, (err, row) => {
    if (err) {
      console.error("Error checking rewards:", err.message);
      return;
    }
    if (row.count === 0) {
      const insert = db.prepare(`INSERT INTO rewards (name, points_required, reward_type, discount_value) VALUES (?, ?, ?, ?)`);
      insert.run("Voucher Diskon 10%", 100, "VOUCHER", 10);
      insert.run("Voucher Diskon Rp 10.000", 200, "VOUCHER", 10000);
      insert.run("Diskon Rp 20.000", 350, "DISCOUNT", 20000);
      insert.run("Gratis 1 Produk (max Rp 15.000)", 500, "FREE_PRODUCT", 15000);
      insert.run("Voucher Diskon 25% (max Rp 50.000)", 750, "VOUCHER", 25);
      insert.finalize();
      console.log("✅ Contoh reward telah ditambahkan");
    }
  });
});

const app = express();
app.use(cors());
app.use(express.json());

// Serve file frontend statis
app.use(express.static(path.join(__dirname, '../frontend')));

// ============ API AUTH / LOGIN ============
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: "Username dan password harus diisi" });
  }
  
  const hashedPassword = hashPassword(password);
  
  db.get(`SELECT id, username, name, role, is_active FROM users WHERE username = ? AND password = ? AND is_active = 1`, 
    [username, hashedPassword], 
    (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!user) return res.status(401).json({ error: "Username atau password salah" });
      
      // Update last_login
      db.run(`UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?`, [user.id]);
      
      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role
        }
      });
    });
});

app.post('/api/logout', (req, res) => {
  res.json({ success: true });
});

// ============ API USERS (Admin only) ============
app.get('/api/users', (req, res) => {
  db.all(`SELECT id, username, name, role, is_active, created_at, last_login FROM users ORDER BY id`, 
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
});

app.post('/api/users', (req, res) => {
  const { username, password, name, role } = req.body;
  
  if (!username || !password || !name) {
    return res.status(400).json({ error: "Semua field harus diisi" });
  }
  
  const hashedPassword = hashPassword(password);
  const userRole = role || 'CASHIER';
  
  db.run(`INSERT INTO users (username, password, name, role, is_active) VALUES (?, ?, ?, ?, 1)`,
    [username, hashedPassword, name, userRole],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, username, name, role: userRole });
    });
});

app.put('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const { name, role, is_active } = req.body;
  
  db.run(`UPDATE users SET name = ?, role = ?, is_active = ? WHERE id = ?`,
    [name, role, is_active, id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
});

app.delete('/api/users/:id', (req, res) => {
  const { id } = req.params;
  
  db.run(`DELETE FROM users WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ============ API PRODUCTS ============
app.get('/api/products', (req, res) => {
  db.all(`SELECT * FROM products ORDER BY id DESC`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/products/search', (req, res) => {
  const { barcode } = req.query;
  if (!barcode) return res.status(400).json({ error: "Barcode tidak boleh kosong" });
  
  const match = barcode.match(/^(\d+)-/);
  if (match) {
    const productId = match[1];
    db.get(`SELECT * FROM products WHERE id = ?`, [productId], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (row) res.json(row);
      else res.status(404).json({ error: "Produk tidak ditemukan" });
    });
  } else {
    db.all(`SELECT * FROM products WHERE name LIKE ?`, [`%${barcode}%`], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length > 0) res.json(rows[0]);
      else res.status(404).json({ error: "Produk tidak ditemukan" });
    });
  }
});

app.put('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const { name, price, stock } = req.body;
  
  if (!name || !price || !stock) {
    return res.status(400).json({ error: "Semua field harus diisi" });
  }
  
  db.run(`UPDATE products SET name = ?, price = ?, stock = ? WHERE id = ?`,
    [name, price, stock, id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "Produk tidak ditemukan" });
      res.json({ success: true, id, name, price, stock });
    });
});

app.delete('/api/products/:id', (req, res) => {
  const { id } = req.params;
  
  db.run(`DELETE FROM products WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "Produk tidak ditemukan" });
    res.json({ success: true, message: "Produk berhasil dihapus" });
  });
});

app.patch('/api/products/:id/stock', (req, res) => {
  const { id } = req.params;
  const { stock } = req.body;
  
  if (stock === undefined || stock < 0) {
    return res.status(400).json({ error: "Stok tidak valid" });
  }
  
  db.run(`UPDATE products SET stock = ? WHERE id = ?`, [stock, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "Produk tidak ditemukan" });
    res.json({ success: true, id, stock });
  });
});

app.post('/api/products', (req, res) => {
  const { name, price, stock } = req.body;
  if (!name || !price || !stock) {
    return res.status(400).json({ error: "Semua field harus diisi" });
  }
  
  db.run(`INSERT INTO products (name, price, stock) VALUES (?, ?, ?)`,
    [name, price, stock],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, name, price, stock });
    });
});

// ============ API CETAK BARCODE ============
app.post('/api/print-barcode', async (req, res) => {
  const { productIds, copiesPerProduct } = req.body;
  
  if (!productIds || productIds.length === 0) {
    return res.status(400).json({ error: "Pilih minimal 1 produk" });
  }
  
  const placeholders = productIds.map(() => '?').join(',');
  db.all(`SELECT * FROM products WHERE id IN (${placeholders})`, productIds, async (err, products) => {
    if (err) return res.status(500).json({ error: err.message });
    if (products.length === 0) return res.status(404).json({ error: "Produk tidak ditemukan" });
    
    const doc = new PDFDocument({ autoFirstPage: false, margin: 0 });
    const chunks = [];
    
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="barcode-produk.pdf"');
      res.send(pdfBuffer);
    });
    
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const labelWidth = 260;
    const labelHeight = 150;
    const marginX = (pageWidth - (labelWidth * 2)) / 3;
    const marginY = 40;
    
    let currentRow = 0;
    let currentCol = 0;
    let isFirstPage = true;
    
    for (let product of products) {
      const copies = copiesPerProduct || 1;
      
      for (let c = 0; c < copies; c++) {
        if (currentRow === 0 && currentCol === 0 && !isFirstPage) {
          doc.addPage();
        } else if (isFirstPage) {
          doc.addPage();
          isFirstPage = false;
        }
        
        const x = marginX + currentCol * (labelWidth + marginX);
        const y = marginY + currentRow * (labelHeight + 20);
        
        doc.rect(x, y, labelWidth, labelHeight).stroke();
        doc.fontSize(12).fillColor('#000000').text(product.name, x + 10, y + 10, { width: labelWidth - 20, align: 'center' });
        doc.fontSize(10).fillColor('#000000').text(`Rp ${product.price.toLocaleString('id-ID')}`, x + 10, y + 32, { width: labelWidth - 20, align: 'center' });
        
        const barcodeData = `${product.id}-${product.name}`;
        
        try {
          const barcodePng = await bwipjs.toBuffer({
            bcid: 'code128',
            text: barcodeData,
            scale: 2,
            height: 10,
            includetext: true,
            textxalign: 'center',
          });
          
          const barcodeY = y + 55;
          const barcodeWidth_bwip = 220;
          const barcodeX = x + (labelWidth - barcodeWidth_bwip) / 2;
          doc.image(barcodePng, barcodeX, barcodeY, { width: barcodeWidth_bwip });
          doc.fontSize(8).fillColor('#666666').text(`ID: ${product.id}`, x + 10, barcodeY + 40, { width: labelWidth - 20, align: 'center' });
        } catch (barcodeErr) {
          doc.fontSize(10).fillColor('#ff0000').text(barcodeData, x + 10, y + 70, { width: labelWidth - 20, align: 'center' });
        }
        
        currentCol++;
        if (currentCol >= 2) { currentCol = 0; currentRow++; }
        if (currentRow >= 4) { currentRow = 0; currentCol = 0; }
      }
    }
    doc.end();
  });
});

// ============ API MEMBERS ============
app.get('/api/members', (req, res) => {
  db.all(`SELECT * FROM members ORDER BY points DESC`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/members/search', (req, res) => {
  const { code, phone, name } = req.query;
  let query = `SELECT * FROM members WHERE 1=1`;
  let params = [];
  
  if (code) { query += ` AND member_code LIKE ?`; params.push(`%${code}%`); }
  if (phone) { query += ` AND phone LIKE ?`; params.push(`%${phone}%`); }
  if (name) { query += ` AND name LIKE ?`; params.push(`%${name}%`); }
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/members', (req, res) => {
  const { name, phone, email } = req.body;
  if (!name) return res.status(400).json({ error: "Nama member harus diisi" });
  
  const memberCode = `M${Date.now()}${Math.floor(Math.random() * 1000)}`;
  
  db.run(`INSERT INTO members (member_code, name, phone, email, points, total_spent) VALUES (?, ?, ?, ?, 0, 0)`,
    [memberCode, name, phone || null, email || null],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, member_code: memberCode, name, phone, email, points: 0 });
    });
});

app.get('/api/members/:id', (req, res) => {
  const { id } = req.params;
  db.get(`SELECT * FROM members WHERE id = ?`, [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Member tidak ditemukan" });
    res.json(row);
  });
});

app.put('/api/members/:id/points', (req, res) => {
  const { id } = req.params;
  const { points, operation } = req.body;
  
  if (!points || !operation) return res.status(400).json({ error: "Points dan operation harus diisi" });
  const operator = operation === 'add' ? '+' : '-';
  
  db.run(`UPDATE members SET points = points ${operator} ? WHERE id = ?`, [points, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ============ API REWARDS ============
app.get('/api/rewards', (req, res) => {
  db.all(`SELECT * FROM rewards WHERE is_active = 1 ORDER BY points_required ASC`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/rewards/history/:memberId', (req, res) => {
  const { memberId } = req.params;
  db.all(`
    SELECT r.*, rr.redemption_date 
    FROM reward_redemptions rr 
    JOIN rewards r ON rr.reward_id = r.id 
    WHERE rr.member_id = ? 
    ORDER BY rr.redemption_date DESC
  `, [memberId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/rewards/redeem', (req, res) => {
  const { memberId, rewardId, pointsRequired } = req.body;
  
  db.serialize(() => {
    db.get(`SELECT points FROM members WHERE id = ?`, [memberId], (err, member) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!member) return res.status(404).json({ error: "Member tidak ditemukan" });
      if (member.points < pointsRequired) return res.status(400).json({ error: "Poin tidak mencukupi" });
      
      db.run(`UPDATE members SET points = points - ? WHERE id = ?`, [pointsRequired, memberId], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.run(`INSERT INTO reward_redemptions (member_id, reward_id, points_used) VALUES (?, ?, ?)`,
          [memberId, rewardId, pointsRequired], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: "Reward berhasil ditukar!" });
          });
      });
    });
  });
});

// ============ API TRANSACTIONS ============
app.post('/api/transactions', (req, res) => {
  const { memberId, totalAmount, pointsEarned, paymentMethod, items, usedDiscount, userId } = req.body;
  const transactionCode = `TRX${Date.now()}${Math.floor(Math.random() * 1000)}`;
  let finalAmount = totalAmount;
  
  if (usedDiscount && usedDiscount > 0) finalAmount = totalAmount - usedDiscount;
  
  db.run(`INSERT INTO transactions (transaction_code, member_id, user_id, total_amount, points_earned, payment_method) VALUES (?, ?, ?, ?, ?, ?)`,
    [transactionCode, memberId || null, userId || null, finalAmount, pointsEarned, paymentMethod],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      if (memberId && pointsEarned > 0) {
        db.run(`UPDATE members SET points = points + ?, total_spent = total_spent + ? WHERE id = ?`,
          [pointsEarned, finalAmount, memberId], (err) => {
            if (err) console.error("Error updating member points:", err);
          });
      }
      
      res.json({ success: true, transaction_code: transactionCode, points_earned: pointsEarned, final_amount: finalAmount });
    });
});

app.get('/api/transactions/history/:memberId', (req, res) => {
  const { memberId } = req.params;
  db.all(`SELECT * FROM transactions WHERE member_id = ? ORDER BY transaction_date DESC`, [memberId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ============ PWA PUSH NOTIFICATION ENDPOINTS ============
let pushSubscriptions = [];

app.post('/api/subscribe', (req, res) => {
  const subscription = req.body;
  pushSubscriptions.push(subscription);
  console.log('New push subscription:', subscription);
  res.json({ success: true });
});

app.post('/api/send-notification', (req, res) => {
  const { title, body, url } = req.body;
  
  // Send to all subscribers (would need web-push library)
  console.log(`Notification: ${title} - ${body}`);
  
  res.json({ success: true });
});

// Endpoint to check for low stock and send notification
app.get('/api/check-low-stock', (req, res) => {
  db.all(`SELECT * FROM products WHERE stock <= 5`, (err, products) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (products.length > 0) {
      console.log(`⚠️ Low stock alert: ${products.length} products have low stock`);
    }
    
    res.json({ lowStockProducts: products });
  });
});
// ============ MAIN ROUTE ============
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`🛒 KIOS IRON berjalan di http://localhost:${PORT}`);
  console.log(`📦 API Produk tersedia di http://localhost:${PORT}/api/products`);
  console.log(`👥 API Member tersedia di http://localhost:${PORT}/api/members`);
  console.log(`🎁 API Reward tersedia di http://localhost:${PORT}/api/rewards`);
  console.log(`🔐 API Auth tersedia di http://localhost:${PORT}/api/login`);
  console.log(`🔔 API Push Notification tersedia di http://localhost:${PORT}/api/subscribe`);
});