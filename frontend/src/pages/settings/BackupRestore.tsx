/**
 * Ambika Trading — Database Backup, Restore & Audit Trail
 *
 * Provides offline SQLite snapshot backups, point-in-time restore,
 * and immutable audit history logs.
 */

import { useState, useEffect } from 'react';
import { backupService } from '../../services/backup.service';
import type { BackupItem, AuditLogItem } from '../../services/backup.service';
import { formatDate } from '../../utils/formatters';

export default function BackupRestore() {
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [restoringPath, setRestoringPath] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<'backup' | 'audit'>('backup');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [backupsRes, auditRes] = await Promise.all([
        backupService.listBackups(),
        backupService.listAuditLogs({ limit: 100 }),
      ]);
      setBackups(backupsRes.backups);
      setAuditLogs(auditRes.items);
    } catch {
      setMessage({ type: 'error', text: 'Failed to load backup and audit records.' });
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateBackup() {
    try {
      setCreatingBackup(true);
      setMessage(null);

      // If in Electron, allow choosing folder
      let selectedDir: string | undefined = undefined;
      if ((window as any).electronAPI?.selectDirectory) {
        const dir = await (window as any).electronAPI.selectDirectory();
        if (dir) selectedDir = dir;
      }

      const res = await backupService.createBackup(selectedDir);
      setMessage({
        type: 'success',
        text: `Backup successfully created: ${res.backup_path}`,
      });
      await loadData();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to create database backup',
      });
    } finally {
      setCreatingBackup(false);
    }
  }

  async function handleRestore(backup: BackupItem) {
    const confirmed = confirm(
      `⚠️ CAUTION: Are you sure you want to restore database from:\n${backup.filename}?\n\nCurrent database will be replaced with this snapshot. A safety copy of current database will be saved first.`
    );
    if (!confirmed) return;

    try {
      setRestoringPath(backup.path);
      setMessage(null);
      await backupService.restoreBackup(backup.path);
      setMessage({
        type: 'success',
        text: `Database successfully restored from ${backup.filename}. Please refresh data.`,
      });
      await loadData();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Database restore failed',
      });
    } finally {
      setRestoringPath(null);
    }
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
  }

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">बॅकअप व ऑडिट / Backup & Audit</h1>
          <p className="page-subtitle">
            डेटाबेस बॅकअप व सुरक्षा नोंद — Offline data protection and activity audit trail
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleCreateBackup}
          disabled={creatingBackup}
        >
          {creatingBackup ? 'बॅकअप तयार होत आहे...' : '💾 बॅकअप तयार करा / Create Backup'}
        </button>
      </div>

      {message && (
        <div
          className={`toast ${message.type === 'success' ? 'toast-success' : 'toast-error'} mb-4`}
          style={{ position: 'static' }}
        >
          {message.text}
        </div>
      )}

      {/* ── System Info Card ── */}
      <div className="card mb-4">
        <div className="grid grid-3 gap-4">
          <div>
            <div className="text-xs text-muted">Storage Engine:</div>
            <div style={{ fontWeight: 600 }}>Embedded SQLite (WAL Mode)</div>
          </div>
          <div>
            <div className="text-xs text-muted">App Environment:</div>
            <div style={{ fontWeight: 600 }}>Windows Desktop (Offline Capable)</div>
          </div>
          <div>
            <div className="text-xs text-muted">Backend Service:</div>
            <div className="text-success" style={{ fontWeight: 600 }}>
              ● Local Port 8741 (Healthy)
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="card">
        <div
          className="flex gap-4 pb-3 mb-4"
          style={{ borderBottom: '1px solid var(--border-default)' }}
        >
          <button
            className={`btn btn-sm ${activeTab === 'backup' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('backup')}
          >
            💾 Backup Snapshots ({backups.length})
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'audit' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('audit')}
          >
            📜 Audit Log Trail ({auditLogs.length})
          </button>
        </div>

        {loading ? (
          <div className="loading-overlay">
            <div className="spinner" />
          </div>
        ) : activeTab === 'backup' ? (
          backups.length === 0 ? (
            <div className="empty-state">
              <div className="icon">💾</div>
              <h3>No backups found</h3>
              <p>Click "Create Database Backup Now" above to create your first snapshot.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>Backup Filename</th>
                    <th>File Size</th>
                    <th>Created Timestamp</th>
                    <th style={{ width: 140 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map((b, idx) => (
                    <tr key={b.path}>
                      <td className="text-muted">{idx + 1}</td>
                      <td className="font-mono" style={{ fontWeight: 600 }}>
                        {b.filename}
                      </td>
                      <td>{formatBytes(b.size_bytes)}</td>
                      <td>{formatDate(b.created_at)}</td>
                      <td>
                        <button
                          className="btn btn-danger btn-sm"
                          disabled={restoringPath === b.path}
                          onClick={() => handleRestore(b)}
                        >
                          {restoringPath === b.path ? 'Restoring...' : 'Restore'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : auditLogs.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📜</div>
            <h3>No audit records yet</h3>
            <p>System events will appear here as transactions and entities are modified.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>#</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Entity ID</th>
                  <th>User</th>
                  <th>Date & Time</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="text-muted">{log.id}</td>
                    <td>
                      <span
                        className={`badge ${
                          log.action === 'CREATE'
                            ? 'badge-success'
                            : log.action === 'UPDATE'
                            ? 'badge-warning'
                            : 'badge-danger'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{log.entity_type}</td>
                    <td className="font-mono">#{log.entity_id}</td>
                    <td>{log.performed_by || 'operator'}</td>
                    <td className="text-muted text-sm">{formatDate(log.performed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
