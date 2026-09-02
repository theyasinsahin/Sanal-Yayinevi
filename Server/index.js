// Temel Kütüphaneler
import http from 'http';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import * as dotenv from 'dotenv';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/use/ws';
import { PubSub } from 'graphql-subscriptions';
import jwt from 'jsonwebtoken';

// Bizim Oluşturduğumuz Modüller
import connectDB from './src/config/db.js';
import schema from './src/graphql/schema.js';
import models from './src/models/index.js';
import { authenticateUser } from './src/utils/auth.js';
import formatError from './src/utils/formatError.js';
import paymentRoutes from './src/routes/paymentRoutes.js';
import googleAuthRoutes from './src/routes/googleAuthRoutes.js';

// 1. Ortam Değişkenlerini Yükle
dotenv.config({
  path: process.env.NODE_ENV === "production" ? ".env.prod" : ".env",
});

const PORT = process.env.PORT || 5000;

// 2. PubSub instance — tüm uygulama bu tek instance'ı kullanır
// Dosya seviyesinde export ediyoruz ki servis ve resolver'lar import edebilsin
export const pubsub = new PubSub();

// 3. Sunucuyu Başlatma Fonksiyonu
const startServer = async () => {
  try {
    const app = express();

    await connectDB();

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // CORS: web (localhost:3000), prod frontend (CLIENT_URL) ve mobil
    // uygulamanın (Capacitor) kullandığı origin'lere izin ver.
    // Capacitor'ın androidScheme:'http' ayarıyla uygulamanın origin'i
    // "http://localhost" (port'suz) oluyor — varsayılan https şemasında ise
    // "https://localhost" veya "capacitor://localhost" olabiliyor. Hangi
    // ayarla test edersen et diye üçünü de baştan ekliyoruz.
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost',
      'capacitor://localhost',
      'https://localhost',
    ];
    if (process.env.CLIENT_URL) {
      allowedOrigins.push(process.env.CLIENT_URL);
    }

    app.use(cors({
      origin: allowedOrigins,
      credentials: true,
    }));

    app.use('/api/payment', paymentRoutes);

    // Google Identity Services'ın ux_mode="redirect" modunda POST ettiği
    // credential'ı karşılayan endpoint. Bu, tarayıcının gerçek bir sayfa
    // navigasyonu yaptığı bir form-POST'tur; window.postMessage kullanmaz,
    // bu yüzden Cross-Origin-Opener-Policy'den etkilenmez.
    app.use('/auth/google', googleAuthRoutes);

    // NOT: Burada daha önce bulunan
    //   app.use((req, res, next) => {
    //     res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    //     next();
    //   });
    // satırı kaldırıldı. Bu header'ın API sunucusuna eklenmesinin COOP/postMessage
    // sorununa hiçbir etkisi yoktu — asıl gereken yer, popup'ı açan FRONTEND
    // sayfasıydı. Artık login/register redirect akışına geçtiği için (yukarıdaki
    // /auth/google/callback), popup + postMessage'a hiç ihtiyaç kalmadı ve bu
    // header de gereksizleşti. Eğer ileride başka bir yerde popup tabanlı bir
    // Google akışı kullanmaya devam edersen, header'ı frontend'i sunan sunucuya
    // (dev server veya prod hosting) eklemen gerekir — API sunucusuna değil.

    // 4. HTTP sunucusunu oluştur
    const httpServer = http.createServer(app);

    // 5. WebSocket sunucusu — HTTP sunucusuyla aynı port, /graphql path'i
    const wsServer = new WebSocketServer({
      server: httpServer,
      path: '/graphql',
    });

    // 6. graphql-ws'i schema'ya bağla
    // useServer'ın döndürdüğü serverCleanup, Apollo kapanırken WS'i de temiz kapatır
    const serverCleanup = useServer(
      {
        schema,
        context: async (ctx) => {
          // WebSocket bağlantısında JWT doğrula
          // HTTP context'inden farklı olarak burada req yok,
          // token connectionParams üzerinden gelir
          try {
            const token = ctx.connectionParams?.authorization?.replace('Bearer ', '');
            if (token) {
              const decoded = jwt.verify(token, process.env.JWT_SECRET);
              const user = await models.User.findById(decoded.userId);
              return { ...models, user, currentUserId: user?._id ?? null };
            }
          } catch {
            // Geçersiz token — subscription bağlantısını kopar
            throw new Error('Geçersiz token.');
          }
          return { ...models };
        },
      },
      wsServer
    );

    // 7. Apollo Server — WebSocket kapatma plugin'i eklendi
    const server = new ApolloServer({
      schema,
      cache: 'bounded',
      introspection: true,
      plugins: [
        ApolloServerPluginDrainHttpServer({ httpServer }),
        // Apollo kapanırken WebSocket sunucusunu da temiz kapat
        {
          async serverWillStart() {
            return {
              async drainServer() {
                await serverCleanup.dispose();
              },
            };
          },
        },
      ],
      formatError,
    });

    await server.start();

    // 8. Apollo HTTP middleware — mevcut context yapın korundu
    app.use(
      '/',
      bodyParser.json({ limit: '50mb' }),
      expressMiddleware(server, {
        context: async ({ req }) => {
          const authHeader = req.headers.authorization;
          let user = null;

          if (authHeader && authHeader.startsWith('Bearer ')) {
            user = await authenticateUser(req, models.User);
          }

          return { ...models, user, req, currentUserId: user?._id ?? null, pubsub };
        },
      })
    );

    await new Promise((resolve) => httpServer.listen({ port: PORT }, resolve));
    console.log(`🚀 Server hazır: http://localhost:${PORT}`);
    console.log(`🔌 WebSocket hazır: ws://localhost:${PORT}/graphql`);

  } catch (e) {
    console.error('Server başlatılamadı:', e);
  }
};

startServer();