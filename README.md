# Urbano Store API (NestJS + Supabase)

API em NestJS para gerenciar products, sales e sale_items usando Supabase.

## Setup

1. Node.js 18+
2. Instale dependências:
```bash
npm install
```
3. Crie `.env` com:
```bash
PORT=3000
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
# ou SUPABASE_ANON_KEY
```
4. Rodar em dev:
```bash
npm run start:dev
```

## Endpoints

- `POST /products`
- `GET /products?limit=20&cursor=...&orderBy=created_at|id&order=asc|desc`
- `GET /products/:id`
- `PATCH /products/:id`
- `DELETE /products/:id`

- `POST /sales` (com items)
- `GET /sales?limit=20&cursor=...&month=9&year=2025`
- `GET /sales/:id`
- `PATCH /sales/:id`
- `DELETE /sales/:id`

- `POST /sale-items`
- `GET /sale-items?limit=20&cursor=...&sale_id=...`
- `GET /sale-items/:id`
- `PATCH /sale-items/:id`
- `DELETE /sale-items/:id`

## Cursor Pagination

- Query params: `limit`, `cursor` (base64), `orderBy` (id|created_at), `order` (asc|desc)
- Response padrão:
```json
{
  "data": [ /* rows */ ],
  "nextCursor": "base64string or null"
}
```

### Exemplo: Listar products
Request:
```http
GET /products?limit=2&orderBy=created_at&order=desc
```
Response:
```json
{
  "data": [
    { "id": "...", "name": "A", "created_at": "2025-10-01T10:00:00Z" },
    { "id": "...", "name": "B", "created_at": "2025-09-30T10:00:00Z" }
  ],
  "nextCursor": "MjAyNS0wOS0zMFQxMDowMDowMFo="
}
```
Próxima página:
```http
GET /products?limit=2&orderBy=created_at&order=desc&cursor=MjAyNS0wOS0zMFQxMDowMDowMFo=
```

### Exemplo: Filtro por mês/ano em sales
Request:
```http
GET /sales?year=2025&month=9&limit=10
```

## Guia de Testes (passo a passo)

Base URL local: `http://localhost:3000`

1) Criar um produto
```bash
curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Camiseta",
    "description": "Algodão",
    "price_sale": 59.9,
    "cost": 30,
    "quantity": 100
  }'
```

2) Listar produtos (pagina 1)
```bash
curl "http://localhost:3000/products?limit=2&orderBy=created_at&order=desc"
```
- Guarde o `nextCursor` do retorno.

3) Listar produtos (pagina 2)
```bash
curl "http://localhost:3000/products?limit=2&orderBy=created_at&order=desc&cursor=<NEXT_CURSOR_AQUI>"
```

4) Buscar um produto por ID
```bash
curl http://localhost:3000/products/<PRODUCT_ID>
```

5) Atualizar um produto
```bash
curl -X PATCH http://localhost:3000/products/<PRODUCT_ID> \
  -H "Content-Type: application/json" \
  -d '{
    "price_sale": 69.9,
    "quantity": 120
  }'
```

6) Criar uma venda com itens
```bash
curl -X POST http://localhost:3000/sales \
  -H "Content-Type: application/json" \
  -d '{
    "total_price": 129.8,
    "payment_method": "pix",
    "items": [
      { "product_id": "<PRODUCT_ID>", "quantity": 2, "price_sale": 59.9 }
    ]
  }'
```

7) Listar vendas com filtro por mês/ano
```bash
curl "http://localhost:3000/sales?year=2025&month=9&limit=10"
```

8) Paginar vendas por `created_at` (com cursor)
```bash
curl "http://localhost:3000/sales?limit=5&orderBy=created_at&order=desc"
# use o nextCursor para a próxima página
```

9) Buscar uma venda por ID (com itens)
```bash
curl http://localhost:3000/sales/<SALE_ID>
```

10) Atualizar dados da venda (ex.: método de pagamento)
```bash
curl -X PATCH http://localhost:3000/sales/<SALE_ID> \
  -H "Content-Type: application/json" \
  -d '{ "payment_method": "credit" }'
```

11) Criar item de venda isoladamente (opcional)
```bash
curl -X POST http://localhost:3000/sale-items \
  -H "Content-Type: application/json" \
  -d '{
    "sale_id": "<SALE_ID>",
    "product_id": "<PRODUCT_ID>",
    "quantity": 1,
    "price_sale": 59.9
  }'
```

12) Listar itens de venda por `sale_id` e paginar
```bash
curl "http://localhost:3000/sale-items?sale_id=<SALE_ID>&limit=10&orderBy=id&order=desc"
```

13) Deletar produto/venda/itens
```bash
curl -X DELETE http://localhost:3000/products/<PRODUCT_ID>
curl -X DELETE http://localhost:3000/sales/<SALE_ID>
curl -X DELETE http://localhost:3000/sale-items/<ITEM_ID>
```

## Critérios de Aceite / Checklist

- Products
  - [ ] `POST /products` cria e retorna o produto.
  - [ ] `GET /products` retorna `data` e `nextCursor` e pagina corretamente.
  - [ ] `GET /products/:id` retorna o produto correto.
  - [ ] `PATCH /products/:id` atualiza campos e reflete na busca.
  - [ ] `DELETE /products/:id` remove e deixa de retornar no GET.

- Sales
  - [ ] `POST /sales` cria a venda e os itens associados.
  - [ ] `GET /sales?year=YYYY&month=MM` filtra por mês/ano.
  - [ ] Paginação com `cursor` funciona com `orderBy=created_at|id`.
  - [ ] `GET /sales/:id` retorna venda + itens.
  - [ ] `PATCH /sales/:id` atualiza campos básicos.
  - [ ] `DELETE /sales/:id` remove itens e venda.

- Sale Items
  - [ ] `POST /sale-items` cria item.
  - [ ] `GET /sale-items?sale_id=...` filtra por venda e pagina usando `id`.
  - [ ] `GET /sale-items/:id`, `PATCH /sale-items/:id`, `DELETE /sale-items/:id` funcionam.

- Erros
  - [ ] Respostas mapeadas (400/404/500) com mensagens claras ao ocorrer erro do Supabase.

## Troubleshooting

- "Nest can't resolve dependencies of the SupabaseService":
  - Verifique variáveis `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no `.env`.
  - Reinicie o servidor após alterar `.env`.

- Cursor inválido (base64 inválido):
  - O serviço ignora cursor inválido e retorna a primeira página novamente.

- `image` (bytea) em products:
  - Para criar/atualizar via `imageBase64` use string base64 (sem prefixos `data:`). A API converte para `bytea` e retorna como base64 em `image`.

- Depreciação `punycode`:
  - Alerta de dependência transitiva; não impede funcionamento.

## Observações

- O SDK Supabase é usado via `SupabaseService`. Módulos: `ProductsModule`, `SalesModule`, `SaleItemsModule`.
- Paginação por cursor baseada em `id` ou `created_at` com `data` e `nextCursor`.
## Notas

- Campo `image` em `products` é `bytea`. A API aceita/retorna `imageBase64` no DTO.
- Erros do Supabase são mapeados para HTTP 400/404/500 com mensagens claras.
