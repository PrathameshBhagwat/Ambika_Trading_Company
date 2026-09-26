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
 * Split an amount into Rupees and Paise strings for traditional bil columns.
 */
export function splitRupeesPaise(amount: number | null | undefined): { rupees: string; paise: string } {
  if (amount === undefined || amount === null || isNaN(amount) || amount === 0) {
    return { rupees: '—', paise: '—' };
  }
  const fixed = Math.abs(amount).toFixed(2);
  const parts = fixed.split('.');
  return {
    rupees: parts[0],
    paise: parts[1] || '00',
  };
}

/**
 * Convert number amount to Marathi words for bill footer.
 */
export function amountToWordsMarathi(amount: number): string {
  if (!amount || amount <= 0) return 'शून्य रुपये फक्त';

  const ones = [
    '', 'एक', 'दोन', 'तीन', 'चार', 'पाच', 'सहा', 'सात', 'आठ', 'नऊ', 'दहा',
    'अकरा', 'बारा', 'तेरा', 'चौदा', 'पंधरा', 'सोळा', 'सतरा', 'अठरा', 'एकोणीस',
  ];
  const tens = [
    '', '', 'वीस', 'तीस', 'चाळीस', 'पन्नास', 'साठ', 'सत्तर', 'ऐंशी', 'नव्वद',
  ];

  function convertTwoDigits(n: number): string {
    if (n < 20) return ones[n];
    const t = Math.floor(n / 10);
    const o = n % 10;
    return o > 0 ? `${tens[t]} ${ones[o]}` : tens[t];
  }

  function convertThreeDigits(n: number): string {
    const h = Math.floor(n / 100);
    const rem = n % 100;
    let res = '';
    if (h > 0) {
      res += (h === 1 ? 'एकशे ' : `${ones[h]}शे `);
    }
    if (rem > 0) {
      res += convertTwoDigits(rem);
    }
    return res.trim();
  }

  let whole = Math.floor(amount);
  const paise = Math.round((amount - whole) * 100);

  let result = '';
  const crore = Math.floor(whole / 10000000);
  whole %= 10000000;
  const lakh = Math.floor(whole / 100000);
  whole %= 100000;
  const thousand = Math.floor(whole / 1000);
  whole %= 1000;
  const hundred = whole;

  if (crore > 0) result += `${convertTwoDigits(crore)} कोटी `;
  if (lakh > 0) result += `${convertTwoDigits(lakh)} लाख `;
  if (thousand > 0) result += `${convertTwoDigits(thousand)} हजार `;
  if (hundred > 0) result += `${convertThreeDigits(hundred)} `;

  result = result.trim() + ' रुपये';
  if (paise > 0) {
    result += ` आणि ${convertTwoDigits(paise)} पैसे`;
  }
  result += ' फक्त';

  return result;
}

/**
 * Map payment mode to display label.
 */
export function getPaymentModeLabel(mode: string): string {
  switch (mode) {
    case 'cash': return 'Cash (रोख)';
    case 'bank_transfer': return 'Bank Transfer (बँक)';
    case 'upi': return 'UPI / Online';
    case 'cheque': return 'Cheque (धनादेश)';
    default: return mode;
  }
}
