# 4 Kings Store na Vercel

Este diretório é o projeto independente para deploy. Ele mantém a loja em HTML estático e adiciona funções serverless para autenticação do administrador, catálogo compartilhado e upload de fotos no Vercel Blob.

## Configuração

1. No painel da Vercel, crie ou selecione um projeto Blob **público** e conecte-o a este projeto. As imagens e o catálogo podem ser lidos pelos visitantes; o token de escrita permanece apenas no servidor.
2. Configure estas variáveis em **Project Settings → Environment Variables** para Production e Preview:
   - `BLOB_READ_WRITE_TOKEN`: token de leitura e escrita criado pelo Blob da Vercel.
   - `ADMIN_PASSWORD`: senha forte com pelo menos 12 caracteres.
   - `ADMIN_SESSION_SECRET`: segredo aleatório com pelo menos 32 caracteres. Gere localmente com `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"` e não o publique.
3. Faça o deploy deste diretório como **Root Directory** do projeto. A Vercel instala `@vercel/blob` pelo `package.json`; `/api` é publicado como funções Node.js.
4. Abra a loja, clique oito vezes seguidas no logo, entre com `ADMIN_PASSWORD` e gerencie os produtos. O catálogo e fotos salvos ficam disponíveis para todos os visitantes.

O catálogo embutido é usado até o primeiro salvamento administrativo na nuvem. As fotos antigas com caminho `/_blob/...` pertenciam a um ambiente externo e não foram incluídas no HTML; reenvie-as pelo painel.

## API

- `GET /api/products`: retorna o catálogo publicado; não exige login.
- `PUT /api/products`: valida e grava o catálogo no Blob; exige sessão administrativa.
- `POST /api/upload`: recebe uma foto JPEG compactada e retorna a URL pública do Blob; exige sessão administrativa.
- `POST /api/admin/login`, `GET /api/admin/session` e `POST /api/admin/logout`: gerenciam a sessão administrativa.

O conteúdo público do catálogo pode levar até 60 segundos para sair do cache do Blob após uma atualização.

## Dados e segurança

A autenticação administrativa usa cookie assinado, `HttpOnly`, `SameSite=Strict` e expiração de 8 horas. As rotas de escrita exigem essa sessão e a origem do próprio site. O token Blob e as credenciais não são enviados ao navegador.

Visitantes não precisam criar conta nem fazer login. O botão **Comprar agora** abre diretamente o link de afiliado do produto na Shein. A loja não coleta dados de clientes, mantém CRM ou registra histórico de pedidos. A compra e o pagamento são realizados no site externo da Shein, sem confirmação de pedido nesta loja.

Dados de cadastro e compras que tenham sido gravados no `localStorage` por versões anteriores não são mais carregados pela loja nem apagados automaticamente do navegador. A API da Vercel continua sincronizando apenas catálogo e imagens.

## Testes

```powershell
npm test
```
