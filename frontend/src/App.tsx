/**
 * Ambika Trading — Application Shell
 *
 * Main layout with sidebar navigation and routed content area.
 * This is the root component that defines the application structure.
 */

import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import FarmerList from './pages/farmers/FarmerList';
import FarmerLedger from './pages/farmers/FarmerLedger';
import VegetableList from './pages/vegetables/VegetableList';
import TransactionList from './pages/transactions/TransactionList';
import TransactionForm from './pages/transactions/TransactionForm';
import TransactionDetail from './pages/transactions/TransactionDetail';
import DailySummaryReport from './pages/reports/DailySummary';
import FarmerOutstandingReport from './pages/reports/FarmerOutstanding';
import PaymentSummary from './pages/reports/PaymentSummary';
import BackupRestore from './pages/settings/BackupRestore';
import './App.css';

function App() {
  return (
    <div className="app-layout">
      {/* ── Sidebar ── */}
      <aside className="app-sidebar no-print">
        <div className="sidebar-brand">
          <h1>🌿 Ambika Trading</h1>
          <p>Farmer Settlement System</p>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section">
            <div className="sidebar-section-title">Overview</div>
            <NavLink
              to="/"
              end
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <span className="icon">📊</span>
              Dashboard
            </NavLink>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-title">Operations</div>
            <NavLink
              to="/transactions"
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <span className="icon">📋</span>
              Transactions
            </NavLink>
            <NavLink
              to="/transactions/new"
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <span className="icon">✍️</span>
              New Settlement
            </NavLink>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-title">Masters</div>
            <NavLink
              to="/farmers"
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <span className="icon">👨‍🌾</span>
              Farmers
            </NavLink>
            <NavLink
              to="/vegetables"
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <span className="icon">🥬</span>
              Vegetables
            </NavLink>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-title">Reports</div>
            <NavLink
              to="/reports/daily"
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <span className="icon">📅</span>
              Daily Summary
            </NavLink>
            <NavLink
              to="/reports/outstanding"
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <span className="icon">💰</span>
              Outstanding
            </NavLink>
            <NavLink
              to="/reports/payments"
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <span className="icon">💳</span>
              Payment Summary
            </NavLink>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-title">System</div>
            <NavLink
              to="/settings/backup"
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <span className="icon">💾</span>
              Backup & Audit
            </NavLink>
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-version">v1.0.0 · Offline Desktop</div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="app-main">
        <div className="app-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/farmers" element={<FarmerList />} />
            <Route path="/farmers/:id" element={<FarmerLedger />} />
            <Route path="/vegetables" element={<VegetableList />} />
            <Route path="/transactions" element={<TransactionList />} />
            <Route path="/transactions/new" element={<TransactionForm />} />
            <Route path="/transactions/edit/:id" element={<TransactionForm />} />
            <Route path="/transactions/:id" element={<TransactionDetail />} />
            <Route path="/reports/daily" element={<DailySummaryReport />} />
            <Route path="/reports/outstanding" element={<FarmerOutstandingReport />} />
            <Route path="/reports/payments" element={<PaymentSummary />} />
            <Route path="/settings/backup" element={<BackupRestore />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default App;
