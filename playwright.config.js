import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir:     './scripts',
  testMatch:   '**/*.spec.js',
  timeout:     30000,
  retries:     0,
  reporter:    [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],

  use: {
    headless:        true,
    baseURL:         'http://localhost:4173',
    screenshot:      'only-on-failure',
    video:           'off',
  },

  // Run demo preview server before tests
  webServer: {
    command:  'npm run build:demo && npx vite preview --config vite.demo.config.js --port 4173',
    url:      'http://localhost:4173/trace-scope/',
    timeout:  60000,
    reuseExistingServer: !process.env.CI,
  },

  projects: [
    {
      name: 'chromium',
      use:  { ...devices['Desktop Chrome'] },
    },
  ],
})
