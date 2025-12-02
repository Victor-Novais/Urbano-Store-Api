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
    price_wholesale: number; // Adicionar este campo
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

    async update(id: string, dto: UpdateProductDto): Promise<Product> {
        const client = this.supabase.getClient();
        const payload: any = { ...dto };
        const imageBase64 = (dto as any).imageBase64 as string | undefined;
        if (imageBase64 !== undefined) {
            // Send base64 string directly for bytea columns
            payload.image = imageBase64 ?? null;
            delete payload.imageBase64;
        }
        const { data, error } = await client.from('products').update(payload).eq('id', id).select('*').single();
        const row = handleSupabaseSingle<any>(data, error, 'Product not updated');
        return this.mapRow(row);
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


