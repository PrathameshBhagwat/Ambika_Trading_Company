/**
 * Ambika Trading — Payment Summary Report
 *
 * Displays financial settlements grouped by payment mode (Cash, UPI, Bank Transfer, Cheque)
 * for a selected date or custom date range, with counts, amounts, and grand total.
 */

import { useState, useEffect } from 'react';
import { reportService } from '../../services/report.service';
import { formatCurrency, formatDate, todayISO } from '../../utils/formatters';
import type { PaymentSummaryReport as PaymentReportType } from '../../types';

const PAYMENT_MODE_LABELS: Record<string, { en: string; mr: string; icon: string }> = {
  cash: { en: 'Cash', mr: 'रोख', icon: '💵' },
  upi: { en: 'UPI / Online', mr: 'ऑनलाईन', icon: '📱' },
  bank_transfer: { en: 'Bank Transfer', mr: 'बँक ट्रान्सफर', icon: '🏦' },
  cheque: { en: 'Cheque', mr: 'धनादेश', icon: '📜' },
};

export default function PaymentSummary() {
  const [dateFrom, setDateFrom] = useState(todayISO());
  const [dateTo, setDateTo] = useState(todayISO());
  const [report, setReport] = useState<PaymentReportType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReport();
  }, []);

  async function loadReport() {
    try {
      setLoading(true);
      setError(null);
      const data = await reportService.paymentSummary(
        dateFrom,
        dateTo !== dateFrom ? dateTo : undefined
      );
      setReport(data);
    } catch {
      setError('Failed to load payment summary report.');
    } finally {
      setLoading(false);
    }
  }

  function handleFilterSubmit(e: React.FormEvent) {
    e.preventDefault();
    loadReport();
  }

  function setQuickFilter(type: 'today' | 'yesterday' | 'week' | 'month') {
    const today = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const toISO = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (type === 'today') {
      const d = toISO(today);
      setDateFrom(d);
      setDateTo(d);
    } else if (type === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const d = toISO(y);
      setDateFrom(d);
      setDateTo(d);
    } else if (type === 'week') {
      const w = new Date();
      w.setDate(w.getDate() - 7);
      setDateFrom(toISO(w));
      setDateTo(toISO(today));
    } else if (type === 'month') {
      const m = new Date(today.getFullYear(), today.getMonth(), 1);
      setDateFrom(toISO(m));
      setDateTo(toISO(today));
    }
  }

  // Pre-aggregate by known modes so all 4 modes are displayed even if 0
  const modesList = ['cash', 'upi', 'bank_transfer', 'cheque'];
  const breakdownMap = new Map<string, { count: number; total_amount: number }>();
  if (report?.mode_breakdown) {
    for (const item of report.mode_breakdown) {
      breakdownMap.set(item.payment_mode.toLowerCase(), {
        count: item.count,
        total_amount: item.total_amount,
      });
    }
  }

  const grandTotal = report?.grand_total || 0;
  const totalCount = report?.mode_breakdown?.reduce((sum, item) => sum + item.count, 0) || 0;

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="page-header no-print">
        <div>
          <h1 className="page-title">Payment Summary Report</h1>
          <p className="page-subtitle">
            पेमेंट सारांश अहवाल — Mode-wise payout breakdown (Cash, UPI, Bank Transfer, Cheque)
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => window.print()}>
          🖨️ Print Report
        </button>
      </div>

      {/* ── Filter Card ── */}
      <div className="card mb-4 no-print">
        <form onSubmit={handleFilterSubmit} className="flex items-end gap-3" style={{ flexWrap: 'wrap' }}>
          <div className="form-group mb-0">
            <label className="form-label">From Date</label>
            <input
              type="date"
              className="form-input"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              required
            />
          </div>
          <div className="form-group mb-0">
            <label className="form-label">To Date</label>
            <input
              type="date"
              className="form-input"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary">
            Filter Report
          </button>

          {/* Quick preset buttons */}
          <div className="flex gap-2 ml-auto" style={{ alignSelf: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setQuickFilter('today')}
            >
              Today
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setQuickFilter('yesterday')}
            >
              Yesterday
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setQuickFilter('week')}
            >
              Last 7 Days
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setQuickFilter('month')}
            >
              This Month
            </button>
          </div>
        </form>
      </div>

      {error && <div className="toast toast-error mb-4" style={{ position: 'static' }}>{error}</div>}

      {loading ? (
        <div className="loading-overlay">
          <div className="spinner" />
        </div>
      ) : report ? (
        <>
          {/* Printable Report Header */}
          <div className="print-only mb-4 text-center">
            <h2>🌿 Ambika Trading · Payment Summary Report</h2>
            <p>
              Period: {formatDate(dateFrom)} to {formatDate(dateTo)}
            </p>
          </div>

          {/* ── Mode-wise KPI Cards ── */}
          <div className="grid grid-4 gap-4 mb-4">
            {modesList.map((modeKey) => {
              const info = PAYMENT_MODE_LABELS[modeKey];
              const data = breakdownMap.get(modeKey) || { count: 0, total_amount: 0 };
              const percent = grandTotal > 0 ? ((data.total_amount / grandTotal) * 100).toFixed(1) : '0.0';

              return (
                <div key={modeKey} className="card stat-card">
                  <div className="stat-label">
                    <span>{info.icon}</span> {info.en} ({info.mr})
                  </div>
                  <div className="stat-value font-mono" style={{ fontSize: '1.5rem', marginTop: 4 }}>
                    {formatCurrency(data.total_amount)}
                  </div>
                  <div className="stat-sub font-mono" style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{data.count} {data.count === 1 ? 'payment' : 'payments'}</span>
                    <span className="badge badge-secondary">{percent}%</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Grand Total Card ── */}
          <div className="card mb-4" style={{ background: 'var(--color-primary-light, #eef9f5)', borderColor: 'var(--color-primary, #059669)' }}>
            <div className="flex items-center justify-between">
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-primary-dark, #047857)', textTransform: 'uppercase' }}>
                  Grand Total Disbursed / एकूण वितरित रक्कम
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  Total {totalCount} successful payouts across all payment channels
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-bold" style={{ fontSize: '2rem', color: 'var(--color-primary, #059669)' }}>
                  {formatCurrency(grandTotal)}
                </div>
              </div>
            </div>
          </div>

          {/* ── Breakdown Table ── */}
          <div className="card">
            <h3 className="card-title mb-3">Channel Breakdown / माध्यमनिहाय तपशील</h3>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Payment Mode / पद्धत</th>
                    <th className="text-right">Payment Count</th>
                    <th className="text-right">Total Amount (₹)</th>
                    <th className="text-right">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {modesList.map((modeKey) => {
                    const info = PAYMENT_MODE_LABELS[modeKey];
                    const data = breakdownMap.get(modeKey) || { count: 0, total_amount: 0 };
                    const percent = grandTotal > 0 ? ((data.total_amount / grandTotal) * 100).toFixed(1) : '0.0';

                    return (
                      <tr key={modeKey}>
                        <td>
                          <strong>{info.icon} {info.en}</strong> · <span className="text-muted">{info.mr}</span>
                        </td>
                        <td className="text-right font-mono">{data.count}</td>
                        <td className="text-right font-mono font-bold">{formatCurrency(data.total_amount)}</td>
                        <td className="text-right font-mono">{percent}%</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--bg-secondary)', fontWeight: 700 }}>
                    <td>Grand Total / एकूण</td>
                    <td className="text-right font-mono">{totalCount}</td>
                    <td className="text-right font-mono text-primary" style={{ fontSize: '1.1rem' }}>
                      {formatCurrency(grandTotal)}
                    </td>
                    <td className="text-right font-mono">100.0%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
