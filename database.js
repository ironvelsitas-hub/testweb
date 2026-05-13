const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

const db = new sqlite3.Database(path.join(__dirname, 'kios.db'));

// Hash password function
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

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

  // Tabel users (untuk login system)
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

  // Insert contoh user jika kosong
  db.get(`SELECT COUNT(*) as count FROM users`, (err, row) => {
    if (err) {
      console.error("Error checking users:", err.message);
      return;
    }
    if (row.count === 0) {
      const insert = db.prepare(`INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)`);
      insert.run("admin", hashPassword("admin123"), "Administrator", "ADMIN");
      insert.run("kasir1", hashPassword("kasir123"), "Budi Kasir", "CASHIER");
      insert.run("gudang1", hashPassword("gudang123"), "Siti Gudang", "WAREHOUSE");
      insert.finalize();
      console.log("✅ Contoh user telah ditambahkan (admin/admin123, kasir1/kasir123, gudang1/gudang123)");
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

module.exports = db;
module.exports.hashPassword = hashPassword;