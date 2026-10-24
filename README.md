# 4 Kings Store na Vercel

Loja estática em HTML/CSS/JavaScript com funções serverless Node.js. O catálogo compartilhado e as imagens permanentes usam Supabase; a autenticação administrativa continua protegida no backend.

## Configuração do Supabase

1. Crie um projeto Supabase e execute `supabase/schema.sql` no SQL Editor. O esquema cria a tabela `products`, ativa RLS, limita escrita à service role, cria a RPC transacional de substituição do catálogo e configura o bucket público `product-images`.
2. Configure as variáveis abaixo na Vercel para os ambientes Production e Preview. A chave `SUPABASE_SERVICE_ROLE_KEY` é confidencial: mantenha-a somente no backend/Vercel e nunca use prefixo `VITE_` nem a inclua no frontend.
3. Para carregar uma vez os produtos embutidos atualmente no HTML, defina `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no ambiente do terminal local e execute `npm run seed:catalog`. O script não carrega arquivos `.env` automaticamente, só grava se a tabela estiver vazia e não sobrescreve produtos existentes.
4. Instale dependências com `npm install`, execute `npm test` e então publique o projeto manualmente quando estiver pronto.

Se `SUPABASE_STORAGE_BUCKET` for diferente de `product-images`, crie no Supabase Storage um bucket público com esse mesmo nome e limite de JPEG compatível com o upload (2 MB).

Variáveis necessárias:

| Variável | Obrigatória | Uso |
| --- | --- | --- |
| `SUPABASE_URL` | Sim | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | Chave privada usada somente pelas funções serverless |
| `SUPABASE_STORAGE_BUCKET` | Não | Bucket de imagens; padrão `product-images` |
| `ADMIN_PASSWORD` | Sim | Senha do administrador, validada no backend |
| `ADMIN_SESSION_SECRET` | Sim | Segredo aleatório usado para assinar cookies de sessão |

Gere `ADMIN_SESSION_SECRET` localmente, sem compartilhá-lo: `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`. Para trocar a senha, atualize `ADMIN_PASSWORD` nas variáveis da Vercel e publique uma nova versão. Não existe configuração de senha no frontend.

## Loja e administração

- Os visitantes navegam pelo catálogo central e compram diretamente no link do produto na Shein; não há cadastro de cliente nem carrinho.
- O administrador abre o painel com oito cliques consecutivos na logo e continua autenticado por cookie `HttpOnly`, `SameSite=Strict` com validade de oito horas.
- O painel permite cadastrar, editar e excluir produtos, gerir imagens no Supabase Storage e informar tamanhos e disponibilidade.
- As rotas de escrita verificam sessão administrativa e origem da solicitação. A tabela não permite leitura ou escrita direta por `anon`/`authenticated`; a API pública de produtos faz a leitura no servidor.
- A planilha XLSX exporta IDs, nome, descrição, preço, categoria, tamanhos, disponibilidade, URLs das imagens, link da Shein e emoji. Imagens são exportadas como URLs, não são incorporadas no arquivo. A importação valida os campos, aceita arquivos de até 3 MB e rejeita duplicatas por ID, link ou nome/categoria.
- O menu responsivo oferece Início, Categorias e Exibir Produtos.

## Catálogo embutido e imagens antigas

O HTML ainda contém um catálogo de contingência com 17 produtos, usado somente quando a API central está indisponível. Para iniciar um banco vazio, execute o script de seed antes da publicação; ele importa os produtos embutidos apenas quando a tabela está vazia. O catálogo do Supabase, inclusive quando vazio, sempre prevalece sobre o conteúdo de contingência, para que excluir todos os produtos não os faça reaparecer. As imagens antigas referenciadas por caminhos `/_blob/...` não são URLs públicas recuperáveis pelo código atual; reenviá-las pelo painel é necessário para armazená-las permanentemente no Supabase. A API publicada anteriormente retornou indisponibilidade, portanto produtos remotos antigos não puderam ser recuperados automaticamente.

## API

- `GET /api/products`: leitura pública do catálogo persistente.
- `PUT /api/products`: substituição do catálogo; exige sessão administrativa.
- `POST /api/upload`: armazenamento de JPEG no Supabase Storage; exige sessão administrativa.
- `GET /api/products/export`: exportação XLSX; exige sessão administrativa.
- `POST /api/products/import`: importação XLSX validada; exige sessão administrativa.
- `POST /api/admin/login`, `GET /api/admin/session` e `POST /api/admin/logout`: sessão administrativa.

## Testes

```powershell
npm test
```

Não há script de build configurado neste projeto HTML estático. A integração real com Supabase (CRUD, upload e planilhas na Vercel) depende da configuração de um projeto Supabase e das variáveis secretas diretamente na Vercel; nenhum deploy é executado automaticamente.
