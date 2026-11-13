package com.erp.erp.crm.dto;

/** One page of results; the page number starts at 0 like the Angular app. */
public record PageResponse<T>(java.util.List<T> items, long total, int page, int size) {}
