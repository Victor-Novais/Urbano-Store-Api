import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { SupabaseModule } from 'src/supabase/supabase.module';

@Module({
    imports: [SupabaseModule],
    controllers: [ProductsController],
    providers: [ProductsService],
})
export class ProductsModule { }


