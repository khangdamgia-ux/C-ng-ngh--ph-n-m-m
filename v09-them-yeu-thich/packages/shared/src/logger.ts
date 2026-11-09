type Level = 'info' | 'warn' | 'error';

export function createLogger(service: string) {
  const write = (level: Level, msg: string, extra: Record<string, unknown> = {}) => {
    if (process.env.LOG_SILENT === '1') return;
    const line = JSON.stringify({ time: new Date().toISOString(), level, service, msg, ...extra });
    (level === 'error' ? console.error : console.log)(line);
  };
  return {
    info: (msg: string, extra?: Record<string, unknown>) => write('info', msg, extra),
    warn: (msg: string, extra?: Record<string, unknown>) => write('warn', msg, extra),
    error: (msg: string, extra?: Record<string, unknown>) => write('error', msg, extra),
  };
}
export type Logger = ReturnType<typeof createLogger>;
