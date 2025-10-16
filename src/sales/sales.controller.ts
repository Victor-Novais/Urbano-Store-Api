import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';

@Controller('sales')
export class SalesController {
    constructor(private readonly salesService: SalesService) { }

    @Post()
    create(@Body() dto: CreateSaleDto) {
        return this.salesService.create(dto);
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
        return this.salesService.findPage({ limit, cursor, orderBy, order, month, year });
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.salesService.findOne(id);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() dto: UpdateSaleDto) {
        return this.salesService.update(id, dto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.salesService.remove(id);
    }
}


