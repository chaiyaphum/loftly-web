import createMiddleware from 'next-intl/middleware';
import { routing } from './src/i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match all non-static, non-api paths.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
