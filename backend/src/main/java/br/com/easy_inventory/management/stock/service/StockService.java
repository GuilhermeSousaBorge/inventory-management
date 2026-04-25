package br.com.easy_inventory.management.stock.service;

import br.com.easy_inventory.management.shared.exception.ResourceNotFoundException;
import br.com.easy_inventory.management.stock.dto.StockResponse;
import br.com.easy_inventory.management.stock.entity.Stock;
import br.com.easy_inventory.management.stock.repository.StockRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class StockService {

    private final StockRepository stockRepository;

    public StockService(StockRepository stockRepository) {
        this.stockRepository = stockRepository;
    }

    public Page<StockResponse> findAll(UUID unitId, UUID ingredientId, Pageable pageable) {
        Page<Stock> page;
        if (unitId != null && ingredientId != null) {
            page = stockRepository.findByIngredientIdAndUnitId(ingredientId, unitId, pageable);
        } else if (unitId != null) {
            page = stockRepository.findByUnitId(unitId, pageable);
        } else if (ingredientId != null) {
            page = stockRepository.findByIngredientId(ingredientId, pageable);
        } else {
            page = stockRepository.findAll(pageable);
        }
        return page.map(StockResponse::from);
    }

    public StockResponse findById(UUID id) {
        return StockResponse.from(getOrThrow(id));
    }

    public Page<StockResponse> findBelowMinimum(Pageable pageable) {
        return stockRepository.findBelowMinimum(pageable).map(StockResponse::from);
    }

    private Stock getOrThrow(UUID id) {
        return stockRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Stock not found: " + id));
    }
}
