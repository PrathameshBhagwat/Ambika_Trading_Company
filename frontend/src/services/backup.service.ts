/**
 * Ambika Trading — Backup & Audit API Service
 */

import api from './api';

export interface BackupItem {
  filename: string;
  path: string;
  size_bytes: number;
  created_at: string;
}

export interface BackupListResponse {
  backups: BackupItem[];
  total: number;
}

export interface BackupResponse {
  message: string;
  backup_path: string;
  timestamp: string;
}

export interface RestoreResponse {
  message: string;
  restored_from: string;
}

export interface AuditLogItem {
  id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  old_values: string | null;
  new_values: string | null;
  performed_by: string;
  performed_at: string;
}

export interface AuditLogListResponse {
  items: AuditLogItem[];
  total: number;
}

export const backupService = {
  createBackup: async (backupDir?: string): Promise<BackupResponse> => {
    const params = backupDir ? { backup_dir: backupDir } : undefined;
    const { data } = await api.post('/api/backup/create', null, { params });
    return data;
  },

  listBackups: async (): Promise<BackupListResponse> => {
    const { data } = await api.get('/api/backup/list');
    return data;
  },

  restoreBackup: async (backupPath: string): Promise<RestoreResponse> => {
    const { data } = await api.post('/api/backup/restore', null, {
      params: { backup_path: backupPath },
    });
    return data;
  },

  listAuditLogs: async (params?: {
    entity_type?: string;
    action?: string;
    date_from?: string;
    date_to?: string;
    limit?: number;
  }): Promise<AuditLogListResponse> => {
    const { data } = await api.get('/api/audit/', { params });
    return data;
  },
};
