/**
 * Transaction List — सर्व व्यवहार / All Settlements
 *
 * Compact table with date/status filters.
 * Bilingual labels matching Ambika Trading terminology.
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
      setError('व्यवहार लोड करता आले नाहीत / Failed to load transactions');
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
          <p className="page-subtitle">एकूण {total} व्यवहार</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/transactions/new')}>
          + नवीन हिशोब पट्टी
        </button>
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div className="flex items-center gap-4" style={{ flexWrap: 'wrap' }}>
          <div className="form-group mb-0">
            <label className="form-label">From Date</label>
            <input
              type="date"
              className="form-input"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{ width: 160 }}
            />
          </div>
          <div className="form-group mb-0">
            <label className="form-label">To Date</label>
            <input
              type="date"
              className="form-input"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{ width: 160 }}
            />
          </div>
          <div className="form-group mb-0">
            <label className="form-label">स्थिती / Status</label>
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: 160 }}
            >
              <option value="">All</option>
              <option value="saved">Unpaid</option>
              <option value="partially_paid">Partial</option>
              <option value="fully_paid">Paid</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div style={{ marginTop: 18 }}>
            <button className="btn btn-ghost btn-sm" onClick={resetFilters}>
              Reset
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
          <h3>कोणतेही व्यवहार सापडले नाहीत</h3>
          <p>
            {dateFrom || dateTo || statusFilter
              ? 'फिल्टर बदलून पहा / Try adjusting your filters.'
              : 'पहिली हिशोब पावती तयार करा / Create your first settlement.'}
          </p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>बिल नं.</th>
                <th>दिनांक</th>
                <th>शेतकरी</th>
                <th className="amount">एकूण</th>
                <th className="amount">कपात</th>
                <th className="amount">देय रक्कम</th>
                <th className="amount">दिलेली</th>
                <th className="amount">बाकी</th>
                <th>स्थिती</th>
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
                    <td className="amount currency font-semibold">
                      {formatCurrency(txn.net_payable)}
                    </td>
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
  );
}
