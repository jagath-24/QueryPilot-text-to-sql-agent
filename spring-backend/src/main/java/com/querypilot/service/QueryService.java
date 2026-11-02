package com.querypilot.service;

import com.querypilot.dto.ApiDtos;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class QueryService {
    private final JdbcTemplate jdbc;
    private final SqlValidationService validator;
    private final GroqService groq;
    private final RateLimitService rateLimit;

    public QueryService(JdbcTemplate jdbc, SqlValidationService validator, GroqService groq, RateLimitService rateLimit) { this.jdbc = jdbc; this.validator = validator; this.groq = groq; this.rateLimit = rateLimit; }
    public ApiDtos.GenerateResponse generate(ApiDtos.GenerateRequest request) { return groq.generate(request.question()); }

    public ApiDtos.ExecuteResponse execute(ApiDtos.ExecuteRequest request, String userId) {
        if (!rateLimit.allow(userId)) throw new IllegalStateException("Rate limit exceeded: maximum 20 queries per hour");
        long started = System.currentTimeMillis();
        String normalized;
        try {
            normalized = validator.validate(request.sql());
            jdbc.update("INSERT INTO query_audit(user_id,sql_text,allowed) VALUES (?,?,true)", userId, normalized);
        } catch (RuntimeException ex) {
            try { jdbc.update("INSERT INTO query_audit(user_id,sql_text,allowed,rejection_reason) VALUES (?,?,false,?)", userId, request.sql(), ex.getMessage()); } catch (Exception ignored) {}
            throw ex;
        }
        List<Map<String, Object>> rows = jdbc.queryForList(normalized);
        List<String> columns = rows.isEmpty() ? List.of() : new ArrayList<>(rows.get(0).keySet());
        ApiDtos.ChartSuggestion chart = suggestChart(columns, rows);
        long duration = System.currentTimeMillis() - started;
        return new ApiDtos.ExecuteResponse(normalized, columns, rows, rows.size(), chart, duration);
    }

    private ApiDtos.ChartSuggestion suggestChart(List<String> columns, List<Map<String, Object>> rows) {
        if (columns.size() < 2 || rows.isEmpty()) return new ApiDtos.ChartSuggestion("table", null, List.of(), "A table is clearest for this result shape.");
        String x = columns.get(0);
        List<String> measures = columns.subList(1, columns.size()).stream().filter(column -> rows.stream().anyMatch(row -> isNumeric(row.get(column)))).toList();
        if (measures.isEmpty()) return new ApiDtos.ChartSuggestion("table", null, List.of(), "No numeric measures were found for a chart.");
        boolean temporal = x.toLowerCase().matches(".*(date|month|year|time|week).*");
        return new ApiDtos.ChartSuggestion(temporal ? "line" : "bar", x, measures, temporal ? "A time-like dimension and numeric measures make a trend line chart useful." : "A compact categorical result with numeric measures is suited to a bar chart.");
    }
    private boolean isNumeric(Object value) { return value instanceof Number || value instanceof BigDecimal; }
    public List<ApiDtos.HistoryItem> history(String userId) { return jdbc.query("SELECT h.id,h.question,h.sql_text,h.explanation,h.chart_type,h.row_count,h.created_at,EXISTS(SELECT 1 FROM query_favorites f WHERE f.query_id=h.id AND f.user_id=?) AS favorite FROM query_history h WHERE h.user_id=? ORDER BY h.created_at DESC LIMIT 40", (rs, rowNum) -> new ApiDtos.HistoryItem(rs.getLong("id"), rs.getString("question"), rs.getString("sql_text"), rs.getString("explanation"), rs.getString("chart_type"), rs.getInt("row_count"), rs.getTimestamp("created_at").toInstant().toString(), rs.getBoolean("favorite")), userId, userId); }
    public void favorite(String userId, long queryId) { jdbc.update("INSERT IGNORE INTO query_favorites(query_id,user_id) VALUES (?,?)", queryId, userId); }
}
