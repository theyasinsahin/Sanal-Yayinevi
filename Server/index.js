// Temel Kütüphaneler
import http from 'http';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import * as dotenv from 'dotenv';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';

// Bizim Oluşturduğumuz Modüller
import connectDB from './src/config/db.js';
import schema from './src/graphql/schema.js';
import models from './src/models/index.js';
import { authenticateUser } from './src/utils/auth.js';
import formatError from './src/utils/formatError.js';

import paymentRoutes from './src/routes/paymentRoutes.js';

// 1. Ortam Değişkenlerini Yükle
dotenv.config({
  path: process.env.NODE_ENV === "production" ? ".env.prod" : ".env",
});

const PORT = process.env.PORT || 5000;

// 2. Sunucuyu Başlatma Fonksiyonu
const startServer = async () => {
  try {
    // Express App Oluştur
    const app = express();

    // Veritabanına Bağlan
    await connectDB();

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // 3. Ödeme Geri Çağrı Yolu (Webhook)
    app.use('/api/payment', paymentRoutes);

    // 4. Genel Middleware'ler
    app.use(cors({
      origin: ['http://localhost:3000'],
      credentials: true,
    }));
    app.use(express.json()); // Standart JSON body parser

    // 5. Apollo Server Kurulumu
    const httpServer = http.createServer(app);
    
    const server = new ApolloServer({
      schema, // schema.js'den geliyor
      cache: "bounded", // cacheControl yerine bunu kullanmak daha güncel
      introspection: true,
      plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
      formatError: formatError,
    });

    await server.start();

    // 6. Apollo Middleware Entegrasyonu
    app.use(
      '/',
      bodyParser.json({ limit: '50mb' }),
      expressMiddleware(server, {
        context: async ({ req }) => {
          const authHeader = req.headers.authorization;
          let user = null;

          if (authHeader && authHeader.startsWith("Bearer ")) {
            user = await authenticateUser(req, models.User);
          }

          return { ...models, user, req };
        },
      })
    );

    // 7. Sunucuyu Dinle
    await new Promise((resolve) => httpServer.listen({ port: PORT }, resolve));
    console.log(`🚀 Server hazır: http://localhost:${PORT}`);

  } catch (e) {
    console.error('Server başlatılamadı:', e);
  }
};

startServer();