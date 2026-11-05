package com.erp.erp.billing.config;

import com.stripe.StripeClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class StripeConfig {

    /**
     * The client is created even when the key is empty so the application can
     * start without billing configured. Billing endpoints check the key first.
     */
    @Bean
    public StripeClient stripeClient(@Value("${app.stripe.secret-key:}") String secretKey) {
        return new StripeClient(secretKey);
    }
}
