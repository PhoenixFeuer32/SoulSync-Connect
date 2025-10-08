import winston from 'winston';
import { storage } from './storage.js';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'soulsync-connect' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ],
});

export class Logger {
  static async log(level: 'error' | 'warn' | 'info' | 'debug', service: string, message: any, metadata?: any, userId?: string) {
    // Log to Winston
    logger.log(level, message, { service, metadata, userId });
    
    // Also store in database for dashboard
    try {
      await storage.createErrorLog({
        level,
        service,
        message,
        stack: metadata?.stack,
        metadata: metadata ? JSON.stringify(metadata) : null,
        userId
      });
    } catch (error) {
      // Narrow unknown to Error or fallback to string to avoid TS18046
      let errMsg: string | undefined;
      if (error instanceof Error) {
        errMsg = error.message;
      } else if (typeof error === 'string') {
        errMsg = error;
      } else {
        try {
          errMsg = JSON.stringify(error);
        } catch (_) {
          errMsg = undefined;
        }
      }

      logger.error('Failed to store log in database', { error: errMsg });
    }
  }

  static async error(service: string, message: any, error?: Error, userId?: string) {
    await this.log('error', service, message, { 
      error: error?.message, 
      stack: error?.stack 
    }, userId);
  }

  static async warn(service: string, message: any, metadata?: any, userId?: string) {
    await this.log('warn', service, message, metadata, userId);
  }

  static async info(service: string, message: any, metadata?: any, userId?: string) {
    await this.log('info', service, message, metadata, userId);
  }

  static async debug(service: string, message: any, metadata?: any, userId?: string) {
    await this.log('debug', service, message, metadata, userId);
  }
}

export { logger };
