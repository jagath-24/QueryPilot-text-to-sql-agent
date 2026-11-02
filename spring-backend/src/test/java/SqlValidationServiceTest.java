package com.querypilot;

import com.querypilot.service.SqlValidationService;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class SqlValidationServiceTest {
    private final SqlValidationService service = new SqlValidationService();
    @Test void addsLimitToSelect() { assertEquals("SELECT id FROM orders LIMIT 100", service.validate("SELECT id FROM orders")); }
    @Test void blocksMutation() { assertThrows(IllegalArgumentException.class, () -> service.validate("DELETE FROM orders")); }
    @Test void capsLargeLimit() { assertEquals("SELECT * FROM orders LIMIT 100", service.validate("SELECT * FROM orders LIMIT 999")); }
}
