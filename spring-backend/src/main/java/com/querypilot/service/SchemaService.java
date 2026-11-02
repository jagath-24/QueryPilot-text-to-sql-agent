package com.querypilot.service;

import com.querypilot.dto.ApiDtos;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class SchemaService {
    private final JdbcTemplate jdbc;
    private volatile ApiDtos.SchemaResponse cache;
    public SchemaService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public ApiDtos.SchemaResponse getSchema() {
        if (cache != null) return cache;
        try {
            // Get table names from information_schema
            List<Map<String, Object>> tableRows = jdbc.queryForList(
                "SELECT TABLE_NAME FROM information_schema.TABLES " +
                "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME");

            // Get column metadata
            List<Map<String, Object>> columnRows = jdbc.queryForList(
                "SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY " +
                "FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() " +
                "ORDER BY TABLE_NAME, ORDINAL_POSITION");

            List<ApiDtos.SchemaTable> tables = new ArrayList<>();
            for (Map<String, Object> table : tableRows) {
                String name = String.valueOf(table.get("TABLE_NAME"));

                // Use real COUNT(*) instead of information_schema estimate (InnoDB estimates are unreliable)
                long realCount = 0;
                try {
                    realCount = jdbc.queryForObject("SELECT COUNT(*) FROM `" + name + "`", Long.class);
                } catch (Exception ignored) {}

                List<ApiDtos.SchemaColumn> columns = columnRows.stream()
                    .filter(col -> name.equals(col.get("TABLE_NAME")))
                    .map(col -> new ApiDtos.SchemaColumn(
                        String.valueOf(col.get("COLUMN_NAME")),
                        String.valueOf(col.get("COLUMN_TYPE")),
                        "YES".equals(col.get("IS_NULLABLE")),
                        String.valueOf(col.get("COLUMN_KEY"))))
                    .toList();

                tables.add(new ApiDtos.SchemaTable(name, realCount, columns));
            }

            cache = new ApiDtos.SchemaResponse(
                jdbc.getDataSource().getConnection().getCatalog(),
                Instant.now().toString(),
                tables);
        } catch (Exception ex) {
            throw new IllegalStateException("Schema introspection failed", ex);
        }
        return cache;
    }

    public void invalidate() { cache = null; }
}
