# 39 — SSRF em `/api/url/title` e extração de URL

> **Status: EXECUTADO** em 2026-07-20 — assertPublicUrl guard com DNS resolution
> adicionado a fetchUrlMetadata (initial), fetchMetadataViaFetch (redirect:manual),
> e makeRequest (redirect callback). Todas as 3 vias de fetch bloqueiam IPs privados.
> **Esforço:** Médio · **Natureza:** julgamento · **Modelo:** médio (sonnet)
> **Branch:** main · **Depende de:** -

## Diagnóstico

`GET /url/title` (`backend/modules/url/routes.js:7`) e `POST /url/extract-from-text`
(`routes.js:8`) só exigem auth (montadas após `requireAuth` em `app.js:384`). O
controller (`backend/modules/url/controller.js:7-22`) repassa a URL crua para
`urlService.getTitle` (`backend/modules/url/service.js:448`), que chama
`fetchUrlMetadata`.

Em `fetchUrlMetadata` → `makeRequest` (`service.js:245-296`):
- `service.js:253-267`: monta a request a partir de `new URL(currentUrl)` sem
  validar o host. Aceita `http:` e `https:` por `urlObj.protocol` (L254), mas nada
  além disso.
- `service.js:279-289`: em resposta 301/302/303/307/308, **segue o `Location`**
  chamando `makeRequest(redirectUrl, ...)` — o redirect também não é validado, então
  um host público pode redirecionar para `169.254.169.254` ou `127.0.0.1`.
- A normalização em `service.js:393-403` só prefixa `https://` e faz `new URL`; não
  há checagem de IP privado/loopback/link-local nem de esquema.

Não há bloqueio de: `localhost`, `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`,
`192.168.0.0/16`, `169.254.0.0/16` (metadata de AWS/GCP/Azure), `::1`, `fc00::/7`,
nem de esquemas não-http. Qualquer usuário autenticado consegue:
- Fazer o servidor requisitar serviços internos (portas de admin, bancos, healthchecks).
- Ler o endpoint de metadata da instância de cloud (credenciais IAM em muitos setups).
- Inferir topologia interna por diferença de timing/erro.

## Implementação Proposta

1. Criar um guard `assertPublicUrl(urlString)` (novo helper em `url/service.js` ou
   `backend/utils/`) que:
   - rejeita esquema ≠ `http:`/`https:`;
   - resolve o hostname (`dns.promises.lookup`, `{ all: true }`) e rejeita se
     **qualquer** IP resolvido cair em loopback/privado/link-local/ULA/multicast/
     unspecified (usar `net.isIP` + checagem de faixas, ou dependência já presente;
     não adicionar pacote novo sem necessidade).
2. Chamar o guard **antes do fetch inicial** (em `fetchUrlMetadata`/`getTitle`) e
   **a cada redirect** dentro de `makeRequest` (`service.js:283-289`) sobre o
   `redirectUrl` resolvido — o ponto crítico é revalidar o alvo do redirect.
3. Em caso de bloqueio, retornar o mesmo shape de "sem metadata" (não vazar se o host
   é interno vs. inexistente): `getTitle` já degrada para `{ error }`/sem título.
4. Manter o comportamento atual para hosts públicos legítimos (YouTube etc. em
   `service.js:405-413` continua antes do fetch, ok).

## Critério de Pronto

- Teste de integração: `GET /url/title?url=http://127.0.0.1:3002/api/health` (e
  variantes `localhost`, `169.254.169.254`, `10.0.0.1`) retorna sem título / bloqueado,
  **sem** ter feito a request interna.
- Teste: host público que redireciona para `127.0.0.1` é bloqueado no passo do redirect.
- Host público legítimo continua retornando título.
- Suíte backend verde; lint dos arquivos tocados.
