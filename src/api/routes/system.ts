import { Hono } from 'hono';
import type { Bindings, Variables } from '../types';

const system = new Hono<{ Bindings: Bindings, Variables: Variables }>();

system.get('/status', (c) => {
  return c.json({
    status: 'online',
    version: '2.2.0',
    platform: 'Cloudflare Worker',
    runtime: 'Hono',
    timestamp: new Date().toISOString()
  });
});

system.get('/set-cookie', (c) => {
  const cookie = c.req.query('cookie');
  if (!cookie) return c.json({ error: 'Cookie required' }, 400);
  
  // Note: In Workers, we usually set this in Wrangler, 
  // but we can acknowledge it here.
  return c.json({ 
    message: 'Cookie received (Update FEBBOX_UI_COOKIE in Wrangler to persist)',
    preview: cookie.substring(0, 20) + '...'
  });
});

export default system;
