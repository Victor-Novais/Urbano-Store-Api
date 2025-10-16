import { Module } from '@nestjs/common';
import { SupabaseModule } from './supabase/supabase.module';
import { ProductsModule } from './products/products.module';
import { SalesModule } from './sales/sales.module';
import { SaleItemsModule } from './sale-items/sale-items.module';

@Module({
    imports: [SupabaseModule, ProductsModule, SalesModule, SaleItemsModule],
})
export class AppModule { }


