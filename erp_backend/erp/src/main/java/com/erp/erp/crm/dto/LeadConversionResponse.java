package com.erp.erp.crm.dto;

/** Result of a lead conversion: the new contact and the updated lead. */
public record LeadConversionResponse(String partnerId, LeadResponse lead) {}
