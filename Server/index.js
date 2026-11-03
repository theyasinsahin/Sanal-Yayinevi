import './src/config/environment.js';
// Temel Kütüphaneler
import http from 'http';
import express from 'express';
import cors from 'cors';
import { expressMiddleware } from '@as-integrations/express4';
import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/use/ws';
import { pubsub } from './src/config/pubsub.js';
import { configureHttpSecurity, allowedOrigins as getAllowedOrigins, requestShield, httpError, websocketAddress } from './src/security/httpSecurity.js';
import { graphqlSecurityPlugin, queryBudgetRule } from './src/security/graphqlSecurity.js';
import { websocketOptions } from './src/security/websocketSecurity.js';
import SecurityRateBucket from './src/models/securityRateBucket.js';

// Bizim Oluşturduğumuz Modüller
import connectDB from './src/config/db.js';
import schema from './src/graphql/schema.js';
import models from './src/models/index.js';
import { authenticateUser } from './src/utils/auth.js';
import formatError from './src/utils/formatError.js';
import paymentRoutes from './src/routes/paymentRoutes.js';
import googleAuthRoutes from './src/routes/googleAuthRoutes.js';
import socialShareRoutes from './src/routes/socialShareRoutes.js';
import { compressResponses, operationTiming } from './src/config/httpPerformance.js';
import { createLoaders } from './src/graphql/loaders.js';
import printRoutes from './src/routes/printRoutes.js';
import { initializePrintFunding } from './src/services/print/common.js';
import { startPrintWorker } from './src/services/print/worker.js';
import { printSystemEnabled } from './src/services/print/paymentConfig.js';

const PORT = process.env.PORT || 5000;

// 2. PubSub instance — tüm uygulama bu tek instance'ı kullanır
// Dosya seviyesinde export ediyoruz ki servis ve resolver'lar import edebilsin
export { pubsub };

// 3. Sunucuyu Başlatma Fonksiyonu
const startServer = async () => {
  try {
    const app = express();
    if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || Buffer.byteLength(process.env.JWT_SECRET) < 32 || !process.env.CLIENT_URL)) throw new Error('Üretim oturum/origin yapılandırması eksik.');
    configureHttpSecurity(app);
    app.use(requestShield());
    app.use(compressResponses());

    await connectDB();
    await SecurityRateBucket.createIndexes();
    if (printSystemEnabled()) {
      await initializePrintFunding();
      await models.Notification.createIndexes();
    }

    // CORS: web (localhost:3000), prod frontend (CLIENT_URL) ve mobil
    // uygulamanın (Capacitor) kullandığı origin'lere izin ver.
    // Capacitor'ın androidScheme:'http' ayarıyla uygulamanın origin'i
    // "http://localhost" (port'suz) oluyor — varsayılan https şemasında ise
    // "https://localhost" veya "capacitor://localhost" olabiliyor. Hangi
    // ayarla test edersen et diye üçünü de baştan ekliyoruz.
    const allowedOrigins = getAllowedOrigins();

    app.use(cors({
      origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)),
      credentials: true,
      maxAge: 600,
      exposedHeaders: ['Server-Timing'],
    }));

    // Verify webhook bytes and receive private PDF uploads before JSON parsing.
    app.use('/api/print', printRoutes);
    app.use(express.json({ limit: '2mb', inflate: false }));
    app.use(express.urlencoded({ extended: false, limit: '16kb', parameterLimit: 20, inflate: false }));
    app.use('/api/payment', paymentRoutes);
    app.use('/share', socialShareRoutes);

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
      maxPayload: 65536,
      perMessageDeflate: false,
      verifyClient: info => {
        info.req.ip = websocketAddress(app, info.req);
        return (!info.origin || allowedOrigins.has(info.origin)) && [...wsServer.clients].filter(client => client.betikIp === info.req.ip).length < 20;
      },
    });
    wsServer.on('connection', (socket, req) => { socket.betikIp = req.ip || req.socket.remoteAddress; });

    // 6. graphql-ws'i schema'ya bağla
    // useServer'ın döndürdüğü serverCleanup, Apollo kapanırken WS'i de temiz kapatır
    const serverCleanup = useServer(
      websocketOptions(schema, models),
      wsServer
    );

    // 7. Apollo Server — WebSocket kapatma plugin'i eklendi
    const server = new ApolloServer({
      schema,
      cache: 'bounded',
      introspection: process.env.NODE_ENV !== 'production',
      csrfPrevention: true,
      allowBatchedHttpRequests: false,
      includeStacktraceInErrorResponses: false,
      hideSchemaDetailsFromClientErrors: process.env.NODE_ENV === 'production',
      parseOptions: { maxTokens: 10000 },
      validationRules: [queryBudgetRule],
      plugins: [
        graphqlSecurityPlugin,
        operationTiming,
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
      expressMiddleware(server, {
        context: async ({ req }) => {
          const authHeader = req.headers.authorization;
          let user = null;

          if (authHeader && authHeader.startsWith('Bearer ')) {
            user = await authenticateUser(req, models.User);
          }

          return { ...models, user, req, currentUserId: user?._id ?? null, pubsub, loaders: createLoaders() };
        },
      })
    );
    app.use(httpError);
    httpServer.requestTimeout = 30000;
    httpServer.headersTimeout = 15000;
    httpServer.keepAliveTimeout = 5000;
    httpServer.maxRequestsPerSocket = 1000;

    await new Promise((resolve) => httpServer.listen({ port: PORT, ...(process.env.BETIK_ISOLATED_PRINT_SANDBOX === 'true' ? { host: '127.0.0.1' } : {}) }, resolve));
    // Application notifications also need delivery when funding is disabled.
    // Maintenance only touches money/provider state if sandboxEnabled() is true.
    startPrintWorker();
    console.log(`🚀 Server hazır: http://localhost:${PORT}`);
    console.log(`🔌 WebSocket hazır: ws://localhost:${PORT}/graphql`);

  } catch (e) {
    console.error('Server başlatılamadı. Yapılandırma ve servis erişimini kontrol edin.');
    process.exitCode = 1;
  }
};

startServer();
