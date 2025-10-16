import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class CreateSaleItemDto {
    @IsString()
    @IsNotEmpty()
    sale_id!: string;

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


