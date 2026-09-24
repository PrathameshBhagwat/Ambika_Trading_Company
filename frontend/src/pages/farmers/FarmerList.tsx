/**
 * Farmer List — View, search, create, edit, and deactivate farmers.
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
          <h1 className="page-title">Farmers</h1>
          <p className="page-subtitle">{total} registered farmers</p>
        </div>
        <button className="btn btn-primary" onClick={openCreateForm}>
          + Add Farmer
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          className="form-input"
          placeholder="Search by name, mobile, or village..."
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
          <h3>No farmers found</h3>
          <p>{search ? 'Try a different search term.' : 'Add your first farmer to get started.'}</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Mobile</th>
                <th>Village</th>
                <th>Registered</th>
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
                        Ledger
                      </Link>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEditForm(farmer)}>
                        Edit
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeactivate(farmer)}>
                        Deactivate
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
              <h2 className="card-title">{editingFarmer ? 'Edit Farmer' : 'Add New Farmer'}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && <div className="form-error mb-4">{error}</div>}

                <div className="form-group">
                  <label className="form-label">Farmer Name *</label>
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
                    <label className="form-label">Mobile Number</label>
                    <input
                      className="form-input"
                      value={formData.mobile || ''}
                      onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                      placeholder="e.g. 9876543210"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Village</label>
                    <input
                      className="form-input"
                      value={formData.village || ''}
                      onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                      placeholder="e.g. Nashik"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Address</label>
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
