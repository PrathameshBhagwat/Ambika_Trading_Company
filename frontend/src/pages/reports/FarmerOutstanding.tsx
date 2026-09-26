/**
 * Ambika Trading — Farmer Outstanding Balances Report
 *
 * Polished layout matching Screenshot 4 visual inspiration:
 * - 3 Hero KPI cards (Total Outstanding, Total Payable, Total Paid)
 * - Village quick filter pills & instant search
 * - Distinct initials avatars and clear monetary hierarchy
 * - View Ledger & Quick Pay shortcuts
 * - Grand totals and bottom feature indicators
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportService } from '../../services/report.service';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import type { FarmerOutstandingItem } from '../../types';
import './FarmerOutstanding.css';

export default function FarmerOutstandingReport() {
  const navigate = useNavigate();
  const [items, setItems] = useState<FarmerOutstandingItem[]>([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedVillage, setSelectedVillage] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadOutstanding();
  }, []);

  async function loadOutstanding() {
    try {
      setLoading(true);
      setError(null);
      const data = await reportService.farmerOutstanding();
      setItems(data.items);
      setGrandTotal(data.grand_total_outstanding);
    } catch {
      setError('Failed to load farmer outstanding report / अहवाल लोड करता आला नाही');
    } finally {
      setLoading(false);
    }
  }

  // Extract unique villages
  const villages = useMemo(() => {
    const list = items
      .map((i) => i.village?.trim())
      .filter((v): v is string => Boolean(v && v.length > 0));
    return Array.from(new Set(list));
  }, [items]);

  // Aggregate metrics
  const aggregate = useMemo(() => {
    let payable = 0;
    let paid = 0;
    let bills = 0;
    for (const it of items) {
      payable += it.total_net_payable || 0;
      paid += it.total_paid || 0;
      bills += it.total_transactions || 0;
    }
    const paidPct = payable > 0 ? ((paid / payable) * 100).toFixed(1) : '0';
    return { payable, paid, bills, paidPct };
  }, [items]);

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((f) => {
      const matchesSearch =
        !search ||
        f.farmer_name.toLowerCase().includes(search.toLowerCase()) ||
        (f.village && f.village.toLowerCase().includes(search.toLowerCase()));

      const matchesVillage =
        selectedVillage === 'all' ||
        (f.village && f.village.toLowerCase() === selectedVillage.toLowerCase());

      return matchesSearch && matchesVillage;
    });
  }, [items, search, selectedVillage]);

  // Export to CSV
  function handleExportCSV() {
    if (filteredItems.length === 0) return;
    const headers = [
      'Farmer Name',
      'Village',
      'Settlement Bills',
      'Total Net Payable',
      'Total Paid',
      'Balance Due',
    ];
    const rows = filteredItems.map((it) => [
      `"${it.farmer_name.replace(/"/g, '""')}"`,
      `"${(it.village || '').replace(/"/g, '""')}"`,
      it.total_transactions,
      it.total_net_payable,
      it.total_paid,
      it.total_outstanding,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Ambika_Farmer_Outstanding_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Get Initials
  function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase() || 'AT';
  }

  return (
    <div className="fo-container">
      {/* ─── Page Top Bar ─── */}
      <div className="fo-top-bar">
        <div className="fo-title-group">
          <h1>
            <span>📊</span> Farmer Outstanding Report / शेतकरी शिल्लक बाकी अहवाल
          </h1>
          <p>
            Unsettled farmer balances, ledger drilldown, and payable reconciliation • थकबाकीतील त्वरित रक्कम व्यवस्थापन
          </p>
        </div>

        <div className="fo-top-actions no-print">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => window.print()}
          >
            🖨️ Print Report / प्रिंट
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleExportCSV}
          >
            📥 Export CSV / एक्सेल
          </button>
        </div>
      </div>

      {/* ─── Hero KPI Cards (3 Cards) ─── */}
      <div className="fo-hero-grid">
        {/* Main Outstanding Hero Card */}
        <div className="fo-hero-card main">
          <div>
            <div className="fo-hero-header">
              <span className="fo-hero-label">● TOTAL OUTSTANDING / एकूण बाकी देणे</span>
              <span style={{ fontSize: 16 }}>⏳</span>
            </div>
            <div className="fo-hero-sublabel">
              Active Net Outstanding Payable Across All Farmers
            </div>
            <div className="fo-hero-amount">
              {formatCurrency(grandTotal)}
            </div>
          </div>
          <div className="fo-hero-footer">
            <span>👥 <strong>{items.length}</strong> Farmers with unsettled balances in {aggregate.bills} bills</span>
          </div>
        </div>

        {/* Total Payable Card */}
        <div className="fo-hero-card">
          <div>
            <div className="fo-hero-header">
              <span className="fo-hero-label">Total Payable / एकूण रक्कम</span>
              <span style={{ fontSize: 16 }}>📋</span>
            </div>
            <div className="fo-hero-amount" style={{ fontSize: '1.7rem' }}>
              {formatCurrency(aggregate.payable)}
            </div>
            <div className="fo-hero-sublabel">
              Across {aggregate.bills} generated settlement vouchers
            </div>
          </div>
          <div className="fo-hero-footer" style={{ borderTop: '1px solid var(--border-light)', paddingTop: 6 }}>
            <span>Auto Mandi Balance Reconciliation</span>
          </div>
        </div>

        {/* Total Paid Card */}
        <div className="fo-hero-card success">
          <div>
            <div className="fo-hero-header">
              <span className="fo-hero-label">Total Paid / जमा रक्कम</span>
              <span style={{ fontSize: 16 }}>✓</span>
            </div>
            <div className="fo-hero-amount" style={{ fontSize: '1.7rem' }}>
              {formatCurrency(aggregate.paid)}
            </div>
            <div className="fo-hero-sublabel">
              Settled to farmers ({aggregate.paidPct}%)
            </div>
            <div className="fo-progress-bar-bg">
              <div
                className="fo-progress-bar-fill"
                style={{ width: `${Math.min(100, Math.max(0, Number(aggregate.paidPct)))}%` }}
              />
            </div>
          </div>
          <div className="fo-hero-footer" style={{ borderTop: '1px solid var(--border-light)', paddingTop: 6 }}>
            <span>Verified Payout Ledger</span>
          </div>
        </div>
      </div>

      {/* ─── Search & Village Filter Bar ─── */}
      <div className="fo-filter-card no-print">
        <div className="fo-search-box">
          <input
            type="text"
            className="form-input"
            placeholder="🔍 Search by farmer name, village... (शोधा)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setSearch('')}
            >
              Clear
            </button>
          )}
        </div>

        <div className="fo-village-pills">
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
            गाव निवडा:
          </span>
          <button
            type="button"
            className={`fo-village-pill${selectedVillage === 'all' ? ' active' : ''}`}
            onClick={() => setSelectedVillage('all')}
          >
            All Villages ({items.length})
          </button>
          {villages.map((v) => {
            const count = items.filter((i) => i.village?.toLowerCase() === v.toLowerCase()).length;
            return (
              <button
                key={v}
                type="button"
                className={`fo-village-pill${selectedVillage.toLowerCase() === v.toLowerCase() ? ' active' : ''}`}
                onClick={() => setSelectedVillage(v)}
              >
                {v} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="toast toast-error mb-2" style={{ position: 'static' }}>
          {error}
        </div>
      )}

      {/* ─── Table Card ─── */}
      <div className="fo-table-card">
        <div className="fo-table-header">
          <h2>
            <span>📑</span> Unsettled Ledgers / शिल्लक बाकी खातेदार
          </h2>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Rows: <strong>{filteredItems.length}</strong> • Total Dues:{' '}
            <strong style={{ color: 'var(--color-danger)' }}>
              {formatCurrency(filteredItems.reduce((s, it) => s + it.total_outstanding, 0))}
            </strong>
          </span>
        </div>

        {loading ? (
          <div className="loading-overlay" style={{ minHeight: 200 }}>
            <div className="spinner" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="empty-state">
            <div className="icon">🎉</div>
            <h3>कोणतीही शिल्लक बाकी नाही / No outstanding balances</h3>
            <p>
              {search || selectedVillage !== 'all'
                ? 'निवडलेल्या निकषानुसार शेतकरी सापडले नाहीत / Try changing your search query or village filter.'
                : 'सर्व शेतकरी खाती पूर्णतः निर्वाह झालेली आहेत / All farmer accounts are up to date.'}
            </p>
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>FARMER NAME / शेतकरी नाव</th>
                  <th>VILLAGE / गाव</th>
                  <th className="amount">SETTLEMENT BILLS</th>
                  <th className="amount">TOTAL NET PAYABLE (₹)</th>
                  <th className="amount">TOTAL PAID (₹)</th>
                  <th className="amount">BALANCE DUE / बाकी (₹)</th>
                  <th className="no-print" style={{ textAlign: 'center', width: 160 }}>ACTIONS / व्यवहार</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, idx) => (
                  <tr key={item.farmer_id}>
                    <td className="text-muted">{idx + 1}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span className="fo-avatar">{getInitials(item.farmer_name)}</span>
                        <div>
                          <div style={{ fontWeight: 600 }}>{item.farmer_name}</div>
                          {item.village && (
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                              खातेदार • {item.village}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{item.village || '—'}</td>
                    <td className="amount" style={{ fontWeight: 600 }}>
                      {item.total_transactions} {item.total_transactions === 1 ? 'Bill' : 'Bills'}
                    </td>
                    <td className="amount currency">{formatCurrency(item.total_net_payable)}</td>
                    <td className="amount currency text-success">{formatCurrency(item.total_paid)}</td>
                    <td
                      className="amount currency text-danger"
                      style={{ fontWeight: 700, fontSize: '1.05rem' }}
                    >
                      {formatCurrency(item.total_outstanding)}
                    </td>
                    <td className="no-print" style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => navigate(`/farmers/${item.farmer_id}`)}
                          title="View Ledger"
                        >
                          View Ledger
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => navigate(`/farmers/${item.farmer_id}`)}
                          title="Record Payment"
                          style={{ padding: '2px 8px' }}
                        >
                          Pay Now
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--table-header-bg)', fontWeight: 700, borderTop: '2px solid var(--border-default)' }}>
                  <td colSpan={3}>
                    Grand Total ({filteredItems.length} Farmers) / एकूण गोषवारा
                  </td>
                  <td className="amount">
                    {filteredItems.reduce((s, it) => s + it.total_transactions, 0)} Bills
                  </td>
                  <td className="amount currency">
                    {formatCurrency(filteredItems.reduce((s, it) => s + it.total_net_payable, 0))}
                  </td>
                  <td className="amount currency text-success">
                    {formatCurrency(filteredItems.reduce((s, it) => s + it.total_paid, 0))}
                  </td>
                  <td className="amount currency text-danger" style={{ fontSize: '1.15rem' }}>
                    {formatCurrency(filteredItems.reduce((s, it) => s + it.total_outstanding, 0))}
                  </td>
                  <td className="no-print" style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
                    {filteredItems.length} Pending Payouts
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="fo-table-footer-summary">
          <span>Showing 1 to {filteredItems.length} of {items.length} unsettled accounts • स्थानिक सर्व रेकॉर्ड्स अद्ययावत आहेत.</span>
          <span>📅 Date: {formatDateTime(new Date().toISOString())}</span>
        </div>
      </div>

      {/* ─── Bottom Highlight Cards (3 Cards) ─── */}
      <div className="fo-bottom-highlights no-print">
        <div className="fo-highlight-card">
          <div className="fo-highlight-icon">💳</div>
          <div className="fo-highlight-text">
            <h4>Direct Cash / NEFT Settlement</h4>
            <p>शेतकऱ्यास रोख अथवा बँक खात्यात थेट पेमेंट करून शिल्लक शून्य (Zero Dues) करा.</p>
          </div>
        </div>

        <div className="fo-highlight-card">
          <div className="fo-highlight-icon">📱</div>
          <div className="fo-highlight-text">
            <h4>Marathi SMS Notification</h4>
            <p>सर्व पावतीची नोंद शेतकऱ्यांच्या मोबाईलवर मराठीतून पोहोचवली जाईल.</p>
          </div>
        </div>

        <div className="fo-highlight-card">
          <div className="fo-highlight-icon">🛡️</div>
          <div className="fo-highlight-text">
            <h4>Offline SQLite Integrity</h4>
            <p>स्थानिक हिशोब डेटा पूर्णतः सुरक्षित असून इंटरनेट नसतानाही अखंड चालतो.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
