import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { FacturXService } from './factur-x.service';
import { InvoiceService } from '../../invoices/services/invoice.service';

const FAC_POSTED = 'c3000000-0000-4000-8000-000000000002';

describe('FacturXService', () => {
  let service: FacturXService;
  let invoices: InvoiceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FacturXService);
    invoices = TestBed.inject(InvoiceService);
  });

  it('builds a well-formed Factur-X XML with number, buyer and totals', async () => {
    const invoice = await firstValueFrom(invoices.getInvoice(FAC_POSTED));
    expect(invoice).toBeDefined();

    const xml = service.buildXml(invoice!, {
      name: 'My Company',
      address: '1 Main St',
      taxId: 'TAX123',
    });

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');

    const parsed = new DOMParser().parseFromString(xml, 'application/xml');
    const parseError = parsed.querySelector('parsererror');
    expect(parseError).toBeNull();

    expect(parsed.documentElement.nodeName).toBe('ram:CrossIndustryInvoice');
    expect(xml).toContain('FAC-2026-0001');
    expect(xml).toContain('My Company');
    expect(xml).toContain('<ram:InvoiceCurrencyCode>USD</ram:InvoiceCurrencyCode>');
    expect(xml).toContain('GrandTotalAmount');
  });

  it('escapes special XML characters in descriptions', async () => {
    const invoice = await firstValueFrom(invoices.getInvoice(FAC_POSTED));
    const escaped = invoice!.lines.map((line) =>
      line.description.replace(/&/g, '&amp;').replace(/</g, '&lt;'),
    );

    const xml = service.buildXml(invoice!, { name: 'A & B', address: '', taxId: '' });
    expect(xml).toContain('A &amp; B');
    expect(escaped.every((value) => !value.includes('<'))).toBe(true);
  });
});
