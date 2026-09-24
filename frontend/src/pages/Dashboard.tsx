/**
 * Dashboard — Today's overview with key metrics and recent transactions.
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
      setError('Could not load dashboard. Is the backend running?');
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
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Today's overview — {formatDate(todayISO())}</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/transactions')}>
          + New Transaction
        </button>
      </div>

      {/* ── Stats Grid ── */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Today's Transactions</div>
          <div className="stat-value">{summary?.total_transactions ?? 0}</div>
          <div className="stat-sub">{summary?.total_farmers_served ?? 0} farmers served</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Gross Amount</div>
          <div className="stat-value currency">{formatCurrency(summary?.total_gross_amount ?? 0)}</div>
          <div className="stat-sub">Before deductions</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Total Deductions</div>
          <div className="stat-value currency text-warning">{formatCurrency(summary?.total_deductions ?? 0)}</div>
          <div className="stat-sub">Hamali, Bharai, Tolai, etc.</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Net Payable</div>
          <div className="stat-value currency text-success">{formatCurrency(summary?.total_net_payable ?? 0)}</div>
          <div className="stat-sub">To farmers</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Payments Received</div>
          <div className="stat-value currency">{formatCurrency(summary?.total_payments_received ?? 0)}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Outstanding</div>
          <div className="stat-value currency text-danger">{formatCurrency(summary?.total_outstanding ?? 0)}</div>
          <div className="stat-sub">Pending payments</div>
        </div>
      </div>

      {/* ── Vegetable Breakdown ── */}
      {summary && summary.vegetable_breakdown.length > 0 && (
        <div className="card mb-4">
          <div className="card-header">
            <div className="card-title">Today's Vegetable Summary</div>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Vegetable</th>
                  <th className="amount">Total Weight (KG)</th>
                  <th className="amount">Total Amount</th>
                  <th className="amount">Avg Rate / 10 KG</th>
                </tr>
              </thead>
              <tbody>
                {summary.vegetable_breakdown.map((veg) => (
                  <tr key={veg.vegetable_id}>
                    <td>{veg.vegetable_name}</td>
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

      {/* ── Recent Transactions ── */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Recent Transactions</div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/transactions')}>
            View All →
          </button>
        </div>
        {recentTxns.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📋</div>
            <h3>No transactions yet</h3>
            <p>Create your first farmer settlement transaction to get started.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Bill No.</th>
                  <th>Date</th>
                  <th>Farmer</th>
                  <th className="amount">Net Payable</th>
                  <th className="amount">Paid</th>
                  <th className="amount">Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentTxns.map((txn) => {
                  const status = getStatusDisplay(txn.status);
                  return (
                    <tr key={txn.id} style={{ cursor: 'pointer' }}>
                      <td className="font-mono">{txn.bill_number}</td>
                      <td>{formatDate(txn.transaction_date)}</td>
                      <td>{txn.farmer_name}</td>
                      <td className="amount currency">{formatCurrency(txn.net_payable)}</td>
                      <td className="amount currency">{formatCurrency(txn.total_paid)}</td>
                      <td className="amount currency">{formatCurrency(txn.balance_due)}</td>
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
    </div>
  );
}
