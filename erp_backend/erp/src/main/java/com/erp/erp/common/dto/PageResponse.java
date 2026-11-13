package com.erp.erp.common.dto;

import java.util.List;

/** One page of results; the page number starts at 0 like the Angular app. */
public record PageResponse<T>(List<T> items, long total, int page, int size) {}
