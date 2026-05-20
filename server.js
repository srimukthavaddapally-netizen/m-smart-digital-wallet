const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 5000;
const JWT_SECRET = 'wallet_secret_key_2024';

app.use(cors());
app.use(express.json());

// ─── DATABASE SETUP ───────────────────────────────────────────────────────────
const db = new sqlite3.Database('./wallet.db', (err) => {
  if (err) console.error(err.message);
  else console.log('Connected to SQLite database.');
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS wallets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    balance REAL DEFAULT 0,
    currency TEXT DEFAULT 'INR',
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER,
    receiver_id INTEGER,
    amount REAL NOT NULL,
    type TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    note TEXT,
    status TEXT DEFAULT 'completed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS payment_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requester_id INTEGER NOT NULL,
    payer_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    note TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (requester_id) REFERENCES users(id),
    FOREIGN KEY (payer_id) REFERENCES users(id)
  )`);
});

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ─── AUTH ROUTES ──────────────────────────────────────────────────────────────
app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'All fields required' });

  const hashed = await bcrypt.hash(password, 10);
  db.run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
    [name, email, hashed],
    function (err) {
      if (err) return res.status(400).json({ error: 'Email already registered' });
      const userId = this.lastID;
      db.run('INSERT INTO wallets (user_id, balance) VALUES (?, ?)', [userId, 1000], (err2) => {
        if (err2) return res.status(500).json({ error: 'Wallet creation failed' });
        const token = jwt.sign({ id: userId, email, name }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: userId, name, email } });
      });
    }
  );
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err || !user) return res.status(400).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  });
});

// ─── WALLET ROUTES ────────────────────────────────────────────────────────────
app.get('/api/wallet', authenticate, (req, res) => {
  db.get('SELECT * FROM wallets WHERE user_id = ?', [req.user.id], (err, wallet) => {
    if (err || !wallet) return res.status(404).json({ error: 'Wallet not found' });
    res.json(wallet);
  });
});

app.post('/api/wallet/add-money', authenticate, (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

  db.run('UPDATE wallets SET balance = balance + ? WHERE user_id = ?', [amount, req.user.id], function (err) {
    if (err) return res.status(500).json({ error: 'Failed to add money' });
    db.run(
      'INSERT INTO transactions (receiver_id, amount, type, note) VALUES (?, ?, ?, ?)',
      [req.user.id, amount, 'credit', 'Added to wallet'],
      () => res.json({ message: 'Money added successfully' })
    );
  });
});

// ─── TRANSFER ROUTES ──────────────────────────────────────────────────────────
app.post('/api/transfer', authenticate, (req, res) => {
  const { to_email, amount, note, category } = req.body;
  if (!to_email || !amount || amount <= 0)
    return res.status(400).json({ error: 'Invalid transfer details' });

  db.get('SELECT * FROM users WHERE email = ?', [to_email], (err, receiver) => {
    if (err || !receiver) return res.status(404).json({ error: 'Recipient not found' });
    if (receiver.id === req.user.id) return res.status(400).json({ error: 'Cannot transfer to yourself' });

    db.get('SELECT * FROM wallets WHERE user_id = ?', [req.user.id], (err2, senderWallet) => {
      if (err2 || !senderWallet) return res.status(500).json({ error: 'Sender wallet not found' });
      if (senderWallet.balance < amount) return res.status(400).json({ error: 'Insufficient balance' });

      db.run('UPDATE wallets SET balance = balance - ? WHERE user_id = ?', [amount, req.user.id], (err3) => {
        if (err3) return res.status(500).json({ error: 'Transfer failed' });
        db.run('UPDATE wallets SET balance = balance + ? WHERE user_id = ?', [amount, receiver.id], (err4) => {
          if (err4) return res.status(500).json({ error: 'Transfer failed' });
          db.run(
            'INSERT INTO transactions (sender_id, receiver_id, amount, type, category, note) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, receiver.id, amount, 'transfer', category || 'General', note || ''],
            () => res.json({ message: 'Transfer successful' })
          );
        });
      });
    });
  });
});

// ─── TRANSACTIONS ROUTES ──────────────────────────────────────────────────────
app.get('/api/transactions', authenticate, (req, res) => {
  const { page = 1, limit = 10, type, category, start_date, end_date } = req.query;
  const offset = (page - 1) * limit;
  let conditions = ['(t.sender_id = ? OR t.receiver_id = ?)'];
  let params = [req.user.id, req.user.id];

  if (type) { conditions.push('t.type = ?'); params.push(type); }
  if (category) { conditions.push('t.category = ?'); params.push(category); }
  if (start_date) { conditions.push('t.created_at >= ?'); params.push(start_date); }
  if (end_date) { conditions.push('t.created_at <= ?'); params.push(end_date); }

  const where = conditions.join(' AND ');
  const query = `
    SELECT t.*, 
      s.name as sender_name, s.email as sender_email,
      r.name as receiver_name, r.email as receiver_email
    FROM transactions t
    LEFT JOIN users s ON t.sender_id = s.id
    LEFT JOIN users r ON t.receiver_id = r.id
    WHERE ${where}
    ORDER BY t.created_at DESC
    LIMIT ? OFFSET ?
  `;
  params.push(parseInt(limit), offset);

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch transactions' });
    res.json(rows);
  });
});

// ─── PAYMENT REQUEST ROUTES ───────────────────────────────────────────────────
app.post('/api/payment-requests', authenticate, (req, res) => {
  const { payer_email, amount, note } = req.body;
  db.get('SELECT * FROM users WHERE email = ?', [payer_email], (err, payer) => {
    if (err || !payer) return res.status(404).json({ error: 'User not found' });
    db.run(
      'INSERT INTO payment_requests (requester_id, payer_id, amount, note) VALUES (?, ?, ?, ?)',
      [req.user.id, payer.id, amount, note || ''],
      function (err2) {
        if (err2) return res.status(500).json({ error: 'Failed to create request' });
        res.json({ message: 'Payment request sent', id: this.lastID });
      }
    );
  });
});

app.get('/api/payment-requests', authenticate, (req, res) => {
  const query = `
    SELECT pr.*, 
      req.name as requester_name, req.email as requester_email,
      pay.name as payer_name, pay.email as payer_email
    FROM payment_requests pr
    JOIN users req ON pr.requester_id = req.id
    JOIN users pay ON pr.payer_id = pay.id
    WHERE pr.requester_id = ? OR pr.payer_id = ?
    ORDER BY pr.created_at DESC
  `;
  db.all(query, [req.user.id, req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch requests' });
    res.json(rows);
  });
});

app.put('/api/payment-requests/:id/approve', authenticate, (req, res) => {
  db.get('SELECT * FROM payment_requests WHERE id = ? AND payer_id = ? AND status = "pending"',
    [req.params.id, req.user.id], (err, request) => {
      if (err || !request) return res.status(404).json({ error: 'Request not found' });

      db.get('SELECT * FROM wallets WHERE user_id = ?', [req.user.id], (err2, wallet) => {
        if (wallet.balance < request.amount) return res.status(400).json({ error: 'Insufficient balance' });

        db.run('UPDATE wallets SET balance = balance - ? WHERE user_id = ?', [request.amount, req.user.id], () => {
          db.run('UPDATE wallets SET balance = balance + ? WHERE user_id = ?', [request.amount, request.requester_id], () => {
            db.run('UPDATE payment_requests SET status = "approved" WHERE id = ?', [request.id], () => {
              db.run(
                'INSERT INTO transactions (sender_id, receiver_id, amount, type, note) VALUES (?, ?, ?, ?, ?)',
                [req.user.id, request.requester_id, request.amount, 'transfer', `Payment request: ${request.note}`],
                () => res.json({ message: 'Payment approved' })
              );
            });
          });
        });
      });
    }
  );
});

app.put('/api/payment-requests/:id/reject', authenticate, (req, res) => {
  db.run('UPDATE payment_requests SET status = "rejected" WHERE id = ? AND payer_id = ?',
    [req.params.id, req.user.id], function (err) {
      if (err || this.changes === 0) return res.status(404).json({ error: 'Request not found' });
      res.json({ message: 'Payment request rejected' });
    }
  );
});

// ─── STATS ROUTE ──────────────────────────────────────────────────────────────
app.get('/api/stats', authenticate, (req, res) => {
  const userId = req.user.id;
  const queries = {
    totalSent: `SELECT COALESCE(SUM(amount),0) as val FROM transactions WHERE sender_id = ? AND type='transfer'`,
    totalReceived: `SELECT COALESCE(SUM(amount),0) as val FROM transactions WHERE receiver_id = ? AND type IN ('transfer','credit')`,
    txCount: `SELECT COUNT(*) as val FROM transactions WHERE sender_id = ? OR receiver_id = ?`,
    byCategory: `SELECT category, SUM(amount) as total FROM transactions WHERE sender_id = ? GROUP BY category`,
  };

  Promise.all([
    new Promise(r => db.get(queries.totalSent, [userId], (e, row) => r(row?.val || 0))),
    new Promise(r => db.get(queries.totalReceived, [userId], (e, row) => r(row?.val || 0))),
    new Promise(r => db.get(queries.txCount, [userId, userId], (e, row) => r(row?.val || 0))),
    new Promise(r => db.all(queries.byCategory, [userId], (e, rows) => r(rows || []))),
  ]).then(([totalSent, totalReceived, txCount, byCategory]) => {
    res.json({ totalSent, totalReceived, txCount, byCategory });
  });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
