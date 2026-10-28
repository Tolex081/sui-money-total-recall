import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'tests/e2e',fullyParallel:false,retries:0,reporter:'list',use:{baseURL:process.env.BASE_URL??'http://localhost:3000',trace:'retain-on-failure'},webServer:process.env.BASE_URL?undefined:{command:'npm run dev',url:'http://localhost:3000',reuseExistingServer:true,timeout:90000}});
