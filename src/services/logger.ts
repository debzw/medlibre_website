import { supabase } from '@/integrations/supabase/client';

type LogLevel = 'info' | 'warn' | 'error';

interface LogContext {
    [key: string]: any;
}

class Logger {
    private static async log(
        level: LogLevel,
        message: string,
        context?: LogContext,
        targetId?: string
    ) {
        // Console output for development
        if (process.env.NODE_ENV === 'development') {
            console[level](`[${level.toUpperCase()}] ${message}`, context);
        }

        try {
            // Get current user if possible
            const { data: { session } } = await supabase.auth.getSession();
            const userId = session?.user?.id;

            const { error } = await supabase.from('reports').insert({
                type: 'system_log',
                category: level,
                description: message,
                target_id: targetId || 'system',
                user_id: userId,
                metadata: context || {},
                status: 'open'
            });

            if (error) {
                console.error('Failed to send log to Supabase:', error);
            }
        } catch (err) {
            console.error('Logger failed critically:', err);
        }
    }

    static async info(message: string, context?: LogContext) {
        await this.log('info', message, context);
    }

    static async warn(message: string, context?: LogContext) {
        await this.log('warn', message, context);
    }

    static async error(error: Error | string, context?: LogContext, targetId?: string) {
        const message = error instanceof Error ? error.message : error;
        const errorContext = error instanceof Error ? {
            stack: error.stack,
            name: error.name,
            ...context
        } : context;

        await this.log('error', message, errorContext, targetId);
    }
}

export const logger = Logger;
