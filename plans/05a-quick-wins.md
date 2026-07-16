# 05a — Melhorias de esforço BAIXO (quick wins)

Origem: itens do levantamento `05-future-improvements.md`, segregados por esforço.
Cada item é autocontido e executável por um agente em uma sessão curta.
Regras de execução: ver `plans/README.md`.

---

## QW-1. Race condition no limite de 20 anexos por tarefa

- **Onde**: `backend/modules/tasks/attachments.js:106-116`.
- **O quê**: `TaskAttachment.count` seguido de `create` sem lock — dois uploads
  paralelos passam do limite de 20.
- **Como**: revalidar o count imediatamente após o `create` e, se o total ficou
  acima de 20, remover o registro recém-criado + objeto R2 e responder 400
  (compensação), ou usar `sequelize.transaction` com re-count no mesmo bloco.
- **Testes**: teste de integração com dois uploads simulados na fronteira do limite.
- **Prioridade original**: média. **Esforço**: baixo.

## QW-2. Lifecycle rule no bucket R2 para órfãos residuais

- **Onde**: infra/documentação (nenhum código).
- **O quê**: uploads podem órfãos em crash entre upload e persistência do registro.
- **Como**: documentar (README + docs de storage) regra de lifecycle no bucket:
  expirar objetos com prefixo `tmp/` ou aplicar verificação periódica; no mínimo,
  descrever o procedimento manual de reconciliação (listar objetos sem registro).
- **Prioridade original**: média. **Esforço**: baixo.

## QW-3. Verificação automática de drift nas 25 traduções

- **Onde**: `public/locales/*/translation.json`; commit `350ddeb` mostra o sintoma.
- **O quê**: locales divergem do `en` sem ninguém perceber.
- **Como**: script `scripts/check-i18n.js` que compara recursivamente as chaves de
  cada locale com `en/translation.json` e sai com código ≠ 0 listando faltantes;
  adicionar ao CI (`.github/workflows`) e ao `npm run lint` ou script próprio.
- **Testes**: rodar o script com locale mutilado de propósito.
- **Prioridade original**: média. **Esforço**: baixo.

## QW-4. Warning explícito de segredos com fallback no boot em produção

- **Onde**: `backend/config/config.js:93-95` (session secret aleatório por processo)
  e cadeia `ENCRYPTION_KEY` → `SECRET_KEY` → session secret.
- **O quê**: sem `TUDUDI_SESSION_SECRET`, sessões caem a cada restart e multi-réplica
  quebra; mudança de env torna credenciais CalDAV indecifráveis.
- **Como**: no boot com `NODE_ENV=production`, logar `console.warn` claro quando
  session secret for gerado aleatoriamente e quando `ENCRYPTION_KEY` não estiver
  definida explicitamente.
- **Testes**: unit no config com env limpo vs preenchido.
- **Prioridade original**: média. **Esforço**: baixo.

## QW-5. Remover artefato de dev servido em produção

- **Onde**: `public/generate-favicon.html`.
- **O quê**: ferramenta de desenvolvimento empacotada no build/servida como estático.
- **Como**: deletar o arquivo; conferir que nada referencia
  (`grep -r generate-favicon`).
- **Prioridade original**: baixa. **Esforço**: trivial.

---

Itens do levantamento original já resolvidos (não migrados para cá):

- ~~Logging em `r2Service.deleteObject`~~ — feito no commit `b707dce`.
- ~~`docker-compose.yml` não commitado~~ — feito no commit `44c0ba2`.
- ~~Doc de storage~~ — absorvido pelo plano `06-docs-update.md`.
