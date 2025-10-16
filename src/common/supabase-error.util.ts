import { BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PostgrestError } from '@supabase/supabase-js';

export function handleSupabaseSingle<T>(data: T | null, error: PostgrestError | null, notFoundMessage = 'Not found'): T {
    if (error) {
        throw mapSupabaseError(error);
    }
    if (!data) {
        throw new NotFoundException(notFoundMessage);
    }
    return data;
}

export function handleSupabase<T>(data: T | null, error: PostgrestError | null): T {
    if (error) {
        throw mapSupabaseError(error);
    }
    // allow empty arrays/objects
    return (data as T) ?? ({} as T);
}

export function mapSupabaseError(error: PostgrestError): Error {
    const message = error.message || 'Supabase error';
    // Some simple mappings; extend as needed
    if (error.code === 'PGRST116' || message.toLowerCase().includes('not found')) {
        return new NotFoundException(message);
    }
    if (error.code === '23505' || message.toLowerCase().includes('duplicate')) {
        return new BadRequestException(message);
    }
    return new InternalServerErrorException(message);
}


