import { Hono } from 'hono';
import type { Bindings, Variables } from '../types';
import { FebBoxService } from '../../core/services/FebBoxService';

const febbox = new Hono<{ Bindings: Bindings, Variables: Variables }>();
const service = new FebBoxService();

febbox.use('*', async (c, next) => {
  const redis = (c as any).get('redis');
  (service as any).redis = redis;
  (service as any).env = c.env;
  service.uiCookie = c.env.FEBBOX_UI_COOKIE;
  await next();
});

febbox.get('/folder/:id?', async (c) => {
  const folderId = c.req.param('id') || '0';
  const shareKey = c.req.query('share_key');
  
  const files = await service.getFileList(shareKey || '', folderId);
  return c.json(files);
});

febbox.get('/console/search', async (c) => {
  const q = c.req.query('q') || '';
  const files = await service.searchConsole(q);
  return c.json(files);
});

febbox.get('/watch/:fid', async (c) => {
  const fid = c.req.param('fid');
  const links = await service.getLinks(fid);
  return c.json(links);
});

export default febbox;
