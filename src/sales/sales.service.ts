import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateSaleDto, CreateSaleItemDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { CursorPage, CursorQuery, decodeCursor, encodeCursor } from '../common/pagination';
import { handleSupabase, handleSupabaseSingle } from '../common/supabase-error.util';

export interface Sale {
    id: string;
    total_price: number;
    discount: number;
    payment_method: string;
    sale_type: 'retail' | 'wholesale';
    created_at: string;
}

export interface SaleWithItems extends Sale {
    items: SaleItem[];
}

export interface SaleItem {
    id: string;
    sale_id: string;
    product_id: string;
    quantity: number;
    price_sale: number;
}

@Injectable()
export class SalesService {
    constructor(private readonly supabase: SupabaseService) { }

    async create(dto: CreateSaleDto): Promise<SaleWithItems> {
        const client = this.supabase.getClient();

        // CRÍTICO: Validar preços dos itens antes de criar a venda
        await this.validateSaleItemsPrices(dto.items, dto.sale_type, client);

        // 1. Calcular o Subtotal: somando o preço de venda de cada item multiplicado pela quantidade
        const subtotal = dto.items.reduce((sum, item) => {
            return sum + (Number(item.price_sale) * Number(item.quantity));
        }, 0);

        // 2. Validação do Desconto: verificar se o discount não é maior que o subtotal
        const discount = dto.discount ?? 0;
        if (discount > subtotal) {
            throw new BadRequestException(
                `O desconto de R$ ${discount.toFixed(2)} não pode ser maior que o subtotal de R$ ${subtotal.toFixed(2)}.`
            );
        }

        // 3. Validação do Preço Total: verificar se o total_price enviado é igual a subtotal - discount
        const expectedTotalPrice = subtotal - discount;
        const tolerance = 0.01; // 1 centavo de tolerância para evitar problemas de ponto flutuante
        const priceDifference = Math.abs(Number(dto.total_price) - expectedTotalPrice);

        if (priceDifference > tolerance) {
            throw new BadRequestException(
                `O preço total informado (R$ ${Number(dto.total_price).toFixed(2)}) não corresponde ao cálculo esperado. ` +
                `Subtotal: R$ ${subtotal.toFixed(2)} - Desconto: R$ ${discount.toFixed(2)} = R$ ${expectedTotalPrice.toFixed(2)}.`
            );
        }

        // Insert sale
        const salePayload = {
            total_price: dto.total_price,
            discount: discount,
            payment_method: dto.payment_method,
            sale_type: dto.sale_type,
            created_at: dto.created_at ?? undefined,
        } as const;
        const { data: saleRow, error: saleErr } = await client.from('sales').insert(salePayload).select('*').single();
        const sale = handleSupabaseSingle<any>(saleRow, saleErr, 'Sale not created');

        // Insert items
        const itemsPayload = dto.items.map((i) => ({
            sale_id: sale.id,
            product_id: i.product_id,
            quantity: i.quantity,
            price_sale: i.price_sale,
        }));

        const { data: itemsRows, error: itemsErr } = await client.from('sale_items').insert(itemsPayload).select('*');
        const items = handleSupabase<any[]>(itemsRows, itemsErr);

        return {
            ...this.mapSale(sale),
            items: items.map((r) => this.mapItem(r)),
        };
    }

    /**
     * Valida se os preços dos itens correspondem aos preços cadastrados do produto
     * baseado no tipo de venda (retail ou wholesale).
     * 
     * @param items - Array de itens da venda
     * @param saleType - Tipo de venda: 'retail' ou 'wholesale'
     * @param client - Cliente Supabase
     * @throws BadRequestException se algum preço não corresponder
     */
    private async validateSaleItemsPrices(
        items: CreateSaleItemDto[],
        saleType: 'retail' | 'wholesale',
        client: SupabaseClient
    ): Promise<void> {
        // Buscar todos os produtos de uma vez para otimizar
        const productIds = items.map(item => item.product_id);
        const { data: productsData, error: productsError } = await client
            .from('products')
            .select('id, name, price_sale, price_wholesale')
            .in('id', productIds);

        if (productsError) {
            throw new BadRequestException(`Erro ao buscar produtos: ${productsError.message}`);
        }

        const products = handleSupabase<any[]>(productsData, productsError);
        const productsMap = new Map(products.map(p => [p.id, p]));

        // Validar cada item
        for (const item of items) {
            const product = productsMap.get(item.product_id);

            if (!product) {
                throw new BadRequestException(
                    `Produto com ID ${item.product_id} não encontrado`
                );
            }

            // Determinar qual preço usar baseado no tipo de venda
            const expectedPrice = saleType === 'retail'
                ? Number(product.price_sale)
                : Number(product.price_wholesale);

            const receivedPrice = Number(item.price_sale);

            // Comparar com tolerância para evitar problemas de ponto flutuante
            const priceDifference = Math.abs(expectedPrice - receivedPrice);
            const tolerance = 0.01; // 1 centavo de tolerância

            if (priceDifference > tolerance) {
                const saleTypeLabel = saleType === 'retail' ? 'varejo' : 'atacado';
                const expectedPriceLabel = saleType === 'retail' ? 'price_sale' : 'price_wholesale';

                throw new BadRequestException(
                    `Preço inválido para o produto "${product.name}" (ID: ${item.product_id}). ` +
                    `Para venda ${saleTypeLabel}, o preço esperado é R$ ${expectedPrice.toFixed(2)} ` +
                    `(${expectedPriceLabel}), mas foi recebido R$ ${receivedPrice.toFixed(2)}.`
                );
            }
        }
    }

    async findPage(query: CursorQuery & { month?: number; year?: number }): Promise<CursorPage<Sale>> {
        const client = this.supabase.getClient();
        const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
        const orderBy = query.orderBy ?? 'created_at';
        const order = query.order ?? 'desc';
        const decoded = decodeCursor(query.cursor || undefined);

        let q = client.from('sales').select('*');

        if (query.month && query.year) {
            // Filter by month/year using date_trunc via RPC? Use gte/lt boundaries
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
            data: pageRows.map((r) => this.mapSale(r)),
            nextCursor: nextCursorValue ? encodeCursor(nextCursorValue) : null,
        };
    }

    async findOne(id: string): Promise<SaleWithItems> {
        const client = this.supabase.getClient();
        const { data: saleRow, error: saleErr } = await client.from('sales').select('*').eq('id', id).single();
        const sale = handleSupabaseSingle<any>(saleRow, saleErr, 'Sale not found');
        const { data: itemsRows, error: itemsErr } = await client.from('sale_items').select('*').eq('sale_id', id);
        const items = handleSupabase<any[]>(itemsRows, itemsErr);
        return { ...this.mapSale(sale), items: items.map((r) => this.mapItem(r)) };
    }

    async update(id: string, dto: UpdateSaleDto): Promise<Sale> {
        const client = this.supabase.getClient();
        const payload: any = { ...dto };
        delete payload.items; // items not updated here
        const { data, error } = await client.from('sales').update(payload).eq('id', id).select('*').single();
        const row = handleSupabaseSingle<any>(data, error, 'Sale not updated');
        return this.mapSale(row);
    }

    async remove(id: string): Promise<{ success: true }> {
        const client = this.supabase.getClient();
        // delete items first due to FK constraints if ON DELETE RESTRICT
        const delItems = await client.from('sale_items').delete().eq('sale_id', id);
        handleSupabase(null, delItems.error);
        const delSale = await client.from('sales').delete().eq('id', id);
        handleSupabase(null, delSale.error);
        return { success: true };
    }

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

    private mapItem(row: any): SaleItem {
        return {
            id: row.id,
            sale_id: row.sale_id,
            product_id: row.product_id,
            quantity: Number(row.quantity),
            price_sale: Number(row.price_sale),
        };
    }
}


