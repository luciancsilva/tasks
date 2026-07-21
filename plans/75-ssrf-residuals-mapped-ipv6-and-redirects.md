> **Status: EXECUTADO** em 2026-07-21 — **com replanejamento: o item 1 abaixo
> estava tecnicamente errado.** Ver "Correção do diagnóstico" no fim do arquivo.
> Item 2 implementado (não virou risco aceito). Escolhida a **Opção B** (helper
> único em `backend/shared/net/ssrf.js`), não a Opção A.

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

---

## Correção do diagnóstico (2026-07-21, na execução)

O item 1 acima **não teria corrigido nada**. O fix proposto casa a forma
*dotted* (`::ffff:169.254.169.254`) com regex, mas ela nunca chega ao guard:

```
new URL('http://[::ffff:169.254.169.254]/').hostname  →  '[::ffff:a9fe:a9fe]'
```

O parser WHATWG reescreve o literal para a forma hex canônica. Os **três** sites
tiram o host de `new URL(...)` (`url/service.js` `parsed.hostname`,
`remote-calendar-controller.js:155` `url.hostname`, `users/service.js:172`
`url.hostname`), então o regex dotted seria dead code nos três. O que precisava
ser bloqueado era exatamente a forma que o plano descartou como "edge raro, fora
de escopo v1".

Consequência: o vetor era **mais amplo** do que o plano registrou. Passavam pelo
guard, antes desta execução:

| Entrada | Host visto pelo guard | Antes |
|---|---|---|
| `https://[::ffff:169.254.169.254]/v1` | `::ffff:a9fe:a9fe` | ✗ passava |
| `https://[0:0:0:0:0:ffff:a9fe:a9fe]/` | `::ffff:a9fe:a9fe` | ✗ passava |
| `https://[2002:a9fe:a9fe::1]/` (6to4) | idem | ✗ passava |
| `https://[64:ff9b::a9fe:a9fe]/` (NAT64) | idem | ✗ passava |
| `https://[0000:…:0001]/` (`::1` expandido) | idem | ✗ passava em `url/service` |

Classificar IPv6 por prefixo de string é o erro de fundo — a mesma rede tem
várias grafias legais. O fix compara **bytes**: `expandIPv6()` normaliza
qualquer grafia (dotted, hex, expandida, zone id `%eth0`) para 16 bytes, e os
ranges são testados numericamente. Formas que embutem IPv4 (mapped `::ffff:0:0/96`,
6to4 `2002::/16`, NAT64 `64:ff9b::/96`) delegam ao teste IPv4.

### Opção B em vez de A
A lógica correta tem ~130 linhas; triplicá-la garantia divergência — que já
existia (o CalDAV cobria `0000:…:0001`, o `url/service` não; o `users/service`
inline não tinha nem `198.18/15` nem broadcast). Helper único em
`backend/shared/net/ssrf.js`: `expandIPv6`, `isPrivateIP`, `isPrivateHostname`,
`assertPublicUrl`, `createSsrfSafeFetch`. Os 3 sites importam; `url/service`
re-exporta `assertPublicUrl` para não quebrar quem já o importava.

Endurecimentos que vieram junto: IPv4 `>= 224` (multicast/reservado/broadcast,
antes só o broadcast exato), IPv6 `ff00::/8`, Teredo `2001::/32`, `::/96`
inteiro.

### Item 2 — implementado, não aceito como risco
`openai` v6.45 aceita `fetch` custom (`client.d.ts:98`). `createSsrfSafeFetch()`
faz `redirect: 'manual'` e revalida cada hop com `assertPublicUrl`, máx. 3 hops.
Só é instalado no provider `custom`. `301/302/303` são **recusados** em vez de
seguidos: convertem POST em GET e descartam o body, então um endpoint
OpenAI-compatível que os devolve está mal configurado — melhor falhar visível.

### Testes
`backend/tests/unit/ssrf-guard.test.js` (novo, 46 casos: grafias equivalentes,
ranges v4/v6, embutidos, redirect guard) + 2 casos em
`backend/tests/integration/ai-base-url-ssrf.test.js`. Suíte: **159 / 1929** verde.

### Não feito
`::ffff:0:1.2.3.4` (IPv4-translated, `::ffff:0:0:0/96`) não é tratado como
embutido — cai no ramo genérico e só é bloqueado se o prefixo casar outro range.
Formato deprecado (RFC 2765), não emitido por `dns.lookup` nem pelo parser de URL.
