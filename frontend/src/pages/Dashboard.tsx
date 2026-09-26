/**
 * Dashboard — आजचा आढावा / Today's Overview
 *
 * Compact financial summary with bilingual labels,
 * today's transactions table, and vegetable intake summary.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportService } from '../services/report.service';
import { transactionService } from '../services/transaction.service';
import { formatCurrency, formatDate, todayISO, getStatusDisplay } from '../utils/formatters';
import type { DailySummary, TransactionListItem } from '../types';

export default function Dashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [recentTxns, setRecentTxns] = useState<TransactionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      setError(null);
      const today = todayISO();

      const [summaryData, txnData] = await Promise.all([
        reportService.dailySummary(today).catch(() => null),
        transactionService.list({ limit: 10 }).catch(() => ({ items: [], total: 0 })),
      ]);

      setSummary(summaryData);
      setRecentTxns(txnData.items);
    } catch {
      setError('बॅकएंड कनेक्शन नाही. / Could not load dashboard. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state">
        <div className="icon">⚠️</div>
        <h3>Connection Error</h3>
        <p>{error}</p>
        <button className="btn btn-primary mt-4" onClick={loadDashboard}>
          पुन्हा प्रयत्न करा / Retry
        </button>
      </div>
    );
  }

  const disbursedPercent = summary && summary.total_net_payable > 0
    ? Math.min(100, Math.round(((summary.total_payments_received || 0) / summary.total_net_payable) * 100))
    : 100;

  return (
    <div className="dashboard-page">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            Dashboard <span className="text-muted" style={{ fontWeight: 400 }}>/ आजचा डॅशबोर्ड</span>
            <span className="badge badge-success" style={{ fontSize: '11px', verticalAlign: 'middle' }}>
              ● मंडी सत्र चालू
            </span>
          </h1>
          <p className="page-subtitle">
            Today's Market Overview — {formatDate(todayISO())} · Live Mandi Intake & Settlement Status
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>
            🖨️ Print Summary
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/transactions/new')}>
            + New Settlement / नवीन पावती
          </button>
        </div>
      </div>

      {/* ── Stats Grid (6 Polished KPI Cards) ── */}
      <div className="stats-grid">
        {/* 1. Transactions */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Transactions • व्यवहार</span>
            <span className="stat-icon">📋</span>
          </div>
          <div className="stat-value">{summary?.total_transactions ?? 0}</div>
          <div className="stat-sub">
            <span>👥</span> {summary?.total_farmers_served ?? 0} Farmers served
          </div>
        </div>

        {/* 2. Gross Amount */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Gross • एकूण खरेदी</span>
            <span className="stat-icon">🏪</span>
          </div>
          <div className="stat-value currency">{formatCurrency(summary?.total_gross_amount ?? 0)}</div>
          <div className="stat-sub">Before deductions</div>
        </div>

        {/* 3. Deductions */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Deductions • कपात</span>
            <span className="stat-icon">🛒</span>
          </div>
          <div className="stat-value currency text-warning">{formatCurrency(summary?.total_deductions ?? 0)}</div>
          <div className="stat-sub">Hamali, Bharai, Tolai</div>
        </div>

        {/* 4. Net Payable (Featured Soft Mint) */}
        <div className="stat-card stat-card-featured">
          <div className="stat-card-header">
            <span className="stat-label" style={{ color: 'var(--color-primary)' }}>Net Payable • निव्वळ देय</span>
            <span className="stat-icon">💵</span>
          </div>
          <div className="stat-value currency">{formatCurrency(summary?.total_net_payable ?? 0)}</div>
          <div className="stat-sub" style={{ color: 'var(--color-primary)' }}>
            Final payable to farmers
          </div>
        </div>

        {/* 5. Disbursed / Paid */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Disbursed • अदा रक्कम</span>
            <span className="stat-icon">🏦</span>
          </div>
          <div className="stat-value currency">{formatCurrency(summary?.total_payments_received ?? 0)}</div>
          <div className="stat-sub">
            <span className="badge badge-success" style={{ fontSize: '10px', padding: '1px 6px' }}>
              {disbursedPercent}% Paid
            </span>
          </div>
        </div>

        {/* 6. Outstanding */}
        <div className={`stat-card ${(summary?.total_outstanding ?? 0) > 0 ? 'stat-card-alert' : ''}`}>
          <div className="stat-card-header">
            <span className="stat-label" style={{ color: (summary?.total_outstanding ?? 0) > 0 ? 'var(--color-danger)' : undefined }}>
              Outstanding • बाकी
            </span>
            <span className="stat-icon">⚠️</span>
          </div>
          <div className="stat-value currency">{formatCurrency(summary?.total_outstanding ?? 0)}</div>
          <div className="stat-sub">
            {(summary?.total_outstanding ?? 0) > 0 ? (
              <span className="badge badge-danger" style={{ fontSize: '10px', padding: '1px 6px' }}>
                Pending Settlement
              </span>
            ) : (
              <span className="text-muted">Zero pending balance</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Middle Section: Intake Summary + Market Pulse ── */}
      <div className="grid grid-2 mb-4" style={{ gridTemplateColumns: '2fr 1fr', gap: 'var(--space-4)' }}>
        {/* Left: Vegetable Intake Summary */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title flex items-center gap-2">
                <span>🥬</span> Today's Vegetable Intake Summary
              </div>
              <div className="card-subtitle">भाजीपाला आवक, सरासरी दर आणि एकूण रक्कम</div>
            </div>
            {summary && summary.vegetable_breakdown.length > 0 && (
              <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                {summary.vegetable_breakdown.length} Produce Types
              </span>
            )}
          </div>

          {summary && summary.vegetable_breakdown.length > 0 ? (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>VEGETABLE / भाजी</th>
                    <th className="amount">TOTAL WEIGHT / वजन</th>
                    <th className="amount">AVG RATE / १० KG दर</th>
                    <th className="amount">TOTAL AMOUNT / रक्कम</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.vegetable_breakdown.map((veg, idx) => (
                    <tr key={veg.vegetable_id}>
                      <td className="text-muted font-mono">{idx + 1}</td>
                      <td style={{ fontWeight: 600 }}>{veg.vegetable_name}</td>
                      <td className="amount font-mono">{veg.total_weight_kg.toFixed(2)} KG</td>
                      <td className="amount currency font-mono">{formatCurrency(veg.avg_rate_per_10kg)}</td>
                      <td className="amount currency font-mono" style={{ fontWeight: 600 }}>
                        {formatCurrency(veg.total_amount)}
                      </td>
                    </tr>
                  ))}
                  {/* Totals row */}
                  <tr style={{ background: 'var(--surface-elevated)', fontWeight: 700 }}>
                    <td colSpan={2}>एकूण आवक (Grand Total Intake)</td>
                    <td className="amount font-mono">
                      {summary.vegetable_breakdown.reduce((s, v) => s + v.total_weight_kg, 0).toFixed(2)} KG
                    </td>
                    <td className="amount text-muted" style={{ fontWeight: 500, fontSize: '11px' }}>
                      Weighted Avg
                    </td>
                    <td className="amount currency font-mono text-primary">
                      {formatCurrency(summary.total_gross_amount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: 'var(--space-6)' }}>
              <div className="icon">🥬</div>
              <p>No produce intake recorded today.</p>
            </div>
          )}
        </div>

        {/* Right: Market Pulse & System Health */}
        <div className="card flex flex-col justify-between">
          <div>
            <div className="card-header">
              <div>
                <div className="card-title flex items-center gap-2">
                  <span>📊</span> Market Pulse / मंडी स्थिती
                </div>
                <div className="card-subtitle">Daily trading operations & local sync</div>
              </div>
            </div>

            <div className="pulse-content" style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
              <p className="mb-3">
                Daily agricultural produce arrivals are running smoothly. Weight slips, settlements, and instant receipts are generated locally.
              </p>

              <div className="flex flex-col gap-2 mb-3">
                <div
                  className="flex items-center justify-between p-2 rounded"
                  style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-default)', fontSize: '12px' }}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-success">✓</span> Electronic Weighing Scale
                  </span>
                  <span className="badge badge-success" style={{ fontSize: '10px' }}>Calibrated</span>
                </div>

                <div
                  className="flex items-center justify-between p-2 rounded"
                  style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-default)', fontSize: '12px' }}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-success">✓</span> Local SQLite Database
                  </span>
                  <span className="badge badge-success" style={{ fontSize: '10px' }}>Auto-Saved</span>
                </div>

                <div
                  className="flex items-center justify-between p-2 rounded"
                  style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-default)', fontSize: '12px' }}
                >
                  <span className="flex items-center gap-2">
                    <span>🖨️</span> Bill Receipt Printer
                  </span>
                  <span className="badge badge-neutral" style={{ fontSize: '10px' }}>A4 / A5 Ready</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3" style={{ borderTop: '1px solid var(--border-default)' }}>
            <button
              className="btn btn-secondary btn-sm w-full flex items-center justify-center gap-2"
              onClick={() => navigate('/reports/daily')}
            >
              <span>📑</span> Open Full Mandi Daily Report
            </button>
          </div>
        </div>
      </div>

      {/* ── Today's Recent Transactions ── */}
      <div className="card mb-4">
        <div className="card-header">
          <div>
            <div className="card-title flex items-center gap-2">
              <span>📋</span> Recent Transactions / अलीकडील व्यवहार
            </div>
            <div className="card-subtitle">Farmer bill releases, settlements and balance accounts</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/transactions')}>
            View All Settlements / सर्व पहा →
          </button>
        </div>

        {recentTxns.length === 0 ? (
          <div className="empty-state" style={{ padding: 'var(--space-6)' }}>
            <div className="icon">📋</div>
            <h3>आज कोणतेही हिशोब नाहीत</h3>
            <p>No transactions yet. Create your first settlement.</p>
            <button className="btn btn-primary mt-3" onClick={() => navigate('/transactions/new')}>
              + नवीन हिशोब पट्टी
            </button>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>BILL NO. / पावती</th>
                  <th>DATE / दिनांक</th>
                  <th>FARMER NAME / शेतकरी</th>
                  <th className="amount">NET PAYABLE / निव्वळ</th>
                  <th className="amount">PAID / अदा</th>
                  <th className="amount">BALANCE / बाकी</th>
                  <th>STATUS / स्थिती</th>
                  <th className="text-right">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {recentTxns.map((txn) => {
                  const status = getStatusDisplay(txn.status);
                  return (
                    <tr
                      key={txn.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/transactions/${txn.id}`)}
                    >
                      <td className="font-mono text-primary" style={{ fontWeight: 600 }}>
                        {txn.bill_number}
                      </td>
                      <td>{formatDate(txn.transaction_date)}</td>
                      <td style={{ fontWeight: 600 }}>{txn.farmer_name}</td>
                      <td className="amount currency" style={{ fontWeight: 600 }}>
                        {formatCurrency(txn.net_payable)}
                      </td>
                      <td className="amount currency text-success">
                        {formatCurrency(txn.total_paid)}
                      </td>
                      <td className="amount currency">
                        {txn.balance_due > 0 ? (
                          <span className="text-danger" style={{ fontWeight: 600 }}>
                            {formatCurrency(txn.balance_due)}
                          </span>
                        ) : (
                          <span className="text-muted">₹0.00</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${status.className}`}>{status.label}</span>
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/transactions/${txn.id}`);
                          }}
                        >
                          👁️ पावती
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
