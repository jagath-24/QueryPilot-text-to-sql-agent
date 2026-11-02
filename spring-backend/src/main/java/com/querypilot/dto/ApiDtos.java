package com.querypilot.dto;

import java.util.List;
import java.util.Map;

public final class ApiDtos {
    private ApiDtos() {}
    public record AuthRequest(String email, String password, String name) {}
    public record AuthResponse(String token, String userId, String email, String name) {}
    public record GenerateRequest(String question) {}
    public record GenerateResponse(String sql, String explanation) {}
    public record ExecuteRequest(String sql) {}
    public record ChartSuggestion(String type, String xKey, List<String> yKeys, String reason) {}
    public record ExecuteResponse(String sql, List<String> columns, List<Map<String, Object>> rows, int rowCount, ChartSuggestion chart, long durationMs) {}
    public record SchemaColumn(String name, String type, boolean nullable, String key) {}
    public record SchemaTable(String name, long rowCount, List<SchemaColumn> columns) {}
    public record SchemaResponse(String database, String generatedAt, List<SchemaTable> tables) {}
    public record HistoryItem(long id, String question, String sql, String explanation, String chartType, int rowCount, String createdAt, boolean favorite) {}
    public record FavoriteRequest(long queryId) {}
}
