# CI/CD — Easy Inventory

Dois workflows do GitHub Actions:

| Workflow | Arquivo | Gatilho | O que faz |
|----------|---------|---------|-----------|
| **CI** | [.github/workflows/ci.yml](../.github/workflows/ci.yml) | push/PR na `main` | Roda os testes (`@SpringBootTest` contra um Postgres de serviço) e, só no push da `main`, builda e publica a imagem no ghcr.io |
| **Deploy** | [.github/workflows/deploy.yml](../.github/workflows/deploy.yml) | manual (`workflow_dispatch`) | Copia os arquivos de compose para a VPS via SSH, faz `docker compose pull` + `up -d` |

> O Deploy é **manual** de propósito: a VPS ainda não existe. Acione pela aba
> **Actions → Deploy → Run workflow** quando o servidor estiver pronto.

---

## CI — detalhes

- Sobe um container `postgres:16` (db `pizzaria`, `admin/admin`) na porta 5432, igual ao
  `application.yaml`, para os testes de contexto completo rodarem com Flyway + `ddl-auto: validate`.
- Imagem publicada (privada por padrão): `ghcr.io/guilhermesousaborge/inventory-management`
  - tags: `latest` e `<sha do commit>`.
- Usa o `GITHUB_TOKEN` automático para publicar — **nenhum secret extra** necessário para o CI.

Depois do primeiro push na `main`, confira em **Packages** do repositório. Se quiser que a
VPS puxe sem login, torne o package **público** (Package settings → Change visibility).

---

## Deploy — secrets necessários

Configure em **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Descrição |
|--------|-----------|
| `SSH_HOST` | IP ou domínio da VPS |
| `SSH_USER` | usuário SSH (ex.: `ubuntu`) |
| `SSH_KEY` | **chave privada** SSH (conteúdo do arquivo, formato PEM/OpenSSH) |
| `SSH_PORT` | porta SSH (ex.: `22`) |
| `GHCR_TOKEN` | PAT com escopo `read:packages` (só necessário se a imagem ficar **privada**) |
| `GRAFANA_ADMIN_PASSWORD` | senha do admin do Grafana na VPS |

O workflow copia `docker-compose.yml`, `prometheus.yml` e `promtail.yml` para
`~/easy-inventory` na VPS e roda o compose lá. O `src/` não vai para o servidor —
a imagem da app vem pronta do ghcr.

### Pré-requisitos na VPS
- Docker + plugin `docker compose` instalados.
- Usuário SSH no grupo `docker` (ou ajuste para `sudo`).
- Portas liberadas conforme [docs/monitoramento.md](monitoramento.md).

### Deploy automático (opcional)
Para deployar após cada CI verde na `main`, descomente o bloco `workflow_run`
(e o `if`) em [deploy.yml](../.github/workflows/deploy.yml).
