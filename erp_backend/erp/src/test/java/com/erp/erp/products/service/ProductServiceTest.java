package com.erp.erp.products.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ProductServiceTest {

    private final ProductRepository products = mock(ProductRepository.class);
    private final ProductSupplierRepository suppliers = mock(ProductSupplierRepository.class);
    private final CrmPartnerRepository partners = mock(CrmPartnerRepository.class);
    private final ProductService service = new ProductService(products, suppliers, partners);

    @Test
    void createsAProductWithItsSuppliers() {
        Tenant tenant = tenant();
        UUID supplierId = UUID.randomUUID();
        when(partners.existsByIdAndTenantId(supplierId, tenant.getId())).thenReturn(true);
        when(products.save(any(Product.class))).thenAnswer(call -> save(call.getArgument(0)));
        when(suppliers.findByTenantIdAndProductIdOrderByPositionAsc(any(), any()))
                .thenReturn(List.of());

        ProductResponse response = service.create(tenant, request(supplierId));

        assertEquals("SKU-1001", response.sku());
        assertEquals("good", response.type());
        assertEquals(true, response.active());
        assertEquals(0, new BigDecimal("1299.00").compareTo(response.salePrice()));
        verify(suppliers).save(any(ProductSupplier.class));
    }

    @Test
    void rejectsADuplicateSku() {
        Tenant tenant = tenant();
        when(products.existsByTenantIdAndSkuIgnoreCase(tenant.getId(), "SKU-1001")).thenReturn(true);

        AuthException ex =
                assertThrows(AuthException.class, () -> service.create(tenant, request(null)));

        assertEquals(409, ex.getStatus());
        assertEquals("duplicateSku", ex.getCode());
        verify(products, never()).save(any(Product.class));
    }

    @Test
    void rejectsAnUnknownSupplier() {
        Tenant tenant = tenant();
        UUID supplierId = UUID.randomUUID();
        when(partners.existsByIdAndTenantId(supplierId, tenant.getId())).thenReturn(false);

        AuthException ex =
                assertThrows(AuthException.class, () -> service.create(tenant, request(supplierId)));

        assertEquals(404, ex.getStatus());
        assertEquals("missingSupplier", ex.getCode());
        verify(products, never()).save(any(Product.class));
    }

    @Test
    void rejectsTheSameSupplierTwice() {
        Tenant tenant = tenant();
        UUID supplierId = UUID.randomUUID();
        when(partners.existsByIdAndTenantId(supplierId, tenant.getId())).thenReturn(true);

        ProductRequest request =
                new ProductRequest(
                        "good",
                        "SKU-1001",
                        "Laptop Pro 14",
                        "",
                        "hardware",
                        "piece",
                        new BigDecimal("1299"),
                        new BigDecimal("900"),
                        new BigDecimal("19"),
                        new BigDecimal("6"),
                        List.of(
                                new ProductSupplierRequest(
                                        supplierId.toString(), "VRD", new BigDecimal("900"), 1, 14),
                                new ProductSupplierRequest(
                                        supplierId.toString(), "VRD", new BigDecimal("900"), 1, 14)));

        AuthException ex =
                assertThrows(AuthException.class, () -> service.create(tenant, request));

        assertEquals(400, ex.getStatus());
        assertEquals("duplicateSupplier", ex.getCode());
    }

    @Test
    void rejectsAnUnknownCategory() {
        Tenant tenant = tenant();
        ProductRequest request =
                new ProductRequest(
                        "good",
                        "SKU-1001",
                        "Laptop Pro 14",
                        "",
                        "spaceship",
                        "piece",
                        new BigDecimal("1299"),
                        new BigDecimal("900"),
                        new BigDecimal("19"),
                        new BigDecimal("6"),
                        List.of());

        AuthException ex =
                assertThrows(AuthException.class, () -> service.create(tenant, request));

        assertEquals(400, ex.getStatus());
        assertEquals("invalidCategory", ex.getCode());
    }

    @Test
    void filtersAndPagesTheCatalog() {
        Tenant tenant = tenant();
        when(products.findByTenantIdOrderByNameAsc(tenant.getId()))
                .thenReturn(
                        List.of(
                                product(tenant, "Acme Mouse", true),
                                product(tenant, "Atlas Laptop", true),
                                product(tenant, "Old Printer", false)));
        when(suppliers.findByTenantIdAndProductIdInOrderByPositionAsc(any(), any()))
                .thenReturn(List.of());

        PageResponse<ProductResponse> page =
                service.list(tenant, 0, 10, null, null, null, true, "name,asc", null);

        assertEquals(2, page.total());
        assertEquals("Acme Mouse", page.items().get(0).name());
    }

    @Test
    void archivesAndRestoresAProduct() {
        Tenant tenant = tenant();
        Product product = product(tenant, "Laptop Pro 14", true);
        when(products.findByIdAndTenantId(product.getId(), tenant.getId()))
                .thenReturn(java.util.Optional.of(product));
        when(products.save(any(Product.class))).thenAnswer(call -> save(call.getArgument(0)));
        when(suppliers.findByTenantIdAndProductIdOrderByPositionAsc(any(), any()))
                .thenReturn(List.of());

        assertEquals(false, service.archive(tenant, product.getId()).active());
        assertEquals(true, service.restore(tenant, product.getId()).active());
    }

    private ProductRequest request(UUID supplierId) {
        List<ProductSupplierRequest> supplierList =
                supplierId == null
                        ? List.of()
                        : List.of(
                                new ProductSupplierRequest(
                                        supplierId.toString(),
                                        "VRD-LP14",
                                        new BigDecimal("900"),
                                        1,
                                        14));
        return new ProductRequest(
                "good",
                " SKU-1001 ",
                " Laptop Pro 14 ",
                " 14 inch ",
                "hardware",
                "piece",
                new BigDecimal("1299"),
                new BigDecimal("900"),
                new BigDecimal("19"),
                new BigDecimal("6"),
                supplierList);
    }

    private Product save(Product product) {
        if (product.getId() == null) {
            product.setId(UUID.randomUUID());
        }
        return product;
    }

    private Product product(Tenant tenant, String name, boolean active) {
        Product product = new Product();
        product.setId(UUID.randomUUID());
        product.setTenant(tenant);
        product.setSku("SKU-" + name.hashCode());
        product.setName(name);
        product.setType(ProductType.GOOD);
        product.setCategory("hardware");
        product.setUnit("piece");
        product.setSalePrice(new BigDecimal("100"));
        product.setPurchasePrice(new BigDecimal("60"));
        product.setVatRate(new BigDecimal("19"));
        product.setMinStock(new BigDecimal("5"));
        product.setActive(active);
        return product;
    }

    private Tenant tenant() {
        Tenant tenant = new Tenant();
        tenant.setId(UUID.randomUUID());
        return tenant;
    }
}
