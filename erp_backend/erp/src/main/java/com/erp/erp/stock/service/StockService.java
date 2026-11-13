package com.erp.erp.stock.service;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.common.dto.PageResponse;
import com.erp.erp.products.model.Product;
import com.erp.erp.products.model.ProductType;
import com.erp.erp.products.repository.ProductRepository;
import com.erp.erp.stock.dto.AvailabilityIssueResponse;
import com.erp.erp.stock.dto.AvailabilityRequest;
import com.erp.erp.stock.dto.MovementRequest;
import com.erp.erp.stock.dto.MovementResponse;
import com.erp.erp.stock.dto.ReceptionRequest;
import com.erp.erp.stock.dto.SalePostingRequest;
import com.erp.erp.stock.dto.StockItemRequest;
import com.erp.erp.stock.dto.StockLevelResponse;
import com.erp.erp.stock.dto.TransferRequest;
import com.erp.erp.stock.dto.WarehouseNameRequest;
import com.erp.erp.stock.dto.WarehouseRequest;
import com.erp.erp.stock.dto.WarehouseResponse;
import com.erp.erp.stock.dto.WarehouseSummaryResponse;
import com.erp.erp.stock.model.MovementDirection;
import com.erp.erp.stock.model.MovementType;
import com.erp.erp.stock.model.StockMovement;
import com.erp.erp.stock.model.Warehouse;
import com.erp.erp.stock.repository.StockMovementRepository;
import com.erp.erp.stock.repository.WarehouseRepository;
import com.erp.erp.tenant.model.Tenant;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Warehouses and the stock journal. The quantity on hand is the sum of the
 * movements, so there is no second table to keep in sync.
 * shortcut: the levels are recomputed on every read; move them to a table when
 * the journal grows beyond a few thousand lines.
 */
@Service
public class StockService {

    private static final int DEFAULT_SIZE = 10;
    private static final int MAX_SIZE = 500;

    private final WarehouseRepository warehouses;
    private final StockMovementRepository movements;
    private final ProductRepository products;

    public StockService(
            WarehouseRepository warehouses,
            StockMovementRepository movements,
            ProductRepository products) {
        this.warehouses = warehouses;
        this.movements = movements;
        this.products = products;
    }

    // ---------------------------------------------------------------- warehouses

    @Transactional(readOnly = true)
    public List<WarehouseResponse> listWarehouses(Tenant tenant) {
        return warehouses.findByTenantIdOrderByCodeAsc(tenant.getId()).stream()
                .map(WarehouseResponse::from)
                .toList();
    }

    @Transactional
    public WarehouseResponse createWarehouse(Tenant tenant, WarehouseRequest request) {
        String code = trim(request.code()).toUpperCase(Locale.ROOT);
        String name = trim(request.name());
        if (code.isBlank()) {
            throw new AuthException(400, "a warehouse code is required", "missingCode");
        }
        if (name.isBlank()) {
            throw new AuthException(400, "a warehouse name is required", "missingName");
        }
        if (warehouses.existsByTenantIdAndCodeIgnoreCase(tenant.getId(), code)) {
            throw new AuthException(409, "a warehouse with this code already exists", "warehouseExists");
        }

        Warehouse warehouse = new Warehouse();
        warehouse.setTenant(tenant);
        warehouse.setCode(code);
        warehouse.setName(name);
        warehouse.setActive(true);
        return WarehouseResponse.from(warehouses.save(warehouse));
    }

    @Transactional
    public WarehouseResponse renameWarehouse(
            Tenant tenant, UUID id, WarehouseNameRequest request) {
        String name = trim(request.name());
        if (name.isBlank()) {
            throw new AuthException(400, "a warehouse name is required", "missingName");
        }
        Warehouse warehouse = findWarehouse(tenant, id);
        warehouse.setName(name);
        warehouse.setUpdatedAt(Instant.now());
        return WarehouseResponse.from(warehouses.save(warehouse));
    }

    @Transactional
    public WarehouseResponse archiveWarehouse(Tenant tenant, UUID id) {
        Warehouse warehouse = findWarehouse(tenant, id);
        if (warehouse.isActive() && warehouses.countByTenantIdAndActiveTrue(tenant.getId()) <= 1) {
            throw new AuthException(
                    409, "the last active warehouse cannot be archived", "lastActiveWarehouse");
        }
        warehouse.setActive(false);
        warehouse.setUpdatedAt(Instant.now());
        return WarehouseResponse.from(warehouses.save(warehouse));
    }

    @Transactional
    public WarehouseResponse restoreWarehouse(Tenant tenant, UUID id) {
        Warehouse warehouse = findWarehouse(tenant, id);
        warehouse.setActive(true);
        warehouse.setUpdatedAt(Instant.now());
        return WarehouseResponse.from(warehouses.save(warehouse));
    }

    // -------------------------------------------------------------------- levels

    @Transactional(readOnly = true)
    public List<StockLevelResponse> levels(Tenant tenant, String warehouseId, String search) {
        String query = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        UUID warehouse = warehouseId == null || warehouseId.isBlank() ? null : uuid(warehouseId);
        List<StockMovement> journal = journal(tenant);

        List<StockLevelResponse> rows = new ArrayList<>();
        for (Product product : goods(tenant)) {
            BigDecimal quantity = level(journal, warehouse, product.getId());
            BigDecimal minStock =
                    product.getMinStock() == null ? BigDecimal.ZERO : product.getMinStock();
            BigDecimal value = quantity.multiply(product.getPurchasePrice());
            rows.add(
                    new StockLevelResponse(
                            product.getId().toString(),
                            product.getSku(),
                            product.getName(),
                            product.getUnit(),
                            product.getPurchasePrice(),
                            quantity,
                            value,
                            minStock,
                            minStock.compareTo(BigDecimal.ZERO) > 0
                                    && quantity.compareTo(minStock) <= 0));
        }

        return rows.stream()
                .filter(
                        row ->
                                query.isEmpty()
                                        || contains(row.name(), query)
                                        || contains(row.sku(), query))
                .sorted(Comparator.comparing(StockLevelResponse::name, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    /** Products at or below their threshold, most critical first. */
    @Transactional(readOnly = true)
    public List<StockLevelResponse> lowStock(Tenant tenant) {
        return levels(tenant, null, null).stream()
                .filter(StockLevelResponse::low)
                .sorted(
                        Comparator.comparing(
                                        (StockLevelResponse row) ->
                                                row.quantity().subtract(row.minStock()))
                                .thenComparing(StockLevelResponse::name, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    /** Small stats of every warehouse: references held and stored value. */
    @Transactional(readOnly = true)
    public List<WarehouseSummaryResponse> summaries(Tenant tenant) {
        List<Product> goods = goods(tenant);
        List<StockMovement> journal = journal(tenant);

        List<WarehouseSummaryResponse> summaries = new ArrayList<>();
        for (Warehouse warehouse : warehouses.findByTenantIdOrderByCodeAsc(tenant.getId())) {
            int refs = 0;
            BigDecimal value = BigDecimal.ZERO;
            for (Product product : goods) {
                BigDecimal quantity = level(journal, warehouse.getId(), product.getId());
                if (quantity.compareTo(BigDecimal.ZERO) != 0) {
                    refs++;
                    value = value.add(quantity.multiply(product.getPurchasePrice()));
                }
            }
            summaries.add(
                    new WarehouseSummaryResponse(
                            warehouse.getId().toString(), refs, value.setScale(2, RoundingMode.HALF_UP)));
        }
        return summaries;
    }

    // ----------------------------------------------------------------- movements

    @Transactional(readOnly = true)
    public PageResponse<MovementResponse> movements(
            Tenant tenant,
            int page,
            int size,
            String search,
            String type,
            String warehouseId,
            String sort) {
        List<StockMovement> journal = journal(tenant);
        Map<UUID, Product> catalog = catalog(tenant);
        Map<UUID, Warehouse> places = places(tenant);

        String query = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        MovementType typeFilter = type == null || type.isBlank() ? null : parseType(type);
        UUID warehouse =
                warehouseId == null || warehouseId.isBlank() ? null : uuid(warehouseId);

        List<StockMovement> filtered =
                journal.stream()
                        .filter(movement -> typeFilter == null || movement.getType() == typeFilter)
                        .filter(
                                movement ->
                                        warehouse == null
                                                || warehouse.equals(movement.getWarehouseId()))
                        .filter(movement -> query.isEmpty() || matches(movement, query, catalog))
                        .sorted(comparator(sort, catalog))
                        .toList();

        int pageSize = size <= 0 ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);
        int currentPage = Math.max(0, page);
        int from = Math.min(currentPage * pageSize, filtered.size());
        int to = Math.min(from + pageSize, filtered.size());

        List<MovementResponse> items =
                filtered.subList(from, to).stream()
                        .map(
                                movement ->
                                        MovementResponse.from(
                                                movement,
                                                catalog.get(movement.getProductId()),
                                                places.get(movement.getWarehouseId())))
                        .toList();

        return new PageResponse<>(items, filtered.size(), currentPage, pageSize);
    }

    @Transactional
    public MovementResponse adjustment(Tenant tenant, MovementRequest request) {
        BigDecimal quantity = positive(request.quantity());
        String reason = trim(request.reason());
        if (reason.isBlank()) {
            throw new AuthException(400, "a reason is required", "missingReason");
        }
        Warehouse warehouse = usableWarehouse(tenant, request.warehouseId());
        Product product = stockableProduct(tenant, request.productId());
        MovementDirection direction = parseDirection(request.direction());

        StockMovement movement = new StockMovement();
        movement.setTenant(tenant);
        movement.setType(MovementType.ADJUSTMENT);
        movement.setDirection(direction);
        movement.setProductId(product.getId());
        movement.setWarehouseId(warehouse.getId());
        movement.setQuantity(quantity);
        movement.setDate(request.date() == null ? LocalDate.now() : request.date());
        movement.setReason(reason);
        movement.setRefId(null);

        return MovementResponse.from(movements.save(movement), product, warehouse);
    }

    @Transactional
    public List<MovementResponse> transfer(Tenant tenant, TransferRequest request) {
        BigDecimal quantity = positive(request.quantity());
        String reason = trim(request.reason());
        if (reason.isBlank()) {
            throw new AuthException(400, "a reason is required", "missingReason");
        }
        if (trim(request.fromWarehouseId()).equals(trim(request.toWarehouseId()))) {
            throw new AuthException(
                    409, "the source and the target warehouse are the same", "sameWarehouse");
        }

        Warehouse from = usableWarehouse(tenant, request.fromWarehouseId());
        Warehouse to = usableWarehouse(tenant, request.toWarehouseId());
        Product product = stockableProduct(tenant, request.productId());

        BigDecimal available = level(journal(tenant), from.getId(), product.getId());
        if (available.compareTo(quantity) < 0) {
            throw new AuthException(
                    409, "not enough stock in the source warehouse", "insufficientStock");
        }

        LocalDate date = request.date() == null ? LocalDate.now() : request.date();
        StockMovement out = movement(MovementType.TRANSFER, MovementDirection.OUT, product, from,
                quantity, date, "Transfer to " + to.getName(), null, tenant);
        StockMovement in = movement(MovementType.TRANSFER, MovementDirection.IN, product, to,
                quantity, date, "Transfer received", null, tenant);

        List<MovementResponse> created = new ArrayList<>();
        created.add(MovementResponse.from(movements.save(out), product, from));
        created.add(MovementResponse.from(movements.save(in), product, to));
        return created;
    }

    @Transactional(readOnly = true)
    public List<AvailabilityIssueResponse> availability(Tenant tenant, AvailabilityRequest request) {
        Warehouse warehouse = usableWarehouse(tenant, request.warehouseId());
        List<StockMovement> journal = journal(tenant);
        Map<UUID, BigDecimal> needed = new LinkedHashMap<>();
        List<Product> goods = goods(tenant);

        for (StockItemRequest item : items(request.items())) {
            BigDecimal quantity = item.quantity();
            if (quantity == null || quantity.compareTo(BigDecimal.ZERO) <= 0 || item.productId() == null) {
                continue;
            }
            UUID productId = uuid(item.productId());
            if (!goods.stream().anyMatch(product -> product.getId().equals(productId))) {
                continue;
            }
            needed.merge(productId, quantity, BigDecimal::add);
        }

        List<AvailabilityIssueResponse> issues = new ArrayList<>();
        for (Map.Entry<UUID, BigDecimal> entry : needed.entrySet()) {
            BigDecimal available = level(journal, warehouse.getId(), entry.getKey());
            if (entry.getValue().compareTo(available) > 0) {
                issues.add(
                        new AvailabilityIssueResponse(
                                entry.getKey().toString(), entry.getValue(), available));
            }
        }
        return issues;
    }

    /** Stock coming in from a supplier order. */
    @Transactional
    public List<MovementResponse> reception(Tenant tenant, ReceptionRequest request) {
        Warehouse warehouse = usableWarehouse(tenant, request.warehouseId());
        LocalDate date = request.date() == null ? LocalDate.now() : request.date();
        String reason =
                request.blNumber() == null || request.blNumber().isBlank()
                        ? "Supplier reception"
                        : trim(request.blNumber());

        List<MovementResponse> created = new ArrayList<>();
        for (StockItemRequest item : items(request.items())) {
            Product product = optionalGood(tenant, item.productId());
            if (product == null || item.quantity() == null
                    || item.quantity().compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }
            StockMovement movement =
                    movement(
                            MovementType.PURCHASE,
                            MovementDirection.IN,
                            product,
                            warehouse,
                            item.quantity(),
                            date,
                            reason,
                            request.refId(),
                            tenant);
            created.add(MovementResponse.from(movements.save(movement), product, warehouse));
        }
        return created;
    }

    /** Stock going out for a posted sales invoice. */
    @Transactional
    public List<MovementResponse> salePosting(Tenant tenant, SalePostingRequest request) {
        Warehouse warehouse = usableWarehouse(tenant, request.warehouseId());
        List<AvailabilityIssueResponse> issues =
                availability(
                        tenant,
                        new AvailabilityRequest(
                                request.warehouseId(),
                                items(request.items()).stream()
                                        .filter(
                                                item ->
                                                        item.productId() != null
                                                                && item.quantity() != null
                                                                && item.quantity()
                                                                        .compareTo(BigDecimal.ZERO)
                                                                        > 0)
                                        .toList()));
        if (!issues.isEmpty()) {
            throw new AuthException(409, "not enough stock to post the invoice", "insufficientStock");
        }

        LocalDate date = request.date() == null ? LocalDate.now() : request.date();
        List<MovementResponse> created = new ArrayList<>();
        for (StockItemRequest item : items(request.items())) {
            Product product = optionalGood(tenant, item.productId());
            if (product == null || item.quantity() == null
                    || item.quantity().compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }
            StockMovement movement =
                    movement(
                            MovementType.SALE,
                            MovementDirection.OUT,
                            product,
                            warehouse,
                            item.quantity(),
                            date,
                            "Sales invoice",
                            request.refId(),
                            tenant);
            created.add(MovementResponse.from(movements.save(movement), product, warehouse));
        }
        return created;
    }

    // ------------------------------------------------------------------- helpers

    private StockMovement movement(
            MovementType type,
            MovementDirection direction,
            Product product,
            Warehouse warehouse,
            BigDecimal quantity,
            LocalDate date,
            String reason,
            String refId,
            Tenant tenant) {
        StockMovement movement = new StockMovement();
        movement.setTenant(tenant);
        movement.setType(type);
        movement.setDirection(direction);
        movement.setProductId(product.getId());
        movement.setWarehouseId(warehouse.getId());
        movement.setQuantity(quantity);
        movement.setDate(date);
        movement.setReason(reason);
        movement.setRefId(refId == null || refId.isBlank() ? null : trim(refId));
        return movement;
    }

    private List<StockMovement> journal(Tenant tenant) {
        return movements.findByTenantIdOrderByDateDescCreatedAtDesc(tenant.getId());
    }

    /** Active goods only: services are never stocked. */
    private List<Product> goods(Tenant tenant) {
        return products.findByTenantIdOrderByNameAsc(tenant.getId()).stream()
                .filter(product -> product.getType() == ProductType.GOOD && product.isActive())
                .toList();
    }

    private Map<UUID, Product> catalog(Tenant tenant) {
        Map<UUID, Product> catalog = new LinkedHashMap<>();
        for (Product product : products.findByTenantIdOrderByNameAsc(tenant.getId())) {
            catalog.put(product.getId(), product);
        }
        return catalog;
    }

    private Map<UUID, Warehouse> places(Tenant tenant) {
        Map<UUID, Warehouse> places = new LinkedHashMap<>();
        for (Warehouse warehouse : warehouses.findByTenantIdOrderByCodeAsc(tenant.getId())) {
            places.put(warehouse.getId(), warehouse);
        }
        return places;
    }

    /** Quantity on hand of one product, in one warehouse or in all of them. */
    private BigDecimal level(
            List<StockMovement> journal, UUID warehouseId, UUID productId) {
        BigDecimal total = BigDecimal.ZERO;
        for (StockMovement movement : journal) {
            if (!productId.equals(movement.getProductId())) {
                continue;
            }
            if (warehouseId != null && !warehouseId.equals(movement.getWarehouseId())) {
                continue;
            }
            total =
                    total.add(
                            movement.getDirection() == MovementDirection.IN
                                    ? movement.getQuantity()
                                    : movement.getQuantity().negate());
        }
        return total;
    }

    private Warehouse findWarehouse(Tenant tenant, UUID id) {
        return warehouses
                .findByIdAndTenantId(id, tenant.getId())
                .orElseThrow(() -> new AuthException(404, "warehouse not found", "notFound"));
    }

    private Warehouse usableWarehouse(Tenant tenant, String value) {
        if (value == null || value.isBlank()) {
            throw new AuthException(404, "warehouse not found", "missingWarehouse");
        }
        Warehouse warehouse = findWarehouse(tenant, uuid(value));
        if (!warehouse.isActive()) {
            throw new AuthException(409, "the warehouse is archived", "inactiveWarehouse");
        }
        return warehouse;
    }

    private Product stockableProduct(Tenant tenant, String value) {
        if (value == null || value.isBlank()) {
            throw new AuthException(404, "product not found", "missingProduct");
        }
        Product product =
                products
                        .findByIdAndTenantId(uuid(value), tenant.getId())
                        .orElseThrow(
                                () -> new AuthException(404, "product not found", "missingProduct"));
        if (product.getType() != ProductType.GOOD) {
            throw new AuthException(
                    400, "a service is not stocked", "notStockedProduct");
        }
        return product;
    }

    private Product optionalGood(Tenant tenant, String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        Product product = products.findByIdAndTenantId(uuid(value), tenant.getId()).orElse(null);
        if (product == null || product.getType() != ProductType.GOOD || !product.isActive()) {
            return null;
        }
        return product;
    }

    private boolean matches(StockMovement movement, String query, Map<UUID, Product> catalog) {
        Product product = catalog.get(movement.getProductId());
        return contains(movement.getReason(), query)
                || contains(movement.getDate() == null ? null : movement.getDate().toString(), query)
                || contains(product == null ? null : product.getName(), query)
                || contains(product == null ? null : product.getSku(), query);
    }

    private Comparator<StockMovement> comparator(String sort, Map<UUID, Product> catalog) {
        String[] parts = sort == null ? new String[0] : sort.split(",");
        String field = parts.length > 0 ? parts[0].trim().toLowerCase(Locale.ROOT) : "date";
        boolean desc = parts.length > 1 && "desc".equalsIgnoreCase(parts[1].trim());

        Comparator<StockMovement> primary =
                switch (field) {
                    case "product" -> Comparator.comparing(
                            (StockMovement movement) ->
                                    productName(catalog.get(movement.getProductId())),
                            String.CASE_INSENSITIVE_ORDER);
                    case "quantity" -> Comparator.comparing(
                            (StockMovement movement) ->
                                    movement.getDirection() == MovementDirection.IN
                                            ? movement.getQuantity()
                                            : movement.getQuantity().negate());
                    default -> Comparator.comparing(
                            StockMovement::getDate, Comparator.nullsLast(Comparator.naturalOrder()));
                };
        Comparator<StockMovement> ordered = desc ? primary.reversed() : primary;
        // Most recent first whatever the direction.
        return ordered.thenComparing(
                movement -> movement.getCreatedAt() == null ? "" : movement.getCreatedAt().toString(),
                Comparator.reverseOrder());
    }

    private String productName(Product product) {
        return product == null ? "" : product.getName();
    }

    private MovementType parseType(String value) {
        try {
            return MovementType.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new AuthException(400, "invalid movement type", "invalidType");
        }
    }

    private MovementDirection parseDirection(String value) {
        try {
            return MovementDirection.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new AuthException(400, "invalid movement direction", "invalidDirection");
        }
    }

    private BigDecimal positive(BigDecimal value) {
        if (value == null || value.compareTo(BigDecimal.ZERO) <= 0) {
            throw new AuthException(400, "the quantity must be greater than zero", "invalidQuantity");
        }
        return value.setScale(3, RoundingMode.HALF_UP);
    }

    private List<StockItemRequest> items(List<StockItemRequest> items) {
        return items == null ? List.of() : items;
    }

    private boolean contains(String value, String query) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(query);
    }

    private UUID uuid(String value) {
        try {
            return UUID.fromString(value.trim());
        } catch (IllegalArgumentException ex) {
            throw new AuthException(400, "invalid id", "notFound");
        }
    }

    private String trim(String value) {
        return value == null ? "" : value.trim();
    }
}
