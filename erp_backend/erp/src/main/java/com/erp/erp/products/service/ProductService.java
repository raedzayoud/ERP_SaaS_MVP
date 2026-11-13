package com.erp.erp.products.service;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.common.dto.PageResponse;
import com.erp.erp.crm.repository.CrmPartnerRepository;
import com.erp.erp.products.dto.ProductRequest;
import com.erp.erp.products.dto.ProductResponse;
import com.erp.erp.products.dto.ProductSupplierRequest;
import com.erp.erp.products.model.Product;
import com.erp.erp.products.model.ProductSupplier;
import com.erp.erp.products.model.ProductType;
import com.erp.erp.products.repository.ProductRepository;
import com.erp.erp.products.repository.ProductSupplierRepository;
import com.erp.erp.tenant.model.Tenant;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The product catalog: goods and services sold by the workspace. */
@Service
public class ProductService {

    private static final int DEFAULT_SIZE = 10;
    private static final int MAX_SIZE = 500;
    private static final List<String> CATEGORIES =
            List.of("hardware", "services", "consumables", "other");
    private static final List<String> UNITS =
            List.of("piece", "hour", "day", "kg", "litre", "box", "month");
    private static final List<BigDecimal> VAT_RATES =
            List.of(
                    new BigDecimal("0"),
                    new BigDecimal("5.5"),
                    new BigDecimal("7"),
                    new BigDecimal("10"),
                    new BigDecimal("13"),
                    new BigDecimal("19"),
                    new BigDecimal("20"));

    private final ProductRepository products;
    private final ProductSupplierRepository suppliers;
    private final CrmPartnerRepository partners;

    public ProductService(
            ProductRepository products,
            ProductSupplierRepository suppliers,
            CrmPartnerRepository partners) {
        this.products = products;
        this.suppliers = suppliers;
        this.partners = partners;
    }

    @Transactional(readOnly = true)
    public PageResponse<ProductResponse> list(
            Tenant tenant,
            int page,
            int size,
            String search,
            String type,
            String category,
            Boolean active,
            String sort,
            String supplierId) {
        List<Product> all = products.findByTenantIdOrderByNameAsc(tenant.getId());
        String query = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        ProductType typeFilter = type == null || type.isBlank() ? null : parseType(type);
        String categoryFilter = category == null || category.isBlank() ? null : category.trim();

        Set<UUID> withSupplier = supplierFilter(tenant, supplierId);

        List<Product> filtered =
                all.stream()
                        .filter(product -> typeFilter == null || product.getType() == typeFilter)
                        .filter(
                                product ->
                                        categoryFilter == null
                                                || categoryFilter.equalsIgnoreCase(product.getCategory()))
                        .filter(product -> active == null || product.isActive() == active)
                        .filter(product -> withSupplier == null || withSupplier.contains(product.getId()))
                        .filter(product -> query.isEmpty() || matches(product, query))
                        .sorted(comparator(sort))
                        .toList();

        int pageSize = size <= 0 ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);
        int currentPage = Math.max(0, page);
        int from = Math.min(currentPage * pageSize, filtered.size());
        int to = Math.min(from + pageSize, filtered.size());

        List<Product> pageItems = filtered.subList(from, to);
        Map<UUID, List<ProductSupplier>> byProduct =
                suppliersOf(tenant, pageItems.stream().map(Product::getId).toList());

        List<ProductResponse> items =
                pageItems.stream()
                        .map(
                                product ->
                                        ProductResponse.from(
                                                product,
                                                byProduct.getOrDefault(product.getId(), List.of())))
                        .toList();

        return new PageResponse<>(items, filtered.size(), currentPage, pageSize);
    }

    @Transactional(readOnly = true)
    public ProductResponse get(Tenant tenant, UUID id) {
        Product product = find(tenant, id);
        return ProductResponse.from(
                product, suppliers.findByTenantIdAndProductIdOrderByPositionAsc(tenant.getId(), id));
    }

    @Transactional
    public ProductResponse create(Tenant tenant, ProductRequest request) {
        Product product = new Product();
        product.setTenant(tenant);
        product.setActive(true);
        apply(product, request);
        guardDuplicateSku(product, null);
        validateSuppliers(tenant, request.suppliers());

        Product saved = products.save(product);
        saveSuppliers(tenant, saved, request.suppliers());

        return ProductResponse.from(
                saved,
                suppliers.findByTenantIdAndProductIdOrderByPositionAsc(
                        tenant.getId(), saved.getId()));
    }

    @Transactional
    public ProductResponse update(Tenant tenant, UUID id, ProductRequest request) {
        Product product = find(tenant, id);
        apply(product, request);
        guardDuplicateSku(product, id);
        validateSuppliers(tenant, request.suppliers());

        product.setUpdatedAt(Instant.now());
        Product saved = products.save(product);
        suppliers.deleteByTenantIdAndProductId(tenant.getId(), id);
        saveSuppliers(tenant, saved, request.suppliers());

        return ProductResponse.from(
                saved,
                suppliers.findByTenantIdAndProductIdOrderByPositionAsc(
                        tenant.getId(), saved.getId()));
    }

    @Transactional
    public ProductResponse archive(Tenant tenant, UUID id) {
        Product product = find(tenant, id);
        product.setActive(false);
        product.setUpdatedAt(Instant.now());
        return ProductResponse.from(
                products.save(product),
                suppliers.findByTenantIdAndProductIdOrderByPositionAsc(tenant.getId(), id));
    }

    @Transactional
    public ProductResponse restore(Tenant tenant, UUID id) {
        Product product = find(tenant, id);
        product.setActive(true);
        product.setUpdatedAt(Instant.now());
        return ProductResponse.from(
                products.save(product),
                suppliers.findByTenantIdAndProductIdOrderByPositionAsc(tenant.getId(), id));
    }

    /** Product ids supplied by the given contact, or null when no filter applies. */
    private Set<UUID> supplierFilter(Tenant tenant, String supplierId) {
        if (supplierId == null || supplierId.isBlank()) {
            return null;
        }
        UUID id = uuid(supplierId, "invalid supplier id");
        return suppliers.findByTenantIdAndSupplierId(tenant.getId(), id).stream()
                .map(ProductSupplier::getProduct)
                .map(Product::getId)
                .collect(Collectors.toSet());
    }

    private Product find(Tenant tenant, UUID id) {
        return products
                .findByIdAndTenantId(id, tenant.getId())
                .orElseThrow(() -> new AuthException(404, "product not found", "notFound"));
    }

    private Map<UUID, List<ProductSupplier>> suppliersOf(Tenant tenant, List<UUID> productIds) {
        if (productIds.isEmpty()) {
            return Map.of();
        }
        return suppliers
                .findByTenantIdAndProductIdInOrderByPositionAsc(tenant.getId(), productIds).stream()
                .collect(Collectors.groupingBy(supplier -> supplier.getProduct().getId()));
    }

    private void apply(Product product, ProductRequest request) {
        product.setType(parseType(request.type()));
        product.setSku(request.sku().trim());
        product.setName(request.name().trim());
        product.setDescription(trim(request.description()));
        product.setCategory(category(request.category()));
        product.setUnit(unit(request.unit()));
        product.setSalePrice(money(request.salePrice(), "invalid sale price"));
        product.setPurchasePrice(money(request.purchasePrice(), "invalid purchase price"));
        product.setVatRate(vatRate(request.vatRate()));
        product.setMinStock(
                product.getType() == ProductType.GOOD
                        ? quantity(request.minStock(), "invalid minimum stock")
                        : BigDecimal.ZERO);
    }

    /** Refuses a second product with the same SKU in this workspace. */
    private void guardDuplicateSku(Product product, UUID currentId) {
        UUID tenantId = product.getTenant().getId();
        String sku = product.getSku();
        boolean exists =
                currentId == null
                        ? products.existsByTenantIdAndSkuIgnoreCase(tenantId, sku)
                        : products.existsByTenantIdAndSkuIgnoreCaseAndIdNot(tenantId, sku, currentId);
        if (exists) {
            throw new AuthException(409, "a product with this SKU already exists", "duplicateSku");
        }
    }

    private void validateSuppliers(Tenant tenant, List<ProductSupplierRequest> requests) {
        if (requests == null) {
            return;
        }
        Set<UUID> seen = new HashSet<>();
        for (ProductSupplierRequest request : requests) {
            UUID supplierId = supplierId(request.supplierId(), tenant);
            if (!seen.add(supplierId)) {
                throw new AuthException(
                        400, "the same supplier is listed twice", "duplicateSupplier");
            }
        }
    }

    private void saveSuppliers(
            Tenant tenant, Product product, List<ProductSupplierRequest> requests) {
        if (requests == null) {
            return;
        }
        int position = 0;
        for (ProductSupplierRequest request : requests) {
            ProductSupplier supplier = new ProductSupplier();
            supplier.setTenant(tenant);
            supplier.setProduct(product);
            supplier.setSupplierId(supplierId(request.supplierId(), tenant));
            supplier.setSupplierRef(trim(request.supplierRef()));
            supplier.setPrice(money(request.price(), "invalid supplier price"));
            supplier.setMinQty(request.minQty());
            supplier.setDelayDays(request.delayDays());
            supplier.setPosition(position++);
            suppliers.save(supplier);
        }
    }

    private UUID supplierId(String value, Tenant tenant) {
        UUID id = uuid(value, "invalid supplier id");
        if (!partners.existsByIdAndTenantId(id, tenant.getId())) {
            throw new AuthException(404, "supplier not found", "missingSupplier");
        }
        return id;
    }

    private boolean matches(Product product, String query) {
        return contains(product.getSku(), query)
                || contains(product.getName(), query)
                || contains(product.getDescription(), query);
    }

    private boolean contains(String value, String query) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(query);
    }

    private Comparator<Product> comparator(String sort) {
        String[] parts = sort == null ? new String[0] : sort.split(",");
        String field = parts.length > 0 ? parts[0].trim() : "name";
        boolean desc = parts.length > 1 && "desc".equalsIgnoreCase(parts[1].trim());

        Comparator<Product> comparator =
                switch (field.toLowerCase(Locale.ROOT)) {
                    case "saleprice" ->
                            Comparator.comparing(
                                    Product::getSalePrice,
                                    Comparator.nullsLast(Comparator.naturalOrder()));
                    case "createdat" ->
                            Comparator.comparing(
                                    Product::getCreatedAt,
                                    Comparator.nullsLast(Comparator.naturalOrder()));
                    default ->
                            Comparator.comparing(
                                    Product::getName,
                                    Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER));
                };
        return desc ? comparator.reversed() : comparator;
    }

    private ProductType parseType(String value) {
        try {
            return ProductType.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new AuthException(400, "invalid product type", "invalidType");
        }
    }

    private String category(String value) {
        String category = value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
        if (!CATEGORIES.contains(category)) {
            throw new AuthException(400, "invalid product category", "invalidCategory");
        }
        return category;
    }

    private String unit(String value) {
        String unit = value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
        if (!UNITS.contains(unit)) {
            throw new AuthException(400, "invalid product unit", "invalidUnit");
        }
        return unit;
    }

    private BigDecimal vatRate(BigDecimal value) {
        BigDecimal rate = value == null ? BigDecimal.ZERO : value;
        for (BigDecimal allowed : VAT_RATES) {
            if (allowed.compareTo(rate) == 0) {
                return rate.setScale(2, RoundingMode.HALF_UP);
            }
        }
        throw new AuthException(400, "invalid VAT rate", "invalidVatRate");
    }

    private BigDecimal money(BigDecimal value, String message) {
        if (value == null || value.compareTo(BigDecimal.ZERO) < 0) {
            throw new AuthException(400, message, "invalidAmount");
        }
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal quantity(BigDecimal value, String message) {
        if (value == null || value.compareTo(BigDecimal.ZERO) < 0) {
            throw new AuthException(400, message, "invalidQuantity");
        }
        return value.setScale(3, RoundingMode.HALF_UP);
    }

    private UUID uuid(String value, String message) {
        try {
            return UUID.fromString(value.trim());
        } catch (IllegalArgumentException ex) {
            throw new AuthException(400, message, "notFound");
        }
    }

    private String trim(String value) {
        return value == null ? "" : value.trim();
    }
}
