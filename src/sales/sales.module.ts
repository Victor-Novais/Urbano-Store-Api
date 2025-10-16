import { Module } from '@nestjs/common';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { SupabaseModule } from 'src/supabase/supabase.module';

@Module({
    imports: [SupabaseModule],
    controllers: [SalesController],
    providers: [SalesService],
})
export class SalesModule { }


