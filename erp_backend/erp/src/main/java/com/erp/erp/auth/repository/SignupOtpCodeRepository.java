package com.erp.erp.auth.repository;

import com.erp.erp.auth.model.SignupOtpCode;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SignupOtpCodeRepository extends JpaRepository<SignupOtpCode, UUID> {

    Optional<SignupOtpCode> findByEmail(String email);
}
