package br.com.easy_inventory.management.supplier.service;

import br.com.easy_inventory.management.shared.exception.ResourceNotFoundException;
import br.com.easy_inventory.management.supplier.dto.*;
import br.com.easy_inventory.management.supplier.entity.Supplier;
import br.com.easy_inventory.management.supplier.repository.SupplierRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class SupplierService {

    private final SupplierRepository supplierRepository;

    public SupplierService(SupplierRepository supplierRepository) {
        this.supplierRepository = supplierRepository;
    }

    public Page<SupplierResponse> findAll(Pageable pageable) {
        return supplierRepository.findAll(pageable).map(SupplierResponse::from);
    }

    public SupplierResponse findById(UUID id) {
        return SupplierResponse.from(getOrThrow(id));
    }

    @Transactional
    public SupplierResponse create(CreateSupplierRequest request) {
        Supplier supplier = new Supplier();
        supplier.setName(request.name());
        supplier.setContactName(request.contactName());
        supplier.setPhone(request.phone());
        supplier.setEmail(request.email());
        supplier.setAddress(request.address());
        return SupplierResponse.from(supplierRepository.save(supplier));
    }

    @Transactional
    public SupplierResponse update(UUID id, UpdateSupplierRequest request) {
        Supplier supplier = getOrThrow(id);
        supplier.setName(request.name());
        supplier.setContactName(request.contactName());
        supplier.setPhone(request.phone());
        supplier.setEmail(request.email());
        supplier.setAddress(request.address());
        supplier.setActive(request.active());
        return SupplierResponse.from(supplierRepository.save(supplier));
    }

    @Transactional
    public void deactivate(UUID id) {
        Supplier supplier = getOrThrow(id);
        supplier.setActive(false);
        supplierRepository.save(supplier);
    }

    private Supplier getOrThrow(UUID id) {
        return supplierRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Supplier not found: " + id));
    }
}
