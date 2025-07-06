import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  metadata?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  request_id?: string;
  user_id?: string;
  session_id?: string;
  source: string;
}

class Logger {
  private source: string;
  private persistLogs: boolean;
  private logLevel: LogLevel;

  constructor(source: string = 'ContentPilot', persistLogs: boolean = true) {
    this.source = source;
    this.persistLogs = persistLogs;
    this.logLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
      fatal: 4
    };
    return levels[level] >= levels[this.logLevel];
  }

  private async createLogEntry(
    level: LogLevel,
    message: string,
    context?: string,
    metadata?: Record<string, any>,
    error?: Error,
    requestId?: string,
    userId?: string,
    sessionId?: string
  ): Promise<LogEntry> {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      metadata,
      request_id: requestId,
      user_id: userId,
      session_id: sessionId,
      source: this.source
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }

    return entry;
  }

  private async persistLog(entry: LogEntry): Promise<void> {
    if (!this.persistLogs) return;

    try {
      const logId = `log_${entry.level}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await prisma.setting.create({
        data: {
          key: logId,
          value: JSON.stringify(entry)
        }
      });
    } catch (persistError) {
      // Fallback to console if database persistence fails
      console.error('Failed to persist log:', persistError);
      console.log('Original log entry:', JSON.stringify(entry, null, 2));
    }
  }

  private outputToConsole(entry: LogEntry): void {
    const colorMap: Record<LogLevel, string> = {
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m',  // Green
      warn: '\x1b[33m',  // Yellow
      error: '\x1b[31m', // Red
      fatal: '\x1b[35m'  // Magenta
    };

    const reset = '\x1b[0m';
    const color = colorMap[entry.level] || '';

    if (process.env.NODE_ENV === 'production') {
      // JSON output for production
      console.log(JSON.stringify(entry));
    } else {
      // Human-readable output for development
      const contextStr = entry.context ? ` [${entry.context}]` : '';
      const metadataStr = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : '';
      
      console.log(
        `${color}[${entry.timestamp}] ${entry.level.toUpperCase()}${contextStr}: ${entry.message}${metadataStr}${reset}`
      );
      
      if (entry.error) {
        console.error(`${color}Error Details:`, entry.error, reset);
      }
    }
  }

  public async log(
    level: LogLevel,
    message: string,
    context?: string,
    metadata?: Record<string, any>,
    error?: Error,
    requestId?: string,
    userId?: string,
    sessionId?: string
  ): Promise<void> {
    if (!this.shouldLog(level)) return;

    const entry = await this.createLogEntry(
      level,
      message,
      context,
      metadata,
      error,
      requestId,
      userId,
      sessionId
    );

    this.outputToConsole(entry);
    await this.persistLog(entry);
  }

  public async debug(
    message: string,
    context?: string,
    metadata?: Record<string, any>,
    requestId?: string
  ): Promise<void> {
    await this.log('debug', message, context, metadata, undefined, requestId);
  }

  public async info(
    message: string,
    context?: string,
    metadata?: Record<string, any>,
    requestId?: string
  ): Promise<void> {
    await this.log('info', message, context, metadata, undefined, requestId);
  }

  public async warn(
    message: string,
    context?: string,
    metadata?: Record<string, any>,
    error?: Error,
    requestId?: string
  ): Promise<void> {
    await this.log('warn', message, context, metadata, error, requestId);
  }

  public async error(
    message: string,
    context?: string,
    metadata?: Record<string, any>,
    error?: Error,
    requestId?: string,
    userId?: string
  ): Promise<void> {
    await this.log('error', message, context, metadata, error, requestId, userId);
  }

  public async fatal(
    message: string,
    context?: string,
    metadata?: Record<string, any>,
    error?: Error,
    requestId?: string,
    userId?: string
  ): Promise<void> {
    await this.log('fatal', message, context, metadata, error, requestId, userId);
  }

  // Structured API request logging
  public async logRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    requestId?: string,
    userId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const level: LogLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    
    await this.log(
      level,
      `${method} ${url} - ${statusCode}`,
      'api_request',
      {
        method,
        url,
        status_code: statusCode,
        duration_ms: duration,
        ...metadata
      },
      undefined,
      requestId,
      userId
    );
  }

  // Business logic event logging
  public async logEvent(
    event: string,
    description: string,
    metadata?: Record<string, any>,
    requestId?: string,
    userId?: string
  ): Promise<void> {
    await this.log(
      'info',
      description,
      `event:${event}`,
      {
        event_type: event,
        ...metadata
      },
      undefined,
      requestId,
      userId
    );
  }

  // Performance monitoring
  public async logPerformance(
    operation: string,
    duration: number,
    metadata?: Record<string, any>,
    requestId?: string
  ): Promise<void> {
    const level: LogLevel = duration > 5000 ? 'warn' : 'debug';
    
    await this.log(
      level,
      `${operation} completed`,
      'performance',
      {
        operation,
        duration_ms: duration,
        ...metadata
      },
      undefined,
      requestId
    );
  }

  // Security event logging
  public async logSecurity(
    event: string,
    description: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    metadata?: Record<string, any>,
    requestId?: string,
    userId?: string
  ): Promise<void> {
    const level: LogLevel = severity === 'critical' ? 'fatal' : severity === 'high' ? 'error' : 'warn';
    
    await this.log(
      level,
      description,
      `security:${event}`,
      {
        security_event: event,
        severity,
        ...metadata
      },
      undefined,
      requestId,
      userId
    );
  }

  // Get recent logs with filtering
  public async getLogs(
    level?: LogLevel,
    context?: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<LogEntry[]> {
    try {
      const logSettings = await prisma.setting.findMany({
        where: {
          key: {
            startsWith: 'log_'
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit + offset,
        skip: offset
      });

      let logs = logSettings.map(setting => {
        try {
          return JSON.parse(setting.value) as LogEntry;
        } catch {
          return null;
        }
      }).filter(Boolean) as LogEntry[];

      // Apply filters
      if (level) {
        logs = logs.filter(log => log.level === level);
      }
      if (context) {
        logs = logs.filter(log => log.context?.includes(context));
      }

      return logs.slice(0, limit);
    } catch (error) {
      console.error('Failed to retrieve logs:', error);
      return [];
    }
  }

  // Clean up old logs (retention policy)
  public async cleanupLogs(retentionDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const oldLogs = await prisma.setting.findMany({
        where: {
          key: {
            startsWith: 'log_'
          },
          createdAt: {
            lt: cutoffDate
          }
        }
      });

      if (oldLogs.length > 0) {
        await prisma.setting.deleteMany({
          where: {
            key: {
              in: oldLogs.map(log => log.key)
            }
          }
        });

        await this.info(
          `Cleaned up ${oldLogs.length} old log entries`,
          'log_cleanup',
          { retention_days: retentionDays, deleted_count: oldLogs.length }
        );
      }

      return oldLogs.length;
    } catch (error) {
      await this.error('Failed to cleanup old logs', 'log_cleanup', {}, error as Error);
      return 0;
    }
  }
}

// Create default logger instance
export const logger = new Logger();

// Export factory function for custom loggers
export function createLogger(source: string, persistLogs: boolean = true): Logger {
  return new Logger(source, persistLogs);
}

// Middleware helper for request ID generation
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Express-style middleware for automatic request logging
export function requestLoggingMiddleware(req: any, res: any, next: any) {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  // Add request ID to request object
  req.requestId = requestId;
  
  // Log request start
  logger.debug(
    `Incoming ${req.method} ${req.url}`,
    'request_start',
    {
      method: req.method,
      url: req.url,
      user_agent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress
    },
    requestId
  );

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(...args: any[]) {
    const duration = Date.now() - startTime;
    
    logger.logRequest(
      req.method,
      req.url,
      res.statusCode,
      duration,
      requestId,
      req.userId // Assuming userId is set by auth middleware
    );
    
    originalEnd.apply(res, args);
  };

  next();
} 