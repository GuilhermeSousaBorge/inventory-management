# Prompt — Implementar Stack de Monitoramento

Cole este prompt no Claude (ou no plugin do IntelliJ) dentro do repositório do projeto que quer instrumentar.

---

## Contexto do projeto

Tenho um projeto com as seguintes características:

- **Backend:** Java 21 + Spring Boot 4 (falar qual projeto: Easy Inventory / outro)
- **Infra:** Docker + docker-compose rodando em VPS Ubuntu
- **CI/CD:** GitHub Actions com deploy via SSH

Quero implementar a stack de monitoramento completa abaixo, tudo via docker-compose, sem infraestrutura externa.

---

## Stack de monitoramento a implementar

### 1. Uptime Kuma (porta 3001) — Disponibilidade
- Monitora se a aplicação está online via endpoint `/actuator/health`
- Envia alertas via Telegram quando a aplicação cair
- Ignora falhas momentâneas de rede (alerta só quando realmente cair)

### 2. Prometheus + Grafana (portas 9090 / 3000) — Métricas
- Prometheus coleta métricas da aplicação Spring Boot via `/actuator/prometheus`
- Node Exporter coleta métricas da VPS (CPU, RAM, disco)
- Grafana cria dashboards com CPU, RAM, requests/s, latência, JVM heap

### 3. Grafana Loki + Promtail (porta 3100) — Logs
- Promtail lê os logs JSON dos containers Docker
- Envia para o Loki com labels (app, container, nível)
- Grafana consulta via LogQL — sem ELK stack

---

## O que preciso que você gere

### Passo 1 — Spring Boot

Adicione ao `pom.xml`:
```xml
<!-- Actuator -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>

<!-- Micrometer Prometheus -->
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-registry-prometheus</artifactId>
</dependency>
```

Adicione ao `application.yaml` (ou `application.properties`):
```yaml
management:
  endpoints:
    web:
      exposure:
        include: health, prometheus, info, metrics
  metrics:
    export:
      prometheus:
        enabled: true
```

Configure logs em formato JSON (logstash-logback-encoder) para o Promtail conseguir parsear.

### Passo 2 — Arquivos de configuração

Gere os seguintes arquivos na raiz do projeto:

**`prometheus.yml`** — com scrape de:
- Spring Boot via `app:8080/actuator/prometheus` (ajustar porta conforme o projeto)
- Node Exporter via `node-exporter:9100`
- Intervalo de 15s

**`promtail.yml`** — com:
- Coleta dos logs dos containers Docker em `/var/lib/docker/containers`
- Labels: job=docker, container name, log level

### Passo 3 — docker-compose.yml

Adicione os seguintes serviços ao docker-compose existente (sem remover o serviço da aplicação):

```yaml
  # Disponibilidade
  uptime-kuma:
    image: louislam/uptime-kuma:1
    container_name: uptime-kuma
    ports:
      - "3001:3001"
    volumes:
      - uptime-kuma-data:/app/data
    restart: unless-stopped

  # Métricas
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    restart: unless-stopped

  node-exporter:
    image: prom/node-exporter:latest
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: senha-forte
    volumes:
      - grafana-data:/var/lib/grafana
    depends_on: [prometheus, loki]
    restart: unless-stopped

  # Logs
  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"
    volumes:
      - loki-data:/loki
    restart: unless-stopped

  promtail:
    image: grafana/promtail:latest
    volumes:
      - /var/log:/var/log
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - ./promtail.yml:/etc/promtail/config.yml
    depends_on: [loki]
    restart: unless-stopped

volumes:
  uptime-kuma-data:
  prometheus-data:
  grafana-data:
  loki-data:
```

### Passo 4 — Checklist pós-deploy

Depois de subir com `docker compose up -d`, me mostre:

1. Como acessar cada serviço (URL + porta)
2. Como configurar o primeiro monitor no Uptime Kuma apontando para `/actuator/health`
3. Como adicionar o Prometheus como datasource no Grafana
4. Como adicionar o Loki como datasource no Grafana
5. Qual dashboard do Grafana importar para Spring Boot (ID do dashboard público)

---

## Restrições

- Tudo deve rodar na mesma VPS via docker-compose
- Não usar ELK Stack (muito pesado para VPS)
- Não expor Prometheus e Grafana publicamente sem autenticação
- Manter compatibilidade com o deploy atual via GitHub Actions (o compose já existe)
- O serviço da aplicação no compose usa `image: ghcr.io/SEU_USER/SEU_REPO:latest`

---

## Projeto de referência

- Repositório: [informar o repo]
- Porta da aplicação: [informar a porta]
- Branch de deploy: `main`
- VPS: Ubuntu, acesso via SSH com chave
