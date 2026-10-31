const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: { timeout: 10000 },
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3100',
    channel: process.platform === 'win32' ? 'msedge' : undefined,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: 'node node_modules/react-scripts/scripts/start.js',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: false,
    timeout: 180000,
    env: {
      BROWSER: 'none',
      HOST: '127.0.0.1',
      PORT: '3100',
      REACT_APP_API_URL: 'http://127.0.0.1:5001',
      REACT_APP_WS_URL: 'ws://127.0.0.1:5001/graphql',
    },
  },
});
