/**
 * Ambika Trading — Settlement Bill Entry Form
 *
 * Polished 4-Section Layout inspired by Mandi Trading System workflow:
 * 1. Farmer & Bill Information / शेतकरी तपशील
 * 2. Vegetables & Weights / भाजीपाला व वजन तपशील
 * 3. Deductions / खर्च व कपात वजावट
 * 4. Settlement Summary / अंतिम हिशोब
 *
 * IMPORTANT: Business logic, backend APIs, and calculations are strictly preserved.
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { farmerService } from '../../services/farmer.service';
import { vegetableService } from '../../services/vegetable.service';
import { transactionService } from '../../services/transaction.service';
import { paymentService } from '../../services/payment.service';
import { formatCurrency, todayISO, amountToWordsMarathi } from '../../utils/formatters';
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

  // Clear form
  function handleClearForm() {
    if (window.confirm('नवीन पावतीसाठी फॉर्म साफ करायचा आहे का? / Clear form for new bill?')) {
      setSelectedFarmerId('');
      setFarmerSearch('');
      setBuyerName('');
      setItems([
        {
          id: Date.now().toString(),
          vegetable_id: '',
          bags_count: '',
          weight_kg: '',
          rate_per_10kg: '',
          calculated_amount: 0,
        },
      ]);
      setDeductions({
        hamali: 0,
        bharai: 0,
        tolai: 0,
        mapai: 0,
        lekki: 0,
        motor_bhada: 0,
        other_deductions: 0,
        other_deductions_note: '',
      });
      setRecordPaymentNow(false);
      setPaymentAmount('');
      setPaymentRef('');
      setError(null);
    }
  }

  // Keyboard shortcut handler (Ctrl+S / F4)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        const submitBtn = document.getElementById('btn-save-bill-main');
        if (submitBtn && !saving && grossAmount > 0) {
          submitBtn.click();
        }
      }
      if (e.key === 'F4') {
        e.preventDefault();
        addItemRow();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saving, grossAmount, items]);

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
    <div className="settlement-form-container">
      {/* ─── Top Bar / Header ─── */}
      <div className="sf-top-bar">
        <div className="sf-title-group">
          <div className="sf-title-icon">📋</div>
          <div className="sf-title-text">
            <h1>{isEdit ? `पावती दुरुस्ती — ${billNumber}` : 'नवीन हिशोब पट्टी / New Settlement'}</h1>
            <p>
              {isEdit
                ? `Edit Settlement Bill — Bill Number ${billNumber} will be preserved`
                : 'शेतकरी भाजीपाला वितरण व कपात नोंदवा — Fast Mandi Settlement Billing & Weight Ledger'}
            </p>
          </div>
        </div>
        <div className="sf-top-actions">
          {!isEdit && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleClearForm}
              title="Clear all fields"
            >
              ⟲ Clear Form
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => navigate(isEdit ? `/transactions/${id}` : '/transactions')}
          >
            ← {isEdit ? 'Back to Voucher' : 'Back to Transactions'}
          </button>
        </div>
      </div>

      {error && (
        <div className="toast toast-error mb-2" style={{ position: 'static', margin: 0 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
        {/* ═══════════════════════════════════════════════════
            SECTION 1: Farmer & Bill Information / शेतकरी तपशील
           ═══════════════════════════════════════════════════ */}
        <section className="sf-card">
          <div className="sf-card-header">
            <div className="sf-card-title-group">
              <span className="sf-card-icon">👤</span>
              <h2>1. Farmer & Bill Information <span className="sf-subtitle">/ शेतकरी तपशील</span></h2>
            </div>
            <div className="sf-card-badge sf-badge-bill">
              पावती क्र. / Bill No: {isEdit ? billNumber : 'AT-AUTO'}
            </div>
          </div>

          <div className="sf-card-body">
            <div className="sf-farmer-grid">
              {/* Date */}
              <div className="form-group mb-0">
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

              {/* Farmer Select + Search */}
              <div className="form-group mb-0">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <label className="form-label mb-0">
                    मालधण्याचे नाव / Farmer Name <span className="text-danger">*</span>
                  </label>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm text-primary"
                    style={{ padding: '0 4px', fontSize: 11 }}
                    onClick={() => setShowQuickFarmerModal(true)}
                  >
                    + नवीन शेतकरी (Register New)
                  </button>
                </div>

                <div className="sf-farmer-select-row">
                  <input
                    type="text"
                    placeholder="शोधा / Search..."
                    className="form-input sf-search-input"
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
                  <div className="sf-farmer-pills">
                    <span className="sf-pill">
                      ✓ {selectedFarmer.name}
                    </span>
                    {selectedFarmer.village && (
                      <span className="sf-pill">
                        📍 गाव: {selectedFarmer.village}
                      </span>
                    )}
                    {selectedFarmer.mobile && (
                      <span className="sf-pill">
                        📞 मो.: {selectedFarmer.mobile}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Quick register shortcut button */}
              <div className="form-group mb-0">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowQuickFarmerModal(true)}
                  style={{ height: 35, display: 'inline-flex', alignItems: 'center' }}
                >
                  + नवीन शेतकरी
                </button>
              </div>
            </div>

            {/* Buyer Row */}
            <div className="sf-buyer-strip">
              <div className="form-group mb-0">
                <label className="form-label">खरेदीदाराचे नाव / Buyer's Name (खरेदीदार)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="खरेदीदाराचे नाव प्रविष्ट करा (Buyer Name)..."
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                />
              </div>

              <div className="form-group mb-0">
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

              <div className="form-group mb-0">
                <label className="form-label">एकूण डाग / Bags</label>
                <div
                  className="form-input font-mono font-bold text-center"
                  style={{
                    background: 'var(--surface-elevated)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {totalBags} डाग
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════
            SECTION 2: Vegetables & Weights / भाजीपाला व वजन तपशील
           ═══════════════════════════════════════════════════ */}
        <section className="sf-card">
          <div className="sf-card-header">
            <div className="sf-card-title-group">
              <span className="sf-card-icon">🥬</span>
              <h2>2. Vegetables & Weights <span className="sf-subtitle">/ भाजीपाला व वजन तपशील</span></h2>
            </div>
            <div className="sf-card-badge sf-badge-info">
              ℹ️ सूचना: दर प्रति १० किलो प्रमाणे • Rate per 10 KG: (वजन ÷ १०) × दर
            </div>
          </div>

          <div className="sf-card-body" style={{ padding: 0 }}>
            <div className="sf-table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
              <table className="sf-items-table">
                <thead>
                  <tr>
                    <th className="col-num">#</th>
                    <th className="col-veg">भाजीपाला प्रकार / VEGETABLE</th>
                    <th className="col-bags">डाग / BAGS</th>
                    <th className="col-weight">एकूण वजन (KG)</th>
                    <th className="col-rate">दर प्रति १० कि. (₹)</th>
                    <th className="col-amount">रक्कम / AMOUNT (₹)</th>
                    <th className="col-action">क्रिया</th>
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
                          <option value="">-- निवडा / Select --</option>
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
                          className="form-input text-right"
                          min="1"
                          placeholder="0"
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
                          className="form-input text-right font-mono"
                          placeholder="0.00"
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
                          className="form-input text-right font-mono"
                          placeholder="0.00"
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
                        {items.length > 1 ? (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm text-danger"
                            title="काढा / Remove Row"
                            onClick={() => removeItemRow(index)}
                          >
                            ✕
                          </button>
                        ) : (
                          <span className="text-muted" style={{ fontSize: 11 }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table Footer Bar: Add Row + Summary Metrics */}
            <div className="sf-table-footer-bar">
              <button
                type="button"
                className="btn-add-item"
                onClick={addItemRow}
              >
                <span>+</span> माल जोडा / Add Another Item <kbd style={{ opacity: 0.7, fontSize: 10, marginLeft: 4 }}>F4</kbd>
              </button>

              <div className="sf-items-summary-strip">
                <div className="sf-summary-metric">
                  <span className="label">एकूण डाग:</span>
                  <span className="val">{totalBags} Bags</span>
                </div>
                <div className="sf-summary-metric">
                  <span className="label">एकूण वजन:</span>
                  <span className="val">{totalWeight.toFixed(2)} KG</span>
                </div>
                <div className="sf-summary-metric gross">
                  <span className="label">एकूण खरेदी / GROSS:</span>
                  <span className="val">{formatCurrency(grossAmount)}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════
            LOWER GRID: Section 3 (Deductions) + Section 4 (Summary)
           ═══════════════════════════════════════════════════ */}
        <div className="sf-bottom-grid">

          {/* ─── SECTION 3: Deductions / खर्च व कपात वजावट ─── */}
          <section className="sf-card">
            <div className="sf-card-header">
              <div className="sf-card-title-group">
                <span className="sf-card-icon" style={{ color: 'var(--color-danger)' }}>✂️</span>
                <h2>3. Deductions <span className="sf-subtitle">/ खर्च व कपात वजावट</span></h2>
              </div>
              <div className="sf-card-badge" style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
                कपात नोंद
              </div>
            </div>

            <div className="sf-card-body">
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                सर्व कपात एकूण रक्कमेतून वजा होतील (Subtracted from Gross)
              </p>

              <div className="sf-deductions-grid">
                {/* Hamali */}
                <div className="sf-deduction-cell">
                  <div className="sf-deduction-info">
                    <span className="sf-deduction-icon">🚛</span>
                    <div>
                      <div className="sf-deduction-title">हमाली / Hamali</div>
                      <div className="sf-deduction-sub">मजुरी खर्च</div>
                    </div>
                  </div>
                  <div className="sf-deduction-input-wrap">
                    <span className="sf-deduction-currency">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="sf-deduction-input"
                      value={deductions.hamali || ''}
                      placeholder="0"
                      onChange={(e) => handleDeductionChange('hamali', e.target.value)}
                    />
                  </div>
                </div>

                {/* Bharai */}
                <div className="sf-deduction-cell">
                  <div className="sf-deduction-info">
                    <span className="sf-deduction-icon">📦</span>
                    <div>
                      <div className="sf-deduction-title">भराई / Bharai</div>
                      <div className="sf-deduction-sub">पोते लोडिंग</div>
                    </div>
                  </div>
                  <div className="sf-deduction-input-wrap">
                    <span className="sf-deduction-currency">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="sf-deduction-input"
                      value={deductions.bharai || ''}
                      placeholder="0"
                      onChange={(e) => handleDeductionChange('bharai', e.target.value)}
                    />
                  </div>
                </div>

                {/* Tolai */}
                <div className="sf-deduction-cell">
                  <div className="sf-deduction-info">
                    <span className="sf-deduction-icon">⚖️</span>
                    <div>
                      <div className="sf-deduction-title">तोलाई / Tolai</div>
                      <div className="sf-deduction-sub">वजन काटा फी</div>
                    </div>
                  </div>
                  <div className="sf-deduction-input-wrap">
                    <span className="sf-deduction-currency">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="sf-deduction-input"
                      value={deductions.tolai || ''}
                      placeholder="0"
                      onChange={(e) => handleDeductionChange('tolai', e.target.value)}
                    />
                  </div>
                </div>

                {/* Mapai */}
                <div className="sf-deduction-cell">
                  <div className="sf-deduction-info">
                    <span className="sf-deduction-icon">📏</span>
                    <div>
                      <div className="sf-deduction-title">मापाई / Mapai</div>
                      <div className="sf-deduction-sub">मोजणी शुल्क</div>
                    </div>
                  </div>
                  <div className="sf-deduction-input-wrap">
                    <span className="sf-deduction-currency">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="sf-deduction-input"
                      value={deductions.mapai || ''}
                      placeholder="0"
                      onChange={(e) => handleDeductionChange('mapai', e.target.value)}
                    />
                  </div>
                </div>

                {/* Lekki */}
                <div className="sf-deduction-cell">
                  <div className="sf-deduction-info">
                    <span className="sf-deduction-icon">📝</span>
                    <div>
                      <div className="sf-deduction-title">लेक्ही / Lekki</div>
                      <div className="sf-deduction-sub">नोंद वही हिशोब</div>
                    </div>
                  </div>
                  <div className="sf-deduction-input-wrap">
                    <span className="sf-deduction-currency">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="sf-deduction-input"
                      value={deductions.lekki || ''}
                      placeholder="0"
                      onChange={(e) => handleDeductionChange('lekki', e.target.value)}
                    />
                  </div>
                </div>

                {/* Motor Bhada */}
                <div className="sf-deduction-cell">
                  <div className="sf-deduction-info">
                    <span className="sf-deduction-icon">🚚</span>
                    <div>
                      <div className="sf-deduction-title">मो. भाडे / Bhada</div>
                      <div className="sf-deduction-sub">वाहतूक भाडे</div>
                    </div>
                  </div>
                  <div className="sf-deduction-input-wrap">
                    <span className="sf-deduction-currency">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="sf-deduction-input"
                      value={deductions.motor_bhada || ''}
                      placeholder="0"
                      onChange={(e) => handleDeductionChange('motor_bhada', e.target.value)}
                    />
                  </div>
                </div>

                {/* Other Deductions */}
                <div className="sf-deduction-cell full-width">
                  <div className="sf-deduction-info">
                    <span className="sf-deduction-icon">⋯</span>
                    <div>
                      <div className="sf-deduction-title">इतर कपात / Other Deductions</div>
                      <div className="sf-deduction-sub">अडत किंवा अतिरिक्त खर्च</div>
                    </div>
                  </div>
                  <div className="sf-deduction-input-wrap">
                    <span className="sf-deduction-currency">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="sf-deduction-input"
                      value={deductions.other_deductions || ''}
                      placeholder="0"
                      onChange={(e) => handleDeductionChange('other_deductions', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Other deduction note if amount entered */}
              {(deductions.other_deductions || 0) > 0 && (
                <div style={{ marginTop: 8 }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="इतर कपातीचे कारण / Reason for other deduction..."
                    value={deductions.other_deductions_note || ''}
                    onChange={(e) => handleDeductionChange('other_deductions_note', e.target.value)}
                  />
                </div>
              )}

              {/* Total Deductions Strip */}
              <div className="sf-deductions-total-strip">
                <span className="label">एकूण खर्च कपात / Total Deductions:</span>
                <span className="val">−{formatCurrency(totalDeductions)}</span>
              </div>
            </div>
          </section>

          {/* ─── SECTION 4: Settlement Summary / अंतिम हिशोब ─── */}
          <section className="sf-card">
            <div className="sf-card-header">
              <div className="sf-card-title-group">
                <span className="sf-card-icon">💰</span>
                <h2>4. Settlement Summary <span className="sf-subtitle">/ अंतिम हिशोब</span></h2>
              </div>
            </div>

            <div className="sf-card-body">
              {/* Financial Breakdown */}
              <div className="sf-summary-breakdown">
                <div className="sf-breakdown-row">
                  <span className="label">एकूण रक्कम / Gross Amount <small className="text-muted">(भाजीपाला एकूण खरेदी)</small></span>
                  <span className="val">{formatCurrency(grossAmount)}</span>
                </div>
                <div className="sf-breakdown-row deductions">
                  <span className="label">वजा कपात / Less Deductions <small className="text-muted">(हमली, भाडे, तोलाई व इतर)</small></span>
                  <span className="val">−{formatCurrency(totalDeductions)}</span>
                </div>
              </div>

              {/* Hero Net Payable Box */}
              <div className="sf-net-payable-hero">
                <div className="sf-nph-header">
                  <span className="sf-nph-title">ना. शिल्लक / NET PAYABLE</span>
                  <span className="sf-nph-badge">नक्की रुपये</span>
                </div>
                <div className="sf-nph-amount">
                  {formatCurrency(netPayable)}
                </div>
                <div className="sf-nph-words">
                  अक्षरी: {amountToWordsMarathi(netPayable)}
                </div>
              </div>

              {/* Instant Payment Option */}
              {!isEdit && (
                <div className="sf-payment-box">
                  <label className="sf-payment-toggle-label">
                    <input
                      type="checkbox"
                      checked={recordPaymentNow}
                      onChange={(e) => setRecordPaymentNow(e.target.checked)}
                    />
                    <span className="sf-payment-toggle-text">
                      लगेच रक्कम प्रदान करा / Record Immediate Payment
                    </span>
                  </label>
                  <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, marginLeft: 24 }}>
                    सदर रक्कम शेतकऱ्यास रोख किंवा बँक खात्यावर वितरित करण्यात आली आहे.
                  </p>

                  {recordPaymentNow && (
                    <div className="sf-payment-inputs-grid">
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
                        <label className="form-label">पेमेंट प्रकार / Mode</label>
                        <select
                          className="form-select"
                          value={paymentMode}
                          onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                        >
                          <option value="cash">रोख (Cash)</option>
                          <option value="upi">UPI / Online</option>
                          <option value="bank_transfer">Bank Transfer (NEFT)</option>
                          <option value="cheque">Cheque</option>
                        </select>
                      </div>
                      <div className="form-group mb-0" style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label">नोंदणी संदर्भ / Ref No</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="रोख वाटप (Counter Cash) / UPI Ref..."
                          value={paymentRef}
                          onChange={(e) => setPaymentRef(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Actions Row */}
              <div className="sf-actions-row">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => navigate(isEdit ? `/transactions/${id}` : '/transactions')}
                  disabled={saving}
                >
                  रद्द / Cancel
                </button>
                <button
                  id="btn-save-bill-main"
                  type="submit"
                  className="btn-save-bill-hero"
                  disabled={saving || grossAmount <= 0}
                >
                  {saving
                    ? 'Saving...'
                    : isEdit
                    ? '💾 बदल जतन करा / Save Changes'
                    : '💾 पट्टी तयार करा / Save & Generate Bill'}
                </button>
              </div>
            </div>
          </section>

        </div>

        {/* Shortcuts Footer Bar */}
        <div className="sf-shortcuts-strip">
          <span>⌨ <strong>Shortcuts:</strong></span>
          <span><kbd>Ctrl + S</kbd> पट्टी जतन करा</span>
          <span>•</span>
          <span><kbd>F4</kbd> नवीन ओळ</span>
          <span>•</span>
          <span><kbd>F2</kbd> शेतकरी शोध</span>
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
                    placeholder="e.g. रमेश तुकाराम पाटील"
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
                      placeholder="e.g. पिंपळगाव"
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
