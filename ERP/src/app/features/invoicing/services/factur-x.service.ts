import { Injectable } from '@angular/core';
import { Invoice } from '../../invoices/models/invoice';
import { invoiceTotals } from '../../invoices/utils/invoice-calc';

@Injectable({ providedIn: 'root' })
export class FacturXService {
  buildXml(invoice: Invoice, seller: { name: string; address: string; taxId: string }): string {
    const totals = invoiceTotals(invoice);
    const currency = invoice.currency;
    const number = invoice.number ?? 'DRAFT';
    const buyer = invoice.customerSnapshot;

    const lines = invoice.lines
      .map((line, index) => {
        const net = line.quantity * line.unitPrice * (1 - line.discountPct / 100);
        const vat = (net * line.vatRate) / 100;
        return `    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineDocumentID>${index + 1}</ram:LineDocumentID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${this.escape(line.description)}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${line.unitPrice.toFixed(2)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="C62">${line.quantity}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>S</ram:CategoryCode>
          <ram:RateApplicablePercent>${line.vatRate}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:LineTotalAmount>${net.toFixed(2)}</ram:LineTotalAmount>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:ChargeTotalAmount>${vat.toFixed(2)}</ram:ChargeTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`;
      })
      .join('\n');

    const vatBreakdown = totals.vatByRate
      .map(
        (group) => `    <ram:ApplicableHeaderTradeSettlement>
      <ram:ApplicableTradeTax>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:CategoryCode>S</ram:CategoryCode>
        <ram:RateApplicablePercent>${group.rate}</ram:RateApplicablePercent>
        <ram:BasisAmount>${group.base.toFixed(2)}</ram:BasisAmount>
        <ram:CalculatedAmount>${group.vat.toFixed(2)}</ram:CalculatedAmount>
      </ram:ApplicableTradeTax>
    </ram:ApplicableHeaderTradeSettlement>`,
      )
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<ram:CrossIndustryInvoice xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <ram:ExchangedDocumentContext>
    <ram:BusinessProcessSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017</ram:ID>
    </ram:BusinessProcessSpecifiedDocumentContextParameter>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:basic</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </ram:ExchangedDocumentContext>
  <ram:ExchangedDocument>
    <ram:ID>${this.escape(number)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${invoice.issueDate.replace(/-/g, '')}</udt:DateTimeString>
    </ram:IssueDateTime>
  </ram:ExchangedDocument>
  <ram:SupplyChainTradeTransaction>
${lines}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${this.escape(seller.name)}</ram:Name>
        <ram:DefinedTaxLegalRegistration>
          <ram:ID schemeID="VA">${this.escape(seller.taxId)}</ram:ID>
        </ram:DefinedTaxLegalRegistration>
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${this.escape(buyer?.name ?? '')}</ram:Name>
        @ifTAXID@
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery/>
${vatBreakdown}
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${currency}</ram:InvoiceCurrencyCode>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${totals.totalNet.toFixed(2)}</ram:LineTotalAmount>
        <ram:ChargeTotalAmount>${totals.totalVat.toFixed(2)}</ram:ChargeTotalAmount>
        <ram:TaxBasisTotalAmount>${totals.totalNet.toFixed(2)}</ram:TaxBasisTotalAmount>
        <ram:GrandTotalAmount>${totals.totalTtc.toFixed(2)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${totals.totalToPay.toFixed(2)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </ram:SupplyChainTradeTransaction>
</ram:CrossIndustryInvoice>`.replace(
      '@ifTAXID@',
      buyer?.taxId
        ? `        <ram:DefinedTaxLegalRegistration>\n          <ram:ID schemeID="VA">${this.escape(buyer.taxId)}</ram:ID>\n        </ram:DefinedTaxLegalRegistration>`
        : '',
    );
  }

  download(invoice: Invoice, seller: { name: string; address: string; taxId: string }): void {
    const xml = this.buildXml(invoice, seller);

    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `${invoice.number ?? 'draft'}-factur-x.xml`;
    link.click();

    URL.revokeObjectURL(url);
  }

  private escape(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
