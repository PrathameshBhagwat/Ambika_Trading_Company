/**
 * Farmer List — शेतकरी / Farmers Directory
 * View, search, create, edit, and deactivate farmers.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { farmerService } from '../../services/farmer.service';
import { formatDate } from '../../utils/formatters';
import type { Farmer, FarmerCreate } from '../../types';

export default function FarmerList() {
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingFarmer, setEditingFarmer] = useState<Farmer | null>(null);
  const [formData, setFormData] = useState<FarmerCreate>({
    name: '', mobile: '', village: '', address: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFarmers();
  }, [search]);

  async function loadFarmers() {
    try {
      setLoading(true);
      const data = await farmerService.list({ search: search || undefined, limit: 200 });
      setFarmers(data.items);
      setTotal(data.total);
    } catch {
      setError('Failed to load farmers');
    } finally {
      setLoading(false);
    }
  }

  function openCreateForm() {
    setEditingFarmer(null);
    setFormData({ name: '', mobile: '', village: '', address: '', notes: '' });
    setShowForm(true);
    setError(null);
  }

  function openEditForm(farmer: Farmer) {
    setEditingFarmer(farmer);
    setFormData({
      name: farmer.name,
      mobile: farmer.mobile || '',
      village: farmer.village || '',
      address: farmer.address || '',
      notes: farmer.notes || '',
    });
    setShowForm(true);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Farmer name is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Duplicate check warning
      const dupCheck = await farmerService.checkDuplicate(
        formData.name,
        formData.mobile || null,
        editingFarmer?.id
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
          `⚠️ Duplicate Farmer Warning / शेतकरी आधीच अस्तित्वात असण्याची शक्यता:\n\nA farmer with similar details already exists:\n\n${matchSummary}\n\nDo you want to continue and save this farmer anyway?\n(Cancel to review, OK to continue)`
        );
        if (!proceed) {
          setSaving(false);
          return;
        }
      }

      if (editingFarmer) {
        await farmerService.update(editingFarmer.id, formData);
      } else {
        await farmerService.create(formData);
      }
      setShowForm(false);
      loadFarmers();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save farmer');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(farmer: Farmer) {
    if (!confirm(`Deactivate farmer "${farmer.name}"? This will hide them from active lists.`)) return;
    try {
      await farmerService.deactivate(farmer.id);
      loadFarmers();
    } catch {
      setError('Failed to deactivate farmer');
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">शेतकरी / Farmers</h1>
          <p className="page-subtitle">{total} नोंदणीकृत शेतकरी</p>
        </div>
        <button className="btn btn-primary" onClick={openCreateForm}>
          + नवीन शेतकरी
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          className="form-input"
          placeholder="नाव, मोबाईल किंवा गावाने शोधा / Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 400 }}
        />
      </div>

      {/* Error */}
      {error && !showForm && (
        <div className="toast toast-error mb-4" style={{ position: 'static' }}>
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="loading-overlay"><div className="spinner" /></div>
      ) : farmers.length === 0 ? (
        <div className="empty-state">
          <div className="icon">👨‍🌾</div>
          <h3>शेतकरी सापडले नाहीत</h3>
          <p>{search ? 'वेगळा शब्द शोधून पहा / Try a different search.' : 'पहिला शेतकरी नोंदवा / Add your first farmer.'}</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>नाव / Name</th>
                <th>मोबाईल / Mobile</th>
                <th>गाव / Village</th>
                <th>नोंदणी</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {farmers.map((farmer) => (
                <tr key={farmer.id}>
                  <td style={{ fontWeight: 500 }}>{farmer.name}</td>
                  <td className="font-mono">{farmer.mobile || '—'}</td>
                  <td>{farmer.village || '—'}</td>
                  <td>{formatDate(farmer.created_at)}</td>
                  <td>
                    <div className="flex gap-2">
                      <Link to={`/farmers/${farmer.id}`} className="btn btn-secondary btn-sm">
                        खातेवही
                      </Link>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEditForm(farmer)}>
                        बदला
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeactivate(farmer)}>
                        निष्क्रिय
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Create/Edit Modal ── */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="card-title">{editingFarmer ? 'शेतकरी बदला / Edit Farmer' : 'नवीन शेतकरी / Add Farmer'}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && <div className="form-error mb-4">{error}</div>}

                <div className="form-group">
                  <label className="form-label">शेतकरी नाव / Name *</label>
                  <input
                    className="form-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter farmer's full name"
                    autoFocus
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">मोबाईल / Mobile</label>
                    <input
                      className="form-input"
                      value={formData.mobile || ''}
                      onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                      placeholder="e.g. 9876543210"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">गाव / Village</label>
                    <input
                      className="form-input"
                      value={formData.village || ''}
                      onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                      placeholder="e.g. Nashik"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">पत्ता / Address</label>
                  <input
                    className="form-input"
                    value={formData.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Full address (optional)"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input
                    className="form-input"
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Any additional notes"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editingFarmer ? 'Update Farmer' : 'Add Farmer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
