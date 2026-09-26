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
  const [globalSearch, setGlobalSearch] = useState('');

  // Handle global F2 shortcut to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        const searchInput = document.getElementById('global-search-input');
        if (searchInput) {
          searchInput.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="app-layout">
      {/* ── Sidebar ── */}
      <aside className="app-sidebar no-print">
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">🌿</div>
          <div className="sidebar-brand-title">
            <h1>मे. अंबिका ट्रेडिंग कंपनी</h1>
            <p>Farmer Settlement System</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section">
            <div className="sidebar-section-title">OVERVIEW • आढावा</div>
            <NavLink
              to="/"
              end
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <span className="icon">📊</span>
              <div className="nav-label-group">
                <span className="nav-main">Dashboard</span>
                <span className="nav-sub">डॅशबोर्ड</span>
              </div>
            </NavLink>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-title">OPERATIONS • व्यवहार</div>
            <NavLink
              to="/transactions/new"
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <span className="icon">✍️</span>
              <div className="nav-label-group">
                <span className="nav-main">New Settlement</span>
                <span className="nav-sub">नवीन हिशोब पट्टी</span>
              </div>
            </NavLink>
            <NavLink
              to="/transactions"
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <span className="icon">📋</span>
              <div className="nav-label-group">
                <span className="nav-main">Transactions</span>
                <span className="nav-sub">व्यवहार नोंद</span>
              </div>
            </NavLink>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-title">MASTERS • मास्टर यादी</div>
            <NavLink
              to="/farmers"
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <span className="icon">👥</span>
              <div className="nav-label-group">
                <span className="nav-main">Farmers</span>
                <span className="nav-sub">शेतकरी यादी</span>
              </div>
            </NavLink>
            <NavLink
              to="/vegetables"
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <span className="icon">🥬</span>
              <div className="nav-label-group">
                <span className="nav-main">Vegetables</span>
                <span className="nav-sub">भाजीपाला दर</span>
              </div>
            </NavLink>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-title">REPORTS • हिशोब अहवाल</div>
            <NavLink
              to="/reports/daily"
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <span className="icon">📅</span>
              <div className="nav-label-group">
                <span className="nav-main">Daily Summary</span>
                <span className="nav-sub">दैनिक अहवाल</span>
              </div>
            </NavLink>
            <NavLink
              to="/reports/outstanding"
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <span className="icon">💰</span>
              <div className="nav-label-group">
                <span className="nav-main">Outstanding</span>
                <span className="nav-sub">शिल्लक बाकी</span>
              </div>
            </NavLink>
            <NavLink
              to="/reports/payments"
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <span className="icon">💳</span>
              <div className="nav-label-group">
                <span className="nav-main">Payment Summary</span>
                <span className="nav-sub">पेमेंट सारांश</span>
              </div>
            </NavLink>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-title">SYSTEM • प्रणाली</div>
            <NavLink
              to="/settings/backup"
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <span className="icon">🛡️</span>
              <div className="nav-label-group">
                <span className="nav-main">Backup & Audit</span>
                <span className="nav-sub">डेटाबेस व सुरक्षा</span>
              </div>
            </NavLink>
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-version-pill">
            <span className="status-dot"></span>
            v1.0.0 • Offline Desktop
          </div>
          <div className="sidebar-port">Active Local Port 8741</div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="app-main">
        {/* Top Bar */}
        <div className="app-topbar no-print">
          <div className="topbar-left">
            <div className="topbar-mandi-badge">
              <span className="calendar-icon">📅</span>
              <span className="mandi-label">Mandi Date:</span>
              <span className="mandi-value">{todayFormatted}</span>
            </div>

            <div className="topbar-search">
              <span className="search-icon">🔍</span>
              <input
                id="global-search-input"
                type="text"
                placeholder="Search farmer, lot, bill... (F2)"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && globalSearch.trim()) {
                    window.location.hash = `#/transactions?search=${encodeURIComponent(globalSearch.trim())}`;
                  }
                }}
              />
            </div>
          </div>

          <div className="topbar-right">
            <div className="topbar-status-badge">
              <span className="status-indicator-dot"></span>
              SQLite Synchronized
            </div>

            <NavLink to="/transactions/new" className="btn btn-primary btn-sm topbar-action-btn">
              + New Settlement
            </NavLink>

            <button className="theme-toggle-btn" onClick={toggleTheme} title="Switch Light/Dark theme">
              {theme === 'light' ? '🌙' : '☀️'}
            </button>

            <div className="topbar-operator-badge" title="Ambika Trading Counter Operator">
              <span className="operator-icon">👤</span>
            </div>
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
