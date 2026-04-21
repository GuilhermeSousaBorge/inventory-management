package br.com.easy_inventory.management.shared.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Registers a Jackson 2 ObjectMapper bean.
 * Spring Boot 4 uses Jackson 3 (tools.jackson) for its MVC layer, but Jackson 2
 * remains on the classpath via JJWT. This bean is required for components and
 * tests that depend on com.fasterxml.jackson.databind.ObjectMapper.
 */
@Configuration
public class Jackson2Config {

    @Bean
    public ObjectMapper objectMapper() {
        return new ObjectMapper()
                .registerModule(new JavaTimeModule())
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    }
}
