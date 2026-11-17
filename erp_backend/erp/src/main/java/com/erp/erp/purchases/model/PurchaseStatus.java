package com.erp.erp.purchases.model;

/** The life of a purchase order: a draft becomes confirmed, then cancelled. */
public enum PurchaseStatus {
    DRAFT,
    CONFIRMED,
    CANCELLED
}
