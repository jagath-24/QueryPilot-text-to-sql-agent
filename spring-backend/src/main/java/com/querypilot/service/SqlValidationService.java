package com.querypilot.service;

import net.sf.jsqlparser.parser.CCJSqlParserUtil;
import net.sf.jsqlparser.statement.Statement;
import net.sf.jsqlparser.statement.select.Select;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.regex.Pattern;

@Service
public class SqlValidationService {
    private static final Pattern MUTATION = Pattern.compile("\\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|call|execute|replace|load)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern SYSTEM_TABLE = Pattern.compile("(information_schema|performance_schema|mysql\\.|sys\\.)", Pattern.CASE_INSENSITIVE);
    private static final Pattern COMMENTS = Pattern.compile("(--|/\\*)");

    public String validate(String candidate) {
        if (candidate == null || candidate.isBlank()) throw new IllegalArgumentException("SQL query is required");
        String sql = candidate.replaceFirst("^```(?i:sql)?", "").replaceFirst("```$", "").trim();
        if (sql.contains(";")) throw new IllegalArgumentException("Multiple statements are not allowed");
        if (!sql.toLowerCase(Locale.ROOT).startsWith("select") && !sql.toLowerCase(Locale.ROOT).startsWith("with")) throw new IllegalArgumentException("Only SELECT statements are allowed");
        if (MUTATION.matcher(sql).find()) throw new IllegalArgumentException("Mutating or procedural SQL is blocked");
        if (SYSTEM_TABLE.matcher(sql).find()) throw new IllegalArgumentException("System tables are not queryable");
        if (COMMENTS.matcher(sql).find()) throw new IllegalArgumentException("SQL comments are blocked");
        try {
            Statement statement = CCJSqlParserUtil.parse(sql);
            if (!(statement instanceof Select)) throw new IllegalArgumentException("Only SELECT statements are allowed");
        } catch (Exception ex) {
            throw new IllegalArgumentException("SQL parser rejected the statement: " + ex.getMessage());
        }
        var limit = Pattern.compile("\\blimit\\s+(\\d+)\\b", Pattern.CASE_INSENSITIVE).matcher(sql);
        if (!limit.find()) return sql + " LIMIT 100";
        if (Integer.parseInt(limit.group(1)) > 100) return sql.substring(0, limit.start(1)) + "100" + sql.substring(limit.end(1));
        return sql;
    }
}
