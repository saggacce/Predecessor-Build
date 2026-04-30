import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  base: { service: 'predecessor-api' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-admin-key"]',
      'req.headers["x-api-key"]',
      'res.headers["set-cookie"]',
      'tokenData.access_token',
      'tokenData.refresh_token',
      'tokenData.id_token',
    ],
    censor: '[REDACTED]',
  },
  ...(process.env.NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname,service' },
    },
  }),
});
