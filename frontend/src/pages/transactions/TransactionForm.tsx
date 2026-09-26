/**
 * Ambika Trading — Transaction Entry Form
 *
 * UI designed to match the physical Ambika Trading paper bill layout:
 *
 *   ┌──────────────── COMPANY HEADER ────────────────┐
 *   │  मे. अंबिका ट्रेडिंग कंपनी       Bill / दि.  │
 *   ├──────────────── FARMER / DATE ─────────────────┤
 *   │  दिनांक: ____   मालन्याचे नाव: ____  गाव: __  │
 *   ├────────── ITEMS ──────────┬── DEDUCTIONS ──────┤
 *   │ मालाचा प्रकार | वजन | दर │  हमली    ₹____     │
 *   │ | एकुण रुपये              │  भराई    ₹____     │
 *   │                           │  तोलाई   ₹____     │
 *   │                           │  मापाई   ₹____     │
 *   │                           │  लेक्ही   ₹____     │
 *   │                           │  मो.भाडे  ₹____     │
 *   │ Totals: Bags / KG / Gross │  एकुण खर्च ₹____   │
 *   ├───────────────────────────┴────────────────────┤
 *   │ एकुण रुपये | वजा खर्च | ना. शिल्लक (Net)      │
 *   └────────────────────────────────────────────────┘
 *
 * IMPORTANT: Business logic is NOT changed.
 * All calculations use the same formulas.
 * Backend remains the source of truth for final amounts.
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
import './TransactionForm.css';

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
  const [buyerName, setBuyerName] = useState('');

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
      setError(null);
      const [farmersRes, vegRes] = await Promise.all([
        farmerService.list({ limit: 200 }),
        vegetableService.list({ is_active: true, limit: 100 }),
      ]);
      setFarmers(farmersRes.items);
      setVegetables(vegRes.items);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to load farmer or vegetable lists.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
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
      if (txn.buyer_name) setBuyerName(txn.buyer_name);
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
      setError('कृपया शेतकरी निवडा / Please select a farmer.');
      return;
    }

    if (items.length === 0) {
      setError('किमान एक भाजीपाला आवश्यक / At least one vegetable item is required.');
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.vegetable_id) {
        setError(`Row ${i + 1}: कृपया भाजीपाला निवडा / Please select a vegetable.`);
        return;
      }
      if (!it.bags_count || Number(it.bags_count) <= 0) {
        setError(`Row ${i + 1}: डाग संख्या ० पेक्षा जास्त असणे आवश्यक / Bags count must be greater than 0.`);
        return;
      }
      if (!it.weight_kg || Number(it.weight_kg) <= 0) {
        setError(`Row ${i + 1}: वजन ० पेक्षा जास्त असणे आवश्यक / Weight must be greater than 0.`);
        return;
      }
      if (!it.rate_per_10kg || Number(it.rate_per_10kg) <= 0) {
        setError(`Row ${i + 1}: दर १० किलो ० पेक्षा जास्त असणे आवश्यक / Rate per 10 KG must be greater than 0.`);
        return;
      }
    }

    if (totalDeductions > grossAmount) {
      setError(`एकूण कपात (${formatCurrency(totalDeductions)}) एकूण रक्कमेपेक्षा जास्त असू शकत नाही (${formatCurrency(grossAmount)}).`);
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
        buyer_name: buyerName.trim() || null,
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

  // ─── RENDER ───

  if (loadingMasters || loadingTxn) {
    return (
      <div className="loading-overlay">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {isEdit ? `पावती दुरुस्ती — ${billNumber}` : 'नवीन हिशोब पट्टी / New Settlement'}
          </h1>
          <p className="page-subtitle">
            {isEdit
              ? `Edit Settlement Bill — Bill Number ${billNumber} will be preserved`
              : 'शेतकरी भाजीपाला वितरण व कपात नोंदवा — Record vegetable delivery & deductions'}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => navigate(isEdit ? `/transactions/${id}` : '/transactions')}
        >
          ← {isEdit ? 'Cancel' : 'Back'}
        </button>
      </div>

      {error && (
        <div className="toast toast-error mb-4" style={{ position: 'static', maxWidth: 1100, margin: '0 auto var(--space-4)' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="bill-form">

          {/* ═══════════════════════════════════════════════════
              BILL HEADER — Company Name Strip
             ═══════════════════════════════════════════════════ */}
          <div className="bill-header">
            <div className="bill-header-left">
              <div className="bill-header-icon">🏪</div>
              <div className="bill-header-text">
                <h2>मे. अंबिका ट्रेडिंग कंपनी</h2>
                <p>सर्व प्रकारचे भाजीपाला व तरकारी मालाचे आडतदार</p>
              </div>
            </div>
            <div className="bill-header-right">
              <div className="bill-type-label">
                {isEdit ? 'EDIT BILL / पावती दुरुस्ती' : 'SETTLEMENT BILL / हिशोब पट्टी'}
              </div>
              {isEdit && <div className="bill-type-value">#{billNumber}</div>}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════
              BILL INFO ROW — Date + Farmer + Buyer Selection
             ═══════════════════════════════════════════════════ */}
          <div className="bill-info-section">
            <div className="bill-info-row">
              {/* Date */}
              <div className="form-group" style={{ minWidth: 160 }}>
                <label className="form-label">
                  दिनांक / Date <span className="text-danger">*</span>
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  required
                />
              </div>

              {/* Farmer */}
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">
                  मालधण्याचे नाव / Farmer Name <span className="text-danger">*</span>
                </label>
                <div className="bill-farmer-select">
                  <input
                    type="text"
                    placeholder="शोधा / Search..."
                    className="form-input"
                    style={{ width: 170 }}
                    value={farmerSearch}
                    onChange={(e) => setFarmerSearch(e.target.value)}
                  />
                  <select
                    className="form-select"
                    value={selectedFarmerId}
                    onChange={(e) => setSelectedFarmerId(e.target.value ? Number(e.target.value) : '')}
                    required
                  >
                    <option value="">-- शेतकरी निवडा ({filteredFarmers.length}) --</option>
                    {filteredFarmers.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} {f.village ? `(${f.village})` : ''} {f.mobile ? `· ${f.mobile}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedFarmer && (
                  <div className="bill-farmer-info">
                    ✓ <strong>{selectedFarmer.name}</strong>
                    {selectedFarmer.village && ` — गाव: ${selectedFarmer.village}`}
                    {selectedFarmer.mobile && ` — मो.: ${selectedFarmer.mobile}`}
                  </div>
                )}
              </div>

              {/* Register New Farmer */}
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-register-farmer text-primary"
                onClick={() => setShowQuickFarmerModal(true)}
              >
                + नवीन शेतकरी
              </button>
            </div>

            {/* Sub-row for Buyer's Name (खरेदीदाराचे नाव), Village, and Total Bags */}
            <div className="bill-buyer-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label className="form-label">
                  खरेदीदाराचे नाव / Buyer's Name (खरेदीदार)
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="खरेदीदाराचे नाव प्रविष्ट करा (Buyer Name)..."
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">गाव / Village</label>
                <input
                  type="text"
                  className="form-input"
                  value={selectedFarmer?.village || ''}
                  readOnly
                  placeholder="—"
                  style={{ background: 'var(--surface-elevated)' }}
                />
              </div>

              <div className="form-group" style={{ width: 140 }}>
                <label className="form-label">एकूण डाग / Bags</label>
                <div
                  className="form-input font-mono font-bold text-center"
                  style={{ background: 'var(--surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {totalBags} डाग
                </div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════
              BILL BODY — Items LEFT | Deductions RIGHT
             ═══════════════════════════════════════════════════ */}
          <div className="bill-body">

            {/* ─── LEFT: Vegetable Items ─── */}
            <div className="bill-items-section">
              <div className="bill-items-header">
                <h3>मालाचा तपशील / Vegetable Items</h3>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm text-primary"
                  onClick={addItemRow}
                >
                  + माल जोडा
                </button>
              </div>

              <table className="bill-items-table">
                <thead>
                  <tr>
                    <th className="col-num">#</th>
                    <th className="col-veg">मालाचा प्रकार / Vegetable</th>
                    <th className="col-bags">डाग / Bags</th>
                    <th className="col-weight">एकुण वजन किलो</th>
                    <th className="col-rate">दर १० किलोस</th>
                    <th className="col-amount">एकुण रुपये</th>
                    <th className="col-action"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.id}>
                      <td className="col-num">{index + 1}</td>
                      <td className="col-veg">
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
                          <option value="">-- निवडा --</option>
                          {vegetables.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name_local} {v.name_english ? `(${v.name_english})` : ''}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="col-bags">
                        <input
                          type="number"
                          className="form-input"
                          min="1"
                          placeholder="डाग"
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
                      <td className="col-weight">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          className="form-input"
                          placeholder="किलो"
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
                      <td className="col-rate">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          className="form-input"
                          placeholder="₹/१०किलो"
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
                      <td className="col-amount">
                        {formatCurrency(item.calculated_amount)}
                      </td>
                      <td className="col-action">
                        {items.length > 1 && (
                          <button
                            type="button"
                            className="btn-remove-row"
                            title="काढा / Remove"
                            onClick={() => removeItemRow(index)}
                          >
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals strip */}
              <div className="bill-items-totals">
                <div className="bill-totals-label">
                  एकुण डाग: <span>{totalBags}</span>
                </div>
                <div className="bill-totals-label">
                  एकुण वजन: <span>{totalWeight.toFixed(2)} KG</span>
                </div>
                <div className="bill-gross-amount">
                  <div className="label">एकुण रुपये / Gross</div>
                  <div className="value">{formatCurrency(grossAmount)}</div>
                </div>
              </div>
            </div>

            {/* ─── RIGHT: Deductions ─── */}
            <div className="bill-deductions-section">
              <div className="bill-deductions-header">
                <h3>खर्चाचा तपशील / Deductions</h3>
                <p>सर्व कपात एकूण रक्कमेतून वजा होतील</p>
              </div>

              <div className="bill-deductions-list">
                {/* Hamali / हमली */}
                <div className="bill-deduction-row">
                  <div className="deduction-label">
                    हमली <span className="marathi">/ Hamali</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input"
                    value={deductions.hamali || ''}
                    placeholder="₹ 0"
                    onChange={(e) => handleDeductionChange('hamali', e.target.value)}
                  />
                </div>

                {/* Bharai / भराई */}
                <div className="bill-deduction-row">
                  <div className="deduction-label">
                    भराई <span className="marathi">/ Bharai</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input"
                    value={deductions.bharai || ''}
                    placeholder="₹ 0"
                    onChange={(e) => handleDeductionChange('bharai', e.target.value)}
                  />
                </div>

                {/* Tolai / तोलाई */}
                <div className="bill-deduction-row">
                  <div className="deduction-label">
                    तोलाई <span className="marathi">/ Tolai</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input"
                    value={deductions.tolai || ''}
                    placeholder="₹ 0"
                    onChange={(e) => handleDeductionChange('tolai', e.target.value)}
                  />
                </div>

                {/* Mapai / मापाई */}
                <div className="bill-deduction-row">
                  <div className="deduction-label">
                    मापाई <span className="marathi">/ Mapai</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input"
                    value={deductions.mapai || ''}
                    placeholder="₹ 0"
                    onChange={(e) => handleDeductionChange('mapai', e.target.value)}
                  />
                </div>

                {/* Lekki / लेक्ही */}
                <div className="bill-deduction-row">
                  <div className="deduction-label">
                    लेक्ही <span className="marathi">/ Lekki</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input"
                    value={deductions.lekki || ''}
                    placeholder="₹ 0"
                    onChange={(e) => handleDeductionChange('lekki', e.target.value)}
                  />
                </div>

                {/* Motor Bhada / मो. भाडे */}
                <div className="bill-deduction-row">
                  <div className="deduction-label">
                    मो. भाडे <span className="marathi">/ Motor Bhada</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input"
                    value={deductions.motor_bhada || ''}
                    placeholder="₹ 0"
                    onChange={(e) => handleDeductionChange('motor_bhada', e.target.value)}
                  />
                </div>

                {/* Other / इतर */}
                <div className="bill-deduction-row">
                  <div className="deduction-label">
                    इतर कपात <span className="marathi">/ Other</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input"
                    value={deductions.other_deductions || ''}
                    placeholder="₹ 0"
                    onChange={(e) => handleDeductionChange('other_deductions', e.target.value)}
                  />
                </div>

                {/* Other Note */}
                {(deductions.other_deductions || 0) > 0 && (
                  <div className="bill-deduction-note">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="इतर कपातीचे कारण / Reason..."
                      value={deductions.other_deductions_note || ''}
                      onChange={(e) => handleDeductionChange('other_deductions_note', e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* Total Deductions */}
              <div className="bill-deductions-total">
                <div className="label">एकुण खर्च / Total</div>
                <div className="value">−{formatCurrency(totalDeductions)}</div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════
              SETTLEMENT FOOTER — Gross / Deductions / Net
             ═══════════════════════════════════════════════════ */}
          <div className="bill-settlement-footer">
            <div className="bill-summary-item gross">
              <div className="label">एकुण रुपये / Gross Amount</div>
              <div className="value">{formatCurrency(grossAmount)}</div>
            </div>
            <div className="bill-summary-item deductions">
              <div className="label">वजा खर्च / Less Deductions</div>
              <div className="value">−{formatCurrency(totalDeductions)}</div>
            </div>
            <div className="bill-summary-item net-payable">
              <div className="label">ना. शिल्लक / Net Payable (नक्की रुपये)</div>
              <div className="value">{formatCurrency(netPayable)}</div>
            </div>
          </div>

        </div>

        {/* ═══════════════════════════════════════════════════
            OPTIONAL: Instant Payment
           ═══════════════════════════════════════════════════ */}
        {!isEdit && (
          <div className="bill-payment-section">
            <label className="payment-toggle">
              <input
                type="checkbox"
                checked={recordPaymentNow}
                onChange={(e) => setRecordPaymentNow(e.target.checked)}
              />
              <span className="toggle-text">लगेच रक्कम प्रदान करा / Record Payment Now</span>
            </label>

            {recordPaymentNow && (
              <div className="payment-fields">
                <div className="form-group mb-0">
                  <label className="form-label">रक्कम / Amount (₹)</label>
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
                  <label className="form-label">Reference No.</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="UPI Ref / Cheque No."
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════
            ACTIONS
           ═══════════════════════════════════════════════════ */}
        <div className="bill-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate(isEdit ? `/transactions/${id}` : '/transactions')}
            disabled={saving}
          >
            रद्द / Cancel
          </button>
          <button
            type="submit"
            className="btn-save-bill"
            disabled={saving || grossAmount <= 0}
          >
            {saving
              ? 'Saving...'
              : isEdit
                ? `💾 बदल जतन करा / Save Changes`
                : '💾 पट्टी तयार करा / Save & Generate Bill'}
          </button>
        </div>
      </form>

      {/* ═══════════════════════════════════════════════════
          QUICK FARMER REGISTRATION MODAL
         ═══════════════════════════════════════════════════ */}
      {showQuickFarmerModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">नवीन शेतकरी नोंदणी / Register Farmer</h3>
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
                    पूर्ण नाव / Full Name <span className="text-danger">*</span>
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
                    <label className="form-label">मोबाईल / Mobile</label>
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
                    <label className="form-label">गाव / Village</label>
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
                  रद्द / Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creatingFarmer}>
                  {creatingFarmer ? 'नोंदणी...' : '✓ शेतकरी नोंदवा / Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
