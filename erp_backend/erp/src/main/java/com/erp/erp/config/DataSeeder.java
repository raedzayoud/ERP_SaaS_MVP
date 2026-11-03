package com.erp.erp.config;

import com.erp.erp.tenant.model.Tenant;
import com.erp.erp.tenant.repository.TenantRepository;
import com.erp.erp.user.model.Role;
import com.erp.erp.user.model.User;
import com.erp.erp.user.repository.UserRepository;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Creates the demo data on the very first start (only when the users table
 * is empty): the platform super-admin, the "Demo SARL" workspace and its
 * administrator. Common dev password: demo1234.
 */
@Component
public class DataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);
    private static final String SEED_PASSWORD = "demo1234";

    private static final List<String> ALL_MODULES = List.of(
            "dashboard",
            "apps",
            "contacts",
            "products",
            "sales",
            "invoices",
            "payments",
            "purchases",
            "stock",
            "accounting",
            "invoicing",
            "reports",
            "ai-assistant",
            "collab",
            "settings");

    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;
    private final PasswordEncoder passwordEncoder;

    public DataSeeder(
            UserRepository userRepository, TenantRepository tenantRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.tenantRepository = tenantRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (userRepository.count() > 0) {
            return;
        }

        User superAdmin = new User();
        superAdmin.setFullName("Platform Admin");
        superAdmin.setEmail("superadmin@platform.com");
        superAdmin.setPasswordHash(passwordEncoder.encode(SEED_PASSWORD));
        superAdmin.setRole(Role.SUPER_ADMIN);
        userRepository.save(superAdmin);

        Tenant tenant = new Tenant();
        tenant.setCompanyName("Demo SARL");
        tenant.setEmail("admin@demo.com");
        tenant.setSubdomain("demo");
        tenant.setCountry("TN");
        tenant.setLanguage("en");
        tenant.setCompanySize("1-5");
        tenant.setPlanId("enterprise");
        tenant.setModuleList(ALL_MODULES);
        tenant.setCurrency("USD");
        tenant.setTaxId("12034567/A/M/000");
        tenant.setAddress("12 Rue de la Republique, Tunis");
        tenant = tenantRepository.save(tenant);

        User admin = new User();
        admin.setFullName("Amira Ben Salah");
        admin.setEmail("admin@demo.com");
        admin.setPasswordHash(passwordEncoder.encode(SEED_PASSWORD));
        admin.setRole(Role.ADMIN_ENTREPRISE);
        admin.setTenant(tenant);
        userRepository.save(admin);

        log.info("Seeded demo data: superadmin@platform.com / admin@demo.com (password: {})", SEED_PASSWORD);
    }
}
