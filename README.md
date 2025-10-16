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

## Notas

- Campo `image` em `products` é `bytea`. A API aceita/retorna `imageBase64` no DTO.
- Erros do Supabase são mapeados para HTTP 400/404/500 com mensagens claras.
