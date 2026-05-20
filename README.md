# 💳 PayVault – Smart Digital Wallet & Payment Management System

> NxtWave Full Stack Development – Set 5, Project 19

## 🏗️ Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | ReactJS (component-based) |
| Backend | Node.js + Express.js |
| Database | SQLite (via `sqlite3` npm package) |
| Auth | JWT (JSON Web Tokens) + bcryptjs |

---

## ✨ Features Implemented

### Authentication
- [x] User Registration (name, email, password)
- [x] User Login with JWT token
- [x] Protected routes (token-based auth)

### Wallet
- [x] Wallet auto-created on registration (₹1,000 welcome bonus)
- [x] View current balance
- [x] Add money to wallet

### Transactions
- [x] Send money to any registered user by email
- [x] Transaction categories (Food, Travel, Shopping, etc.)
- [x] Notes for each transaction
- [x] Full transaction history
- [x] Filter by type and category
- [x] Real-time balance deduction/credit

### Payment Requests
- [x] Request money from another user
- [x] Approve incoming payment requests
- [x] Reject incoming payment requests
- [x] View all outgoing/incoming requests with status

### Dashboard & Analytics
- [x] Total balance overview
- [x] Total sent / received / transaction count
- [x] Spending breakdown by category (with progress bars)
- [x] Recent transactions list

---

## 🚀 How to Run

### Option A: Open Frontend Directly (No server needed)
1. Open `frontend/index.html` in any modern browser
2. Register an account and start using the wallet
3. All data persists in browser localStorage

### Option B: Full Stack (Backend + Frontend)

#### Backend Setup
```bash
cd backend
npm install
node server.js
# Server runs on http://localhost:5000
```

#### Frontend Setup
```bash
cd frontend
npm install
npm start
# App runs on http://localhost:3000
```

---

## 📁 Project Structure
```
wallet-project/
├── backend/
│   ├── server.js          # Express server with all API routes
│   ├── package.json
│   └── wallet.db          # SQLite DB (auto-created on first run)
│
└── frontend/
    ├── index.html          # Standalone React app (no build needed)
    └── src/
        ├── App.jsx
        ├── components/
        │   ├── Auth/
        │   ├── Dashboard/
        │   ├── Transfer/
        │   ├── Transactions/
        │   ├── PaymentRequests/
        │   └── Profile/
        └── api/
            └── api.js     # Axios API calls to backend
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/register` | Register new user | ❌ |
| POST | `/api/login` | Login & get JWT | ❌ |
| GET | `/api/wallet` | Get wallet balance | ✅ |
| POST | `/api/wallet/add-money` | Add money to wallet | ✅ |
| POST | `/api/transfer` | Transfer to another user | ✅ |
| GET | `/api/transactions` | Get transaction history | ✅ |
| POST | `/api/payment-requests` | Create payment request | ✅ |
| GET | `/api/payment-requests` | Get all payment requests | ✅ |
| PUT | `/api/payment-requests/:id/approve` | Approve request | ✅ |
| PUT | `/api/payment-requests/:id/reject` | Reject request | ✅ |
| GET | `/api/stats` | Get wallet statistics | ✅ |

---

## 📸 App Pages
1. **Auth Page** – Login / Register with form validation
2. **Dashboard** – Balance card, stats, recent transactions, category chart
3. **Send Money** – Transfer with recipient email, amount, category, note
4. **Transaction History** – Full list with type/category filters
5. **Payment Requests** – Incoming (approve/reject) and outgoing requests
6. **Profile** – User info, stats, and logout

---

## 👨‍💻 Submitted By
NxtWave Full Stack Development Student  
Project: Smart Digital Wallet & Payment Management System  
Set: 5 | Project: 19
