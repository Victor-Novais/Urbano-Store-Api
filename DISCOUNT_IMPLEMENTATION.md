# 💰 Implementação da Funcionalidade de Desconto

## 📋 Resumo

A funcionalidade de desconto foi implementada no método `create` do `SalesService`. Esta implementação permite aplicar descontos nas vendas, garantindo que o valor total seja calculado corretamente (Subtotal - Desconto = Total).

## ✅ Funcionalidades Implementadas

### 1. Cálculo do Subtotal
O subtotal é calculado somando o preço de venda de cada item multiplicado pela quantidade:
```typescript
const subtotal = dto.items.reduce((sum, item) => {
    return sum + (Number(item.price_sale) * Number(item.quantity));
}, 0);
```

### 2. Validação do Desconto
É verificado se o desconto não é maior que o subtotal:
```typescript
const discount = dto.discount ?? 0;
if (discount > subtotal) {
    throw new BadRequestException(
        `O desconto de R$ ${discount.toFixed(2)} não pode ser maior que o subtotal de R$ ${subtotal.toFixed(2)}.`
    );
}
```

### 3. Validação do Preço Total
É verificado se o `total_price` enviado no payload é igual a `subtotal - discount`:
```typescript
const expectedTotalPrice = subtotal - discount;
const tolerance = 0.01; // 1 centavo de tolerância
const priceDifference = Math.abs(Number(dto.total_price) - expectedTotalPrice);

if (priceDifference > tolerance) {
    throw new BadRequestException(
        `O preço total informado não corresponde ao cálculo esperado. ` +
        `Subtotal: R$ ${subtotal.toFixed(2)} - Desconto: R$ ${discount.toFixed(2)} = R$ ${expectedTotalPrice.toFixed(2)}.`
    );
}
```

### 4. Inserção no Banco de Dados
O campo `discount` é incluído no payload de inserção na tabela `sales`:
```typescript
const salePayload = {
    total_price: dto.total_price,
    discount: discount,
    payment_method: dto.payment_method,
    sale_type: dto.sale_type,
    created_at: dto.created_at ?? undefined,
};
```

### 5. Mapeamento do Desconto
O campo `discount` é mapeado corretamente no método `mapSale`:
```typescript
private mapSale(row: any): Sale {
    return {
        id: row.id,
        total_price: Number(row.total_price),
        discount: Number(row.discount ?? 0),
        payment_method: row.payment_method,
        sale_type: row.sale_type,
        created_at: row.created_at,
    };
}
```

## 📊 Exemplo de Fluxo

### Cenário
- Adicionar 3 itens ao carrinho que totalizam R$ 150,00
- Aplicar desconto de R$ 50,00
- Valor final: R$ 100,00

### Request
```json
POST /sales
{
    "total_price": 100.00,
    "discount": 50.00,
    "payment_method": "pix",
    "sale_type": "retail",
    "items": [
        {
            "product_id": "uuid-1",
            "quantity": 2,
            "price_sale": 50.00
        },
        {
            "product_id": "uuid-2",
            "quantity": 1,
            "price_sale": 50.00
        }
    ]
}
```

### Cálculo
- **Subtotal**: (2 × 50.00) + (1 × 50.00) = 150.00
- **Desconto**: 50.00
- **Total**: 150.00 - 50.00 = 100.00 ✓

## 🔧 Configuração do Banco de Dados

### Adicionar Coluna `discount` na Tabela `sales`

Execute o seguinte SQL no Supabase SQL Editor:

```sql
-- Adicionar coluna discount se não existir
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS discount DECIMAL(10,2) DEFAULT 0;

-- Verificar estrutura da tabela
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'sales' 
ORDER BY ordinal_position;
```

### Criar Tabela `sales` Completa (se não existir)

```sql
CREATE TABLE IF NOT EXISTS sales (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    total_price DECIMAL(10,2) NOT NULL,
    discount DECIMAL(10,2) DEFAULT 0,
    payment_method VARCHAR(50) NOT NULL,
    sale_type VARCHAR(20) NOT NULL CHECK (sale_type IN ('retail', 'wholesale')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_sale_type ON sales(sale_type);

-- Habilitar RLS (Row Level Security)
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- Política para permitir todas as operações (ajuste conforme necessário)
CREATE POLICY "Allow all operations on sales" ON sales
    FOR ALL USING (true);
```

## 🧪 Teste da Funcionalidade

### Teste 1: Venda com Desconto Válido
```bash
curl -X POST http://localhost:3000/sales \
  -H "Content-Type: application/json" \
  -d '{
    "total_price": 100.00,
    "discount": 50.00,
    "payment_method": "pix",
    "sale_type": "retail",
    "items": [
      {
        "product_id": "<PRODUCT_ID_1>",
        "quantity": 2,
        "price_sale": 50.00
      },
      {
        "product_id": "<PRODUCT_ID_2>",
        "quantity": 1,
        "price_sale": 50.00
      }
    ]
  }'
```

### Teste 2: Venda sem Desconto
```bash
curl -X POST http://localhost:3000/sales \
  -H "Content-Type: application/json" \
  -d '{
    "total_price": 150.00,
    "payment_method": "cash",
    "sale_type": "retail",
    "items": [
      {
        "product_id": "<PRODUCT_ID>",
        "quantity": 3,
        "price_sale": 50.00
      }
    ]
  }'
```

### Teste 3: Erro - Desconto Maior que Subtotal
```bash
curl -X POST http://localhost:3000/sales \
  -H "Content-Type: application/json" \
  -d '{
    "total_price": 50.00,
    "discount": 200.00,
    "payment_method": "pix",
    "sale_type": "retail",
    "items": [
      {
        "product_id": "<PRODUCT_ID>",
        "quantity": 1,
        "price_sale": 100.00
      }
    ]
  }'
```

**Esperado**: Erro 400 - "O desconto de R$ 200.00 não pode ser maior que o subtotal de R$ 100.00."

### Teste 4: Erro - Total Price Incorreto
```bash
curl -X POST http://localhost:3000/sales \
  -H "Content-Type: application/json" \
  -d '{
    "total_price": 120.00,
    "discount": 50.00,
    "payment_method": "pix",
    "sale_type": "retail",
    "items": [
      {
        "product_id": "<PRODUCT_ID>",
        "quantity": 1,
        "price_sale": 100.00
      }
    ]
  }'
```

**Esperado**: Erro 400 - "O preço total informado (R$ 120.00) não corresponde ao cálculo esperado. Subtotal: R$ 100.00 - Desconto: R$ 50.00 = R$ 50.00."

## 📝 Arquivos Modificados

1. **`src/sales/sales.service.ts`**
   - Implementação do cálculo de subtotal
   - Validações de desconto e preço total
   - Inclusão do campo `discount` no payload de inserção
   - Mapeamento do campo `discount` no método `mapSale`

## ✅ Checklist de Validação

- [x] Cálculo do subtotal implementado
- [x] Validação de desconto maior que subtotal
- [x] Validação de preço total (subtotal - desconto)
- [x] Campo `discount` incluído no payload de inserção
- [x] Campo `discount` mapeado no método `mapSale`
- [x] DTO já tinha o campo `discount` opcional definido
- [x] Interface `Sale` já tinha o campo `discount` definido
- [ ] **Coluna `discount` adicionada na tabela `sales` no banco de dados** ⚠️

## ⚠️ Importante

**Antes de usar a funcionalidade de desconto, certifique-se de que a coluna `discount` existe na tabela `sales` no seu banco de dados Supabase.**

Execute o SQL fornecido na seção "Configuração do Banco de Dados" para adicionar a coluna, caso ela ainda não exista.

