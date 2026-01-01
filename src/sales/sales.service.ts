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
    notes?: string;
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
            notes: dto.notes ?? undefined,
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
        
        // Limpar o ID antes de usar
        const cleanId = id.trim();
        
        console.log('🔄 [UPDATE] Tentando atualizar venda ID:', cleanId);
        console.log('📦 [UPDATE] Payload recebido:', dto);

        // Construir payload apenas com os campos da tabela 'sales' que foram fornecidos
        // Campos atualizáveis: total_price, payment_method, discount, notes, sale_type
        const payload: any = {};
        
        if (dto.total_price !== undefined) {
            // Converter para Number antes de enviar ao banco
            payload.total_price = Number(dto.total_price);
            console.log('💰 [UPDATE] total_price convertido para Number:', payload.total_price);
        }
        
        if (dto.discount !== undefined) {
            // Converter para Number antes de enviar ao banco
            payload.discount = Number(dto.discount);
            console.log('💸 [UPDATE] discount convertido para Number:', payload.discount);
        }
        
        if (dto.payment_method !== undefined) {
            payload.payment_method = dto.payment_method;
        }
        
        if (dto.notes !== undefined) {
            // Permitir null para limpar observações
            payload.notes = dto.notes === null || dto.notes === '' ? null : dto.notes;
        }
        
        if (dto.sale_type !== undefined) {
            payload.sale_type = dto.sale_type;
        }
        
        // Não permitir atualizar created_at via update
        // Não atualizar sale_items neste método - apenas campos da tabela sales

        // Se não há nada para atualizar, buscar e retornar a venda atual
        if (Object.keys(payload).length === 0) {
            console.log('⚠️ [UPDATE] Nenhum campo para atualizar, buscando venda atual...');
            const { data: existingSale, error: findError } = await client
                .from('sales')
                .select('*')
                .eq('id', cleanId)
                .single();
            
            if (findError || !existingSale) {
                console.error('❌ [UPDATE] Venda não encontrada:', findError);
                throw new BadRequestException('Venda não encontrada');
            }
            
            console.log('✅ [UPDATE] Venda encontrada, retornando sem alterações');
            return this.mapSale(existingSale);
        }

        console.log('📝 [UPDATE] Payload final para atualização:', payload);

        // Tentar atualizar com .select() simples primeiro
        const { data: updateData, error: updateError } = await client
            .from('sales')
            .update(payload)
            .eq('id', cleanId)
            .select();
        
        console.log('🔍 [UPDATE] Resultado do update:', { 
            dataLength: updateData?.length || 0,
            hasData: !!updateData && updateData.length > 0,
            error: updateError ? {
                message: updateError.message,
                code: updateError.code,
                details: updateError.details,
                hint: updateError.hint
            } : null
        });

        // Se houver erro do Supabase, logar detalhadamente e lançar exceção
        if (updateError) {
            console.error('❌ [UPDATE] Erro detalhado do Supabase:', {
                message: updateError.message,
                code: updateError.code,
                details: updateError.details,
                hint: updateError.hint,
                error: JSON.stringify(updateError, null, 2)
            });
            throw new BadRequestException(`Erro ao atualizar venda: ${updateError.message}${updateError.hint ? ` - ${updateError.hint}` : ''}`);
        }

        // Verificar se o retorno do update é um array vazio
        if (!updateData || updateData.length === 0) {
            console.error('❌ [UPDATE] Update retornou array vazio (0 rows affected)');
            console.error('🔍 [UPDATE] Possíveis causas:');
            console.error('   - RLS (Row Level Security) bloqueando a atualização');
            console.error('   - ID não encontrado no banco');
            console.error('   - Constraints ou triggers bloqueando');
            console.error('   - Permissões insuficientes');
            
            // Tentar buscar a venda para verificar se existe
            const { data: fetchedSale, error: fetchError } = await client
                .from('sales')
                .select('*')
                .eq('id', cleanId)
                .single();
            
            console.log('🔍 [UPDATE] Verificação de existência da venda:', {
                exists: !!fetchedSale,
                error: fetchError ? {
                    message: fetchError.message,
                    code: fetchError.code
                } : null
            });
            
            throw new BadRequestException(
                'O banco de dados não permitiu a alteração. Verifique o RLS no Supabase.'
            );
        }

        console.log('✅ [UPDATE] Atualização concluída com sucesso');
        return this.mapSale(updateData[0]);
    }

    async remove(id: string): Promise<{ success: true }> {
        const client = this.supabase.getClient();
        
        console.log('🗑️ [DELETE] Iniciando deleção da venda ID:', id);
        console.log('🔍 [DELETE] Tipo do ID:', typeof id);
        
        // Validar se o ID é uma string UUID válida (formato básico)
        if (!id || typeof id !== 'string' || id.trim().length === 0) {
            console.error('❌ [DELETE] ID inválido');
            throw new BadRequestException('ID inválido');
        }

        // ETAPA 1: Buscar os itens da venda (sale_items) vinculados a este sale_id
        console.log('📋 [DELETE] ETAPA 1: Buscando itens da venda...');
        const { data: saleItems, error: fetchItemsError } = await client
            .from('sale_items')
            .select('*')
            .eq('sale_id', id);
        
        console.log('🔍 [DELETE] Resultado da busca de itens:', {
            itemsCount: saleItems?.length || 0,
            error: fetchItemsError ? {
                message: fetchItemsError.message,
                code: fetchItemsError.code,
                details: fetchItemsError.details
            } : null
        });

        if (fetchItemsError) {
            console.error('❌ [DELETE] Erro ao buscar itens da venda:', fetchItemsError);
            throw new BadRequestException(`Erro ao buscar itens da venda: ${fetchItemsError.message}`);
        }

        // ETAPA 2: Para cada item encontrado, devolver o estoque ao produto
        if (saleItems && saleItems.length > 0) {
            console.log(`📦 [DELETE] ETAPA 2: Devolvendo estoque de ${saleItems.length} item(ns)...`);
            
            for (const item of saleItems) {
                const productId = item.product_id;
                const itemQuantity = Number(item.quantity);
                
                console.log(`🔄 [DELETE] Devolvendo ${itemQuantity} unidade(s) ao produto ${productId}...`);
                
                // Buscar o produto atual para obter a quantidade atual
                const { data: product, error: productError } = await client
                    .from('products')
                    .select('id, quantity')
                    .eq('id', productId)
                    .single();
                
                if (productError) {
                    console.error(`❌ [DELETE] Erro ao buscar produto ${productId}:`, productError);
                    // Continuar mesmo se houver erro ao buscar produto (pode não existir mais)
                    continue;
                }
                
                if (!product) {
                    console.warn(`⚠️ [DELETE] Produto ${productId} não encontrado, pulando devolução de estoque`);
                    continue;
                }
                
                const currentQuantity = Number(product.quantity) || 0;
                const newQuantity = currentQuantity + itemQuantity;
                
                console.log(`📊 [DELETE] Produto ${productId}: ${currentQuantity} → ${newQuantity} unidades`);
                
                // Atualizar a quantidade do produto
                const { error: updateProductError } = await client
                    .from('products')
                    .update({ quantity: newQuantity })
                    .eq('id', productId);
                
                if (updateProductError) {
                    console.error(`❌ [DELETE] Erro ao atualizar estoque do produto ${productId}:`, updateProductError);
                    throw new BadRequestException(
                        `Erro ao devolver estoque do produto ${productId}: ${updateProductError.message}`
                    );
                }
                
                console.log(`✅ [DELETE] Estoque do produto ${productId} devolvido com sucesso`);
            }
            
            console.log('✅ [DELETE] ETAPA 2 concluída: Estoque devolvido para todos os produtos');
        } else {
            console.log('ℹ️ [DELETE] Nenhum item encontrado para devolver estoque');
        }

        // ETAPA 3: Deletar todos os registros em sale_items onde sale_id = id
        console.log('🗑️ [DELETE] ETAPA 3: Deletando itens da venda (sale_items)...');
        const { error: delItemsError } = await client
            .from('sale_items')
            .delete()
            .eq('sale_id', id);
        
        console.log('🔍 [DELETE] Resultado da deleção de itens:', {
            success: !delItemsError,
            error: delItemsError ? {
                message: delItemsError.message,
                code: delItemsError.code,
                details: delItemsError.details
            } : null
        });
        
        if (delItemsError) {
            console.error('❌ [DELETE] Erro ao deletar itens da venda:', delItemsError);
            throw new BadRequestException(`Erro ao deletar itens da venda: ${delItemsError.message}`);
        }

        console.log('✅ [DELETE] ETAPA 3 concluída: Itens deletados com sucesso');

        // ETAPA 4: Deletar o registro na tabela sales
        console.log('🗑️ [DELETE] ETAPA 4: Deletando registro da venda (sales)...');
        const { error: delSaleError } = await client
            .from('sales')
            .delete()
            .eq('id', id);
        
        console.log('🔍 [DELETE] Resultado da deleção da venda:', {
            success: !delSaleError,
            error: delSaleError ? {
                message: delSaleError.message,
                code: delSaleError.code,
                details: delSaleError.details
            } : null
        });
        
        if (delSaleError) {
            console.error('❌ [DELETE] Erro ao deletar venda:', delSaleError);
            throw new BadRequestException(`Erro ao deletar venda: ${delSaleError.message}`);
        }

        console.log('✅ [DELETE] ETAPA 4 concluída: Venda deletada com sucesso');
        console.log('✅ [DELETE] Operação de deleção completa - todas as etapas foram bem-sucedidas');

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
            notes: row.notes,
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


