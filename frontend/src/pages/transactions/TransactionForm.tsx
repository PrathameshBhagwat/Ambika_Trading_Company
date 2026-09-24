/**
 * Ambika Trading — Transaction Entry Form
 *
 * Full settlement entry workflow:
 * - Farmer selection with on-the-fly registration modal
 * - Multi-item vegetable entry with live (weight/10)*rate calculation
 * - Deductions entry (Hamali, Bharai, Tolai, Mapai, Lekki, Motor Bhada, Other)
 * - Net payable calculation & validation
 * - Optional instant payment recording on save
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { farmerService } from '../../services/farmer.service';
import { vegetableService } from '../../services/vegetable.service';
import { transactionService } from '../../services/transaction.service';
import { paymentService } from '../../services/payment.service';
import { formatCurrency, todayISO } from '../../utils/formatters';
import type {
  Farmer,
  FarmerCreate,
  Vegetable,
  TransactionCreate,
  DeductionCreate,
  PaymentMode,
} from '../../types';

interface LineItemState {
  id: string; // client temporary key
  vegetable_id: number | '';
  bags_count: number | '';
  weight_kg: number | '';
  rate_per_10kg: number | '';
  calculated_amount: number;
}

export default function TransactionForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);

  // Reference lists
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [vegetables, setVegetables] = useState<Vegetable[]>([]);
  const [loadingMasters, setLoadingMasters] = useState(true);
  const [loadingTxn, setLoadingTxn] = useState(false);
  const [billNumber, setBillNumber] = useState<string>('');

  // Form state
  const [transactionDate, setTransactionDate] = useState(todayISO());
  const [selectedFarmerId, setSelectedFarmerId] = useState<number | ''>('');
  const [farmerSearch, setFarmerSearch] = useState('');

  // Line items
  const [items, setItems] = useState<LineItemState[]>([
    {
      id: '1',
      vegetable_id: '',
      bags_count: '',
      weight_kg: '',
      rate_per_10kg: '',
      calculated_amount: 0,
    },
  ]);

  // Deductions
  const [deductions, setDeductions] = useState<DeductionCreate>({
    hamali: 0,
    bharai: 0,
    tolai: 0,
    mapai: 0,
    lekki: 0,
    motor_bhada: 0,
    other_deductions: 0,
    other_deductions_note: '',
  });

  // Optional instant payment
  const [recordPaymentNow, setRecordPaymentNow] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [paymentRef, setPaymentRef] = useState('');

  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quick-create farmer modal
  const [showQuickFarmerModal, setShowQuickFarmerModal] = useState(false);
  const [quickFarmerData, setQuickFarmerData] = useState<FarmerCreate>({
    name: '',
    mobile: '',
    village: '',
    address: '',
    notes: '',
  });
  const [creatingFarmer, setCreatingFarmer] = useState(false);

  useEffect(() => {
    loadMasters();
  }, []);

  async function loadMasters() {
    try {
      setLoadingMasters(true);
      const [farmersRes, vegRes] = await Promise.all([
        farmerService.list({ limit: 500 }),
        vegetableService.list({ is_active: true, limit: 100 }),
      ]);
      setFarmers(farmersRes.items);
      setVegetables(vegRes.items);
    } catch {
      setError('Failed to load farmer or vegetable lists.');
    } finally {
      setLoadingMasters(false);
    }
  }

  useEffect(() => {
    if (id) {
      loadExistingTransaction(Number(id));
    }
  }, [id]);

  async function loadExistingTransaction(txnId: number) {
    try {
      setLoadingTxn(true);
      const txn = await transactionService.get(txnId);
      if (txn.status !== 'saved' || (txn.total_paid && txn.total_paid > 0)) {
        setError(
          `Cannot edit bill ${txn.bill_number}: Status is '${txn.status}' with paid amount of ${formatCurrency(txn.total_paid)}. Only unpaid saved transactions can be edited.`
        );
        return;
      }
      setBillNumber(txn.bill_number);
      setTransactionDate(txn.transaction_date);
      setSelectedFarmerId(txn.farmer_id);
      if (txn.items && txn.items.length > 0) {
        setItems(
          txn.items.map((it) => ({
            id: it.id.toString(),
            vegetable_id: it.vegetable_id,
            bags_count: it.bags_count,
            weight_kg: it.weight_kg,
            rate_per_10kg: it.rate_per_10kg,
            calculated_amount: it.item_amount,
          }))
        );
      }
      if (txn.deduction) {
        setDeductions({
          hamali: txn.deduction.hamali,
          bharai: txn.deduction.bharai,
          tolai: txn.deduction.tolai,
          mapai: txn.deduction.mapai,
          lekki: txn.deduction.lekki,
          motor_bhada: txn.deduction.motor_bhada,
          other_deductions: txn.deduction.other_deductions,
          other_deductions_note: txn.deduction.other_deductions_note || '',
        });
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load transaction for editing.');
    } finally {
      setLoadingTxn(false);
    }
  }

  // Calculate line item amount: (weight / 10) * rate
  function calcItemAmount(weight: number | '', rate: number | ''): number {
    const w = Number(weight) || 0;
    const r = Number(rate) || 0;
    if (w <= 0 || r <= 0) return 0;
    return Math.round((w / 10) * r * 100) / 100;
  }

  // Update line item
  function handleItemChange(
    index: number,
    field: keyof Omit<LineItemState, 'id' | 'calculated_amount'>,
    val: any
  ) {
    setItems((prev) => {
      const next = [...prev];
      const current = { ...next[index], [field]: val };
      current.calculated_amount = calcItemAmount(current.weight_kg, current.rate_per_10kg);
      next[index] = current;
      return next;
    });
  }

  function addItemRow() {
    setItems((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        vegetable_id: '',
        bags_count: '',
        weight_kg: '',
        rate_per_10kg: '',
        calculated_amount: 0,
      },
    ]);
  }

  function removeItemRow(index: number) {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  // Deduction change
  function handleDeductionChange(field: keyof DeductionCreate, val: string) {
    if (field === 'other_deductions_note') {
      setDeductions((prev) => ({ ...prev, [field]: val }));
    } else {
      const num = parseFloat(val) || 0;
      setDeductions((prev) => ({ ...prev, [field]: Math.max(0, num) }));
    }
  }

  // Calculations
  const totalBags = items.reduce((sum, item) => sum + (Number(item.bags_count) || 0), 0);
  const totalWeight = Math.round(items.reduce((sum, item) => sum + (Number(item.weight_kg) || 0), 0) * 100) / 100;
  const grossAmount = Math.round(items.reduce((sum, item) => sum + item.calculated_amount, 0) * 100) / 100;

  const totalDeductions = Math.round(
    ((deductions.hamali || 0) +
      (deductions.bharai || 0) +
      (deductions.tolai || 0) +
      (deductions.mapai || 0) +
      (deductions.lekki || 0) +
      (deductions.motor_bhada || 0) +
      (deductions.other_deductions || 0)) *
      100
  ) / 100;

  const netPayable = Math.max(0, Math.round((grossAmount - totalDeductions) * 100) / 100);

  // Sync default payment amount if recordPaymentNow is enabled
  useEffect(() => {
    if (recordPaymentNow && (paymentAmount === '' || paymentAmount === 0)) {
      setPaymentAmount(netPayable);
    }
  }, [recordPaymentNow, netPayable]);

  // Farmer filter
  const filteredFarmers = farmers.filter((f) => {
    if (!farmerSearch) return true;
    const term = farmerSearch.toLowerCase();
    return (
      f.name.toLowerCase().includes(term) ||
      (f.village && f.village.toLowerCase().includes(term)) ||
      (f.mobile && f.mobile.includes(term))
    );
  });

  const selectedFarmer = farmers.find((f) => f.id === selectedFarmerId);

  // Submit Handler
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validation
    if (!selectedFarmerId) {
      setError('Please select a farmer.');
      return;
    }

    if (items.length === 0) {
      setError('At least one vegetable item is required.');
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.vegetable_id) {
        setError(`Row ${i + 1}: Please select a vegetable.`);
        return;
      }
      if (!it.bags_count || Number(it.bags_count) <= 0) {
        setError(`Row ${i + 1}: Bags count must be greater than 0.`);
        return;
      }
      if (!it.weight_kg || Number(it.weight_kg) <= 0) {
        setError(`Row ${i + 1}: Weight must be greater than 0.`);
        return;
      }
      if (!it.rate_per_10kg || Number(it.rate_per_10kg) <= 0) {
        setError(`Row ${i + 1}: Rate per 10 KG must be greater than 0.`);
        return;
      }
    }

    if (totalDeductions > grossAmount) {
      setError(`Total deductions (${formatCurrency(totalDeductions)}) cannot exceed gross amount (${formatCurrency(grossAmount)}).`);
      return;
    }

    if (recordPaymentNow) {
      const pAmt = Number(paymentAmount) || 0;
      if (pAmt <= 0) {
        setError('Payment amount must be greater than ₹0.');
        return;
      }
      if (pAmt > netPayable) {
        setError(`Payment amount cannot exceed Net Payable (${formatCurrency(netPayable)}).`);
        return;
      }
    }

    try {
      setSaving(true);

      const payload: TransactionCreate = {
        transaction_date: transactionDate,
        farmer_id: Number(selectedFarmerId),
        items: items.map((it) => ({
          vegetable_id: Number(it.vegetable_id),
          bags_count: Math.round(Number(it.bags_count)),
          weight_kg: Number(it.weight_kg),
          rate_per_10kg: Number(it.rate_per_10kg),
        })),
        deductions: {
          hamali: Number(deductions.hamali) || 0,
          bharai: Number(deductions.bharai) || 0,
          tolai: Number(deductions.tolai) || 0,
          mapai: Number(deductions.mapai) || 0,
          lekki: Number(deductions.lekki) || 0,
          motor_bhada: Number(deductions.motor_bhada) || 0,
          other_deductions: Number(deductions.other_deductions) || 0,
          other_deductions_note: deductions.other_deductions_note || null,
        },
      };

      if (isEdit) {
        const confirmed = window.confirm(
          `Confirm modifications to Bill ${billNumber}?\n\nAll amounts, weight, and deductions will be recalculated server-side.`
        );
        if (!confirmed) {
          setSaving(false);
          return;
        }

        const updatedTxn = await transactionService.update(Number(id), payload);
        navigate(`/transactions/${updatedTxn.id}`);
        return;
      }

      const createdTxn = await transactionService.create(payload);

      // Record immediate payment if checked
      if (recordPaymentNow && Number(paymentAmount) > 0) {
        await paymentService.create({
          transaction_id: createdTxn.id,
          amount: Number(paymentAmount),
          payment_date: transactionDate,
          payment_mode: paymentMode,
          reference_number: paymentRef || null,
          notes: 'Settled at bill generation',
        });
      }

      // Navigate to the transaction detail & print view
      navigate(`/transactions/${createdTxn.id}`);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save transaction');
    } finally {
      setSaving(false);
    }
  }

  // Quick farmer creation
  async function handleQuickFarmerSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!quickFarmerData.name.trim()) return;

    try {
      setCreatingFarmer(true);

      // Check duplicate farmer warning
      const dupCheck = await farmerService.checkDuplicate(
        quickFarmerData.name,
        quickFarmerData.mobile || null
      );

      if (dupCheck.is_duplicate && dupCheck.matches.length > 0) {
        const matchSummary = dupCheck.matches
          .slice(0, 3)
          .map(
            (m) =>
              `• ${m.name} ${m.village ? `(${m.village})` : ''} ${m.mobile ? `· ${m.mobile}` : ''} [${m.match_reason}]`
          )
          .join('\n');

        const proceed = window.confirm(
          `⚠️ Duplicate Farmer Warning / शेतकरी आधीच अस्तित्वात असण्याची शक्यता:\n\nA farmer with similar details already exists:\n\n${matchSummary}\n\nDo you want to continue registering this farmer anyway?\n(Cancel to review, OK to continue)`
        );
        if (!proceed) {
          setCreatingFarmer(false);
          return;
        }
      }

      const newFarmer = await farmerService.create(quickFarmerData);
      setFarmers((prev) => [newFarmer, ...prev]);
      setSelectedFarmerId(newFarmer.id);
      setShowQuickFarmerModal(false);
      setQuickFarmerData({ name: '', mobile: '', village: '', address: '', notes: '' });
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to register farmer');
    } finally {
      setCreatingFarmer(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {isEdit ? `Edit Settlement Bill — ${billNumber}` : 'New Farmer Settlement'}
          </h1>
          <p className="page-subtitle">
            {isEdit
              ? `पावती दुरुस्ती — Bill Number ${billNumber} will be preserved; amounts will be recalculated server-side`
              : 'नवीन शेतकरी हिशोब पट्टी — Record vegetable delivery & deductions'}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => navigate(isEdit ? `/transactions/${id}` : '/transactions')}
        >
          ← {isEdit ? 'Cancel & Return to Bill' : 'Back to Transactions'}
        </button>
      </div>

      {error && (
        <div className="toast toast-error mb-4" style={{ position: 'static' }}>
          {error}
        </div>
      )}

      {loadingMasters || loadingTxn ? (
        <div className="loading-overlay">
          <div className="spinner" />
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {/* ── 1. Farmer & Transaction Info ── */}
          <div className="card mb-4">
            <h2 className="card-title mb-3">1. Farmer & Bill Information / शेतकरी तपशील</h2>
            <div className="grid grid-3 gap-4">
              <div className="form-group">
                <label className="form-label">
                  Transaction Date / दिनांक <span className="text-danger">*</span>
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <div className="flex items-center justify-between">
                  <label className="form-label">
                    Select Farmer / शेतकरी निवडा <span className="text-danger">*</span>
                  </label>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm text-primary"
                    onClick={() => setShowQuickFarmerModal(true)}
                  >
                    + Register New Farmer
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Search farmer name or village..."
                    className="form-input"
                    style={{ width: '40%' }}
                    value={farmerSearch}
                    onChange={(e) => setFarmerSearch(e.target.value)}
                  />
                  <select
                    className="form-select flex-1"
                    value={selectedFarmerId}
                    onChange={(e) => setSelectedFarmerId(e.target.value ? Number(e.target.value) : '')}
                    required
                  >
                    <option value="">-- Choose Farmer ({filteredFarmers.length} found) --</option>
                    {filteredFarmers.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} {f.village ? `(${f.village})` : ''} {f.mobile ? `· ${f.mobile}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedFarmer && (
                  <div className="text-muted text-sm mt-1">
                    Selected: <strong>{selectedFarmer.name}</strong>
                    {selectedFarmer.village && ` | Village: ${selectedFarmer.village}`}
                    {selectedFarmer.mobile && ` | Mobile: ${selectedFarmer.mobile}`}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── 2. Vegetables & Weights ── */}
          <div className="card mb-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="card-title">2. Vegetables & Weights / भाजीपाला व वजन</h2>
                <p className="card-subtitle">Rate is strictly per 10 KG. System calculates (weight ÷ 10) × rate</p>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={addItemRow}>
                + Add Another Item
              </button>
            </div>

            <div className="table-container mb-3">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>Vegetable / भाजी</th>
                    <th style={{ width: 120 }}>Bags / डाग</th>
                    <th style={{ width: 150 }}>Weight (KG) / वजन</th>
                    <th style={{ width: 160 }}>Rate / 10 KG / दर</th>
                    <th style={{ width: 160 }} className="amount">Amount / रक्कम</th>
                    <th style={{ width: 50 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.id}>
                      <td className="text-muted">{index + 1}</td>
                      <td>
                        <select
                          className="form-select"
                          value={item.vegetable_id}
                          onChange={(e) =>
                            handleItemChange(
                              index,
                              'vegetable_id',
                              e.target.value ? Number(e.target.value) : ''
                            )
                          }
                          required
                        >
                          <option value="">-- Select Vegetable --</option>
                          {vegetables.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name_local} {v.name_english ? `(${v.name_english})` : ''}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          className="form-input"
                          min="1"
                          placeholder="e.g. 5"
                          value={item.bags_count}
                          onChange={(e) =>
                            handleItemChange(
                              index,
                              'bags_count',
                              e.target.value ? parseInt(e.target.value, 10) : ''
                            )
                          }
                          required
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          className="form-input"
                          placeholder="KG (e.g. 245.5)"
                          value={item.weight_kg}
                          onChange={(e) =>
                            handleItemChange(
                              index,
                              'weight_kg',
                              e.target.value ? parseFloat(e.target.value) : ''
                            )
                          }
                          required
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          className="form-input"
                          placeholder="₹ / 10 KG"
                          value={item.rate_per_10kg}
                          onChange={(e) =>
                            handleItemChange(
                              index,
                              'rate_per_10kg',
                              e.target.value ? parseFloat(e.target.value) : ''
                            )
                          }
                          required
                        />
                      </td>
                      <td className="amount currency" style={{ fontWeight: 600, fontSize: '1rem' }}>
                        {formatCurrency(item.calculated_amount)}
                      </td>
                      <td className="text-center">
                        {items.length > 1 && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm text-danger"
                            title="Remove Row"
                            onClick={() => removeItemRow(index)}
                          >
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--bg-secondary)', fontWeight: 600 }}>
                    <td colSpan={2}>Totals:</td>
                    <td>{totalBags} Bags</td>
                    <td>{totalWeight.toFixed(2)} KG</td>
                    <td className="text-muted text-sm">Gross Amount:</td>
                    <td className="amount currency text-primary" style={{ fontSize: '1.1rem' }}>
                      {formatCurrency(grossAmount)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ── 3. Deductions (Always Subtracted) ── */}
          <div className="card mb-4">
            <div className="mb-3">
              <h2 className="card-title">3. Deductions / कपात वजावट</h2>
              <p className="card-subtitle text-warning">
                All deduction amounts are deducted from Gross Amount. They are NEVER added.
              </p>
            </div>

            <div className="grid grid-4 gap-3">
              <div className="form-group">
                <label className="form-label">Hamali / हमाली (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input"
                  value={deductions.hamali || ''}
                  placeholder="0.00"
                  onChange={(e) => handleDeductionChange('hamali', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Bharai / भराई (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input"
                  value={deductions.bharai || ''}
                  placeholder="0.00"
                  onChange={(e) => handleDeductionChange('bharai', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Tolai / तोलाई (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input"
                  value={deductions.tolai || ''}
                  placeholder="0.00"
                  onChange={(e) => handleDeductionChange('tolai', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Mapai / मापाई (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input"
                  value={deductions.mapai || ''}
                  placeholder="0.00"
                  onChange={(e) => handleDeductionChange('mapai', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Lekki / लेक्की (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input"
                  value={deductions.lekki || ''}
                  placeholder="0.00"
                  onChange={(e) => handleDeductionChange('lekki', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Motor Bhada / मोटार भाडे (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input"
                  value={deductions.motor_bhada || ''}
                  placeholder="0.00"
                  onChange={(e) => handleDeductionChange('motor_bhada', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Other Deductions / इतर कपात (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input"
                  value={deductions.other_deductions || ''}
                  placeholder="0.00"
                  onChange={(e) => handleDeductionChange('other_deductions', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Other Deductions Note</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Reason for other deduction..."
                  value={deductions.other_deductions_note || ''}
                  onChange={(e) => handleDeductionChange('other_deductions_note', e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-between items-center mt-3 pt-3" style={{ borderTop: '1px solid var(--border-default)' }}>
              <span className="text-muted">Total Deductions / एकूण कपात:</span>
              <span className="text-warning" style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                −{formatCurrency(totalDeductions)}
              </span>
            </div>
          </div>

          {/* ── 4. Financial Summary & Instant Settlement ── */}
          <div className="card mb-4" style={{ borderColor: 'var(--primary)' }}>
            <h2 className="card-title mb-3">4. Settlement Summary / अंतिम हिशोब</h2>

            <div className="grid grid-3 gap-4 mb-4">
              <div className="stat-card">
                <div className="stat-label">Gross Amount / एकूण रक्कम</div>
                <div className="stat-value">{formatCurrency(grossAmount)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Total Deductions / वजा कपात</div>
                <div className="stat-value text-warning">−{formatCurrency(totalDeductions)}</div>
              </div>
              <div className="stat-card" style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'var(--primary)' }}>
                <div className="stat-label" style={{ color: 'var(--primary)' }}>Net Payable / अंतिम देय रक्कम</div>
                <div className="stat-value text-success" style={{ fontSize: '1.8rem' }}>
                  {formatCurrency(netPayable)}
                </div>
              </div>
            </div>

            {/* Optional instant payment checkbox (Only when creating new transaction) */}
            {!isEdit && (
              <div className="p-3 mb-3" style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                <label className="flex items-center gap-2 cursor-pointer" style={{ userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={recordPaymentNow}
                    onChange={(e) => setRecordPaymentNow(e.target.checked)}
                  />
                  <span style={{ fontWeight: 600 }}>Record Payment to Farmer Now / लगेच रक्कम प्रदान करा</span>
                </label>

                {recordPaymentNow && (
                  <div className="grid grid-3 gap-3 mt-3 pt-3" style={{ borderTop: '1px solid var(--border-default)' }}>
                    <div className="form-group mb-0">
                      <label className="form-label">Payment Amount (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={netPayable}
                        className="form-input"
                        value={paymentAmount}
                        onChange={(e) =>
                          setPaymentAmount(e.target.value ? parseFloat(e.target.value) : '')
                        }
                        placeholder={netPayable.toString()}
                      />
                    </div>
                    <div className="form-group mb-0">
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
                    <div className="form-group mb-0">
                      <label className="form-label">Reference No. (Optional)</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. UPI Ref / Cheque No."
                        value={paymentRef}
                        onChange={(e) => setPaymentRef(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Form actions */}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate(isEdit ? `/transactions/${id}` : '/transactions')}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={saving || grossAmount <= 0}
              >
                {saving ? 'Saving...' : isEdit ? `💾 Save Changes to ${billNumber}` : '💾 Save & Generate Settlement Bill'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ── Quick Farmer Registration Modal ── */}
      {showQuickFarmerModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Register New Farmer</h3>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowQuickFarmerModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleQuickFarmerSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">
                    Full Name / नाव <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Ramesh Patil"
                    value={quickFarmerData.name}
                    onChange={(e) =>
                      setQuickFarmerData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    autoFocus
                    required
                  />
                </div>
                <div className="grid grid-2 gap-3">
                  <div className="form-group">
                    <label className="form-label">Mobile Number / मोबाईल</label>
                    <input
                      type="tel"
                      className="form-input"
                      placeholder="10 digit mobile"
                      value={quickFarmerData.mobile || ''}
                      onChange={(e) =>
                        setQuickFarmerData((prev) => ({ ...prev, mobile: e.target.value }))
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Village / गाव</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Pimpalgaon"
                      value={quickFarmerData.village || ''}
                      onChange={(e) =>
                        setQuickFarmerData((prev) => ({ ...prev, village: e.target.value }))
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowQuickFarmerModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creatingFarmer}>
                  {creatingFarmer ? 'Registering...' : 'Register Farmer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
