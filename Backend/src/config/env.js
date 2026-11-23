'use strict';

const path = require('path');
const { z } = require('zod');

require('dotenv').config({ path: path.join(__dirname, '../../.env'), quiet: true });

const LLM_PLACEHOLDERS = new Set(['', 'YOUR_MODEL_NAME', 'YOUR_API_KEY']);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.string().default('info'),
  APP_TIMEZONE: z.string().default('Africa/Tunis'),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:8081'),
  UPLOAD_DIR: z.string().default('uploads'),

  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_NAME: z.string().default('sesame_news'),
  DB_NAME_TEST: z.string().default('sesame_news_test'),
  DB_USER: z.string().default('root'),
  DB_PASSWORD: z.string().default(''),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('12h'),

  LLM_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  LLM_MODEL: z.string().default('YOUR_MODEL_NAME'),
  LLM_API_KEY: z.string().default('YOUR_API_KEY'),

  EXPO_ACCESS_TOKEN: z.string().default(''),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
  console.error(`Invalid environment configuration (see Backend/.env.example):\n${issues}`);
  process.exit(1);
}

const env = parsed.data;

const uploadDir = path.isAbsolute(env.UPLOAD_DIR)
  ? env.UPLOAD_DIR
  : path.join(__dirname, '../..', env.UPLOAD_DIR);

module.exports = {
  ...env,
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  corsOrigins: env.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
  uploadDir,
  publicUploadDir: path.join(uploadDir, 'public'),
  privateUploadDir: path.join(uploadDir, 'private'),
  llmConfigured: !LLM_PLACEHOLDERS.has(env.LLM_MODEL) && !LLM_PLACEHOLDERS.has(env.LLM_API_KEY),
};
