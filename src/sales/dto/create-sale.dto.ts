import { ArrayMinSize, IsArray, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class CreateSaleItemInput {
    @IsString()
    @IsNotEmpty()
    product_id!: string;

    @IsNumber()
    @Min(1)
    quantity!: number;

    @IsNumber()
    @Min(0)
    price_sale!: number;
}

export class CreateSaleDto {
    @IsNumber()
    @Min(0)
    total_price!: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    discount?: number;

    @IsString()
    @IsIn(['cash', 'credit', 'debit', 'pix', 'other'])
    payment_method!: string;

    @IsString()
    @IsIn(['retail', 'wholesale']) // 'varejo' ou 'atacado'
    sale_type!: 'retail' | 'wholesale';

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => CreateSaleItemInput)
    items!: CreateSaleItemInput[];

    @IsOptional()
    @IsString()
    created_at?: string; // allow overriding for imports
}

export type CreateSaleItemDto = CreateSaleItemInput;


