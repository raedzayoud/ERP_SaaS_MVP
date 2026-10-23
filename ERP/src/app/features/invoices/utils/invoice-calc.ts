import { PAYMENT_TERMS_DAYS, PaymentTerms } from '../../../shared/models/payment-terms';
import {
  LineTotals,
  VatGroup,
  addDaysIso,
  roundMoney,
  todayIso,
  totalsFor,
} from '../../../shared/utils/money';
import { Invoice, InvoiceSummary, PaymentState } from '../models/invoice';

export interface InvoiceTotals {
  lines: LineTotals[];
  totalNet: number;
  vatByRate: VatGroup[];
  totalVat: number;
  totalTtc: number;
  stampDuty: number;
  totalToPay: number;
  amountPaid: number;
  due: number;
}

export function invoiceTotals(
  invoice: Pick<Invoice, 'lines' | 'stampDuty' | 'amountPaid' | 'currency'>,
): InvoiceTotals {
  const { currency } = invoice;
  const document = totalsFor(invoice.lines, currency);
  const stampDuty = roundMoney(Math.max(0, invoice.stampDuty), currency);
  const totalToPay = roundMoney(document.totalTtc + stampDuty, currency);
  const amountPaid = roundMoney(Math.max(0, invoice.amountPaid), currency);

  return {
    ...document,
    stampDuty,
    totalToPay,
    amountPaid,
    due: Math.max(0, roundMoney(totalToPay - amountPaid, currency)),
  };
}

export function dueFor(invoice: Invoice): number {
  return invoiceTotals(invoice).due;
}

export function paymentState(invoice: Invoice): PaymentState {
  if (invoice.kind === 'credit_note') return 'none';
  if (invoice.status !== 'posted') return 'none';

  const { totalToPay, amountPaid } = invoiceTotals(invoice);
  if (amountPaid <= 0) return 'unpaid';
  return amountPaid >= totalToPay ? 'paid' : 'partial';
}

export function isOverdue(invoice: Invoice, today = todayIso()): boolean {
  if (invoice.status !== 'posted' || invoice.kind !== 'invoice') return false;
  if (invoice.dueDate >= today) return false;
  return dueFor(invoice) > 0;
}

export function signedTotal(invoice: Invoice): number {
  const { totalTtc } = invoiceTotals(invoice);
  return invoice.kind === 'credit_note' ? -totalTtc : totalTtc;
}

export function signedDue(invoice: Invoice): number {
  const due = dueFor(invoice);
  return invoice.kind === 'credit_note' ? -due : due;
}

export function summaryOf(
  invoices: Invoice[],
  currency: string,
  today = todayIso(),
): InvoiceSummary {
  let outstanding = 0;
  let overdue = 0;

  for (const invoice of invoices) {
    if (invoice.status !== 'posted') continue;
    const due = signedDue(invoice);
    outstanding += due;
    if (invoice.kind === 'invoice' && invoice.dueDate < today && due > 0) {
      overdue += due;
    }
  }

  return {
    outstanding: Math.max(0, roundMoney(outstanding, currency)),
    overdue: Math.max(0, roundMoney(overdue, currency)),
  };
}

export function dueDateFrom(issueDate: string, terms: PaymentTerms): string {
  return addDaysIso(issueDate, PAYMENT_TERMS_DAYS[terms]);
}

export function isIssueDateChronological(
  issueDate: string,
  lastPostedIssueDate: string | null,
): boolean {
  if (!lastPostedIssueDate) return true;
  return issueDate >= lastPostedIssueDate;
}
