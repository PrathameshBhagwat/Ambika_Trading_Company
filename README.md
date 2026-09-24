# Ambika Trading — Farmer Settlement Management System

**अंबिका ट्रेडिंग — शेतकरी हिशोब व पट्टी व्यवस्थापन प्रणाली**

An offline Windows desktop application purpose-built for vegetable commission agents and brokers receiving produce directly from farmers.

---

## 🎯 Business Context

- **Broker / Commission Agent Role**: Ambika Trading operates as a vegetable commission agent. Farmers bring their vegetables (Tomato, Onion, Potato, Brinjal, Cabbage, etc.) to the trading floor.
- **Scope**: Exclusively handles the **farmer-side transaction, deductions, settlement bill generation, and payment lifecycle**.
- **Out of Scope**: Merchant wholesale, retail POS, customer receivables, retail inventory.

---

## ⚙️ Core Business Formulas

1. **Line Item Amount**:
   $$\text{Item Amount} = \left(\frac{\text{Total Weight (KG)}}{10}\right) \times \text{Rate per 10 KG}$$
2. **Gross Amount**:
   $$\text{Gross Amount} = \sum \text{Item Amounts}$$
3. **Total Deductions**:
   $$\text{Total Deductions} = \text{Hamali} + \text{Bharai} + \text{Tolai} + \text{Mapai} + \text{Lekki} + \text{Motor Bhada} + \text{Other Deductions}$$
   *(Deductions are **strictly subtracted** from Gross Amount — never added)*
4. **Net Payable**:
   $$\text{Net Payable} = \text{Gross Amount} - \text{Total Deductions}$$
5. **Balance Due**:
   $$\text{Balance Due} = \text{Net Payable} - \text{Total Paid}$$

---

## 🏗️ Architecture

```
AmbikaTrading/
├── electron/              # Electron main process & IPC context bridge
│   ├── main.cjs           # Window management, print handlers, lifecycle
│   ├── preload.cjs        # Safe IPC Context Bridge (window.electronAPI)
│   └── backend-manager.cjs# Background process manager for FastAPI
├── backend/               # Python FastAPI backend
│   ├── main.py            # API entry point & lifecycle hooks (Port 8741)
│   ├── database.py        # SQLAlchemy SQLite engine with WAL mode
│   ├── models/            # Farmer, Vegetable, Transaction, Deduction, Payment, Audit, Settings
│   ├── schemas/           # Pydantic v2 schemas
│   ├── routers/           # REST endpoints
│   ├── utils/             # calculations.py, bill_generator.py, seed_data.py
│   └── tests/             # pytest calculation & API test suites
└── frontend/              # React 19 + TypeScript + Vite
    ├── src/pages/
    │   ├── Dashboard.tsx               # Daily KPI metrics & recent transactions
    │   ├── farmers/FarmerList.tsx      # Farmer registry & CRUD
    │   ├── farmers/FarmerLedger.tsx    # Individual farmer running ledger & statements
    │   ├── vegetables/VegetableList.tsx# Vegetable master management
    │   ├── transactions/
    │   │   ├── TransactionList.tsx     # Filterable list of settlement bills
    │   │   ├── TransactionForm.tsx     # New settlement bill entry with live math
    │   │   └── TransactionDetail.tsx   # Detailed bill view, print, & cancel
    │   ├── reports/
    │   │   ├── DailySummary.tsx        # Daily intake, turnover & deduction reports
    │   │   └── FarmerOutstanding.tsx   # All unsettled farmer balances
    │   └── settings/BackupRestore.tsx  # Offline SQLite backup, restore, & audit log
    └── src/styles/                     # Bespoke financial dark-mode design system
```

---

## 🚀 Running the Application

### Prerequisites
- **Node.js**: v18+ (v22 recommended)
- **Python**: 3.11+ (Python 3.13 tested)

### 1. Run Development (Backend + Frontend)
```bash
npm run dev
```
- FastAPI backend starts at `http://127.0.0.1:8741`
- Vite frontend starts at `http://localhost:5173`

### 2. Run Desktop App (Electron + Backend + Frontend)
```bash
npm run dev:desktop
```

### 3. Run Backend Unit & Integration Tests
```bash
npm run test:backend
```
*(40 test cases validating calculation rules, overpayment prevention, status transitions, and reporting)*

### 4. Build Production Frontend
```bash
npm run frontend:build
```

---

## 📄 Settlement Bill Printing
Settlement bills can be printed directly using the **"Print Bill / पावती"** button. The document is formatted to automatically print on standard desktop receipt/printer settings (A5 or A4) with Marathi and English labels, line items, itemized deductions, totals, balance due, and signature blocks.
