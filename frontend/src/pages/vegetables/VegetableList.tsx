/**
 * Vegetable List — View, search, create, edit, and deactivate vegetables.
 */

import { useState, useEffect } from 'react';
import { vegetableService } from '../../services/vegetable.service';
import { formatDate } from '../../utils/formatters';
import type { Vegetable, VegetableCreate } from '../../types';

export default function VegetableList() {
  const [vegetables, setVegetables] = useState<Vegetable[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingVeg, setEditingVeg] = useState<Vegetable | null>(null);
  const [formData, setFormData] = useState<VegetableCreate>({
    name_local: '', name_english: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadVegetables();
  }, [search]);

  async function loadVegetables() {
    try {
      setLoading(true);
      const data = await vegetableService.list({ search: search || undefined, limit: 200 });
      setVegetables(data.items);
      setTotal(data.total);
    } catch {
      setError('Failed to load vegetables');
    } finally {
      setLoading(false);
    }
  }

  function openCreateForm() {
    setEditingVeg(null);
    setFormData({ name_local: '', name_english: '' });
    setShowForm(true);
    setError(null);
  }

  function openEditForm(veg: Vegetable) {
    setEditingVeg(veg);
    setFormData({
      name_local: veg.name_local,
      name_english: veg.name_english || '',
    });
    setShowForm(true);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name_local.trim()) {
      setError('Vegetable name (local) is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      if (editingVeg) {
        await vegetableService.update(editingVeg.id, formData);
      } else {
        await vegetableService.create(formData);
      }
      setShowForm(false);
      loadVegetables();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save vegetable');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(veg: Vegetable) {
    if (!confirm(`Deactivate "${veg.name_local}"? It will no longer appear in new transactions.`)) return;
    try {
      await vegetableService.deactivate(veg.id);
      loadVegetables();
    } catch {
      setError('Failed to deactivate vegetable');
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">भाजीपाला / Vegetables</h1>
          <p className="page-subtitle">{total} भाज्या नोंदणीकृत</p>
        </div>
        <button className="btn btn-primary" onClick={openCreateForm}>
          + नवीन भाजी
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          className="form-input"
          placeholder="भाजी शोधा / Search vegetables..."
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
      ) : vegetables.length === 0 ? (
        <div className="empty-state">
          <div className="icon">🥬</div>
          <h3>भाजी सापडली नाहीत</h3>
          <p>{search ? 'वेगळा शब्द शोधून पहा / Try a different search.' : 'पहिली भाजी नोंदवा / Add your first vegetable.'}</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Name (Local)</th>
                <th>Name (English)</th>
                <th>Added</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vegetables.map((veg) => (
                <tr key={veg.id}>
                  <td style={{ fontWeight: 500 }}>{veg.name_local}</td>
                  <td>{veg.name_english || '—'}</td>
                  <td>{formatDate(veg.created_at)}</td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-ghost btn-sm" onClick={() => openEditForm(veg)}>
                        Edit
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeactivate(veg)}>
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
              <h2 className="card-title">{editingVeg ? 'Edit Vegetable' : 'Add New Vegetable'}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && <div className="form-error mb-4">{error}</div>}

                <div className="form-group">
                  <label className="form-label">Name (Marathi/Hindi) *</label>
                  <input
                    className="form-input"
                    value={formData.name_local}
                    onChange={(e) => setFormData({ ...formData, name_local: e.target.value })}
                    placeholder="e.g. कांदा / प्याज"
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Name (English)</label>
                  <input
                    className="form-input"
                    value={formData.name_english || ''}
                    onChange={(e) => setFormData({ ...formData, name_english: e.target.value })}
                    placeholder="e.g. Onion"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editingVeg ? 'Update Vegetable' : 'Add Vegetable'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
