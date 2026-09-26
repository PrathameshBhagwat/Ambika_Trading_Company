/**
 * Transaction List — सर्व व्यवहार / All Settlements
 *
 * Polished Mandi Settlement Ledger matching Screenshot 3 reference.
 * Includes KPI metrics, quick period filters, clean table with status badges,
 * and clerical shortcuts.
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { transactionService } from '../../services/transaction.service';
import { formatCurrency, formatDate, getStatusDisplay, todayISO } from '../../utils/formatters';
import type { TransactionListItem } from '../../types';
import './TransactionList.css';

type PeriodType = 'today' | 'yesterday' | '7days' | 'month' | 'custom';

export default function TransactionList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [transactions, setTransactions] = useState<TransactionListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [activePeriod, setActivePeriod] = useState<PeriodType>(searchParams.get('search') ? 'custom' : 'today');

  // Set default to today on initial mount unless search param is present
  useEffect(() => {
    const s = searchParams.get('search');
    if (s) {
      setSearchQuery(s);
      setActivePeriod('custom');
      setDateFrom('');
      setDateTo('');
    } else {
      handlePeriodSelect('today');
    }
  }, [searchParams]);

  useEffect(() => {
    loadTransactions();
  }, [dateFrom, dateTo, statusFilter]);

  async function loadTransactions() {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, any> = { limit: 150 };
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (statusFilter) params.status = statusFilter;

      const data = await transactionService.list(params);
      setTransactions(data.items);
      setTotal(data.total);
    } catch {
      setError('व्यवहार लोड करता आले नाहीत / Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }

  function handlePeriodSelect(period: PeriodType) {
    setActivePeriod(period);
    const today = new Date();

    if (period === 'today') {
      const t = todayISO();
      setDateFrom(t);
      setDateTo(t);
    } else if (period === 'yesterday') {
      const y = new Date();
      y.setDate(today.getDate() - 1);
      const yStr = y.toISOString().split('T')[0];
      setDateFrom(yStr);
      setDateTo(yStr);
    } else if (period === '7days') {
      const past = new Date();
      past.setDate(today.getDate() - 6);
      setDateFrom(past.toISOString().split('T')[0]);
      setDateTo(todayISO());
    } else if (period === 'month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setDateFrom(firstDay.toISOString().split('T')[0]);
      setDateTo(todayISO());
    } else {
      // custom: don't alter dates
    }
  }

  function resetFilters() {
    setActivePeriod('custom');
    setDateFrom('');
    setDateTo('');
    setStatusFilter('');
    setSearchQuery('');
  }

  // Filter client-side by search query (bill number or farmer name)
  const filteredTransactions = useMemo(() => {
    if (!searchQuery.trim()) return transactions;
    const q = searchQuery.toLowerCase();
    return transactions.filter(
      (t) =>
        t.bill_number.toLowerCase().includes(q) ||
        (t.farmer_name ? t.farmer_name.toLowerCase().includes(q) : false)
    );
  }, [transactions, searchQuery]);

  // Aggregate KPI Metrics
  const metrics = useMemo(() => {
    let gross = 0;
    let disbursed = 0;
    let balance = 0;
    for (const t of filteredTransactions) {
      if (t.status !== 'cancelled') {
        gross += t.gross_amount || 0;
        disbursed += t.total_paid || 0;
        balance += t.balance_due || 0;
      }
    }
    const disbursedPct = gross > 0 ? ((disbursed / gross) * 100).toFixed(1) : '0';
    return { gross, disbursed, balance, disbursedPct };
  }, [filteredTransactions]);

  // Export to CSV
  function handleExportCSV() {
    if (filteredTransactions.length === 0) return;
    const headers = [
      'Bill No',
      'Date',
      'Farmer Name',
      'Gross Amount',
      'Deductions',
      'Net Payable',
      'Paid',
      'Balance Due',
      'Status',
    ];
    const rows = filteredTransactions.map((t) => [
      t.bill_number,
      t.transaction_date,
      `"${(t.farmer_name || '').replace(/"/g, '""')}"`,
      t.gross_amount,
      t.total_deductions,
      t.net_payable,
      t.total_paid,
      t.balance_due,
      t.status,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Ambika_Transactions_${todayISO()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="tl-container">
      {/* ─── Top Bar ─── */}
      <div className="tl-top-bar">
        <div className="tl-title-group">
          <h1>
            <span>📋</span> Transactions / पावती व व्यवहार नोंद
          </h1>
          <p>
            All recorded farmer settlements, payment receipts, mandi commission slips, and real-time balance status.
          </p>
        </div>
        <div className="tl-top-actions no-print">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleExportCSV}
            title="Download CSV report"
          >
            📥 Export CSV / एक्सेल डाउनलोड
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => window.print()}
            title="Print summary"
          >
            🖨️ Batch Print (सर्व प्रिंट)
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/transactions/new')}
          >
            + New Settlement / नवीन पावती
          </button>
        </div>
      </div>

      {/* ─── KPI Metrics Row ─── */}
      <div className="tl-kpi-grid">
        <div className="tl-kpi-card">
          <div>
            <div className="tl-kpi-label">Total Settlements • एकूण पावत्या</div>
            <div className="tl-kpi-value">{filteredTransactions.length}</div>
            <div className="tl-kpi-sub">Active Lots</div>
          </div>
          <div className="tl-kpi-icon">📋</div>
        </div>

        <div className="tl-kpi-card">
          <div>
            <div className="tl-kpi-label">Gross Turnover • एकूण खरेदी</div>
            <div className="tl-kpi-value">{formatCurrency(metrics.gross)}</div>
            <div className="tl-kpi-sub">Total Produce Value</div>
          </div>
          <div className="tl-kpi-icon">💵</div>
        </div>

        <div className="tl-kpi-card success">
          <div>
            <div className="tl-kpi-label">Disbursed • अदा केलेले</div>
            <div className="tl-kpi-value">{formatCurrency(metrics.disbursed)}</div>
            <div className="tl-kpi-sub">{metrics.disbursedPct}% Settled</div>
          </div>
          <div className="tl-kpi-icon">✓</div>
        </div>

        <div className="tl-kpi-card alert">
          <div>
            <div className="tl-kpi-label">Balance Due • शिल्लक देणे</div>
            <div className="tl-kpi-value">{formatCurrency(metrics.balance)}</div>
            <div className="tl-kpi-sub">
              {metrics.balance > 0 ? 'Pending Payouts' : 'All Settled'}
            </div>
          </div>
          <div className="tl-kpi-icon">⏳</div>
        </div>
      </div>

      {/* ─── Filters Card ─── */}
      <div className="tl-filter-card no-print">
        <div className="tl-quick-periods">
          <div className="tl-period-pills">
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginRight: 4 }}>
              QUICK PERIOD:
            </span>
            <button
              type="button"
              className={`tl-period-pill${activePeriod === 'today' ? ' active' : ''}`}
              onClick={() => handlePeriodSelect('today')}
            >
              Today (आज)
            </button>
            <button
              type="button"
              className={`tl-period-pill${activePeriod === 'yesterday' ? ' active' : ''}`}
              onClick={() => handlePeriodSelect('yesterday')}
            >
              Yesterday (काल)
            </button>
            <button
              type="button"
              className={`tl-period-pill${activePeriod === '7days' ? ' active' : ''}`}
              onClick={() => handlePeriodSelect('7days')}
            >
              Last 7 Days (मागील ७ दिवस)
            </button>
            <button
              type="button"
              className={`tl-period-pill${activePeriod === 'month' ? ' active' : ''}`}
              onClick={() => handlePeriodSelect('month')}
            >
              This Month (या महिन्यात)
            </button>
          </div>

          <div className="tl-sync-indicator">
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
            <span>Auto-syncing SQLite Local</span>
          </div>
        </div>

        <div className="tl-filter-inputs">
          <div className="form-group">
            <label className="form-label">From Date / या तारखेपासून</label>
            <input
              type="date"
              className="form-input"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setActivePeriod('custom');
              }}
              style={{ width: 155 }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">To Date / या तारखेपर्यंत</label>
            <input
              type="date"
              className="form-input"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setActivePeriod('custom');
              }}
              style={{ width: 155 }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Status / स्थिती</label>
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: 150 }}
            >
              <option value="">All Statuses (सर्व)</option>
              <option value="saved">Unpaid (थकित)</option>
              <option value="partially_paid">Partial (अंशतः)</option>
              <option value="fully_paid">Paid (पूर्ण भरणा)</option>
              <option value="cancelled">Cancelled (रद्द)</option>
            </select>
          </div>

          <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
            <label className="form-label">Search Records / शेतकरी, बिल क्रमांक शोधा</label>
            <input
              type="text"
              className="form-input"
              placeholder="Search by bill no, farmer name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={resetFilters}
            style={{ height: 34, marginBottom: 1 }}
          >
            Reset Filters (रीसेट)
          </button>
        </div>
      </div>

      {error && (
        <div className="toast toast-error mb-2" style={{ position: 'static' }}>
          {error}
        </div>
      )}

      {/* ─── Table Card ─── */}
      <div className="tl-table-card">
        <div className="tl-table-header">
          <h2>
            <span>Daily Settlement Ledger</span>
            <span className="tl-table-count">{filteredTransactions.length} Records</span>
          </h2>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Sort By: Bill No (Desc)
          </span>
        </div>

        {loading ? (
          <div className="loading-overlay" style={{ minHeight: 200 }}>
            <div className="spinner" />
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📋</div>
            <h3>कोणतेही व्यवहार सापडले नाहीत / No settlements found</h3>
            <p>
              {dateFrom || dateTo || statusFilter || searchQuery
                ? 'फिल्टर बदलून पहा / Try adjusting your filters or date range.'
                : 'पहिली हिशोब पावती तयार करा / Create your first settlement.'}
            </p>
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>BILL NO. / पावती क्र.</th>
                  <th>DATE / दिनांक</th>
                  <th>FARMER NAME / शेतकरी नाव</th>
                  <th className="amount">GROSS / एकूण (₹)</th>
                  <th className="amount">DEDUCTIONS / कपात (₹)</th>
                  <th className="amount">NET PAYABLE / निव्वळ (₹)</th>
                  <th className="amount">PAID / दिलेले (₹)</th>
                  <th className="amount">BALANCE DUE / बाकी (₹)</th>
                  <th style={{ textAlign: 'center' }}>STATUS / स्थिती</th>
                  <th className="no-print" style={{ textAlign: 'center', width: 90 }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((txn) => {
                  const status = getStatusDisplay(txn.status);
                  return (
                    <tr
                      key={txn.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/transactions/${txn.id}`)}
                    >
                      <td className="font-mono" style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                        📄 {txn.bill_number}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(txn.transaction_date)}</td>
                      <td style={{ fontWeight: 600 }}>{txn.farmer_name}</td>
                      <td className="amount currency">{formatCurrency(txn.gross_amount)}</td>
                      <td className="amount currency text-warning">
                        {txn.total_deductions > 0 ? `−${formatCurrency(txn.total_deductions)}` : '—'}
                      </td>
                      <td className="amount currency font-semibold">
                        {formatCurrency(txn.net_payable)}
                      </td>
                      <td className="amount currency text-success">
                        {txn.total_paid > 0 ? formatCurrency(txn.total_paid) : '₹0.00'}
                      </td>
                      <td className="amount currency">
                        {txn.balance_due > 0 ? (
                          <span className="text-danger font-bold">{formatCurrency(txn.balance_due)}</span>
                        ) : (
                          <span className="text-muted">₹0.00</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${status.className}`}>{status.label}</span>
                      </td>
                      <td className="no-print" style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          title="View Details"
                          onClick={() => navigate(`/transactions/${txn.id}`)}
                        >
                          👁️
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          title="Print Bill"
                          onClick={() => navigate(`/transactions/${txn.id}?print=true`)}
                        >
                          🖨️
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="tl-table-footer">
          <div>
            Showing 1 to {filteredTransactions.length} of {total} settlements (पावत्या)
          </div>
          <div>
            Total Volume: <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(metrics.gross)}</strong>
          </div>
        </div>
      </div>

      {/* ─── Bottom Helper Cards ─── */}
      <div className="tl-bottom-grid no-print">
        <div className="tl-info-card">
          <div className="tl-info-card-header">
            <span>⌨</span> Clerical Shortcuts (शॉर्टकट कीज)
          </div>
          <div className="tl-shortcuts-list">
            <div className="tl-shortcut-item">
              <span>New Farmer Settlement Slip</span>
              <kbd>F1</kbd>
            </div>
            <div className="tl-shortcut-item">
              <span>Quick Ledger Farmer Search</span>
              <kbd>F2</kbd>
            </div>
            <div className="tl-shortcut-item">
              <span>Print Active Bill Voucher</span>
              <kbd>Ctrl + P</kbd>
            </div>
          </div>
        </div>

        <div className="tl-info-card">
          <div className="tl-info-card-header">
            <span>🖨</span> Thermal Slip Status (थर्मल प्रिंटर)
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 6 }}>
            Printer: Epson TM-T82 (3-inch Mandi Slip) is configured and connected on USB001.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-primary)', fontWeight: 600 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
            Ready for immediate payout slips (203 DPI)
          </div>
        </div>
      </div>
    </div>
  );
}
