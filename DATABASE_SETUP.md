# 🗄️ Configuração do Banco de Dados - Supabase

## ❌ **Problema Identificado**

O erro `Could not find the 'image' column of 'products' in the schema cache` indica que a tabela `products` não tem a coluna `image` configurada no Supabase.

## ✅ **Solução: Criar/Alterar a Tabela**

### 1. **Acesse o Supabase Dashboard**
- Vá para [https://supabase.com/dashboard](https://supabase.com/dashboard)
- Selecione seu projeto
- Vá em **Table Editor**

### 2. **Opção A: Criar Nova Tabela (Recomendado)**

Execute este SQL no **SQL Editor** do Supabase:

```sql
-- Criar tabela products
CREATE TABLE IF NOT EXISTS products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price_sale DECIMAL(10,2) NOT NULL,
    cost DECIMAL(10,2) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    image TEXT, -- URL da imagem (Supabase Storage ou base64)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

-- Habilitar RLS (Row Level Security)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Política para permitir todas as operações (ajuste conforme necessário)
CREATE POLICY "Allow all operations on products" ON products
    FOR ALL USING (true);
```

### 3. **Opção B: Adicionar Coluna à Tabela Existente**

Se a tabela já existe, execute:

```sql
-- Adicionar coluna image se não existir
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS image TEXT;

-- Adicionar outras colunas se necessário
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS price_sale DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS cost DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
```

### 4. **Verificar Estrutura da Tabela**

Execute para ver a estrutura atual:

```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'products' 
ORDER BY ordinal_position;
```

## 🔧 **Configuração do Storage (Opcional)**

Se quiser usar Supabase Storage para imagens:

### 1. **Criar Bucket**
- Vá em **Storage** no dashboard
- Clique em **New bucket**
- Nome: `imagens`
- Marque como **Public bucket**

### 2. **Configurar Políticas do Storage**

```sql
-- Política para permitir leitura pública
CREATE POLICY "Public Access" ON storage.objects 
FOR SELECT USING (bucket_id = 'imagens');

-- Política para permitir upload
CREATE POLICY "Authenticated users can upload" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'imagens');

-- Política para permitir atualização
CREATE POLICY "Users can update own files" ON storage.objects 
FOR UPDATE USING (bucket_id = 'imagens');

-- Política para permitir remoção
CREATE POLICY "Users can delete own files" ON storage.objects 
FOR DELETE USING (bucket_id = 'imagens');
```

## 🧪 **Teste a Configuração**

### 1. **Teste SQL Direto**
```sql
-- Inserir produto de teste
INSERT INTO products (name, description, price_sale, cost, quantity, image) 
VALUES ('Produto Teste', 'Descrição teste', 10.00, 5.00, 10, 'https://exemplo.com/imagem.jpg');

-- Verificar se foi inserido
SELECT * FROM products;
```

### 2. **Teste via API**
```bash
curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Teste API",
    "description": "Teste via API",
    "price_sale": 15.00,
    "cost": 8.00,
    "quantity": 5,
    "imageUrl": "https://exemplo.com/imagem.jpg"
  }'
```

## 📋 **Checklist de Verificação**

- [ ] **Tabela `products` criada** com todas as colunas
- [ ] **Coluna `image` existe** (TEXT)
- [ ] **RLS habilitado** na tabela
- [ ] **Políticas configuradas** para acesso
- [ ] **Bucket `imagens` criado** (se usar Storage)
- [ ] **Políticas do Storage configuradas** (se usar Storage)
- [ ] **Teste SQL funcionando**
- [ ] **Teste API funcionando**

## 🚨 **Problemas Comuns**

### Erro: "relation 'products' does not exist"
- **Solução**: Execute o SQL de criação da tabela

### Erro: "column 'image' does not exist"
- **Solução**: Execute `ALTER TABLE products ADD COLUMN image TEXT;`

### Erro: "permission denied"
- **Solução**: Configure as políticas RLS corretamente

### Erro: "bucket not found"
- **Solução**: Crie o bucket 'imagens' no Storage

---

**🎯 Execute o SQL de criação da tabela e o erro será resolvido!**
