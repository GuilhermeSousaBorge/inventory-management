package br.com.easy_inventory.management.stock.controller;

import br.com.easy_inventory.management.shared.dto.ApiResponse;
import br.com.easy_inventory.management.shared.dto.PageResponse;
import br.com.easy_inventory.management.stock.dto.StockResponse;
import br.com.easy_inventory.management.stock.service.StockService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/stock")
public class StockController {
    private final StockService stockService;

    public StockController(StockService stockService) {
        this.stockService = stockService;
    }

    @GetMapping
    public ResponseEntity<PageResponse<StockResponse>> list(
            @RequestParam(required = false) UUID unit,
            @RequestParam(required = false) UUID ingredient,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<StockResponse> result = stockService.findAll(unit, ingredient, PageRequest.of(page, size));
        return ResponseEntity.ok(PageResponse.of(result.getContent(), page, size, result.getTotalElements()));
    }

    @GetMapping("/low")
    public ResponseEntity<PageResponse<StockResponse>> low(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<StockResponse> result = stockService.findBelowMinimum(PageRequest.of(page, size));
        return ResponseEntity.ok(PageResponse.of(result.getContent(), page, size, result.getTotalElements()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<StockResponse>> findById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.of(stockService.findById(id)));
    }
}
