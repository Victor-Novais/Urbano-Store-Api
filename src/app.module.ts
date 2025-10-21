import { Module } from '@nestjs/common';
import { SupabaseModule } from './supabase/supabase.module';
import { ProductsModule } from './products/products.module';
import { SalesModule } from './sales/sales.module';
import { PurchasesModule } from './purchases/purchases.module';
import { SaleItemsModule } from './sale-items/sale-items.module';

@Module({
    imports: [SupabaseModule, ProductsModule, SalesModule, SaleItemsModule, PurchasesModule],
})
export class AppModule { }


