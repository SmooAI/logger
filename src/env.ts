import { isRunningLocally } from '@smooai/utils/env/index';

export enum Level {
    Trace = 'trace',
    Debug = 'debug',
    Info = 'info',
    Warn = 'warn',
    Error = 'error',
    Fatal = 'fatal',
}

export const MAIN_ENVIRONMENTS = ['development', 'staging', 'production'];

export function getEnvironment(stage = process.env.SST_STAGE ?? 'local'): string {
    if (process.env.IS_LOCAL || process.env.SST_DEV || (Boolean(process.env.IS_DEPLOYED_STAGE) && process.env.IS_DEPLOYED_STAGE !== 'true')) {
        return 'local';
    } else {
        return stage;
    }
}

export function isLocal() {
    return isRunningLocally();
}

export function isBuild() {
    return Boolean(process.env.GITHUB_ACTIONS);
}

function levelToCode(level: Level): number {
    switch (level) {
        case Level.Trace:
            return 10;
        case Level.Debug:
            return 20;
        case Level.Info:
            return 30;
        case Level.Warn:
            return 40;
        case Level.Error:
            return 50;
        case Level.Fatal:
            return 60;
        default:
            return Number.POSITIVE_INFINITY;
    }
}

export function isLogLevelEnabled(limit: Level): boolean {
    return levelToCode(limit) >= levelToCode((process.env.LOG_LEVEL as Level) ?? Level.Info);
}
