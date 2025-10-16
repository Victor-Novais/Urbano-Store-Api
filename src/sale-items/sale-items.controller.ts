import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { SaleItemsService } from './sale-items.service';
import { CreateSaleItemDto } from './dto/create-sale-item.dto';
import { UpdateSaleItemDto } from './dto/update-sale-item.dto';

@Controller('sale-items')
export class SaleItemsController {
    constructor(private readonly saleItemsService: SaleItemsService) { }

    @Post()
    create(@Body() dto: CreateSaleItemDto) {
        return this.saleItemsService.create(dto);
    }

    @Get()
    findPage(
        @Query('limit') limit?: number,
        @Query('cursor') cursor?: string,
        @Query('orderBy') orderBy?: 'id' | 'created_at',
        @Query('order') order?: 'asc' | 'desc',
        @Query('sale_id') sale_id?: string,
    ) {
        return this.saleItemsService.findPage({ limit, cursor, orderBy, order, sale_id });
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.saleItemsService.findOne(id);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() dto: UpdateSaleItemDto) {
        return this.saleItemsService.update(id, dto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.saleItemsService.remove(id);
    }
}


