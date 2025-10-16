export interface CursorPage<T> {
    data: T[];
    nextCursor: string | null;
}

export interface CursorQuery {
    limit?: number;
    cursor?: string; // base64 string encoding of value and direction context
    orderBy?: 'id' | 'created_at';
    order?: 'asc' | 'desc';
}

export function encodeCursor(value: string | number | Date): string {
    const toEncode = typeof value === 'string' ? value : value instanceof Date ? value.toISOString() : String(value);
    return Buffer.from(toEncode, 'utf8').toString('base64');
}

export function decodeCursor(cursor?: string): string | null {
    if (!cursor) return null;
    try {
        return Buffer.from(cursor, 'base64').toString('utf8');
    } catch {
        return null;
    }
}


