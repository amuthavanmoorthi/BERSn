import type { AuthenticatedRequestState } from './auth.js';

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedRequestState;
      requestId?: string;
    }
  }
}

export {};
