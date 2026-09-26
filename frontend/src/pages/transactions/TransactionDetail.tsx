/**
 * Ambika Trading — Transaction Detail & Settlement Bill View
 *
 * Full settlement bill display, bill printing (Electron / browser),
 * payment collection, and cancellation with reason.
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { transactionService } from '../../services/transaction.service';
import { paymentService } from '../../services/payment.service';
import {
  formatCurrency,
  formatDate,
  formatNumber,
  getStatusDisplay,
  getPaymentModeLabel,
  splitRupeesPaise,
  amountToWordsMarathi,
} from '../../utils/formatters';
import type {
  TransactionResponse,
  PaymentResponse,
  PaymentMode,
  PaymentCreate,
} from '../../types';

function GaneshIcon() {
  return (
    <svg
      width="68"
      height="78"
      viewBox="0 0 100 115"
      fill="none"
      stroke="#000000"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Mukut / Crown */}
      <path d="M35 30 L50 8 L65 30 Z" fill="#ffffff" />
      <path d="M42 20 L50 14 L58 20" />
      <circle cx="50" cy="7" r="2.5" fill="#000000" />
      <path d="M30 30 Q50 25 70 30" />

      {/* Head / Tilak */}
      <path d="M30 30 Q25 45 32 55" />
      <path d="M70 30 Q75 45 68 55" />
      <path d="M50 28 L50 38" strokeWidth="2.5" />
      <path d="M46 32 Q50 36 54 32" strokeWidth="1.8" />
      <circle cx="50" cy="26" r="1.5" fill="#000000" />

      {/* Ears */}
      <path d="M30 32 Q10 38 14 55 Q18 68 32 62" fill="#ffffff" />
      <path d="M70 32 Q90 38 86 55 Q82 68 68 62" fill="#ffffff" />
      <path d="M22 45 Q20 54 26 56" strokeWidth="1.5" />
      <path d="M78 45 Q80 54 74 56" strokeWidth="1.5" />

      {/* Eyes */}
      <ellipse cx="42" cy="42" rx="3" ry="1.5" fill="#000000" />
      <ellipse cx="58" cy="42" rx="3" ry="1.5" fill="#000000" />

      {/* Trunk */}
      <path d="M44 48 Q47 62 44 75 Q40 86 32 86 Q25 86 26 80 Q27 75 32 76" fill="#ffffff" />
      <path d="M56 48 Q55 60 52 70 Q49 78 42 81" />
      <circle cx="28" cy="78" r="3" fill="#000000" />

      {/* Tusks */}
      <path d="M38 56 L33 59" strokeWidth="3" />
      <path d="M62 56 L66 58" strokeWidth="2.5" />

      {/* Seated Body */}
      <path d="M32 66 Q20 85 24 100 Q40 108 50 108 Q60 108 76 100 Q80 85 68 66" fill="#ffffff" />
      <circle cx="50" cy="94" r="1.5" fill="#000000" />
      <path d="M42 90 Q50 97 58 90" strokeWidth="1.5" />

      {/* Hands */}
      <path d="M22 70 Q14 74 15 82 Q20 84 25 78" fill="#ffffff" />
      <path d="M78 70 Q86 74 85 82 Q80 84 75 78" fill="#ffffff" />
      <circle cx="83" cy="78" r="3" fill="#000000" />

      {/* Lotus Base */}
      <path d="M18 102 Q50 114 82 102" strokeWidth="2" />
      <path d="M25 106 Q50 116 75 106" strokeWidth="1.5" />
    </svg>
  );
}

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

  async function handlePrint() {
    try {
      if (transaction) {
        const updated = await transactionService.recordPrint(transaction.id);
        setTransaction(updated);
      }
    } catch (e) {
      console.error('Failed to record print count', e);
    }
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
  const isUnpaidSaved = transaction.status === 'saved' && transaction.total_paid === 0;
  const isDuplicate = !isCancelled && (transaction.print_count !== undefined && transaction.print_count >= 1);

  const totalBags = transaction.items.reduce((s, it) => s + (Number(it.bags_count) || 0), 0);
  const totalWeight = transaction.items.reduce((s, it) => s + (Number(it.weight_kg) || 0), 0);

  const deductionRows = [
    { label: 'हमली', amount: transaction.deduction?.hamali || 0 },
    { label: 'भराई', amount: transaction.deduction?.bharai || 0 },
    { label: 'तोलाई', amount: transaction.deduction?.tolai || 0 },
    { label: 'मापाई', amount: transaction.deduction?.mapai || 0 },
    { label: 'लेव्ही', amount: transaction.deduction?.lekki || 0 },
    { label: 'मो.भाडे', amount: transaction.deduction?.motor_bhada || 0 },
  ];
  if (transaction.deduction?.other_deductions && transaction.deduction.other_deductions > 0) {
    deductionRows.push({
      label: transaction.deduction.other_deductions_note ? `इतर (${transaction.deduction.other_deductions_note})` : 'इतर',
      amount: transaction.deduction.other_deductions,
    });
  }

  const tableRowCount = Math.max(transaction.items.length, deductionRows.length, 6);

  return (
    <div>
      {/* ── Top Action Bar (Hidden on Print) ── */}
      <div className="page-header no-print">
        <div className="flex items-center gap-3">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/transactions')}>
            ← Back
          </button>
          <div>
            <h1 className="page-title font-mono">
              {transaction.bill_number}
              <span className={`badge ${status.className}`} style={{ fontSize: '0.75rem', verticalAlign: 'middle', marginLeft: 8 }}>
                {status.label}
              </span>
            </h1>
            <p className="page-subtitle">
              Settlement Bill for <strong>{transaction.farmer_name}</strong> ·{' '}
              {formatDate(transaction.transaction_date)}
              {isDuplicate && (
                <span className="badge badge-warning" style={{ marginLeft: 8 }}>
                  DUPLICATE (Printed {transaction.print_count}x)
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Phase C: Edit Bill button (only when saved & unpaid) */}
          {isUnpaidSaved && (
            <button
              className="btn btn-secondary"
              onClick={() => navigate(`/transactions/edit/${transaction.id}`)}
            >
              ✏️ Edit Bill
            </button>
          )}

          {!isCancelled && !isFullyPaid && (
            <button className="btn btn-success" onClick={openPaymentModal}>
              💰 Record Payment
            </button>
          )}

          <button className="btn btn-primary" onClick={handlePrint}>
            🖨️ {isDuplicate ? 'Print Duplicate Bill' : 'Print Bill / पावती'}
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

      {/* ═══════════════════════════════════════════════════
          AUTHENTIC AMBIKA TRADING PAPER BILL (MATCHES ORIGINAL)
         ═══════════════════════════════════════════════════ */}
      <div className="traditional-paper-bill" id="printable-bill" style={{ position: 'relative' }}>
        {/* Cancelled watermark */}
        {isCancelled ? (
          <div
            style={{
              position: 'absolute',
              top: '40%',
              left: '50%',
              transform: 'translate(-50%, -50%) rotate(-25deg)',
              fontSize: '4.5rem',
              fontWeight: 800,
              color: 'rgba(239, 68, 68, 0.22)',
              border: '4px dashed rgba(239, 68, 68, 0.35)',
              padding: '10px 40px',
              borderRadius: '8px',
              pointerEvents: 'none',
              zIndex: 10,
              textTransform: 'uppercase',
            }}
          >
            CANCELLED
          </div>
        ) : isDuplicate ? (
          <div
            style={{
              position: 'absolute',
              top: '40%',
              left: '50%',
              transform: 'translate(-50%, -50%) rotate(-25deg)',
              fontSize: '4.5rem',
              fontWeight: 800,
              color: 'rgba(245, 158, 11, 0.22)',
              border: '4px dashed rgba(245, 158, 11, 0.35)',
              padding: '10px 40px',
              borderRadius: '8px',
              pointerEvents: 'none',
              zIndex: 10,
              textTransform: 'uppercase',
            }}
          >
            DUPLICATE
          </div>
        ) : null}

        {/* ── 1. Top Jurisdiction & Blessings Row ── */}
        <div className="bill-top-meta">
          <div>पुणे न्यायदानाच्या कक्षेत</div>
          <div className="bill-blessings">
            <div>श्री. गजानन प्रसन्न</div>
            <div>श्री. जगदंब प्रसन्न</div>
          </div>
          <div>कुमार खराडे ९३५९१५७३६९</div>
        </div>

        {/* ── 2. Firm Header with Lord Ganesha Emblem ── */}
        <div className="bill-firm-header">
          <div className="bill-ganesh-icon">
            <GaneshIcon />
          </div>
          <div className="bill-firm-titles">
            <h1 className="bill-firm-name">मे. अंबिका ट्रेडिंग कंपनी</h1>
            <div className="bill-firm-sub">सर्व प्रकारचे भाजीपाला व तरकारी मालाचे आडतदार</div>
            <div className="bill-firm-address">श्री. नागेश्वर महाराज मोशी उपबाजार समिती, पुणे</div>
            <div className="bill-firm-contacts">
              <span>एस. जी. तनपुरे ९९२२९७४२०९</span>
              <span>संदिप खराडे ९५९४१६१६५२</span>
            </div>
          </div>
        </div>

        {/* ── 3. Bill Information Lines (No, Date, Farmer, Village, Buyer, Bags) ── */}
        <div className="bill-info-lines">
          {/* Row 1: Bill No & Date */}
          <div className="bill-info-row-item">
            <div className="bill-info-left">
              <span className="line-label">नं :</span>
              <span className="line-val font-mono">{transaction.bill_number}</span>
            </div>
            <div className="bill-info-right">
              <span className="line-label">दि. :</span>
              <span className="line-val font-mono">{formatDate(transaction.transaction_date)}</span>
            </div>
          </div>

          {/* Row 2: Farmer Name & Village */}
          <div className="bill-info-row-item">
            <div className="bill-info-left">
              <span className="line-label">मालधण्याचे नाव :</span>
              <span className="line-val">{transaction.farmer_name}</span>
            </div>
            <div className="bill-info-right">
              <span className="line-label">गाव :</span>
              <span className="line-val">{transaction.farmer_village || '—'}</span>
            </div>
          </div>

          {/* Row 3: Buyer's Name & Total Bags */}
          <div className="bill-info-row-item">
            <div className="bill-info-left">
              <span className="line-label">खरेदीदाराचे नाव :</span>
              <span className="line-val">{transaction.buyer_name || '—'}</span>
            </div>
            <div className="bill-info-right">
              <span className="line-label">एकुण डाग :</span>
              <span className="line-val font-mono">{totalBags}</span>
            </div>
          </div>
        </div>

        {/* ── 4. Main Two-Sided Table (Items LEFT | Deductions RIGHT) ── */}
        <table className="bill-grid-table">
          <thead>
            <tr>
              <th style={{ width: '20%' }} rowSpan={2}>मालाचा<br />प्रकार</th>
              <th style={{ width: '12%' }} rowSpan={2}>एकुण वजन<br />किलो</th>
              <th style={{ width: '12%' }} rowSpan={2}>दर १०<br />किलोस</th>
              <th style={{ width: '16%' }} colSpan={2}>एकुण</th>
              <th style={{ width: '16%' }} rowSpan={2}>खर्चाचा<br />तपशील</th>
              <th style={{ width: '14%' }} colSpan={2}>रक्कम</th>
            </tr>
            <tr>
              <th style={{ width: '10%' }} className="col-sub">रुपये</th>
              <th style={{ width: '6%' }} className="col-sub">पैसे</th>
              <th style={{ width: '9%' }} className="col-sub">रुपये</th>
              <th style={{ width: '5%' }} className="col-sub">पैसे</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: tableRowCount }).map((_, i) => {
              const item = transaction.items[i];
              const ded = deductionRows[i];
              const itemSplit = item ? splitRupeesPaise(item.item_amount) : { rupees: '', paise: '' };
              const dedSplit = ded && ded.amount > 0 ? splitRupeesPaise(ded.amount) : { rupees: '', paise: '' };

              return (
                <tr key={i}>
                  {/* Left item columns */}
                  <td style={{ fontWeight: item ? 700 : 'normal', verticalAlign: 'middle' }}>
                    {item ? item.vegetable_name || `Item #${item.vegetable_id}` : ''}
                  </td>
                  <td className="font-mono" style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                    {item ? item.weight_kg.toFixed(2) : ''}
                  </td>
                  <td className="font-mono" style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                    {item ? item.rate_per_10kg.toFixed(2) : ''}
                  </td>
                  <td className="font-mono" style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                    {item ? itemSplit.rupees : ''}
                  </td>
                  <td className="font-mono" style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                    {item ? itemSplit.paise : ''}
                  </td>

                  {/* Right deduction columns */}
                  <td className="col-deduction-detail" style={{ verticalAlign: 'middle' }}>
                    {ded ? ded.label : ''}
                  </td>
                  <td className="font-mono" style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                    {ded && ded.amount > 0 ? dedSplit.rupees : ''}
                  </td>
                  <td className="font-mono" style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                    {ded && ded.amount > 0 ? dedSplit.paise : ''}
                  </td>
                </tr>
              );
            })}

            {/* Ekun Kharch (Total Deductions) row — matches paper bill */}
            <tr className="bill-ekun-kharch-row">
              <td style={{ textAlign: 'center' }}>एकुण</td>
              <td className="font-mono" style={{ textAlign: 'right' }}>{totalWeight.toFixed(2)}</td>
              <td></td>
              <td className="font-mono" style={{ textAlign: 'right' }}>{splitRupeesPaise(transaction.gross_amount).rupees}</td>
              <td className="font-mono" style={{ textAlign: 'center' }}>{splitRupeesPaise(transaction.gross_amount).paise}</td>
              <td style={{ textAlign: 'center', fontWeight: 800, fontSize: '12.5px' }}>एकुण<br />खर्च</td>
              <td className="font-mono" style={{ textAlign: 'right', fontWeight: 800 }}>{splitRupeesPaise(transaction.total_deductions).rupees}</td>
              <td className="font-mono" style={{ textAlign: 'center', fontWeight: 800 }}>{splitRupeesPaise(transaction.total_deductions).paise}</td>
            </tr>
          </tbody>
        </table>

        {/* ── 5. Bottom Settlement Summary Box ── */}
        <div className="bill-bottom-grid">
          {/* Left: Chukbhool Dene Ghene + Nakki Rupaye */}
          <div className="bottom-col-nakki">
            <div className="e-and-oe">चुकभूल देणे घेणे</div>
            <div className="nakki-box">नक्की रुपये</div>
            <div className="nakki-val font-mono">₹{formatNumber(transaction.net_payable, 2)}</div>
          </div>

          {/* Center: Calculations Summary */}
          <div className="bottom-col-calc">
            <div className="calc-row">
              <span className="calc-label">एकुण रुपये</span>
              <span className="calc-val font-mono">₹{formatNumber(transaction.gross_amount, 2)}</span>
            </div>
            <div className="calc-row">
              <span className="calc-label">वजा खर्च</span>
              <span className="calc-val font-mono">₹{formatNumber(transaction.total_deductions, 2)}</span>
            </div>
            <div className="calc-row font-bold">
              <span className="calc-label">न. शिल्लक</span>
              <span className="calc-val font-mono">₹{formatNumber(transaction.net_payable, 2)}</span>
            </div>
          </div>

          {/* Right: Firm Name + Proprietor Signature */}
          <div className="bottom-col-sign">
            <div className="firm-sign-title">मे. अंबिका ट्रेडिंग कं</div>
            <div className="signature-space"></div>
            <div className="proprietor-label">प्रोप्रायटर</div>
          </div>
        </div>

        {/* ── 6. Bottom Underlined Amount in Words & Acknowledgment ── */}
        <div className="bill-footer-words">
          <div className="words-left">
            <span className="words-label">हिशोबपट्टीत नमूद केल्याप्रमाणे अक्षरी रु.</span>
            <span className="words-value">{amountToWordsMarathi(transaction.net_payable)}</span>
          </div>
          <div className="words-right">
            <span>पोहोचले / पाठविले.</span>
          </div>
        </div>
      </div>

      {/* ── Cancellation Banner (Screen Only) ── */}
      {isCancelled && transaction.cancel_reason && (
        <div
          className="card p-3 my-4 text-danger no-print"
          style={{
            background: 'var(--color-danger-bg)',
            border: '1px solid var(--border-error)',
            borderRadius: 'var(--radius-md)',
            maxWidth: 820,
            margin: '16px auto',
          }}
        >
          <strong>Cancelled Reason:</strong> {transaction.cancel_reason}
        </div>
      )}

      {/* ── Payment History Table (Screen Only — Hidden on Print) ── */}
      <div className="card mt-4 no-print" style={{ maxWidth: 820, margin: '20px auto' }}>
        <div className="flex justify-between items-center mb-2">
          <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Payment History / भरणा नोंदी</h3>
          {!isCancelled && !isFullyPaid && (
            <button className="btn btn-ghost btn-sm text-primary no-print" onClick={openPaymentModal}>
              + Add Payment
            </button>
          )}
        </div>

        {payments.length === 0 ? (
          <div className="text-muted text-sm p-3 text-center" style={{ background: 'var(--surface-elevated)', borderRadius: 'var(--radius-md)' }}>
            No payments made yet. Total amount of {formatCurrency(transaction.net_payable)} is outstanding.
          </div>
        ) : (
          <div className="table-responsive">
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
                        <span className="badge badge-secondary">{mode}</span>
                      </td>
                      <td className="font-mono text-muted">{p.reference_number || '—'}</td>
                      <td className="text-muted">{p.notes || '—'}</td>
                      <td className="amount currency text-success font-mono" style={{ fontWeight: 600 }}>
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
                <div className="p-3 mb-3 text-warning" style={{ background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning)', borderRadius: 'var(--radius-md)', fontSize: '0.9rem' }}>
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
