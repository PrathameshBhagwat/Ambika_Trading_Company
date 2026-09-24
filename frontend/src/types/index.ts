/**
 * Ambika Trading — TypeScript Type Definitions
 *
 * Mirrors the Pydantic schemas on the backend.
 * All types are prefixed to avoid collisions with DOM types.
 */

// ─── Farmer ───
export interface Farmer {
  id: number;
  name: string;
  mobile: string | null;
  village: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FarmerCreate {
  name: string;
  mobile?: string | null;
  village?: string | null;
  address?: string | null;
  notes?: string | null;
}

export interface FarmerUpdate {
  name?: string;
  mobile?: string | null;
  village?: string | null;
  address?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

export interface DuplicateFarmerMatch {
  id: number;
  name: string;
  mobile?: string | null;
  village?: string | null;
  match_reason: string;
}

export interface DuplicateCheckResponse {
  is_duplicate: boolean;
  matches: DuplicateFarmerMatch[];
  message?: string | null;
}

// ─── Vegetable ───
export interface Vegetable {
  id: number;
  name_local: string;
  name_english: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface VegetableCreate {
  name_local: string;
  name_english?: string | null;
}

export interface VegetableUpdate {
  name_local?: string;
  name_english?: string | null;
  is_active?: boolean;
}

// ─── Transaction ───
export type TransactionStatus =
  | 'draft'
  | 'saved'
  | 'partially_paid'
  | 'fully_paid'
  | 'cancelled';

export interface TransactionItemCreate {
  vegetable_id: number;
  bags_count: number;
  weight_kg: number;
  rate_per_10kg: number;
}

export interface TransactionItemResponse {
  id: number;
  vegetable_id: number;
  vegetable_name: string | null;
  bags_count: number;
  weight_kg: number;
  rate_per_10kg: number;
  item_amount: number;
}

export interface DeductionCreate {
  hamali?: number;
  bharai?: number;
  tolai?: number;
  mapai?: number;
  lekki?: number;
  motor_bhada?: number;
  other_deductions?: number;
  other_deductions_note?: string | null;
}

export interface DeductionResponse {
  id: number;
  hamali: number;
  bharai: number;
  tolai: number;
  mapai: number;
  lekki: number;
  motor_bhada: number;
  other_deductions: number;
  other_deductions_note: string | null;
  total_deductions: number;
}

export interface TransactionCreate {
  transaction_date: string; // ISO date string YYYY-MM-DD
  farmer_id: number;
  items: TransactionItemCreate[];
  deductions: DeductionCreate;
}

export interface TransactionUpdate {
  farmer_id?: number;
  transaction_date?: string;
  items?: TransactionItemCreate[];
  deductions?: DeductionCreate;
}

export interface TransactionResponse {
  id: number;
  bill_number: string;
  transaction_date: string;
  farmer_id: number;
  farmer_name: string | null;
  farmer_mobile?: string | null;
  farmer_village?: string | null;
  gross_amount: number;
  total_deductions: number;
  net_payable: number;
  total_paid: number;
  balance_due: number;
  status: TransactionStatus;
  cancel_reason: string | null;
  print_count?: number;
  items: TransactionItemResponse[];
  deduction: DeductionResponse | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionListItem {
  id: number;
  bill_number: string;
  transaction_date: string;
  farmer_id: number;
  farmer_name: string | null;
  farmer_mobile?: string | null;
  farmer_village?: string | null;
  gross_amount: number;
  total_deductions: number;
  net_payable: number;
  total_paid: number;
  balance_due: number;
  status: TransactionStatus;
  print_count?: number;
  created_at: string;
}

// ─── Payment ───
export type PaymentMode = 'cash' | 'bank_transfer' | 'upi' | 'cheque';

export interface PaymentCreate {
  transaction_id: number;
  amount: number;
  payment_date: string;
  payment_mode: PaymentMode;
  reference_number?: string | null;
  notes?: string | null;
}

export interface PaymentResponse {
  id: number;
  transaction_id: number;
  amount: number;
  payment_date: string;
  payment_mode: string;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
  transaction_status?: string | null;
  transaction_bill_number?: string | null;
}

// ─── Reports ───
export interface VegetableSummaryItem {
  vegetable_id: number;
  vegetable_name: string;
  total_weight_kg: number;
  total_amount: number;
  avg_rate_per_10kg: number;
}

export interface DailySummary {
  report_date_from: string;
  report_date_to: string;
  total_transactions: number;
  total_farmers_served: number;
  vegetable_breakdown: VegetableSummaryItem[];
  total_gross_amount: number;
  total_deductions: number;
  total_net_payable: number;
  total_payments_received: number;
  total_outstanding: number;
}

export interface FarmerOutstandingItem {
  farmer_id: number;
  farmer_name: string;
  village: string | null;
  total_transactions: number;
  total_net_payable: number;
  total_paid: number;
  total_outstanding: number;
}

export interface PaymentSummaryItem {
  payment_mode: string;
  count: number;
  total_amount: number;
}

export interface PaymentSummaryReport {
  report_date_from: string;
  report_date_to: string;
  mode_breakdown: PaymentSummaryItem[];
  grand_total: number;
}

// ─── Common ───
export interface ListResponse<T> {
  items: T[];
  total: number;
}

export interface ApiError {
  detail: string;
}
