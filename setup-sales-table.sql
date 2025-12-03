-- =============================================
-- Script de Configuração da Tabela Sales
-- Urbano Store API - Supabase
-- Inclui suporte para desconto
-- =============================================

-- 1. Criar tabela sales (se não existir)
CREATE TABLE IF NOT EXISTS sales (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    total_price DECIMAL(10,2) NOT NULL,
    discount DECIMAL(10,2) DEFAULT 0,
    payment_method VARCHAR(50) NOT NULL,
    sale_type VARCHAR(20) NOT NULL CHECK (sale_type IN ('retail', 'wholesale')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Adicionar coluna discount se a tabela já existir mas não tiver a coluna
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'sales' 
        AND column_name = 'discount'
    ) THEN
        ALTER TABLE sales 
        ADD COLUMN discount DECIMAL(10,2) DEFAULT 0;
    END IF;
END $$;

-- 3. Criar tabela sale_items (se não existir)
CREATE TABLE IF NOT EXISTS sale_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sale_id UUID NOT NULL,
    product_id UUID NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price_sale DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- 4. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_sale_type ON sales(sale_type);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);

-- 5. Habilitar RLS (Row Level Security) na tabela sales
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- 6. Habilitar RLS na tabela sale_items
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

-- 7. Políticas para permitir todas as operações na tabela sales
-- ATENÇÃO: Ajuste conforme suas necessidades de segurança
DROP POLICY IF EXISTS "Allow all operations on sales" ON sales;
CREATE POLICY "Allow all operations on sales" ON sales
    FOR ALL USING (true);

-- 8. Políticas para permitir todas as operações na tabela sale_items
DROP POLICY IF EXISTS "Allow all operations on sale_items" ON sale_items;
CREATE POLICY "Allow all operations on sale_items" ON sale_items
    FOR ALL USING (true);

-- 9. Verificar estrutura da tabela sales
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'sales' 
ORDER BY ordinal_position;

-- 10. Verificar estrutura da tabela sale_items
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'sale_items' 
ORDER BY ordinal_position;

