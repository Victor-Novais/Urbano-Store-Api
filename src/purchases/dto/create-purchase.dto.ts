import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreatePurchaseDto {
    @IsString()
    @IsNotEmpty()
    product_id!: string;

    @IsNumber()
    @Min(1)
    quantity!: number;

    @IsNumber()
    @Min(0)
    unit_cost!: number;

    @IsOptional()
    @IsString()
    created_at?: string;
}


