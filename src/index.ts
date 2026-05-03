import dotenv from 'dotenv';
dotenv.config();

import app from './api/index';
import { validateEnv } from './core/utils/config';

// Validate local environment
validateEnv(process.env);

console.log('🚀 MyFlixi Hono API live at http://localhost:3000');

export default {
  port: 3000,
  fetch: app.fetch,
};
