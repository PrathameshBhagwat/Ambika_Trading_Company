/**
 * Ambika Trading — Formatting Utilities
 *
 * Currency (INR), date, and status formatting helpers.
 */

/**
 * Format a number as Indian Rupee currency.
 * Uses the Indian numbering system (lakhs, crores).
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a number with the Indian numbering system (no currency symbol).
 */
export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format an ISO date string to Indian date format (DD-MM-YYYY).
 */
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format an ISO datetime string to DD-MM-YYYY HH:MM.
 */
export function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get today's date as YYYY-MM-DD string.
 */
export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Map transaction status to display label and badge class.
 */
export function getStatusDisplay(status: string): { label: string; className: string } {
  switch (status) {
    case 'draft':
      return { label: 'Draft', className: 'badge-neutral' };
    case 'saved':
      return { label: 'Unpaid', className: 'badge-warning' };
    case 'partially_paid':
      return { label: 'Partial', className: 'badge-info' };
    case 'fully_paid':
      return { label: 'Paid', className: 'badge-success' };
    case 'cancelled':
      return { label: 'Cancelled', className: 'badge-danger' };
    default:
      return { label: status, className: 'badge-neutral' };
  }
}

/**
 * Map payment mode to display label.
 */
export function getPaymentModeLabel(mode: string): string {
  switch (mode) {
    case 'cash': return 'Cash';
    case 'bank_transfer': return 'Bank Transfer';
    case 'upi': return 'UPI';
    case 'cheque': return 'Cheque';
    default: return mode;
  }
}
