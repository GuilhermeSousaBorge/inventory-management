package br.com.easy_inventory.management.shared.security;

import br.com.easy_inventory.management.user.entity.User;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.UUID;

public class AuthenticatedUser {


    public AuthenticatedUser() {}

    public static User current(){
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        if(auth == null || !(auth.getPrincipal() instanceof User user)){
            throw new IllegalStateException("Contexto não possui um usuário autenticado");
        }

        return user;
    }

    public static UUID currentId(){
        return current().getId();
    }
}
