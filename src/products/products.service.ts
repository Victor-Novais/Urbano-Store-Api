import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CursorPage, CursorQuery, decodeCursor, encodeCursor } from '../common/pagination';
import { handleSupabase, handleSupabaseSingle } from '../common/supabase-error.util';

export interface Product {
    id: string;
    name: string;
    description: string | null;
    price_sale: number;
    price_wholesale: number; // preço de venda no atacado
    cost: number;
    quantity: number;
    image_url: string | null; // URL da imagem (Supabase Storage ou base64)
    created_at: string;
    updated_at: string | null;
}

@Injectable()
export class ProductsService {
    constructor(private readonly supabase: SupabaseService) { }

    async create(dto: CreateProductDto): Promise<Product> {
        console.log('Creating product with data:', {
            name: dto.name,
            description: dto.description,
            price_sale: dto.price_sale,
            price_wholesale: dto.price_wholesale,
            cost: dto.cost,
            quantity: dto.quantity,
            hasImageBase64: !!dto.imageBase64,
            hasImageUrl: !!dto.imageUrl,
            imageBase64Size: dto.imageBase64?.length || 0
        });

        const client = this.supabase.getClient();

        // Determine which image format to use
        let imageValue: string | null = null;
        if (dto.imageUrl) {
            // Use Supabase Storage URL (preferred)
            imageValue = dto.imageUrl;
            console.log('Using Supabase Storage URL:', dto.imageUrl);
        } else if (dto.imageBase64) {
            // Fallback to base64 (legacy)
            imageValue = dto.imageBase64;
            console.log('Using base64 image, size:', dto.imageBase64.length);
        }

        const payload = {
            name: dto.name,
            description: dto.description ?? null,
            price_sale: dto.price_sale,
            price_wholesale: dto.price_wholesale,
            cost: dto.cost,
            quantity: dto.quantity,
            image_url: imageValue, // Usar image_url em vez de image
        } as const;

        console.log('Payload prepared, image type:', imageValue ? (dto.imageUrl ? 'URL' : 'base64') : 'none');

        const { data, error } = await client
            .from('products')
            .insert(payload)
            .select('*')
            .single();

        if (error) {
            console.error('Supabase error:', error);
            throw new Error(`Failed to create product: ${error.message}`);
        }

        const row = handleSupabaseSingle<any>(data, error, 'Product not created');
        return this.mapRow(row);
    }

    async findPage(query: CursorQuery): Promise<CursorPage<Product>> {
        const client = this.supabase.getClient();
        const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
        const orderBy = query.orderBy ?? 'created_at';
        const order = query.order ?? 'desc';
        const decoded = decodeCursor(query.cursor || undefined);

        let q = client.from('products').select('*');

        if (decoded) {
            if (orderBy === 'id') {
                q = order === 'asc' ? q.gt('id', decoded) : q.lt('id', decoded);
            } else {
                q = order === 'asc' ? q.gt('created_at', decoded) : q.lt('created_at', decoded);
            }
        }

        q = q.order(orderBy, { ascending: order === 'asc' }).limit(limit + 1);

        const { data, error } = await q;
        const rows = handleSupabase<any[]>(data, error);

        const hasMore = rows.length > limit;
        const pageRows = rows.slice(0, limit);
        const nextCursorValue = hasMore
            ? (orderBy === 'id' ? pageRows[pageRows.length - 1].id : pageRows[pageRows.length - 1].created_at)
            : null;

        return {
            data: pageRows.map((r) => this.mapRow(r)),
            nextCursor: nextCursorValue ? encodeCursor(nextCursorValue) : null,
        };
    }

    async findOne(id: string): Promise<Product> {
        const client = this.supabase.getClient();
        const { data, error } = await client.from('products').select('*').eq('id', id).single();
        const row = handleSupabaseSingle<any>(data, error, 'Product not found');
        return this.mapRow(row);
    }

    async getProductStats(id: string): Promise<{
        product_id: string;
        total_purchased: number;
        total_invested: number;
        total_sold: number;
        total_revenue: number;
        cost_of_sold_items: number;
        gross_profit: number;
        profit_margin: number;
    }> {
        const client = this.supabase.getClient();

        // Verificar se o produto existe
        const product = await this.findOne(id);

        // Buscar todas as compras (purchases) para este produto
        const { data: purchases, error: purchasesError } = await client
            .from('purchases')
            .select('quantity, unit_cost')
            .eq('product_id', id);

        handleSupabase(purchases, purchasesError);

        // Calcular totais de compras
        let total_purchased = 0;
        let total_invested = 0;
        let total_quantity_for_avg = 0;
        let total_cost_for_avg = 0;

        if (purchases && purchases.length > 0) {
            purchases.forEach((purchase: any) => {
                const qty = Number(purchase.quantity);
                const cost = Number(purchase.unit_cost);
                total_purchased += qty;
                total_invested += qty * cost;
                total_quantity_for_avg += qty;
                total_cost_for_avg += qty * cost;
            });
        }

        // Calcular custo médio ponderado
        const average_cost = total_quantity_for_avg > 0 
            ? total_cost_for_avg / total_quantity_for_avg 
            : product.cost; // Fallback para o custo atual do produto

        // Buscar todas as vendas (sale_items) para este produto
        const { data: saleItems, error: saleItemsError } = await client
            .from('sale_items')
            .select('quantity, price_sale')
            .eq('product_id', id);

        handleSupabase(saleItems, saleItemsError);

        // Calcular totais de vendas
        let total_sold = 0;
        let total_revenue = 0;

        if (saleItems && saleItems.length > 0) {
            saleItems.forEach((item: any) => {
                const qty = Number(item.quantity);
                const price = Number(item.price_sale);
                total_sold += qty;
                total_revenue += qty * price;
            });
        }

        // Calcular custo dos itens vendidos (usando custo médio ponderado)
        const cost_of_sold_items = total_sold * average_cost;

        // Calcular Lucro Bruto
        const gross_profit = total_revenue - cost_of_sold_items;

        // Calcular Margem de Lucro (em percentual)
        const profit_margin = total_revenue > 0 
            ? (gross_profit / total_revenue) * 100 
            : 0;

        return {
            product_id: id,
            total_purchased,
            total_invested,
            total_sold,
            total_revenue,
            cost_of_sold_items,
            gross_profit,
            profit_margin: Number(profit_margin.toFixed(2)), // Arredondar para 2 casas decimais
        };
    }

    async update(id: string, dto: UpdateProductDto): Promise<Product> {
        const client = this.supabase.getClient();

        // Buscar produto atual para comparar quantidade
        const currentProduct = await this.findOne(id);
        const oldQuantity = currentProduct.quantity;
        const newQuantity = dto.quantity !== undefined ? dto.quantity : oldQuantity;
        const quantityIncrease = newQuantity > oldQuantity;

        // Determinar qual campo de imagem usar (mesma lógica do create)
        let imageValue: string | null | undefined = undefined;
        if ((dto as any).imageUrl !== undefined || (dto as any).imageBase64 !== undefined) {
            const imageUrl = (dto as any).imageUrl as string | undefined;
            const imageBase64 = (dto as any).imageBase64 as string | undefined;

            if (imageUrl) {
                imageValue = imageUrl;
                console.log('🔄 Update product: usando imageUrl', imageUrl);
            } else if (imageBase64) {
                imageValue = imageBase64;
                console.log('🔄 Update product: usando imageBase64 (legacy), size:', imageBase64.length);
            } else {
                // Se enviado vazio, significa remover imagem
                imageValue = null;
                console.log('🔄 Update product: removendo imagem');
            }
        }

        // Montar payload apenas com campos definidos
        const payload: any = {};
        if (dto.name !== undefined) payload.name = dto.name;
        if (dto.description !== undefined) payload.description = dto.description ?? null;
        if (dto.price_sale !== undefined) payload.price_sale = dto.price_sale;
        if (dto.price_wholesale !== undefined) payload.price_wholesale = dto.price_wholesale;
        if (dto.cost !== undefined) payload.cost = dto.cost;
        if (dto.quantity !== undefined) payload.quantity = dto.quantity;
        if (imageValue !== undefined) payload.image_url = imageValue;

        console.log('🔄 Update product payload:', payload);

        const { data, error } = await client
            .from('products')
            .update(payload)
            .eq('id', id)
            .select('*')
            .single();

        const row = handleSupabaseSingle<any>(data, error, 'Product not updated');
        const updatedProduct = this.mapRow(row);

        // Se a quantidade aumentou, criar registro em purchases
        if (quantityIncrease) {
            const restockQuantity = newQuantity - oldQuantity;
            const unitCost = dto.cost !== undefined ? dto.cost : currentProduct.cost;

            console.log(`📦 Criando purchase automático: ${restockQuantity} unidades a R$ ${unitCost} cada`);

            const { error: purchaseError } = await client
                .from('purchases')
                .insert({
                    product_id: id,
                    quantity: restockQuantity,
                    unit_cost: unitCost,
                });

            if (purchaseError) {
                console.error('❌ Erro ao criar purchase automático:', purchaseError);
                // Não lançar erro aqui para não quebrar o update do produto
                // Mas logar para debug
            } else {
                console.log('✅ Purchase automático criado com sucesso');
            }
        }

        return updatedProduct;
    }

    async remove(id: string): Promise<{ success: true }> {
        console.log('🗑️ Tentando deletar produto:', id);
        const client = this.supabase.getClient();

        // Primeiro, remover dependências que referenciam o produto para evitar violação de FK
        // 1) Remover itens de venda que referenciam o produto
        const { error: saleItemsError } = await client.from('sale_items').delete().eq('product_id', id);
        if (saleItemsError) {
            console.error('❌ Erro ao remover sale_items do produto:', saleItemsError);
            handleSupabase(null, saleItemsError);
        }

        // 2) Remover compras (purchases) que referenciam o produto (se existir essa relação)
        const { error: purchasesError } = await client.from('purchases').delete().eq('product_id', id);
        if (purchasesError) {
            console.error('❌ Erro ao remover purchases do produto:', purchasesError);
            handleSupabase(null, purchasesError);
        }

        // 3) Finalmente, remover o produto
        const { data, error } = await client.from('products').delete().eq('id', id).select();
        console.log('📊 Resultado da deleção de produto:', { data, error });
        if (error) {
            console.error('❌ Erro do Supabase ao deletar produto:', error);
        }
        handleSupabase(null, error);
        console.log('✅ Produto deletado com sucesso');
        return { success: true };
    }

    private mapRow(row: any): Product {
        // Converte imagem em base64 (se existir em 'image')
        let imageBase64: string | null = null;
        const imageField = row.image as unknown;
        if (imageField) {
            if (typeof imageField === 'string') {
                const s = imageField as string;
                if (/^\\x/i.test(s)) {
                    const hex = s.replace(/^\\x/i, '');
                    imageBase64 = Buffer.from(hex, 'hex').toString('base64');
                } else {
                    imageBase64 = Buffer.from(s, 'binary').toString('base64');
                }
            } else if (imageField instanceof Uint8Array) {
                imageBase64 = Buffer.from(imageField).toString('base64');
            } else if (Array.isArray(imageField)) {
                imageBase64 = Buffer.from(imageField).toString('base64');
            } else {
                try {
                    imageBase64 = Buffer.from(imageField as any).toString('base64');
                } catch {
                    imageBase64 = null;
                }
            }
        }

        return {
            id: row.id,
            name: row.name,
            description: row.description,
            price_sale: Number(row.price_sale),
            price_wholesale: Number(row.price_wholesale),
            cost: Number(row.cost),
            quantity: Number(row.quantity),

            // ✅ CORRETO AGORA: mantém o valor real de image_url se existir,
            // senão usa o base64 como fallback (caso antigo)
            image_url: row.image_url ?? (imageBase64 ? `data:image/png;base64,${imageBase64}` : null),

            created_at: row.created_at,
            updated_at: row.updated_at,
        };
    }
}


