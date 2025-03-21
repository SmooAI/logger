/* eslint-disable @typescript-eslint/no-explicit-any */
import merge from 'lodash.merge';
import BrowserDetector from 'browser-dtector';

import Logger, {
    ContextConfig as BaseContextConfig,
    ContextKeyConfig as BaseContextKeyConfig,
    CONFIG_MINIMAL as BASE_CONFIG_MINIMAL,
    Level,
    Context as BaseContext,
    CONTEXT as BASE_CONTEXT,
    ContextKey as BaseContextKey,
    global,
} from './Logger';

export * from './Logger';

export enum BrowserContextKey {
    CallerContext = 'callerContext',
    BrowserContext = 'browserContext',
}

type ContextKey = BrowserContextKey | BaseContextKey;
const ContextKey = { ...BrowserContextKey, ...BaseContextKey } as const;

export enum ContextKeyCaller {
    LoggerName = 'loggerName',
}

// https://www.npmjs.com/package/browser-dtector
export enum ContextKeyBrowser {
    Name = 'name',
    Platform = 'platform',
    UserAgent = 'userAgent',
    Version = 'version',
    ShortVersion = 'shortVersion',
    IsAndroid = 'isAndroid',
    IsTablet = 'isTablet',
    IsMobile = 'isMobile',
    IsDesktop = 'isDesktop',
    IsWebkit = 'isWebkit',
    IsIE = 'isIE',
}

export let CONTEXT = merge({}, BASE_CONTEXT);

type ContextKeys = ContextKeyCaller | ContextKeyBrowser | string;

type ContextKeyConfig = BaseContextKeyConfig<ContextKeyCaller[] | ContextKeyBrowser[] | Partial<{ [key in ContextKeys]: ContextKeyConfig }> | boolean>;

export type ContextConfig = BaseContextConfig<ContextKey, ContextKeyConfig>;

export const CONFIG_MINIMAL: ContextConfig = merge(
    {
        [ContextKey.BrowserContext]: true,
    },
    BASE_CONFIG_MINIMAL,
);

export const CONFIG_FULL: ContextConfig = null;

const FULL_CONFIG_MINIMAL = merge(CONFIG_MINIMAL, BASE_CONFIG_MINIMAL);

const CONFIG_SETTINGS: Record<string, ContextConfig> = {
    DEFAULT: FULL_CONFIG_MINIMAL,
    MINIMAL: FULL_CONFIG_MINIMAL,
    FULL: CONFIG_FULL,
};

export type Context = BaseContext<{
    [ContextKey.CallerContext]?: Partial<Record<ContextKeyCaller | string, any>>;
    [ContextKey.BrowserContext]?: Partial<Record<ContextKeyBrowser | string, any>>;
}>;

export default class BrowserLogger extends Logger {
    private _browserName = 'BrowserLogger';
    private _browserContextConfig!: ContextConfig;
    private _browserConfigSettings: Record<string, ContextConfig> = CONFIG_SETTINGS;
    private browserDetector: any;

    public get context(): Context {
        return CONTEXT;
    }

    public set context(context: Context) {
        CONTEXT = context;
    }

    public get name(): string {
        return this._browserName;
    }

    public set name(name: string) {
        this._browserName = name;
    }

    public get contextConfig(): ContextConfig {
        return this._browserContextConfig;
    }

    public set contextConfig(contextConfig: ContextConfig) {
        this._browserContextConfig = contextConfig;
    }

    public get configSettings(): Record<string, ContextConfig> {
        return this._browserConfigSettings;
    }

    public set configSettings(configSettings: Record<string, ContextConfig>) {
        this._browserConfigSettings = configSettings;
    }

    constructor(options?: { name?: string; context?: Context; level?: Level; contextConfig?: ContextConfig; prettyPrint?: boolean }) {
        super(options);

        if (typeof global.window !== 'undefined') {
            this.browserDetector = new BrowserDetector(global.window?.navigator?.userAgent);
        }
    }

    private addCallerContext() {
        this.addBaseContext({
            [ContextKey.CallerContext]: {
                [ContextKeyCaller.LoggerName]: this.name,
            },
        });
    }

    private addBrowserContext() {
        if (this.browserDetector) {
            const browserInfo = this.browserDetector.parseUserAgent();
            this.addBaseContext({
                [ContextKey.BrowserContext]: {
                    [ContextKeyBrowser.Name]: browserInfo.name,
                    [ContextKeyBrowser.Platform]: browserInfo.platform,
                    [ContextKeyBrowser.UserAgent]: browserInfo.userAgent,
                    [ContextKeyBrowser.Version]: browserInfo.version || undefined,
                    [ContextKeyBrowser.ShortVersion]: browserInfo.shortVersion || undefined,
                    [ContextKeyBrowser.IsAndroid]: browserInfo.isAndroid,
                    [ContextKeyBrowser.IsTablet]: browserInfo.isTablet,
                    [ContextKeyBrowser.IsMobile]: browserInfo.isMobile,
                    [ContextKeyBrowser.IsDesktop]: browserInfo.isDesktop,
                    [ContextKeyBrowser.IsWebkit]: browserInfo.isWebkit,
                    [ContextKeyBrowser.IsIE]: browserInfo.isIE,
                },
            });
        }
    }

    protected buildLogObject(level: Level, args: any[]): any {
        return merge(merge(super.buildLogObject(level, args), this.addCallerContext()), this.addBrowserContext());
    }
}
