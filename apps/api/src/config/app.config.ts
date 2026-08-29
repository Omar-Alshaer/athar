export type AthrAppConfig = {
  port: number;
  webOrigin: string;
  adminOrigin: string;
  apiOrigin: string;
  cookieDomain: string;
};

export function appConfig(): AthrAppConfig {
  return {
    port: Number(process.env.PORT ?? 4000),
    webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    adminOrigin: process.env.ADMIN_ORIGIN ?? 'http://localhost:3001',
    apiOrigin: process.env.API_ORIGIN ?? 'http://localhost:4000',
    cookieDomain: process.env.COOKIE_DOMAIN ?? '',
  };
}
