import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';

@Controller('purchases')
export class PurchasesController {
    constructor(private readonly purchases: PurchasesService) { }

    @Post()
    create(@Body() dto: CreatePurchaseDto) {
        return this.purchases.create(dto);
    }

    @Get()
    findPage(
        @Query('limit') limit?: number,
        @Query('cursor') cursor?: string,
        @Query('orderBy') orderBy?: 'id' | 'created_at',
        @Query('order') order?: 'asc' | 'desc',
        @Query('month') month?: number,
        @Query('year') year?: number,
    ) {
        return this.purchases.findPage({ limit, cursor, orderBy, order, month, year });
    }
}


