import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { CursorPage, CursorQuery, decodeCursor, encodeCursor } from '../common/pagination';
import { handleSupabase, handleSupabaseSingle } from '../common/supabase-error.util';

export interface Purchase {
    id: string;
    product_id: string;
    quantity: number;
    unit_cost: number;
    created_at: string;
}

@Injectable()
export class PurchasesService {
    constructor(private readonly supabase: SupabaseService) { }

    async create(dto: CreatePurchaseDto): Promise<Purchase> {
        const client = this.supabase.getClient();
        const payload = {
            product_id: dto.product_id,
            quantity: dto.quantity,
            unit_cost: dto.unit_cost,
            created_at: dto.created_at ?? undefined,
        } as const;
        const { data, error } = await client.from('purchases').insert(payload).select('*').single();
        const row = handleSupabaseSingle<any>(data, error, 'Purchase not created');
        return this.mapRow(row);
    }

    async findPage(query: CursorQuery & { month?: number; year?: number }): Promise<CursorPage<Purchase>> {
        const client = this.supabase.getClient();
        const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
        const orderBy = query.orderBy ?? 'created_at';
        const order = query.order ?? 'desc';
        const decoded = decodeCursor(query.cursor || undefined);

        let q = client.from('purchases').select('*');
        if (query.month && query.year) {
            const start = new Date(Date.UTC(query.year, query.month - 1, 1)).toISOString();
            const end = new Date(Date.UTC(query.year, query.month, 1)).toISOString();
            q = q.gte('created_at', start).lt('created_at', end);
        } else if (query.year && !query.month) {
            const start = new Date(Date.UTC(query.year, 0, 1)).toISOString();
            const end = new Date(Date.UTC(query.year + 1, 0, 1)).toISOString();
            q = q.gte('created_at', start).lt('created_at', end);
        }

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

    private mapRow(row: any): Purchase {
        return {
            id: row.id,
            product_id: row.product_id,
            quantity: Number(row.quantity),
            unit_cost: Number(row.unit_cost),
            created_at: row.created_at,
        };
    }
}


