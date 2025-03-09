/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import BrowserLogger, { ContextKey, Level } from './BrowserLogger';

class TestLogger extends BrowserLogger {
    public removeUndefinedValuesRecursively(value: any): any {
        return super.removeUndefinedValuesRecursively(value);
    }
}

describe('Test Browser Logger', () => {
    let logger: TestLogger;

    beforeEach(() => {
        const options = {
            context: {},
            level: Level.Info,
        };
        logger = new TestLogger(options);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    test('Test general Logger', async () => {
        logger.info('hello, world!');
    });

    test('context method returns current context', async () => {
        expect(Object.keys(logger.context).length).toBe(4);
        expect(logger.correlationId()).toBeDefined();
    });

    test('contextKey method returns value for given key', async () => {
        logger.addBaseContext({
            key1: 'value1',
            key2: 'value2',
        });
        expect(logger.baseContextKey('key1')).toEqual('value1');
        expect(logger.baseContextKey('key2')).toEqual('value2');
        expect(logger.baseContextKey('key3')).toBeUndefined();
    });

    test('addContextKey method adds given key-value to context', async () => {
        logger.addBaseContextKey('key1', 'value1');
        expect(logger.baseContextKey('key1')).toEqual('value1');
    });

    test('addContext method adds given object to context', async () => {
        logger.addBaseContext({
            key1: 'value1',
            key2: 'value2',
        });
        expect(logger.context).toEqual(
            expect.objectContaining({
                key1: 'value1',
                key2: 'value2',
            }),
        );
    });

    test('correlationId method returns correlationId from context', async () => {
        logger.addBaseContextKey(ContextKey.CorrelationId, 'uuid-123');
        expect(logger.correlationId()).toEqual('uuid-123');
    });

    test('setCorrelationId method sets given correlationId in context', async () => {
        logger.setCorrelationId('uuid-123');
        expect(logger.correlationId()).toEqual('uuid-123');
    });

    test('Test general Logger in class', async () => {
        class TestClass {
            private test = 'hello, world';
            testFunc() {
                logger.info('testFunc 1: %s', this.test);
            }
        }

        const testClass = new TestClass();
        testClass.testFunc();
    });

    test('Test general Logger in function', async () => {
        logger.info('hello, world!');

        function testFunc() {
            logger.info('testFunc 2');
        }

        testFunc();
    });

    test('Test lambda Logger', async () => {
        logger.info('hello, world!');

        function testFunc() {
            logger.info('testFunc 2');
        }

        testFunc();
    });

    test('Test lambda Logger with context and minimal context config', async () => {
        process.env.LOGGER_CONTEXT_CONFIG = 'MINIMAL';

        logger.info('Browser Logging 2');
    });

    test('removes undefined values from an array recursively', () => {
        const obj = [1, undefined, { a: undefined, b: 2 }];
        const expected = [1, undefined, { b: 2 }];

        const result = logger.removeUndefinedValuesRecursively(obj);

        expect(result).toEqual(expected);
    });

    test('removes undefined values from an object recursively', () => {
        const obj = {
            a: 1,
            b: undefined,
            c: { d: undefined, e: 2 },
        };
        const expected = {
            a: 1,
            c: { e: 2 },
        };

        const result = logger.removeUndefinedValuesRecursively(obj);

        expect(result).toEqual(expected);
    });

    test('returns the same value if it is not an array or an object', () => {
        const values = [null, 123, 'hello', true];

        values.forEach((value) => {
            expect(logger.removeUndefinedValuesRecursively(value)).toBe(value);
        });
    });
});
