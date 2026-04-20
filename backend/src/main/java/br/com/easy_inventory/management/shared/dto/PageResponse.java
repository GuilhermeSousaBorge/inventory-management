package br.com.easy_inventory.management.shared.dto;

import java.util.List;

public record PageResponse<T>(List<T> data, int page, int size, long total) {
    public static <T> PageResponse<T> of(List<T> data, int page, int size, long total) {
        return new PageResponse<>(data, page, size, total);
    }
}
