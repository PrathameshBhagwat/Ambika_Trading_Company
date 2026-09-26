/**
 * Ambika Trading — Farmer Outstanding Balances Report
 *
 * Lists all farmers with pending balances, running ledger links,
 * and quick settlement shortcuts.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportService } from '../../services/report.service';
import { formatCurrency } from '../../utils/formatters';
import type { FarmerOutstandingItem } from '../../types';

export default function FarmerOutstandingReport() {
  const navigate = useNavigate();
  const [items, setItems] = useState<FarmerOutstandingItem[]>([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [search, setSearch] = useState('');
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
      setError('Failed to load farmer outstanding report');
    } finally {
      setLoading(false);
    }
  }

  const filteredItems = items.filter((f) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      f.farmer_name.toLowerCase().includes(term) ||
      (f.village && f.village.toLowerCase().includes(term))
    );
  });

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="page-header no-print">
        <div>
          <h1 className="page-title">Farmer Outstanding Report</h1>
          <p className="page-subtitle">शेतकरी शिल्लक बाकी अहवाल — Unsettled farmer balances and payables</p>
        </div>

        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={() => window.print()}>
            🖨️ Print Report
          </button>
        </div>
      </div>

      {/* ── Grand Total Banner ── */}
      <div
        className="card mb-4"
        style={{
          borderColor: 'var(--color-danger)',
        }}
      >
        <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div className="text-sm text-danger" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Outstanding Across All Farmers / एकूण येणे-देणे बाकी
            </div>
            <div className="text-danger" style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '0.25rem', fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrency(grandTotal)}
            </div>
          </div>
          <div className="text-right text-muted text-sm">
            <div><strong>{items.length}</strong> शेतकरी बाकी / farmers with unsettled balances</div>
          </div>
        </div>
      </div>

      {/* ── Search Bar ── */}
      <div className="card mb-4 no-print">
        <div className="flex items-center gap-3">
          <input
            type="text"
            className="form-input"
            placeholder="Search by farmer name or village..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 380 }}
          />
          {search && (
            <button className="btn btn-ghost btn-sm" onClick={() => setSearch('')}>
              Clear Search
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="toast toast-error mb-4" style={{ position: 'static' }}>
          {error}
        </div>
      )}

      {/* ── Table ── */}
      {loading ? (
        <div className="loading-overlay">
          <div className="spinner" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="empty-state">
          <div className="icon">🎉</div>
          <h3>No outstanding balances found</h3>
          <p>
            {search
              ? 'No matching farmers found with this search.'
              : 'All farmer accounts are settled up to date.'}
          </p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Farmer Name / शेतकरी नाव</th>
                <th>Village / गाव</th>
                <th className="amount">Settlement Bills</th>
                <th className="amount">Total Net Payable (₹)</th>
                <th className="amount">Total Paid (₹)</th>
                <th className="amount">Balance Due / बाकी (₹)</th>
                <th className="no-print" style={{ width: 140 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item, idx) => (
                <tr key={item.farmer_id}>
                  <td className="text-muted">{idx + 1}</td>
                  <td style={{ fontWeight: 600 }}>{item.farmer_name}</td>
                  <td>{item.village || '—'}</td>
                  <td className="amount">{item.total_transactions}</td>
                  <td className="amount currency">{formatCurrency(item.total_net_payable)}</td>
                  <td className="amount currency text-success">{formatCurrency(item.total_paid)}</td>
                  <td
                    className="amount currency text-danger"
                    style={{ fontWeight: 700, fontSize: '1.05rem' }}
                  >
                    {formatCurrency(item.total_outstanding)}
                  </td>
                  <td className="no-print">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => navigate(`/farmers/${item.farmer_id}`)}
                    >
                      View Ledger
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--bg-secondary)', fontWeight: 700 }}>
                <td colSpan={3}>Grand Total ({filteredItems.length} Farmers):</td>
                <td className="amount">
                  {filteredItems.reduce((s, it) => s + it.total_transactions, 0)}
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
                <td className="no-print"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
