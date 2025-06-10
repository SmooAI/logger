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

export function isBuild() {
    return Boolean(process.env.GITHUB_ACTIONS || process.env.SEED_SERVICE_FULLPATH);
}

export function isGithubActions() {
    return Boolean(process.env.GITHUB_ACTIONS);
}

export function isLocal(stage = process.env.SST_STAGE ?? '') {
    return getEnvironment(stage) === 'local';
}

export function isDevelopment(stage = process.env.SST_STAGE ?? 'local') {
    return getEnvironment(stage) === 'development';
}

export function isStaging(stage = process.env.SST_STAGE ?? 'local') {
    return getEnvironment(stage) === 'staging';
}

export function isProduction(stage = process.env.SST_STAGE ?? 'local') {
    return getEnvironment(stage) === 'production';
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
