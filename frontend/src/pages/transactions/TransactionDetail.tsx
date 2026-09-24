/**
 * Ambika Trading — Transaction Detail & Settlement Bill View
 *
 * Full settlement bill display, bill printing (Electron / browser),
 * payment collection, and cancellation with reason.
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { transactionService } from '../../services/transaction.service';
import { paymentService } from '../../services/payment.service';
import {
  formatCurrency,
  formatDate,
  getStatusDisplay,
  getPaymentModeLabel,
} from '../../utils/formatters';
import type {
  TransactionResponse,
  PaymentResponse,
  PaymentMode,
  PaymentCreate,
} from '../../types';

export default function TransactionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [transaction, setTransaction] = useState<TransactionResponse | null>(null);
  const [payments, setPayments] = useState<PaymentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Payment form
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Cancel form
  const [cancelReason, setCancelReason] = useState('');
  const [submittingCancel, setSubmittingCancel] = useState(false);

  useEffect(() => {
    if (id) {
      loadDetails(parseInt(id, 10));
    }
  }, [id]);

  async function loadDetails(txnId: number) {
    try {
      setLoading(true);
      setError(null);
      const [txnData, paymentsData] = await Promise.all([
        transactionService.get(txnId),
        paymentService.listForTransaction(txnId),
      ]);
      setTransaction(txnData);
      setPayments(paymentsData.items);
    } catch {
      setError('Failed to load transaction details.');
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    // If running in Electron, use IPC print or standard window.print()
    if ((window as any).electronAPI?.printBill) {
      (window as any).electronAPI.printBill();
    } else {
      window.print();
    }
  }

  function openPaymentModal() {
    if (!transaction) return;
    setPaymentAmount(transaction.balance_due);
    setPaymentMode('cash');
    setPaymentRef('');
    setPaymentNotes('');
    setShowPaymentModal(true);
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!transaction) return;

    const amt = Number(paymentAmount) || 0;
    if (amt <= 0) {
      alert('Payment amount must be greater than 0');
      return;
    }
    if (amt > transaction.balance_due) {
      alert(`Payment amount cannot exceed remaining balance of ${formatCurrency(transaction.balance_due)}`);
      return;
    }

    try {
      setSubmittingPayment(true);
      const payload: PaymentCreate = {
        transaction_id: transaction.id,
        amount: amt,
        payment_date: new Date().toISOString().split('T')[0],
        payment_mode: paymentMode,
        reference_number: paymentRef || null,
        notes: paymentNotes || null,
      };

      await paymentService.create(payload);
      setShowPaymentModal(false);
      await loadDetails(transaction.id);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to record payment');
    } finally {
      setSubmittingPayment(false);
    }
  }

  async function handleCancelTransaction(e: React.FormEvent) {
    e.preventDefault();
    if (!transaction) return;
    if (!cancelReason.trim()) {
      alert('Please specify a cancellation reason.');
      return;
    }

    try {
      setSubmittingCancel(true);
      await transactionService.cancel(transaction.id, cancelReason.trim());
      setShowCancelModal(false);
      await loadDetails(transaction.id);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to cancel transaction');
    } finally {
      setSubmittingCancel(false);
    }
  }

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner" />
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className="card text-center p-5">
        <div className="text-danger mb-3" style={{ fontSize: '2rem' }}>⚠️</div>
        <h3>{error || 'Transaction not found'}</h3>
        <button className="btn btn-secondary mt-3" onClick={() => navigate('/transactions')}>
          Back to Transactions
        </button>
      </div>
    );
  }

  const status = getStatusDisplay(transaction.status);
  const isCancelled = transaction.status === 'cancelled';
  const isFullyPaid = transaction.status === 'fully_paid';

  return (
    <div>
      {/* ── Top Action Bar (Hidden on Print) ── */}
      <div className="page-header no-print">
        <div className="flex items-center gap-3">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/transactions')}>
            ← Back
          </button>
          <div>
            <h1 className="page-title font-mono">{transaction.bill_number}</h1>
            <p className="page-subtitle">
              Settlement Bill for <strong>{transaction.farmer_name}</strong> ·{' '}
              {formatDate(transaction.transaction_date)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isCancelled && !isFullyPaid && (
            <button className="btn btn-success" onClick={openPaymentModal}>
              💰 Record Payment
            </button>
          )}

          <button className="btn btn-primary" onClick={handlePrint}>
            🖨️ Print Bill / पावती
          </button>

          {!isCancelled && (
            <button
              className="btn btn-ghost text-danger"
              onClick={() => setShowCancelModal(true)}
            >
              Cancel Bill
            </button>
          )}
        </div>
      </div>

      {/* ── Settlement Bill Printable Slip ── */}
      <div className="card bill-container" id="printable-bill" style={{ position: 'relative' }}>
        {/* Cancelled watermark */}
        {isCancelled && (
          <div
            style={{
              position: 'absolute',
              top: '35%',
              left: '50%',
              transform: 'translate(-50%, -50%) rotate(-25deg)',
              fontSize: '4.5rem',
              fontWeight: 800,
              color: 'rgba(239, 68, 68, 0.25)',
              border: '4px dashed rgba(239, 68, 68, 0.4)',
              padding: '10px 40px',
              borderRadius: '8px',
              pointerEvents: 'none',
              zIndex: 10,
              textTransform: 'uppercase',
            }}
          >
            CANCELLED
          </div>
        )}

        {/* Bill Header */}
        <div
          className="flex justify-between items-start pb-4 mb-4"
          style={{ borderBottom: '2px solid var(--border-default)' }}
        >
          <div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--primary)' }}>
              🌿 Ambika Trading (अंबिका ट्रेडिंग)
            </div>
            <div className="text-muted text-sm">
              Vegetable Commission Agent & Trader | भाजीपाला अडत व खरेदी-विक्री
            </div>
            <div className="text-muted text-xs mt-1">
              APMC Market Yard, Maharashtra · Ph: 9876543210
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-muted uppercase tracking-wider">Farmer Settlement Slip</div>
            <div className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700 }}>
              {transaction.bill_number}
            </div>
            <div className="text-sm mt-1">Date: {formatDate(transaction.transaction_date)}</div>
            <div className="mt-1">
              <span className={`badge ${status.className}`}>{status.label}</span>
            </div>
          </div>
        </div>

        {/* Farmer Info Bar */}
        <div
          className="grid grid-3 gap-3 p-3 mb-4"
          style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}
        >
          <div>
            <div className="text-xs text-muted">Farmer Name / शेतकरी:</div>
            <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>
              <Link to={`/farmers/${transaction.farmer_id}`} className="no-print">
                {transaction.farmer_name}
              </Link>
              <span className="only-print">{transaction.farmer_name}</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-muted">Bill ID:</div>
            <div className="font-mono text-sm">#{transaction.id}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Created Timestamp:</div>
            <div className="text-sm">{new Date(transaction.created_at).toLocaleString()}</div>
          </div>
        </div>

        {/* Items Table */}
        <div className="table-container mb-4">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Vegetable / भाजी</th>
                <th className="amount">Bags / डाग</th>
                <th className="amount">Weight (KG) / वजन</th>
                <th className="amount">Rate / 10 KG / दर</th>
                <th className="amount">Amount / रक्कम</th>
              </tr>
            </thead>
            <tbody>
              {transaction.items.map((item, index) => (
                <tr key={item.id}>
                  <td className="text-muted">{index + 1}</td>
                  <td style={{ fontWeight: 600 }}>{item.vegetable_name || `Item #${item.vegetable_id}`}</td>
                  <td className="amount">{item.bags_count}</td>
                  <td className="amount">{item.weight_kg.toFixed(2)}</td>
                  <td className="amount currency">{formatCurrency(item.rate_per_10kg)}</td>
                  <td className="amount currency" style={{ fontWeight: 600 }}>
                    {formatCurrency(item.item_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--bg-secondary)', fontWeight: 600 }}>
                <td colSpan={2}>Gross Total / एकूण वजन व रक्कम:</td>
                <td className="amount">
                  {transaction.items.reduce((s, it) => s + it.bags_count, 0)} Bags
                </td>
                <td className="amount">
                  {transaction.items.reduce((s, it) => s + it.weight_kg, 0).toFixed(2)} KG
                </td>
                <td></td>
                <td className="amount currency text-primary" style={{ fontSize: '1.05rem' }}>
                  {formatCurrency(transaction.gross_amount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Deductions & Summary Grid */}
        <div className="grid grid-2 gap-4 mb-4">
          {/* Deductions Breakdown */}
          <div
            className="p-3"
            style={{
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-default)',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
              Deductions Breakdown / कपात तपशील (Always Subtracted)
            </div>
            {transaction.deduction ? (
              <table style={{ width: '100%', fontSize: '0.9rem' }}>
                <tbody>
                  <tr>
                    <td className="text-muted py-1">Hamali (हमाली):</td>
                    <td className="text-right py-1 font-mono">
                      {transaction.deduction.hamali > 0 ? `−${formatCurrency(transaction.deduction.hamali)}` : '—'}
                    </td>
                  </tr>
                  <tr>
                    <td className="text-muted py-1">Bharai (भराई):</td>
                    <td className="text-right py-1 font-mono">
                      {transaction.deduction.bharai > 0 ? `−${formatCurrency(transaction.deduction.bharai)}` : '—'}
                    </td>
                  </tr>
                  <tr>
                    <td className="text-muted py-1">Tolai (तोलाई):</td>
                    <td className="text-right py-1 font-mono">
                      {transaction.deduction.tolai > 0 ? `−${formatCurrency(transaction.deduction.tolai)}` : '—'}
                    </td>
                  </tr>
                  <tr>
                    <td className="text-muted py-1">Mapai (मापाई):</td>
                    <td className="text-right py-1 font-mono">
                      {transaction.deduction.mapai > 0 ? `−${formatCurrency(transaction.deduction.mapai)}` : '—'}
                    </td>
                  </tr>
                  <tr>
                    <td className="text-muted py-1">Lekki (लेक्की / आडत):</td>
                    <td className="text-right py-1 font-mono">
                      {transaction.deduction.lekki > 0 ? `−${formatCurrency(transaction.deduction.lekki)}` : '—'}
                    </td>
                  </tr>
                  <tr>
                    <td className="text-muted py-1">Motor Bhada (मोटर भाडे):</td>
                    <td className="text-right py-1 font-mono">
                      {transaction.deduction.motor_bhada > 0 ? `−${formatCurrency(transaction.deduction.motor_bhada)}` : '—'}
                    </td>
                  </tr>
                  <tr>
                    <td className="text-muted py-1">
                      Other Deductions (इतर):
                      {transaction.deduction.other_deductions_note && (
                        <span className="text-xs text-muted block">
                          ({transaction.deduction.other_deductions_note})
                        </span>
                      )}
                    </td>
                    <td className="text-right py-1 font-mono">
                      {transaction.deduction.other_deductions > 0
                        ? `−${formatCurrency(transaction.deduction.other_deductions)}`
                        : '—'}
                    </td>
                  </tr>
                  <tr style={{ borderTop: '1px solid var(--border-default)', fontWeight: 600 }}>
                    <td className="py-2">Total Deductions (एकूण कपात):</td>
                    <td className="text-right py-2 text-warning font-mono">
                      −{formatCurrency(transaction.total_deductions)}
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <div className="text-muted text-sm">No deductions recorded.</div>
            )}
          </div>

          {/* Settlement Totals Card */}
          <div
            className="p-3 flex flex-col justify-between"
            style={{
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-default)',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
                Settlement Statement / अंतिम हिशोब
              </div>
              <div className="flex justify-between py-1 text-sm">
                <span className="text-muted">Gross Amount (एकूण):</span>
                <span className="font-mono">{formatCurrency(transaction.gross_amount)}</span>
              </div>
              <div className="flex justify-between py-1 text-sm">
                <span className="text-muted">Total Deductions (कपात):</span>
                <span className="font-mono text-warning">−{formatCurrency(transaction.total_deductions)}</span>
              </div>
              <div
                className="flex justify-between py-2 my-2"
                style={{
                  borderTop: '2px dashed var(--border-default)',
                  borderBottom: '2px dashed var(--border-default)',
                }}
              >
                <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>Net Payable (देय रक्कम):</span>
                <span style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--primary)' }}>
                  {formatCurrency(transaction.net_payable)}
                </span>
              </div>
              <div className="flex justify-between py-1 text-sm">
                <span className="text-muted">Total Paid (दिलेली रक्कम):</span>
                <span className="font-mono text-success">{formatCurrency(transaction.total_paid)}</span>
              </div>
              <div className="flex justify-between py-2 text-base" style={{ fontWeight: 600 }}>
                <span>Balance Due (शिल्लक):</span>
                <span className={transaction.balance_due > 0 ? 'text-danger' : 'text-success'}>
                  {formatCurrency(transaction.balance_due)}
                </span>
              </div>
            </div>

            {/* Signature Area for Print */}
            <div
              className="grid grid-2 gap-4 mt-6 pt-4 text-center text-xs text-muted"
              style={{ borderTop: '1px solid var(--border-default)' }}
            >
              <div>
                <div style={{ height: 35 }}></div>
                <div>Farmer Signature (शेतकरी स्वाक्षरी)</div>
              </div>
              <div>
                <div style={{ height: 35 }}></div>
                <div>For Ambika Trading (अधिकृत स्वाक्षरी)</div>
              </div>
            </div>
          </div>
        </div>

        {/* Cancellation Notice if Cancelled */}
        {isCancelled && transaction.cancel_reason && (
          <div
            className="p-3 mb-4 text-danger"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--danger)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <strong>Cancelled Reason:</strong> {transaction.cancel_reason}
          </div>
        )}

        {/* Payment History Table (Visible on Screen & Print) */}
        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Payment History / भरणा नोंदी</h3>
            {!isCancelled && !isFullyPaid && (
              <button className="btn btn-ghost btn-sm text-primary no-print" onClick={openPaymentModal}>
                + Add Payment
              </button>
            )}
          </div>

          {payments.length === 0 ? (
            <div className="text-muted text-sm p-3 text-center" style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
              No payments made yet. Total amount of {formatCurrency(transaction.net_payable)} is outstanding.
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Payment Mode</th>
                    <th>Reference / Cheque No.</th>
                    <th>Notes</th>
                    <th className="amount">Amount Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => {
                    const mode = getPaymentModeLabel(p.payment_mode);
                    return (
                      <tr key={p.id}>
                        <td>{formatDate(p.payment_date)}</td>
                        <td>
                          <span className="badge badge-draft">{mode}</span>
                        </td>
                        <td className="font-mono text-muted">{p.reference_number || '—'}</td>
                        <td className="text-muted">{p.notes || '—'}</td>
                        <td className="amount currency text-success" style={{ fontWeight: 600 }}>
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

      {/* ── Record Payment Modal ── */}
      {showPaymentModal && (
        <div className="modal-backdrop no-print">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Record Payment / रक्कम जमा करा</h3>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowPaymentModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleRecordPayment}>
              <div className="modal-body">
                <div className="p-3 mb-3" style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                  <div className="text-xs text-muted">Settling against bill:</div>
                  <div className="font-mono" style={{ fontWeight: 600 }}>
                    {transaction.bill_number} · {transaction.farmer_name}
                  </div>
                  <div className="flex justify-between mt-2 text-sm">
                    <span>Balance Due:</span>
                    <strong className="text-danger">{formatCurrency(transaction.balance_due)}</strong>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Payment Amount (₹) <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={transaction.balance_due}
                    className="form-input"
                    value={paymentAmount}
                    onChange={(e) =>
                      setPaymentAmount(e.target.value ? parseFloat(e.target.value) : '')
                    }
                    required
                    autoFocus
                  />
                  <div className="text-muted text-xs mt-1">
                    Enter full or partial payment amount. Cannot exceed {formatCurrency(transaction.balance_due)}.
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Mode</label>
                  <select
                    className="form-select"
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                  >
                    <option value="cash">Cash (रोख)</option>
                    <option value="upi">UPI / Online</option>
                    <option value="bank_transfer">Bank Transfer (NEFT/RTGS)</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Reference No. (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. UTR / UPI Ref / Cheque No."
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                  />
                </div>

                <div className="form-group mb-0">
                  <label className="form-label">Notes (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Paid in cash at market"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowPaymentModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submittingPayment}>
                  {submittingPayment ? 'Saving...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Cancel Bill Modal ── */}
      {showCancelModal && (
        <div className="modal-backdrop no-print">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title text-danger">Cancel Bill / पावती रद्द करा</h3>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowCancelModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCancelTransaction}>
              <div className="modal-body">
                <div className="p-3 mb-3 text-warning" style={{ background: 'rgba(245, 158, 11, 0.1)', borderRadius: 'var(--radius-md)', fontSize: '0.9rem' }}>
                  ⚠️ Cancelling this bill will void all settlement balances for {transaction.bill_number}. This action is recorded in the audit trail and cannot be undone.
                </div>

                <div className="form-group mb-0">
                  <label className="form-label">
                    Mandatory Reason for Cancellation <span className="text-danger">*</span>
                  </label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="Explain why this bill is being cancelled (e.g. wrong weight entered, duplicate bill)..."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCancelModal(false)}
                >
                  Close
                </button>
                <button type="submit" className="btn btn-danger" disabled={submittingCancel}>
                  {submittingCancel ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
