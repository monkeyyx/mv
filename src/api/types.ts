/// <reference types="@cloudflare/workers-types" />
import { Env } from '../core/utils/config';

export type Bindings = Env & {
  MYFLIXI_CACHE?: KVNamespace;
};

import { ICacheService } from '../core/services/CacheService';

export type Variables = {
  cache: ICacheService;
};
