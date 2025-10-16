import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateSaleItemDto } from './dto/create-sale-item.dto';
import { UpdateSaleItemDto } from './dto/update-sale-item.dto';
import { CursorPage, CursorQuery, decodeCursor, encodeCursor } from '../common/pagination';
import { handleSupabase, handleSupabaseSingle } from '../common/supabase-error.util';

export interface SaleItem {
    id: string;
    sale_id: string;
    product_id: string;
    quantity: number;
    price_sale: number;
}

@Injectable()
export class SaleItemsService {
    constructor(private readonly supabase: SupabaseService) { }

    async create(dto: CreateSaleItemDto): Promise<SaleItem> {
        const client = this.supabase.getClient();
        const { data, error } = await client.from('sale_items').insert(dto).select('*').single();
        const row = handleSupabaseSingle<any>(data, error, 'Sale item not created');
        return this.mapRow(row);
    }

    async findPage(query: CursorQuery & { sale_id?: string }): Promise<CursorPage<SaleItem>> {
        const client = this.supabase.getClient();
        const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
        const orderBy = query.orderBy ?? 'id';
        const order = query.order ?? 'desc';
        const decoded = decodeCursor(query.cursor || undefined);

        let q = client.from('sale_items').select('*');
        if (query.sale_id) q = q.eq('sale_id', query.sale_id);

        if (decoded) {
            if (orderBy === 'id') {
                q = order === 'asc' ? q.gt('id', decoded) : q.lt('id', decoded);
            } else {
                // fallback to id if created_at is not present in table
                q = order === 'asc' ? q.gt('id', decoded) : q.lt('id', decoded);
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

    async findOne(id: string): Promise<SaleItem> {
        const client = this.supabase.getClient();
        const { data, error } = await client.from('sale_items').select('*').eq('id', id).single();
        const row = handleSupabaseSingle<any>(data, error, 'Sale item not found');
        return this.mapRow(row);
    }

    async update(id: string, dto: UpdateSaleItemDto): Promise<SaleItem> {
        const client = this.supabase.getClient();
        const { data, error } = await client.from('sale_items').update(dto).eq('id', id).select('*').single();
        const row = handleSupabaseSingle<any>(data, error, 'Sale item not updated');
        return this.mapRow(row);
    }

    async remove(id: string): Promise<{ success: true }> {
        const client = this.supabase.getClient();
        const { error } = await client.from('sale_items').delete().eq('id', id);
        handleSupabase(null, error);
        return { success: true };
    }

    private mapRow(row: any): SaleItem {
        return {
            id: row.id,
            sale_id: row.sale_id,
            product_id: row.product_id,
            quantity: Number(row.quantity),
            price_sale: Number(row.price_sale),
        };
    }
}


