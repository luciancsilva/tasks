# 10a — `r2Service`: subir arquivo do disco e listar objetos

> **Status: EXECUTADO** em 2026-07-17 — `putObjectFromFile` e `listObjects` adicionados ao `r2Service`, com paginação completa. Testes unitários cobrindo todos os casos do plano incluindo paginação multi-página.

Pré-requisito de leitura: `plans/README.md` e `backend/services/r2Service.js`
inteiro (é curto).

## Contexto

O `10b-db-snapshot-service.md` precisa subir o arquivo do banco para o R2 e
listar os objetos existentes para aplicar retenção. Hoje o `r2Service` **não sabe
fazer nenhuma das duas**:

- importa só `S3Client`, `GetObjectCommand`, `DeleteObjectCommand` e
  `HeadObjectCommand` (`backend/services/r2Service.js:16-21`);
- expõe `getClient`, `getBucket`, `getUploadStorage`, `deleteObject`,
  `getObjectStream`, `objectExists`;
- `getUploadStorage` é engine **multer-s3** — serve para upload vindo de
  requisição HTTP, não para um arquivo que já está no disco.

Este plano só adiciona as duas funções e seus testes. Nenhum consumidor novo.

## Itens

### 1. `putObjectFromFile(key, filePath, contentType)`

- `PutObjectCommand` (importar de `@aws-sdk/client-s3`).
- Body: `fs.createReadStream(filePath)`. **Passar `ContentLength`** obtido de
  `fs.stat(filePath)` — sem isso o SDK precisa bufferizar o stream inteiro em
  memória, e o arquivo aqui é o banco de dados.
- `ContentType` opcional, com default `application/octet-stream`.
- Seguir o estilo do módulo: cliente via `getClient()`, bucket via `getBucket()`,
  erro logado com `logError` (ver `deleteObject`, linha 120, como molde de
  tratamento de erro e assinatura).
- Key sem barra inicial — convenção documentada no header do arquivo.

### 2. `listObjects(prefix)`

- `ListObjectsV2Command` (importar de `@aws-sdk/client-s3`).
- **Tratar paginação**: a API retorna no máximo 1000 chaves por página; enquanto
  `IsTruncated` for verdadeiro, repetir passando `ContinuationToken` com o
  `NextContinuationToken` da resposta. Sem isso a retenção do `10b` silenciosamente
  ignora objetos além do milésimo.
- Retornar a lista de objetos (`Key` e `LastModified` bastam para o `10b`).
- Prefixo vazio/ausente = listar tudo do bucket; decidir e documentar no JSDoc.

### 3. Export

Acrescentar as duas ao `module.exports` (linha ~175), mantendo a ordem/estilo.

## Testes

Regra 4 do `/plans`. Mock do S3 com `aws-sdk-client-mock` — padrão já usado em
`backend/tests/integration/task-attachments.test.js`. Há também
`backend/tests/unit/` para testes de serviço isolado; escolher conforme o padrão
vigente e não inventar estrutura nova.

- `putObjectFromFile` monta `PutObjectCommand` com Bucket, Key e ContentLength
  corretos (criar um arquivo temporário pequeno no teste).
- `putObjectFromFile` propaga/loga erro do S3 conforme o contrato do módulo
  (espelhar o que `deleteObject` faz).
- `listObjects` devolve as chaves de **uma** página.
- `listObjects` percorre **mais de uma** página: primeira resposta com
  `IsTruncated: true` + `NextContinuationToken`, segunda com `IsTruncated: false`;
  o resultado tem as chaves das duas. **Este é o teste que importa** — é o
  comportamento fácil de errar.

## Verificação

- Baseline `npm run backend:test` antes; suíte verde depois, com os testes novos.
- Lint só nos arquivos tocados (lint global tem ruído CRLF pré-existente).
- Nenhum consumidor novo: `git status` mostra só `r2Service.js` e o arquivo de
  teste.
- Commit: `feat(storage): add file upload and object listing to r2Service`,
  corpo citando `plans/10a`.
