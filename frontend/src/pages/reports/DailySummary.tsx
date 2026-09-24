/**
 * Ambika Trading — Daily Summary Report
 *
 * Daily trading report aggregating bills, farmers served,
 * vegetable weight breakdowns, deductions, and payments.
 */

import { useState, useEffect } from 'react';
import { reportService } from '../../services/report.service';
import { formatCurrency, todayISO } from '../../utils/formatters';
import type { DailySummary } from '../../types';

export default function DailySummaryReport() {
  const [dateFrom, setDateFrom] = useState(todayISO());
  const [dateTo, setDateTo] = useState(todayISO());
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReport();
  }, []);

  async function loadReport() {
    try {
      setLoading(true);
      setError(null);
      const data = await reportService.dailySummary(dateFrom, dateTo !== dateFrom ? dateTo : undefined);
      setSummary(data);
    } catch {
      setError('Failed to load daily report data');
    } finally {
      setLoading(false);
    }
  }

  function handleFilterSubmit(e: React.FormEvent) {
    e.preventDefault();
    loadReport();
  }

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="page-header no-print">
        <div>
          <h1 className="page-title">Daily Summary Report</h1>
          <p className="page-subtitle">दैनिक खरेदी व हिशोब अहवाल — Trading turnover and deductions breakdown</p>
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
          <button type="submit" className="btn btn-secondary">
            Filter Report
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              const t = todayISO();
              setDateFrom(t);
              setDateTo(t);
            }}
          >
            Today
          </button>
        </form>
      </div>

      {error && (
        <div className="toast toast-error mb-4" style={{ position: 'static' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading-overlay">
          <div className="spinner" />
        </div>
      ) : summary ? (
        <div id="printable-report">
          {/* Print Report Header */}
          <div className="only-print mb-4 pb-2" style={{ borderBottom: '2px solid #000' }}>
            <h2>Ambika Trading — Trading Summary Report</h2>
            <div>Period: {dateFrom} to {dateTo}</div>
          </div>

          {/* ── KPI Stat Cards ── */}
          <div className="grid grid-4 gap-4 mb-4">
            <div className="stat-card">
              <div className="stat-label">Total Settlements / पट्ट्या</div>
              <div className="stat-value">{summary.total_transactions}</div>
              <div className="text-xs text-muted mt-1">{summary.total_farmers_served} Farmers Served</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Gross Amount / एकूण खरेदी</div>
              <div className="stat-value">{formatCurrency(summary.total_gross_amount)}</div>
              <div className="text-xs text-warning mt-1">
                Deductions: −{formatCurrency(summary.total_deductions)}
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Net Payable / एकूण देय</div>
              <div className="stat-value text-primary">{formatCurrency(summary.total_net_payable)}</div>
              <div className="text-xs text-success mt-1">
                Paid: {formatCurrency(summary.total_payments_received)}
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Outstanding / शिल्लक बाकी</div>
              <div className="stat-value text-danger">{formatCurrency(summary.total_outstanding)}</div>
              <div className="text-xs text-muted mt-1">Pending payments</div>
            </div>
          </div>

          {/* ── Vegetable Breakdown Table ── */}
          <div className="card mb-4">
            <h2 className="card-title mb-3">Vegetable Intake & Sales Summary / भाजीपाला आवक व उलाढाल</h2>
            {summary.vegetable_breakdown.length === 0 ? (
              <div className="text-muted text-sm p-4 text-center">
                No vegetable transactions recorded for this date range.
              </div>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th>Vegetable Name / भाजी</th>
                      <th className="amount">Total Weight (KG) / वजन</th>
                      <th className="amount">Average Rate / 10 KG / सरासरी दर</th>
                      <th className="amount">Total Amount / एकूण रक्कम</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.vegetable_breakdown.map((item, idx) => (
                      <tr key={item.vegetable_id}>
                        <td className="text-muted">{idx + 1}</td>
                        <td style={{ fontWeight: 600 }}>{item.vegetable_name}</td>
                        <td className="amount">{item.total_weight_kg.toFixed(2)} KG</td>
                        <td className="amount currency">{formatCurrency(item.avg_rate_per_10kg)}</td>
                        <td className="amount currency" style={{ fontWeight: 600 }}>
                          {formatCurrency(item.total_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--bg-secondary)', fontWeight: 600 }}>
                      <td colSpan={2}>Grand Total:</td>
                      <td className="amount">
                        {summary.vegetable_breakdown
                          .reduce((s, it) => s + it.total_weight_kg, 0)
                          .toFixed(2)}{' '}
                        KG
                      </td>
                      <td></td>
                      <td className="amount currency text-primary" style={{ fontSize: '1.05rem' }}>
                        {formatCurrency(summary.total_gross_amount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
