// Vercel entry point. Expo builds the API routes and web pages into dist/server;
// this function serves them (static files in dist/client are served by Vercel directly).
const path = require('node:path');
const { createRequestHandler } = require('expo-server/adapter/vercel');

module.exports = createRequestHandler({
  build: path.join(__dirname, '../dist/server'),
});
