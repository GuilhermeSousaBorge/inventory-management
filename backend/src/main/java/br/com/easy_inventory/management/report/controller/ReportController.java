package br.com.easy_inventory.management.report.controller;

import br.com.easy_inventory.management.report.dto.ConsumptionReportRow;
import br.com.easy_inventory.management.report.dto.SalesReportRow;
import br.com.easy_inventory.management.report.dto.StockStatusRow;
import br.com.easy_inventory.management.report.dto.WasteReportRow;
import br.com.easy_inventory.management.report.service.ReportService;
import br.com.easy_inventory.management.shared.dto.ApiResponse;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/reports")
public class ReportController {

    private final ReportService service;

    public ReportController(ReportService service) {
        this.service = service;
    }

    @GetMapping("/consumption")
    public ResponseEntity<ApiResponse<List<ConsumptionReportRow>>> consumption(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @RequestParam(required = false) UUID unit,
            @RequestParam(required = false) UUID ingredient) {
        return ResponseEntity.ok(ApiResponse.of(service.consumption(from, to, unit, ingredient)));
    }

    @GetMapping("/sales")
    public ResponseEntity<ApiResponse<List<SalesReportRow>>> sales(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @RequestParam(required = false) UUID unit,
            @RequestParam(required = false) UUID product) {
        return ResponseEntity.ok(ApiResponse.of(service.sales(from, to, unit, product)));
    }

    @GetMapping("/waste")
    public ResponseEntity<ApiResponse<List<WasteReportRow>>> waste(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @RequestParam(required = false) UUID unit,
            @RequestParam(required = false) UUID ingredient) {
        return ResponseEntity.ok(ApiResponse.of(service.waste(from, to, unit, ingredient)));
    }

    @GetMapping("/stock-status")
    public ResponseEntity<ApiResponse<List<StockStatusRow>>> stockStatus(
            @RequestParam(required = false) UUID unit) {
        return ResponseEntity.ok(ApiResponse.of(service.stockStatus(unit)));
    }
}
