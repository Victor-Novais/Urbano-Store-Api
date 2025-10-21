import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // Habilitar CORS
    app.enableCors({
        origin: [
            'http://localhost:8080',
            'http://localhost:3000',
            'http://localhost:5173',
            'https://urbano-gestao-visual.vercel.app/', // ✅ Exemplo: seu site hospedado
            'https://urbano-store-api.onrender.com', // ✅ Para permitir chamadas internas
        ],
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
    });

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            transformOptions: { enableImplicitConversion: true },
        }),
    );

    const port = process.env.PORT || 3000;

    // ✅ Use '0.0.0.0' no Render
    await app.listen(port, '0.0.0.0');

    console.log(`✅ Server running on port ${port}`);
}

bootstrap();
