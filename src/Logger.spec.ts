/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import Logger, { ContextKey, Level } from './Logger';

class TestLogger extends Logger {
    public removeUndefinedValuesRecursively(value: any): any {
        return super.removeUndefinedValuesRecursively(value);
    }
}

describe('Test Logger', () => {
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
        expect(Object.keys(logger.context).length).toBe(3);
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
        const logger = new Logger();

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
        const logger = new Logger();
        logger.info('hello, world!');

        function testFunc() {
            logger.info('testFunc 2');
        }

        testFunc();
    });

    test('Test lambda Logger', async () => {
        const logger = new Logger();
        logger.info('hello, world!');

        function testFunc() {
            logger.info('testFunc 2');
        }

        testFunc();
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

    test('Handles circular references', () => {
        const obj: any = { a: 1, b: 2 };
        obj.c = obj;

        const expected = { a: 1, b: 2, c: { $ref: '$' } };

        const result = logger.removeUndefinedValuesRecursively(obj);

        expect(result).toEqual(expected);
    });

    test('addResponseContext method adds response context without body', () => {
        logger.resetContext(); // Reset context to start fresh
        const mockResponse = {
            status: 200,
            headers: new Headers({
                'content-type': 'application/json',
                'x-custom-header': 'value',
            }),
        };

        logger.addResponseContext(mockResponse as any);

        const context = logger.context;
        expect(context[ContextKey.Http]).toBeDefined();
        expect(context[ContextKey.Http]?.response).toBeDefined();
        expect(context[ContextKey.Http]?.response?.statusCode).toBe(200);
        expect(context[ContextKey.Http]?.response?.headers).toBeDefined();
        expect(context[ContextKey.Http]?.response?.headers?.['content-type']).toBe('application/json');
        expect(context[ContextKey.Http]?.response?.headers?.['x-custom-header']).toBe('value');
        expect(context[ContextKey.Http]?.response?.body).toBeUndefined();
    });

    test('cloneAndAddResponseContext method adds response context with body', async () => {
        logger.resetContext(); // Reset context to start fresh
        const mockResponseBody = JSON.stringify({ message: 'Success', data: { id: 123 } });
        const mockResponse = {
            status: 201,
            headers: new Headers({
                'content-type': 'application/json',
            }),
            clone: async () => ({
                text: async () => mockResponseBody,
                status: 201,
                headers: new Headers({
                    'content-type': 'application/json',
                }),
            }),
        };

        await logger.cloneAndAddResponseContext(mockResponse as any);

        const context = logger.context;
        expect(context[ContextKey.Http]).toBeDefined();
        expect(context[ContextKey.Http]?.response).toBeDefined();
        expect(context[ContextKey.Http]?.response?.statusCode).toBe(201);
        expect(context[ContextKey.Http]?.response?.headers).toBeDefined();
        expect(context[ContextKey.Http]?.response?.headers?.['content-type']).toBe('application/json');
        expect(context[ContextKey.Http]?.response?.body).toEqual(JSON.parse(mockResponseBody));
    });

    test('cloneAndAddResponseContext handles non-JSON response body', async () => {
        logger.resetContext(); // Reset context to start fresh
        const mockResponseBody = 'Plain text response';
        const mockResponse = {
            status: 200,
            headers: new Headers({
                'content-type': 'text/plain',
            }),
            clone: async () => ({
                text: async () => mockResponseBody,
                status: 200,
                headers: new Headers({
                    'content-type': 'text/plain',
                }),
            }),
        };

        await logger.cloneAndAddResponseContext(mockResponse as any);

        const context = logger.context;
        expect(context[ContextKey.Http]).toBeDefined();
        expect(context[ContextKey.Http]?.response).toBeDefined();
        expect(context[ContextKey.Http]?.response?.body).toBe(mockResponseBody);
    });

    test('addResponseContext handles missing headers', () => {
        logger.resetContext(); // Reset context to start fresh
        const mockResponse = {
            status: 404,
        };

        logger.addResponseContext(mockResponse as any);

        const context = logger.context;
        expect(context[ContextKey.Http]).toBeDefined();
        expect(context[ContextKey.Http]?.response).toBeDefined();
        expect(context[ContextKey.Http]?.response?.statusCode).toBe(404);
        expect(context[ContextKey.Http]?.response?.headers).toEqual({});
    });

    test('cloneAndAddResponseContext handles error responses', async () => {
        logger.resetContext(); // Reset context to start fresh
        const mockErrorBody = JSON.stringify({ error: 'Internal Server Error' });
        const mockResponse = {
            status: 500,
            headers: new Headers({
                'content-type': 'application/json',
            }),
            clone: async () => ({
                text: async () => mockErrorBody,
                status: 500,
                headers: new Headers({
                    'content-type': 'application/json',
                }),
            }),
        };

        await logger.cloneAndAddResponseContext(mockResponse as any);

        const context = logger.context;
        expect(context[ContextKey.Http]).toBeDefined();
        expect(context[ContextKey.Http]?.response).toBeDefined();
        expect(context[ContextKey.Http]?.response?.statusCode).toBe(500);
        expect(context[ContextKey.Http]?.response?.body).toEqual(JSON.parse(mockErrorBody));
    });

    test('handles error in context object and adds to error and errorDetails', async () => {
        logger.resetContext();
        const testError = new Error('Test error in context');
        const contextWithError = {
            data: { someValue: 'test' },
            errorInstance: testError,
            message: 'Processing failed',
        };

        // Spy on the logFunc to capture what gets logged
        const logSpy = vi.spyOn(logger as any, 'logFunc') as any;

        logger.info(contextWithError);

        expect(logSpy).toHaveBeenCalledTimes(1);
        const loggedObject = logSpy.mock.calls[0][0][0] as any;

        expect(loggedObject[ContextKey.Error]).toBe('Test error in context');
        expect(loggedObject[ContextKey.ErrorDetails]).toBeDefined();
        expect(loggedObject[ContextKey.ErrorDetails]).toHaveLength(1);
        expect(loggedObject[ContextKey.ErrorDetails]?.[0]).toEqual(
            expect.objectContaining({
                name: 'Error',
                message: 'Test error in context',
                stack: expect.any(String),
            }),
        );
        expect(loggedObject[ContextKey.Context]).toEqual(
            expect.objectContaining({
                data: { someValue: 'test' },
                errorInstance: {}, // Error objects get serialized to empty objects
                message: 'Processing failed',
            }),
        );
    });

    test('handles multiple errors in context object', async () => {
        logger.resetContext();
        const error1 = new Error('First error');
        const error2 = new Error('Second error');
        const contextWithErrors = {
            firstError: error1,
            nested: {
                secondError: error2,
            },
            data: 'some data',
        };

        const logSpy = vi.spyOn(logger as any, 'logFunc') as any;

        logger.error(contextWithErrors);

        expect(logSpy).toHaveBeenCalledTimes(1);
        const loggedObject = logSpy.mock.calls[0][0][0] as any;

        // Note: The current implementation only checks top-level values, not nested objects
        expect(loggedObject[ContextKey.Error]).toBe('First error');
        expect(loggedObject[ContextKey.ErrorDetails]).toBeDefined();
        expect(loggedObject[ContextKey.ErrorDetails]).toHaveLength(1);
        expect(loggedObject[ContextKey.ErrorDetails]?.[0]).toEqual(
            expect.objectContaining({
                name: 'Error',
                message: 'First error',
            }),
        );
    });

    test('handles mix of error argument and error in context object', async () => {
        logger.resetContext();
        const directError = new Error('Direct error argument');
        const contextError = new Error('Error in context');
        const contextWithError = {
            errorInContext: contextError,
            data: 'test data',
        };

        const logSpy = vi.spyOn(logger as any, 'logFunc') as any;

        logger.warn(directError, contextWithError, 'Additional message');

        expect(logSpy).toHaveBeenCalledTimes(1);
        const loggedObject = logSpy.mock.calls[0][0][0] as any;

        expect(loggedObject[ContextKey.Error]).toBe('Direct error argument; Error in context');
        expect(loggedObject[ContextKey.ErrorDetails]).toBeDefined();
        expect(loggedObject[ContextKey.ErrorDetails]).toHaveLength(2);
        expect(loggedObject[ContextKey.Message]).toBe('Additional message');
    });
});
