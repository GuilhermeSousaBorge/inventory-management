# Stack de Monitoramento — Easy Inventory

Stack completa de observabilidade rodando via `docker compose`, sem infraestrutura externa.

| Camada          | Ferramenta             | Porta  |
|-----------------|------------------------|--------|
| Disponibilidade | Uptime Kuma            | `3001` |
| Métricas        | Prometheus             | `9090` (apenas localhost) |
| Métricas (host) | Node Exporter          | interno (`9100`) |
| Dashboards      | Grafana                | `3000` |
| Logs            | Grafana Loki           | `3100` (apenas localhost) |
| Coleta de logs  | Promtail               | interno (`9080`) |

Arquivos relevantes:
- [backend/docker-compose.yml](../backend/docker-compose.yml) — todos os serviços
- [backend/prometheus.yml](../backend/prometheus.yml) — scrape configs
- [backend/promtail.yml](../backend/promtail.yml) — coleta de logs Docker
- [backend/Dockerfile](../backend/Dockerfile) — build da imagem da aplicação
- `application.yaml` — endpoints do Actuator + logs JSON nativos (Spring Boot 4)

---

## Subir a stack

```bash
cd backend

# Defina a senha do Grafana (não use a default em produção)
export GRAFANA_ADMIN_PASSWORD='uma-senha-forte'

docker compose up -d
```

> A imagem `app` (`ghcr.io/guilhermesousaborge/inventory-management:latest`) precisa
> existir no registry. Para construir/publicar localmente:
> ```bash
> docker build -t ghcr.io/guilhermesousaborge/inventory-management:latest backend/
> docker push ghcr.io/guilhermesousaborge/inventory-management:latest
> ```

---

## 1. URLs de acesso

| Serviço      | URL                              | Observação |
|--------------|----------------------------------|------------|
| Aplicação    | `http://<vps>:8080`              | Health em `/actuator/health` |
| Uptime Kuma  | `http://<vps>:3001`              | Cria usuário admin no 1º acesso |
| Grafana      | `http://<vps>:3000`              | login `admin` / `$GRAFANA_ADMIN_PASSWORD` |
| Prometheus   | `http://127.0.0.1:9090`          | **só localhost** — use túnel SSH |
| Loki         | `http://127.0.0.1:3100`          | **só localhost** — consultado pelo Grafana |

Túnel SSH para acessar Prometheus do seu computador:
```bash
ssh -L 9090:127.0.0.1:9090 usuario@<vps>
# depois abra http://localhost:9090
```

---

## 2. Primeiro monitor no Uptime Kuma

1. Acesse `http://<vps>:3001` e crie o usuário administrador.
2. **Add New Monitor**:
   - **Monitor Type:** `HTTP(s)`
   - **Friendly Name:** `Easy Inventory — Health`
   - **URL:** `http://app:8080/actuator/health`
     (na mesma rede do compose; se o Uptime Kuma estivesse fora, use `http://<vps>:8080/actuator/health`)
   - **Heartbeat Interval:** `60` segundos
   - **Retries:** `3` → só dispara o alerta após 3 falhas seguidas, ignorando quedas momentâneas de rede.
   - **Upside Down Mode:** desligado.
3. **Accepted Status Codes:** `200-299`.
4. Salve.

### Alerta via Telegram
1. No Telegram, fale com **@BotFather** → `/newbot` → copie o **token**.
2. Pegue seu **chat id** (fale com **@userinfobot** ou use a API `getUpdates`).
3. No Uptime Kuma: **Settings → Notifications → Add** → tipo **Telegram** → cole token + chat id → **Test** → **Save**.
4. No monitor criado, marque a notificação do Telegram.

---

## 3. Prometheus como datasource no Grafana

1. Grafana → **Connections → Data sources → Add data source → Prometheus**.
2. **Prometheus server URL:** `http://prometheus:9090` (nome do serviço na rede do compose).
3. **Save & test** → deve mostrar “Successfully queried”.

## 4. Loki como datasource no Grafana

1. Grafana → **Connections → Data sources → Add data source → Loki**.
2. **URL:** `http://loki:3100`.
3. **Save & test**.
4. Explore os logs em **Explore** com LogQL, ex.:
   ```logql
   {job="docker"} | json | level="ERROR"
   ```

---

## 5. Dashboards para importar no Grafana

Grafana → **Dashboards → New → Import** → cole o ID → selecione o datasource.

| Finalidade                         | Dashboard ID | Datasource |
|------------------------------------|--------------|------------|
| Spring Boot (Micrometer/Actuator)  | **19004**    | Prometheus |
| JVM (Micrometer)                   | **4701**     | Prometheus |
| Node Exporter Full (CPU/RAM/disco) | **1860**     | Prometheus |

> O dashboard **19004** (“Spring Boot 3.x Statistics”) cobre requests/s, latência,
> heap da JVM, threads e GC, e funciona com as métricas do Spring Boot 4.

---

## Notas de segurança

- Prometheus e Loki estão **bind em `127.0.0.1`** — não ficam expostos publicamente
  (nenhum dos dois tem autenticação nativa). Acesse via Grafana ou túnel SSH.
- Grafana possui login próprio — **troque a senha default** via `GRAFANA_ADMIN_PASSWORD`.
- Em produção, considere colocar Grafana e Uptime Kuma atrás de um reverse proxy
  (Nginx/Traefik) com TLS.

## Limitação conhecida — nomes de container nos logs

O `promtail.yml` extrai o **id** do container a partir do caminho do arquivo de log.
Para ter o **nome** legível do container como label, monte o socket do Docker
(`/var/run/docker.sock`) e troque `static_configs` por `docker_sd_configs`.
