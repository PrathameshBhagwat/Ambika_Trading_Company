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

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">आजचा आढावा — {formatDate(todayISO())}</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/transactions/new')}>
          + नवीन हिशोब पट्टी
        </button>
      </div>

      {/* ── Stats Grid ── */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">आजचे व्यवहार / Today's Txns</div>
          <div className="stat-value">{summary?.total_transactions ?? 0}</div>
          <div className="stat-sub">{summary?.total_farmers_served ?? 0} शेतकरी</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">एकूण खरेदी / Gross</div>
          <div className="stat-value currency">{formatCurrency(summary?.total_gross_amount ?? 0)}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">एकूण खर्च / Deductions</div>
          <div className="stat-value currency text-warning">{formatCurrency(summary?.total_deductions ?? 0)}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">शेतकऱ्यांना देय / Net Payable</div>
          <div className="stat-value currency text-success">{formatCurrency(summary?.total_net_payable ?? 0)}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">दिलेली रक्कम / Paid</div>
          <div className="stat-value currency">{formatCurrency(summary?.total_payments_received ?? 0)}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">बाकी / Outstanding</div>
          <div className="stat-value currency text-danger">{formatCurrency(summary?.total_outstanding ?? 0)}</div>
        </div>
      </div>

      {/* ── Today's Transactions ── */}
      <div className="card mb-4">
        <div className="card-header">
          <div className="card-title">आजचे अलीकडील व्यवहार / Recent Transactions</div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/transactions')}>
            सर्व पहा →
          </button>
        </div>
        {recentTxns.length === 0 ? (
          <div className="empty-state" style={{ padding: 'var(--space-6)' }}>
            <div className="icon">📋</div>
            <h3>आज कोणतेही हिशोब नाहीत</h3>
            <p>No transactions yet. Create your first settlement.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>बिल नं. / Bill No.</th>
                  <th>दिनांक / Date</th>
                  <th>शेतकरी / Farmer</th>
                  <th className="amount">देय रक्कम / Net Payable</th>
                  <th className="amount">दिलेली / Paid</th>
                  <th className="amount">बाकी / Balance</th>
                  <th>स्थिती / Status</th>
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
                      <td className="font-mono">{txn.bill_number}</td>
                      <td>{formatDate(txn.transaction_date)}</td>
                      <td style={{ fontWeight: 500 }}>{txn.farmer_name}</td>
                      <td className="amount currency">{formatCurrency(txn.net_payable)}</td>
                      <td className="amount currency text-success">{formatCurrency(txn.total_paid)}</td>
                      <td className="amount currency">
                        {txn.balance_due > 0 ? (
                          <span className="text-danger">{formatCurrency(txn.balance_due)}</span>
                        ) : '—'}
                      </td>
                      <td>
                        <span className={`badge ${status.className}`}>{status.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Vegetable Breakdown ── */}
      {summary && summary.vegetable_breakdown.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">आजचा भाजीपाला आढावा / Vegetable Intake</div>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>भाजी / Vegetable</th>
                  <th className="amount">एकूण वजन (KG)</th>
                  <th className="amount">एकूण रक्कम / Amount</th>
                  <th className="amount">सरासरी दर / Avg Rate</th>
                </tr>
              </thead>
              <tbody>
                {summary.vegetable_breakdown.map((veg) => (
                  <tr key={veg.vegetable_id}>
                    <td style={{ fontWeight: 500 }}>{veg.vegetable_name}</td>
                    <td className="amount">{veg.total_weight_kg.toFixed(2)}</td>
                    <td className="amount currency">{formatCurrency(veg.total_amount)}</td>
                    <td className="amount currency">{formatCurrency(veg.avg_rate_per_10kg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
