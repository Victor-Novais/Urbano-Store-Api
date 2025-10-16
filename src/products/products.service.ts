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
    cost: number;
    quantity: number;
    image: string | null; // base64
    created_at: string;
    updated_at: string | null;
}

@Injectable()
export class ProductsService {
    constructor(private readonly supabase: SupabaseService) { }

    async create(dto: CreateProductDto): Promise<Product> {
        const client = this.supabase.getClient();
        const payload = {
            name: dto.name,
            description: dto.description ?? null,
            price_sale: dto.price_sale,
            cost: dto.cost,
            quantity: dto.quantity,
            image: dto.imageBase64 ? Buffer.from(dto.imageBase64, 'base64') : null,
        } as const;
        const { data, error } = await client
            .from('products')
            .insert(payload)
            .select('*')
            .single();
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
            payload.image = imageBase64 ? Buffer.from(imageBase64, 'base64') : null;
            delete payload.imageBase64;
        }
        const { data, error } = await client.from('products').update(payload).eq('id', id).select('*').single();
        const row = handleSupabaseSingle<any>(data, error, 'Product not updated');
        return this.mapRow(row);
    }

    async remove(id: string): Promise<{ success: true }> {
        const client = this.supabase.getClient();
        const { error } = await client.from('products').delete().eq('id', id);
        handleSupabase(null, error);
        return { success: true };
    }

    private mapRow(row: any): Product {
        return {
            id: row.id,
            name: row.name,
            description: row.description,
            price_sale: Number(row.price_sale),
            cost: Number(row.cost),
            quantity: Number(row.quantity),
            image: row.image ? Buffer.from(row.image).toString('base64') : null,
            created_at: row.created_at,
            updated_at: row.updated_at,
        };
    }
}


