/// <reference types="@cloudflare/workers-types" />
import { Env } from '../core/utils/config';

export type Bindings = Env & {
  MYFLIXI_CACHE?: KVNamespace;
};

export type Variables = {
  // Add any custom variables here
};
