/**
 * Ambika Trading — Farmer Profile & Ledger Statement
 *
 * Displays running account of all farmer settlement transactions,
 * payment history, and current outstanding balances.
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { farmerService } from '../../services/farmer.service';
import { transactionService } from '../../services/transaction.service';
import { paymentService } from '../../services/payment.service';
import {
  formatCurrency,
  formatDate,
  getStatusDisplay,
  getPaymentModeLabel,
} from '../../utils/formatters';
import type {
  Farmer,
  TransactionListItem,
  PaymentResponse,
} from '../../types';

export default function FarmerLedger() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [farmer, setFarmer] = useState<Farmer | null>(null);
  const [transactions, setTransactions] = useState<TransactionListItem[]>([]);
  const [payments, setPayments] = useState<PaymentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date range filter (Phase E)
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Active tab
  const [activeTab, setActiveTab] = useState<'transactions' | 'payments'>('transactions');

  useEffect(() => {
    if (id) {
      loadFarmerData(parseInt(id, 10));
    }
  }, [id]);

  async function loadFarmerData(farmerId: number, fromDate = dateFrom, toDate = dateTo) {
    try {
      setLoading(true);
      setError(null);
      const txnParams: { farmer_id: number; limit: number; date_from?: string; date_to?: string } = {
        farmer_id: farmerId,
        limit: 200,
      };
      const pmtParams: { date_from?: string; date_to?: string } = {};

      if (fromDate) {
        txnParams.date_from = fromDate;
        pmtParams.date_from = fromDate;
      }
      if (toDate) {
        txnParams.date_to = toDate;
        pmtParams.date_to = toDate;
      }

      const [farmerData, txnsData, paymentsData] = await Promise.all([
        farmerService.get(farmerId),
        transactionService.list(txnParams),
        paymentService.listForFarmer(farmerId, pmtParams),
      ]);
      setFarmer(farmerData);
      setTransactions(txnsData.items);
      setPayments(paymentsData.items);
    } catch {
      setError('Failed to load farmer ledger data');
    } finally {
      setLoading(false);
    }
  }

  function handleFilterSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (id) {
      loadFarmerData(parseInt(id, 10), dateFrom, dateTo);
    }
  }

  function handleClearFilter() {
    setDateFrom('');
    setDateTo('');
    if (id) {
      loadFarmerData(parseInt(id, 10), '', '');
    }
  }

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner" />
      </div>
    );
  }

  if (error || !farmer) {
    return (
      <div className="card text-center p-5">
        <div className="text-danger mb-3" style={{ fontSize: '2rem' }}>⚠️</div>
        <h3>{error || 'Farmer not found'}</h3>
        <button className="btn btn-secondary mt-3" onClick={() => navigate('/farmers')}>
          Back to Farmers List
        </button>
      </div>
    );
  }

  // Financial aggregates (Phase B: exclude cancelled transactions and their associated payments)
  const validTxns = transactions.filter((t) => t.status !== 'cancelled');
  const validTxnIds = new Set(validTxns.map((t) => t.id));
  const validPayments = payments.filter((p) =>
    p.transaction_status ? p.transaction_status !== 'cancelled' : validTxnIds.has(p.transaction_id)
  );

  const totalGross = validTxns.reduce((s, t) => s + t.gross_amount, 0);
  const totalDeductions = validTxns.reduce((s, t) => s + t.total_deductions, 0);
  const totalNetPayable = validTxns.reduce((s, t) => s + t.net_payable, 0);
  const totalPaid = validPayments.reduce((s, p) => s + p.amount, 0);
  const outstandingBalance = Math.max(0, Math.round((totalNetPayable - totalPaid) * 100) / 100);

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="page-header no-print">
        <div className="flex items-center gap-3">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/farmers')}>
            ← Back
          </button>
          <div>
            <h1 className="page-title">{farmer.name}</h1>
            <p className="page-subtitle">
              Farmer Ledger & Account Statement · {farmer.village ? `Village: ${farmer.village}` : 'No village specified'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="btn btn-primary" onClick={() => window.print()}>
            🖨️ Print Statement
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/transactions/new')}
          >
            + New Bill for Farmer
          </button>
        </div>
      </div>

      {/* ── Farmer Profile Card ── */}
      <div className="card mb-4">
        <div className="grid grid-4 gap-4">
          <div>
            <div className="text-xs text-muted">Contact Mobile:</div>
            <div style={{ fontWeight: 600 }}>{farmer.mobile || 'Not provided'}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Village / Address:</div>
            <div style={{ fontWeight: 600 }}>
              {farmer.village || '—'} {farmer.address ? `(${farmer.address})` : ''}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted">Account Status:</div>
            <div>
              <span className={`badge ${farmer.is_active ? 'badge-success' : 'badge-danger'}`}>
                {farmer.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
          <div>
            <div className="text-xs text-muted">Registered On:</div>
            <div className="text-sm">{formatDate(farmer.created_at)}</div>
          </div>
        </div>

        {farmer.notes && (
          <div className="mt-3 pt-3 text-muted text-sm" style={{ borderTop: '1px solid var(--border-default)' }}>
            <strong>Notes:</strong> {farmer.notes}
          </div>
        )}
      </div>

      {/* ── Date Range Filter Toolbar (Phase E) ── */}
      <div className="card mb-4 no-print" style={{ padding: '1rem 1.25rem' }}>
        <form onSubmit={handleFilterSubmit} className="flex items-center gap-3 flex-wrap">
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>📅 Statement Date Range:</span>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted" htmlFor="dateFrom">From:</label>
            <input
              id="dateFrom"
              type="date"
              className="form-control form-control-sm"
              style={{ width: 'auto' }}
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted" htmlFor="dateTo">To:</label>
            <input
              id="dateTo"
              type="date"
              className="form-control form-control-sm"
              style={{ width: 'auto' }}
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-sm">
            Apply Filter
          </button>
          {(dateFrom || dateTo) && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleClearFilter}
            >
              Clear Filter
            </button>
          )}
          {(dateFrom || dateTo) ? (
            <span className="text-xs text-muted" style={{ marginLeft: 'auto' }}>
              Showing filtered records from <strong>{dateFrom || 'earliest'}</strong> to <strong>{dateTo || 'latest'}</strong>
            </span>
          ) : (
            <span className="text-xs text-muted" style={{ marginLeft: 'auto' }}>
              Showing all-time records
            </span>
          )}
        </form>
      </div>

      {/* ── Financial KPI Stat Cards ── */}
      <div className="grid grid-4 gap-4 mb-4">
        <div className="stat-card">
          <div className="stat-label">Total Settlements / पट्ट्या</div>
          <div className="stat-value">{validTxns.length}</div>
          <div className="text-xs text-muted mt-1">Valid bills recorded</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Total Net Payable / देय रक्कम</div>
          <div className="stat-value">{formatCurrency(totalNetPayable)}</div>
          <div className="text-xs text-muted mt-1">
            Gross: {formatCurrency(totalGross)} · Ded: {formatCurrency(totalDeductions)}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Total Paid / जमा रक्कम</div>
          <div className="stat-value text-success">{formatCurrency(totalPaid)}</div>
          <div className="text-xs text-muted mt-1">{payments.length} payment records</div>
        </div>

        <div
          className="stat-card"
          style={{
            background: outstandingBalance > 0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
            borderColor: outstandingBalance > 0 ? 'var(--danger)' : 'var(--primary)',
          }}
        >
          <div className="stat-label">Outstanding Due / येणे बाकी</div>
          <div
            className={`stat-value ${outstandingBalance > 0 ? 'text-danger' : 'text-success'}`}
            style={{ fontSize: '1.6rem' }}
          >
            {formatCurrency(outstandingBalance)}
          </div>
          <div className="text-xs text-muted mt-1">
            {outstandingBalance > 0 ? 'Pending settlement' : 'Fully settled'}
          </div>
        </div>
      </div>

      {/* ── Tabs: Transactions vs Payments ── */}
      <div className="card">
        <div
          className="flex gap-4 pb-3 mb-3 no-print"
          style={{ borderBottom: '1px solid var(--border-default)' }}
        >
          <button
            className={`btn btn-sm ${activeTab === 'transactions' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('transactions')}
          >
            📋 Transactions ({transactions.length})
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'payments' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('payments')}
          >
            💰 Payment History ({payments.length})
          </button>
        </div>

        {activeTab === 'transactions' ? (
          transactions.length === 0 ? (
            <div className="empty-state">
              <div className="icon">📋</div>
              <h3>No transactions yet</h3>
              <p>No vegetable delivery bills recorded for this farmer.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Bill No.</th>
                    <th>Date</th>
                    <th className="amount">Gross (₹)</th>
                    <th className="amount">Deductions (₹)</th>
                    <th className="amount">Net Payable (₹)</th>
                    <th className="amount">Paid (₹)</th>
                    <th className="amount">Balance (₹)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((txn) => {
                    const status = getStatusDisplay(txn.status);
                    return (
                      <tr
                        key={txn.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/transactions/${txn.id}`)}
                      >
                        <td className="font-mono">{txn.bill_number}</td>
                        <td>{formatDate(txn.transaction_date)}</td>
                        <td className="amount currency">{formatCurrency(txn.gross_amount)}</td>
                        <td className="amount currency text-warning">
                          {txn.total_deductions > 0 ? `−${formatCurrency(txn.total_deductions)}` : '—'}
                        </td>
                        <td className="amount currency" style={{ fontWeight: 600 }}>
                          {formatCurrency(txn.net_payable)}
                        </td>
                        <td className="amount currency text-success">{formatCurrency(txn.total_paid)}</td>
                        <td className="amount currency text-danger">
                          {txn.balance_due > 0 ? formatCurrency(txn.balance_due) : '—'}
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
          )
        ) : payments.length === 0 ? (
          <div className="empty-state">
            <div className="icon">💰</div>
            <h3>No payments recorded</h3>
            <p>No payments have been logged for this farmer yet.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>#</th>
                  <th>Payment Date</th>
                  <th>Mode</th>
                  <th>Bill ID / Ref</th>
                  <th>Notes</th>
                  <th className="amount">Amount Paid</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p, idx) => {
                  const isCancelled = p.transaction_status === 'cancelled';
                  return (
                    <tr
                      key={p.id}
                      style={isCancelled ? { opacity: 0.65, background: 'rgba(239, 68, 68, 0.04)' } : undefined}
                    >
                      <td className="text-muted">{idx + 1}</td>
                      <td>{formatDate(p.payment_date)}</td>
                      <td>
                        <span className="badge badge-draft">{getPaymentModeLabel(p.payment_mode)}</span>
                      </td>
                      <td className="font-mono">
                        <Link to={`/transactions/${p.transaction_id}`} className="no-print">
                          {p.transaction_bill_number || `Bill #${p.transaction_id}`}
                        </Link>
                        <span className="only-print">
                          {p.transaction_bill_number || `Bill #${p.transaction_id}`}
                        </span>
                        {p.reference_number && ` · Ref: ${p.reference_number}`}
                        {isCancelled && (
                          <span
                            className="badge badge-danger"
                            style={{ marginLeft: 8, fontSize: '0.72rem' }}
                            title="This payment was recorded for a bill that was subsequently cancelled. It is preserved for audit history and excluded from financial totals."
                          >
                            Cancelled Bill (Excluded)
                          </span>
                        )}
                      </td>
                      <td className="text-muted">{p.notes || '—'}</td>
                      <td
                        className={`amount currency ${isCancelled ? 'text-muted' : 'text-success'}`}
                        style={{
                          fontWeight: 600,
                          textDecoration: isCancelled ? 'line-through' : 'none',
                        }}
                      >
                        {formatCurrency(p.amount)}
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
