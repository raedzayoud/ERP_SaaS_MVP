package com.erp.erp.auth.dto;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

class SignupOtpVerifyRequestTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void codeMustBeSixDigits() {
        assertFalse(validator.validate(new SignupOtpVerifyRequest("owner@acme.com", "12ab56")).isEmpty());
        assertTrue(validator.validate(new SignupOtpVerifyRequest("owner@acme.com", "123456")).isEmpty());
    }
}
