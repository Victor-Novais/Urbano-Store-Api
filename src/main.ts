import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // Habilitar CORS
    app.enableCors({
        origin: ['http://localhost:8080', 'http://localhost:3000', 'http://localhost:5173'],
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
    await app.listen(port);
    // eslint-disable-next-line no-console
    console.log(`Server running on http://localhost:${port}`);
}

bootstrap();


