/**
 * Ambika Trading — Application Shell
 *
 * Main layout with:
 * - Compact green-branded sidebar with bilingual navigation
 * - Top bar with page context, date, and theme toggle
 * - Routed content area
 * - Theme persistence (localStorage)
 */

import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
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

function getPageInfo(pathname: string): { title: string; subtitle: string } {
  if (pathname === '/') return { title: 'Dashboard', subtitle: 'आजचा आढावा — Today\'s Overview' };
  if (pathname === '/transactions/new') return { title: 'नवीन हिशोब पट्टी', subtitle: 'New Farmer Settlement' };
  if (pathname.startsWith('/transactions/edit')) return { title: 'पावती दुरुस्ती', subtitle: 'Edit Settlement Bill' };
  if (pathname.startsWith('/transactions/')) return { title: 'हिशोब पावती', subtitle: 'Settlement Bill Details' };
  if (pathname === '/transactions') return { title: 'Transactions', subtitle: 'सर्व व्यवहार — All Settlements' };
  if (pathname === '/farmers') return { title: 'शेतकरी', subtitle: 'Farmers Directory' };
  if (pathname.startsWith('/farmers/')) return { title: 'शेतकरी खातेवही', subtitle: 'Farmer Ledger' };
  if (pathname === '/vegetables') return { title: 'भाजीपाला', subtitle: 'Vegetable Master' };
  if (pathname === '/reports/daily') return { title: 'दैनिक सारांश', subtitle: 'Daily Summary Report' };
  if (pathname === '/reports/outstanding') return { title: 'बाकी रक्कम', subtitle: 'Farmer Outstanding' };
  if (pathname === '/reports/payments') return { title: 'पेमेंट सारांश', subtitle: 'Payment Summary' };
  if (pathname === '/settings/backup') return { title: 'बॅकअप', subtitle: 'Backup & Audit' };
  return { title: 'Ambika Trading', subtitle: '' };
}

function App() {
  const location = useLocation();
  const pageInfo = getPageInfo(location.pathname);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('ambika-theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ambika-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));

  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <div className="app-layout">
      {/* ── Sidebar ── */}
      <aside className="app-sidebar no-print">
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">🌿</div>
          <div>
            <h1>Ambika Trading</h1>
            <p>Farmer Settlement System</p>
          </div>
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
              to="/transactions/new"
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <span className="icon">✍️</span>
              नवीन हिशोब पट्टी
            </NavLink>
            <NavLink
              to="/transactions"
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <span className="icon">📋</span>
              Transactions
            </NavLink>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-title">Masters</div>
            <NavLink
              to="/farmers"
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <span className="icon">👨‍🌾</span>
              शेतकरी / Farmers
            </NavLink>
            <NavLink
              to="/vegetables"
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <span className="icon">🥬</span>
              भाजीपाला / Vegetables
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
        {/* Top Bar */}
        <div className="app-topbar no-print">
          <div className="topbar-left">
            <span className="topbar-page-title">{pageInfo.title}</span>
            {pageInfo.subtitle && (
              <span className="topbar-page-subtitle">— {pageInfo.subtitle}</span>
            )}
          </div>
          <div className="topbar-right">
            <span className="topbar-date">{todayFormatted}</span>
            <button className="theme-toggle" onClick={toggleTheme} title="Switch theme">
              {theme === 'light' ? '🌙' : '☀️'} {theme === 'light' ? 'Dark' : 'Light'}
            </button>
          </div>
        </div>

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
