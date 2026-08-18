# E-commerce de roupas masculinas — Design v1

**Data:** 2026-08-18
**Status:** Aprovado, aguardando plano de implementação

## Contexto e objetivo

Construir um e-commerce funcional do zero para uma loja de roupas masculinas, com loja pública e painel administrativo para o dono gerenciar produtos, estoque e pedidos. Envios são feitos via Melhor Envio; pagamentos via Mercado Pago.

Referência de estrutura e funcionalidades: [malibusurf.com.br](https://malibusurf.com.br/) — loja de streetwear/surfwear com categorização por tipo de peça, cálculo de frete por CEP, desconto no Pix, parcelamento em cartão e frete grátis acima de valor mínimo.

## Escopo da v1

**Incluído:**
- Catálogo de produtos com variações (tamanho/cor) e filtros
- Carrinho e checkout completo (frete via Melhor Envio, pagamento via Mercado Pago)
- Conta do cliente (login opcional — checkout de convidado permitido)
- Painel admin: produtos, estoque por variação, gestão de pedidos, geração de etiqueta de envio

**Fora do escopo (fase 2):**
- Cupons de desconto e promoções
- Múltiplos usuários/papéis no admin (por enquanto só o dono usa)
- Wishlist, avaliações de produto, carrinho abandonado, marketing por email

## Abordagem técnica

Monólito full-stack em **Next.js**, único projeto cobrindo loja e admin (admin nas rotas `/admin`, protegidas por middleware). Evita duplicar autenticação/modelos de dados entre múltiplos serviços — abordagem mais simples e suficiente para o porte da loja, sem impedir evolução futura (ex: app mobile consumindo a mesma base via API).

- **Banco de dados:** PostgreSQL via Prisma (ORM)
- **Hospedagem:** Vercel (app) + Render (Postgres) + Vercel Blob (armazenamento das imagens dos produtos)
- **Autenticação:** Auth.js (NextAuth), email/senha. Campo `isAdmin` no `User` controla acesso ao `/admin` — sem sistema de papéis, já que só o dono usa o painel nesta fase
- **Pagamento:** Mercado Pago (cartão parcelado, Pix com desconto, boleto)
- **Envio:** Melhor Envio (cotação de frete por CEP no carrinho, geração de etiqueta no admin)

Alternativas consideradas e descartadas: backend/frontend separados (complexidade desnecessária nesse estágio) e frameworks alternativos como Remix/SvelteKit (sem vantagem real sobre Next.js para este caso).

## Estrutura de páginas

**Loja (pública):**
- `/` — Home: banners, produtos em destaque, categorias
- `/produtos` — Catálogo com filtros (categoria, tamanho, cor, marca, preço) e ordenação
- `/produtos/[categoria]` — Listagem por categoria
- `/produto/[slug]` — Detalhe: galeria, seletor de tamanho/cor, estoque disponível, preço com desconto Pix, parcelamento
- `/carrinho` — Itens, quantidade, frete por CEP, aviso de frete grátis
- `/checkout` — Dados de entrega, escolha de frete, pagamento
- `/pedido/[id]/confirmacao` — Confirmação pós-compra
- `/conta` — Login/cadastro, dados pessoais, endereços salvos
- `/conta/pedidos` — Histórico de pedidos e status/rastreio

**Admin (protegido, `/admin`):**
- `/admin` — Dashboard: pedidos recentes, alertas de estoque baixo
- `/admin/produtos` — Lista, criar/editar
- `/admin/produtos/[id]` — Editar produto: dados, imagens, variações (tamanho/cor) e estoque
- `/admin/pedidos` — Lista, filtro por status
- `/admin/pedidos/[id]` — Detalhe, mudar status, gerar etiqueta de envio

## Modelo de dados

**Catálogo**
- `Category` — nome, slug, categoria pai (permite subcategorias)
- `Product` — nome, slug, descrição, categoria, marca, imagens, ativo/inativo
- `ProductVariation` — produto, tamanho, cor, SKU, preço (override opcional), quantidade em estoque, imagem específica (opcional)

**Cliente**
- `User` — nome, email, senha (hash), telefone, `isAdmin`. Opcional — pode não existir em pedidos de convidado
- `Address` — endereço de entrega, vinculado a um `User` quando logado ou preenchido direto no pedido quando convidado

**Pedido**
- `Order` — `user_id` opcional (convidado ou logado), email de contato, endereço de entrega, status (aguardando pagamento / pago / enviado / entregue / cancelado / pago com pendência de estoque), valor de frete, valor total, forma de pagamento
- `OrderItem` — pedido, variação do produto, quantidade, preço no momento da compra (não muda retroativamente se o produto mudar de preço depois)
- `Shipment` — pedido, dados do Melhor Envio (código de rastreio, etiqueta gerada, transportadora, status)

**Carrinho:** vive no client-side (local storage) até o checkout — não precisa de tabela própria; só vira `Order` na finalização da compra.

**Configurações da loja**
- `StoreSettings` — registro único (singleton) editável pelo admin: valor mínimo para frete grátis, percentual de desconto no Pix, número máximo de parcelas. Evita hardcode dessas regras no código.

## Fluxo de compra e integrações

**Carrinho:**
1. Cliente informa CEP → cotação de frete via API do Melhor Envio (PAC, Sedex, etc, com prazo e preço) → aplica regra de frete grátis acima de valor configurável pelo admin

**Checkout:**
2. Cliente escolhe frete, preenche dados de entrega (ou usa endereço salvo, se logado)
3. Escolhe pagamento (cartão parcelado, Pix com desconto ou boleto) via Mercado Pago
4. Cria `Order` com status "aguardando pagamento" — estoque ainda intocado
5. Mercado Pago notifica via webhook a confirmação do pagamento
6. Servidor recebe o webhook, marca pedido como "pago", e só então decrementa o estoque das variações compradas — em transação atômica, para evitar overselling quando dois clientes disputam a última unidade
7. Se algum item ficou sem estoque nesse intervalo raro, pedido fica marcado "pago — pendência de estoque" para o admin resolver manualmente

**Despacho (admin):**
8. Admin abre o pedido pago, gera etiqueta via API do Melhor Envio → código de rastreio salvo no pedido
9. Admin marca como "enviado" → cliente acompanha em `/conta/pedidos`

## Tratamento de erros

- Cotação de frete indisponível → mensagem amigável, permite retry, não trava o carrinho
- Pagamento recusado → mostra motivo, mantém carrinho intacto, permite tentar outro método
- Webhook do Mercado Pago duplicado → checagem de idempotência antes de reprocessar/decrementar estoque de novo

## Testes

Foco nos pontos onde um bug custa dinheiro ou gera reclamação:
- Decremento de estoque sob concorrência (duas compras simultâneas da última unidade)
- Cálculo de frete/preço no checkout
- Processamento do webhook de pagamento (idempotência)

Restante do site é validado manualmente durante o desenvolvimento — sem meta de cobertura total.

## Infraestrutura e segredos

- Deploy do app na Vercel; banco Postgres no Render; storage de imagens no Vercel Blob
- Segredos (chaves Mercado Pago, token Melhor Envio, credenciais do banco, secret do NextAuth) via variáveis de ambiente, nunca versionados no código
