import { Module } from '@nestjs/common';
import { SaleItemsService } from './sale-items.service';
import { SaleItemsController } from './sale-items.controller';
import { SupabaseModule } from 'src/supabase/supabase.module';

@Module({
    imports: [SupabaseModule],
    controllers: [SaleItemsController],
    providers: [SaleItemsService],
})
export class SaleItemsModule { }


