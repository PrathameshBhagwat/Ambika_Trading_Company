/**
 * Transaction List — View all transactions with status filters.
 * Entry point for creating new transactions (Phase 3).
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { transactionService } from '../../services/transaction.service';
import { formatCurrency, formatDate, getStatusDisplay } from '../../utils/formatters';
import type { TransactionListItem } from '../../types';

export default function TransactionList() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<TransactionListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    loadTransactions();
  }, [dateFrom, dateTo, statusFilter]);

  async function loadTransactions() {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, any> = { limit: 100 };
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (statusFilter) params.status = statusFilter;

      const data = await transactionService.list(params);
      setTransactions(data.items);
      setTotal(data.total);
    } catch {
      setError('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }

  function resetFilters() {
    setDateFrom('');
    setDateTo('');
    setStatusFilter('');
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Transactions</h1>
          <p className="page-subtitle">{total} total transactions</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/transactions/new')}>
          + New Transaction
        </button>
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div className="flex items-center gap-4" style={{ flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">From Date</label>
            <input
              type="date"
              className="form-input"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{ width: 180 }}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">To Date</label>
            <input
              type="date"
              className="form-input"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{ width: 180 }}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Status</label>
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: 180 }}
            >
              <option value="">All</option>
              <option value="saved">Unpaid</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="fully_paid">Fully Paid</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div style={{ marginTop: 20 }}>
            <button className="btn btn-ghost btn-sm" onClick={resetFilters}>
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="toast toast-error mb-4" style={{ position: 'static' }}>
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="loading-overlay"><div className="spinner" /></div>
      ) : transactions.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📋</div>
          <h3>No transactions found</h3>
          <p>
            {dateFrom || dateTo || statusFilter
              ? 'Try adjusting your filters.'
              : 'Create your first farmer settlement transaction to get started.'}
          </p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Bill No.</th>
                <th>Date</th>
                <th>Farmer</th>
                <th className="amount">Gross</th>
                <th className="amount">Deductions</th>
                <th className="amount">Net Payable</th>
                <th className="amount">Paid</th>
                <th className="amount">Balance</th>
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
                    <td style={{ fontWeight: 500 }}>{txn.farmer_name}</td>
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
      )}
    </div>
  );
}
