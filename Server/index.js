// GraphQL Libraries && TypeDefs && Resolvers
import GraphQLJSON from "graphql-type-json";
import { loadFilesSync } from "@graphql-tools/load-files";
import { mergeResolvers, mergeTypeDefs } from "@graphql-tools/merge";
import { makeExecutableSchema } from "@graphql-tools/schema";
// Apollo Libraries
import { ApolloServer } from "@apollo/server";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { expressMiddleware } from "@apollo/server/express4";
import { MemcachedCache } from "apollo-server-cache-memcached";

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';

import http from 'http';

import * as dotenv from "dotenv";

import { join } from "path";

import bodyParser from "body-parser";

import resolvers from "./src/GraphQL/Resolvers/index.js";

// Start DotENV
dotenv.config({
  path: process.env.NODE_ENV === "production" ? ".env.prod" : ".env",
});

const secret = process.env.JWT_SECRET;

import jwt from 'jsonwebtoken';
import models from "./src/models/index.js";

const startServer = async () => {
    try{
        const app = express();

        app.use(express.json());
        
        /// CORS middleware'ini ekleyin
        app.use(cors({
            origin: 'http://localhost:3000', // React uygulamanızın URL'sini buraya yazın
            methods: ['GET', 'POST', 'PUT', 'DELETE'], // İzin vermek istediğiniz HTTP metodları
            credentials: true, // Eğer cookie ya da authorization bilgisi gönderiyorsanız
        }));
        
        /*app.use(cors({
          origin: 'https://quoridor-game.vercel.app', // React uygulamanızın URL'sini buraya yazın
          methods: ['GET', 'POST', 'PUT', 'DELETE'], // İzin vermek istediğiniz HTTP metodları
          credentials: true, // Eğer cookie ya da authorization bilgisi gönderiyorsanız
      }));*/
        const PORT = 5000;
        
        
        mongoose.connect(process.env.MONGO_URI
        ).then(() => {
            console.log('MongoDB connection successful');
            
        }).catch(err => {
            console.log('MongoDB connection failed', err);
        }); 
        
        
            // Create the GraphQL schema using the type definitions and resolvers
        const schema = makeExecutableSchema({
          typeDefs: mergeTypeDefs(
            loadFilesSync(join("./src/GraphQL/**/**/**/*.graphql"), "utf8")
          ), // Read and Merge TypeDefs
          resolvers: {
            ...mergeResolvers(resolvers), // Merge Resolvers
            JSON: GraphQLJSON, // Import Scalar JSON Schema
          },
        });
        
        
        // Create an HTTP server using the Express app
        const httpServer = http.createServer(app);

        // Create an Apollo Server instance with the schema and an HTTP server plugin
        const server = new ApolloServer({
          schema, 
          cacheControl: { defaultMaxAge: 5 },
          // plugins: [LogMiddleware, ApolloServerPluginDrainHttpServer({ httpServer })],
          plugins: [ApolloServerPluginDrainHttpServer({ httpServer })]
        });
        
        //app.use('/api/auth', require('./src/routes/auth'));
        await server.start();



        // Set up middleware for handling requests
        app.use(
          "/",
          //cors(corsOptions),
          bodyParser.json({ limit: "50mb" }),
            expressMiddleware(server, {
              context: async ({ req }) => {
                const authHeader = req.headers.authorization;
                let user = null;

                if (authHeader && authHeader.startsWith("Bearer ")) {
                  const token = authHeader.replace("Bearer ", "");
                  try {
                    const decoded = jwt.verify(token, secret);
                    user = await models.User.findById(decoded.id).select("-password");
                  } catch (error) {
                    console.log("Authentication error:", error.message); // sadece mesaj
                  }
                }

                return { ...models, user, req };
              },
          })
        )

      // Start the HTTP server and listen on the specified port
      await new Promise((resolve) => httpServer.listen({ port: PORT }, resolve));
    }catch(e){
        console.log('Error starting server: ',e);
    }
}

startServer();
