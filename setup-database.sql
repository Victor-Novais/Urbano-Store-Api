-- =============================================
-- Script de Configuração do Banco de Dados
-- Urbano Store API - Supabase
-- =============================================

-- 1. Criar tabela products (se não existir)
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

-- 2. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

-- 3. Habilitar RLS (Row Level Security)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- 4. Política para permitir todas as operações
-- ATENÇÃO: Ajuste conforme suas necessidades de segurança
CREATE POLICY "Allow all operations on products" ON products
    FOR ALL USING (true);

-- 5. Verificar estrutura da tabela
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'products' 
ORDER BY ordinal_position;

-- 6. Inserir dados de teste (opcional)
INSERT INTO products (name, description, price_sale, cost, quantity, image) 
VALUES 
    ('Produto Teste 1', 'Descrição do produto teste', 25.00, 15.00, 10, 'https://exemplo.com/imagem1.jpg'),
    ('Produto Teste 2', 'Outro produto de teste', 50.00, 30.00, 5, 'https://exemplo.com/imagem2.jpg')
ON CONFLICT DO NOTHING;

-- 7. Verificar dados inseridos
SELECT * FROM products ORDER BY created_at DESC;
