# Plan 75 — SSRF residuais: IPv4-mapped IPv6 + redirect-following

> **Status: PROPOSTO** — residuais de baixa severidade encontrados na review de
> cobertura total dos planos ≥ #40 (2026-07-20). Não bloqueiam; hardening.
> **Esforço:** P (item 1 mecânico) + M (item 2 julgamento) · **Natureza:** item 1
> mecânico, item 2 julgamento · **Modelo:** médio (item 2 prefere forte) ·
> **Branch:** `main` direto (correção de segurança) · **Depende de:** 70, 71 (DONE).

## Contexto

A review dos planos 70/71 fechou o SSRF principal (CalDAV resolve DNS; `ai_base_url`
passou a validar no request-time via `assertPublicUrl`). Sobraram dois gaps de
baixa severidade, ambos documentados no handoff da sessão.

O guard central é `isPrivateIP(ip)`, **duplicado em 3 arquivos** (o próprio smell
de fundo — ver Opção B):
- `backend/modules/url/service.js:14` (bloco IPv6 em `:32`)
- `backend/modules/caldav/api/remote-calendar-controller.js:15` (IPv6 em `:44`)
- `backend/modules/users/service.js:186-210` (check IPv4/IPv6 **inline**, sem função)

## Item 1 — IPv4-mapped IPv6 tratado como público (mecânico)

### Problema
`net.isIP('::ffff:169.254.169.254')` retorna `6` (IPv6). Nas 3 cópias, o ramo
`net.isIPv6` só testa `::1`/`::`/`fc`/`fd`/`fe80` — a forma mapeada
`::ffff:x.x.x.x` não casa nenhum → `isPrivateIP` retorna `false` = **tratado como
público**. Um literal `::ffff:169.254.169.254` (metadata) ou `::ffff:10.0.0.1`
passa. Reachable só via **input literal** (CalDAV URL, `ai_base_url`); `dns.lookup`
por padrão não devolve forma mapeada, mas o literal do usuário chega direto.

### Fix (Opção A — recomendada: one-liner por cópia)
No **início** do ramo IPv6 de cada `isPrivateIP`, antes dos checks existentes,
extrair o IPv4 embutido e re-testar:

```js
// IPv4-mapped IPv6 (ex.: ::ffff:169.254.169.254) — validar o IPv4 embutido
const mapped = normalized.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
if (mapped) return isPrivateIP(mapped[1]);
```

- `url/service.js`: a var é `n` (`:33` faz `const n = ip.toLowerCase()`). Use `n`
  em vez de `normalized`. Inserir logo após `if (net.isIPv6(ip)) {`.
- `caldav/.../remote-calendar-controller.js`: a var é `normalized` (`:45`). Inserir
  após `if (net.isIPv6(ip)) {`.
- `users/service.js`: **não há função** `isPrivateIP` — o check é inline no ramo
  `else if (net.isIPv6(host))` (`:200`). Aqui não dá pra recursar; extraia o IPv4
  e aplique o mesmo teste de IPv4 privado. Trocar o corpo do `else if` por:

```js
} else if (net.isIPv6(host)) {
    const mapped = host.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
    const v4 = mapped ? mapped[1] : null;
    if (v4 && net.isIPv4(v4)) {
        const p = v4.split('.').map(Number);
        const [a, b] = p;
        if (
            a === 127 || a === 10 || a === 0 ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168) ||
            (a === 169 && b === 254) ||
            (a === 100 && b >= 64 && b <= 127)
        ) {
            throw new Error();
        }
    }
    if (
        host === '::1' || host === '::' ||
        host.startsWith('fc') || host.startsWith('fd') ||
        host.startsWith('fe80')
    ) {
        throw new Error();
    }
}
```

> Edge conhecido (fora de escopo v1): forma mapeada em hex (`::ffff:a9fe:a9fe`).
> Rara; `dns.lookup` não a produz. Anotar em comentário, não tratar agora.

### Fix (Opção B — extrair helper único, mais invasivo)
Mover `isPrivateIP` + `assertPublicUrl`/`resolveAndValidateHostname` para
`backend/shared/net/ssrf.js`, e fazer os 3 sites importarem. **Blast radius alto**
(3 arquivos de segurança testados separadamente). Só fazer com suíte completa +
testes novos cobrindo cada site. Se optar por B, este item substitui as 3 cópias.
Default: **Opção A** (menor risco).

## Item 2 — redirect público→interno (julgamento)

### Problema
`assertPublicUrl` valida só o **host inicial**. Se o alvo responde `30x` para um
host interno, o fetch segue o redirect sem re-validar. O CalDAV desabilita
redirects explicitamente (`remote-calendar-controller.js`, comentário em `:480`);
o path de IA (OpenAI SDK v6, `getOpenAIClient`) **não**.

### Investigação (fazer antes de decidir)
1. `openai` v6 aceita `new OpenAI({ fetch })`. Verificar se dá pra passar um
   `fetch` custom que use `redirect: 'manual'` e valide cada hop com
   `assertPublicUrl` antes de seguir. Ref: `node_modules/openai` client options.
2. Se viável e limpo → implementar wrapper e injetar no `getOpenAIClient` para
   provider `custom`. Reusar `assertPublicUrl` por hop.
3. Se inviável sem custom dispatcher/undici agent → **documentar como risco
   aceito**: já é autenticado, HTTPS-only, path fixo `/chat/completions`, key do
   próprio user. Registrar a decisão no banner deste plano e encerrar o item.

## Testes
- Item 1: adicionar casos em `backend/tests/integration/ai-base-url-ssrf.test.js`
  (já existe) — `ai_base_url: https://[::ffff:169.254.169.254]/v1` deve rejeitar.
  Para o CalDAV, mirror em um teste de `validateCalDAVUrl` se houver; senão unit do
  `isPrivateIP` exportado (não é exportado hoje — testar via o path público).
- Item 2 (se implementado): mock de fetch retornando `30x` para host interno →
  rejeitado. Se documentado como aceito, sem teste.

## Critério de pronto
- [ ] `::ffff:<ip-privado>` rejeitado nas 3 superfícies (CalDAV URL, `ai_base_url`
      save-time, `assertPublicUrl`).
- [ ] Item 2 implementado OU decisão de risco aceito registrada no banner.
- [ ] `cd backend && npx eslint --fix` nos arquivos tocados.
- [ ] `npm run backend:test` verde.

## Commit
`fix(security): reject IPv4-mapped IPv6 private addresses (Plan 75)` — "Implements
plans/75". Item 2 em commit próprio se implementado. Sem push sem autorização.
```
