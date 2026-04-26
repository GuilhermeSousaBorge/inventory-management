package br.com.easy_inventory.management.product.repository;

import br.com.easy_inventory.management.product.entity.Product;
import br.com.easy_inventory.management.product.entity.ProductSize;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

public interface ProductRepository extends JpaRepository <Product, UUID>{

    @Query("select p from Product p where " +
            "(:categoryId is null or p.category.id = :categoryId) and " +
            "(:size is null or p.size = :size) and " +
            "(:active is null or p.active = :active) " +
            "order by p.name, p.size")
    Page<Product> search(@Param("categoryId") UUID categoryId,
                         @Param("size") ProductSize size,
                         @Param("active") Boolean active,
                         Pageable pageable);

}
