<!-- Improved compatibility of back to top link: See: https://github.com/othneildrew/Best-README-Template/pull/73 -->

<a name="readme-top"></a>

<!--
*** Thanks for checking out the Best-README-Template. If you have a suggestion
*** that would make this better, please fork the repo and create a pull request
*** or simply open an issue with the tag "enhancement".
*** Don't forget to give the project a star!
*** Thanks again! Now go create something AMAZING! :D
-->

<!-- PROJECT SHIELDS -->
<!--
*** I'm using markdown "reference style" links for readability.
*** Reference links are enclosed in brackets [ ] instead of parentheses ( ).
*** See the bottom of this document for the declaration of the reference variables
*** for contributors-url, forks-url, etc. This is an optional, concise syntax you may use.
*** https://www.markdownguide.org/basic-syntax/#reference-style-links
-->

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://smoo.ai">
    <img src="images/logo.png" alt="SmooAI Logo" />
  </a>
</div>

<!-- ABOUT THE PROJECT -->

## About SmooAI

SmooAI is an AI-powered platform for helping businesses multiply their customer, employee, and developer experience.

Learn more on [smoo.ai](https://smoo.ai)

## SmooAI Packages

Check out other SmooAI packages at [npmjs.com/org/smooai](https://www.npmjs.com/org/smooai)

## About @smooai/logger

A powerful contextual logging system designed for AWS Lambda and Browser environments, with built-in support for structured logging, correlation tracking, and automatic context gathering.

### Key Features

- 📋 Structured JSON logging with configurable levels
- 🔄 Automatic context tracking across distributed systems
- ☁️ AWS Lambda and CloudWatch integration
- 🌐 Browser environment support
- 🔍 Advanced error tracking with stack traces

![NPM Version](https://img.shields.io/npm/v/%40smooai%2Flogger?style=for-the-badge)
![NPM Downloads](https://img.shields.io/npm/dw/%40smooai%2Flogger?style=for-the-badge)
![NPM Last Update](https://img.shields.io/npm/last-update/%40smooai%2Flogger?style=for-the-badge)

![GitHub License](https://img.shields.io/github/license/SmooAI/logger?style=for-the-badge)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/SmooAI/logger/release.yml?style=for-the-badge)
![GitHub Repo stars](https://img.shields.io/github/stars/SmooAI/logger?style=for-the-badge)

### Install

```sh
pnpm add @smooai/logger
```

### Features

#### Core Logger

- Structured JSON logging with consistent formatting
- Correlation ID tracking across distributed systems
- Configurable log levels (TRACE, DEBUG, INFO, WARN, ERROR, FATAL)
- Context preservation across asynchronous operations
- Pretty printing support for local development
- Telemetry fields support (requestId, duration, traceId, etc.)
- Circular reference handling in JSON serialization
- Advanced error tracking
    - Automatic error serialization
    - Full stack trace preservation
    - Multi-error aggregation
    - Error context capture
    - Source map support for accurate stack traces

#### AWS Server Logger

- Automatic AWS Lambda context extraction
- SQS message context tracking
- EventBridge context support
- API Gateway request/response context
- Lambda execution environment details
- Cross-service correlation ID propagation
- CloudWatch optimized output format
- Automatic call stack tracking
    - Captures exact file and line numbers in Lambda functions
    - Records full execution path through Lambda handlers
    - Preserves method and class names in serverless context
    - Real-time stack trace collection with source map support
    - Helps debug complex serverless workflows
    - Maintains stack context across async boundaries

#### Browser Logger

- Automatic browser context detection
- User agent parsing
- Platform detection
- Device type identification (mobile/tablet/desktop)
- Browser capabilities detection
- Cross-origin request support
- Console-friendly output formatting

### Context Sources

The logger automatically collects context from various sources:

- HTTP Headers
- AWS Lambda Context
- SQS Message Attributes
- Browser Information
- User Context
- Request/Response Data
- Error Stack Traces

### Usage Examples

#### Import Paths

The logger provides different import paths for different environments:

```typescript
// For AWS Lambda/Server environments
import { AwsServerLogger, Level } from '@smooai/logger/AwsServerLogger';

// For Browser environments
import { BrowserLogger, Level } from '@smooai/logger/browser/BrowserLogger';
```

**Important:** Always use the browser-specific import path (`@smooai/logger/browser/BrowserLogger`) for browser environments to ensure proper compatibility and avoid server-side dependencies.

#### Automatic Call Stack Tracking

The logger automatically captures the call stack for every log entry, helping you trace where logs originate from:

```typescript
// Simple initialization with no additional context
const logger = new AwsServerLogger();

// In some deep service method
class UserService {
    async createUser(userData: any) {
        logger.info('Creating new user', { userData });
    }
}

// Sample output:
{
  "msg": "Creating new user",
  "time": "2024-03-20T15:30:00.000Z",
  "level": 30,
  "logLevel": "info",
  "name": "AwsServerLogger",
  "correlationId": "123e4567-e89b-12d3-a456-426614174000",
  "callerContext": {
    "loggerName": "AwsServerLogger",
    "stack": [
      "at UserService.createUser (/src/services/UserService.ts:12:16)",
      "at processRequest (/src/handlers/userHandler.ts:25:31)",
      "at Runtime.handler (/src/index.ts:10:23)"
    ]
  },
  "context": {
    "userData": {
      "email": "user@example.com",
      "name": "John Doe"
    }
  }
}
```

The `callerContext` is automatically included in every log entry, showing:

- The exact file and line number where the log was called
- The call stack leading to that log statement
- The method/function names in the call chain

This is particularly useful for:

- Debugging in production environments
- Tracing the flow of execution
- Understanding which code paths led to specific log entries
- Correlating logs across different services and functions

#### AWS Server Logger

Basic initialization and usage:

```typescript
import { AwsServerLogger, Level } from '@smooai/logger';

const logger = new AwsServerLogger({
    name: 'MyLambdaService',
    level: Level.Debug,
    prettyPrint: true, // Pretty printing for local development
});
```

Adding Lambda context (for API Gateway events):

```typescript
// Add Lambda context from API Gateway event
logger.addLambdaContext(event, context);
logger.info('Processing API request', { endpoint: '/users' });

// Sample output:
{
  "msg": "Processing API request",
  "time": "2024-03-20T15:30:00.000Z",
  "level": 30,
  "logLevel": "info",
  "name": "MyLambdaService",
  "correlationId": "123e4567-e89b-12d3-a456-426614174000",
  "lambda": {
    "functionName": "my-lambda-function",
    "requestId": "c6af9ac6-7b61-11e6-9a41-93e8deadbeef",
    "logGroupName": "/aws/lambda/my-lambda-function",
    "remainingTimeMs": 120000
  },
  "http": {
    "request": {
      "method": "POST",
      "path": "/users",
      "sourceIp": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "headers": {
        "authorization": "Bearer ***",
        "content-type": "application/json"
      }
    }
  },
  "context": {
    "endpoint": "/users"
  }
}
```

Working with SQS messages:

```typescript
// Add context from SQS record
logger.addSQSRecordContext(sqsRecord);
logger.info('Processing SQS message', { messageType: 'USER_CREATED' });

// Sample output:
{
  "msg": "Processing SQS message",
  "time": "2024-03-20T15:30:00.000Z",
  "level": 30,
  "logLevel": "info",
  "name": "MyLambdaService",
  "correlationId": "123e4567-e89b-12d3-a456-426614174000",
  "queue": {
    "name": "MyQueue.fifo",
    "messageId": "059f36b4-87a3-44ab-83d2-661975830a7d",
    "messageGroupId": "group123",
    "messageApproximateReceiveCount": "1"
  },
  "context": {
    "messageType": "USER_CREATED"
  }
}
```

Error handling:

```typescript
try {
  throw new Error('Failed to process message');
} catch (error) {
  logger.error('Message processing failed', error, {
    messageId: 'msg123',
    retryCount: 2
  });
}

// Sample output:
{
  "msg": "Message processing failed",
  "time": "2024-03-20T15:30:00.000Z",
  "level": 50,
  "logLevel": "error",
  "name": "MyLambdaService",
  "correlationId": "123e4567-e89b-12d3-a456-426614174000",
  "error": "Failed to process message",
  "errorDetails": [{
    "name": "Error",
    "message": "Failed to process message",
    "stack": "Error: Failed to process message\n    at ..."
  }],
  "context": {
    "messageId": "msg123",
    "retryCount": 2
  }
}
```

#### Browser Logger

Basic initialization and usage:

```typescript
// Import from the browser-specific path
import { BrowserLogger, Level } from '@smooai/logger/browser/BrowserLogger';

const logger = new BrowserLogger({
    name: 'MyWebApp',
    level: Level.Info,
});
```

**Note:** BrowserLogger should be imported from the browser-specific path `@smooai/logger/browser/BrowserLogger` to ensure proper browser compatibility and avoid server-side dependencies.

Adding request context:

```typescript
// Add context from fetch request
const request = new Request('https://api.example.com/users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Correlation-Id': '123e4567-e89b-12d3-a456-426614174000'
  }
});

logger.addRequestContext(request);
logger.info('API request initiated', { userId: '123' });

// Sample output:
{
  "msg": "API request initiated",
  "time": "2024-03-20T15:30:00.000Z",
  "level": 30,
  "logLevel": "info",
  "name": "MyWebApp",
  "correlationId": "123e4567-e89b-12d3-a456-426614174000",
  "http": {
    "request": {
      "protocol": "https:",
      "host": "api.example.com",
      "path": "/users",
      "method": "POST",
      "headers": {
        "content-type": "application/json",
        "x-correlation-id": "123e4567-e89b-12d3-a456-426614174000"
      }
    }
  },
  "browserContext": {
    "name": "Chrome",
    "platform": "MacIntel",
    "userAgent": "Mozilla/5.0...",
    "version": "120.0.0",
    "isDesktop": true
  },
  "context": {
    "userId": "123"
  }
}
```

Adding response context:

```typescript
logger.addResponseContext({
  statusCode: 201,
  headers: {
    'content-type': 'application/json'
  },
  body: '{"id": "123", "status": "created"}'
});
logger.info('API request completed');

// Sample output:
{
  "msg": "API request completed",
  "time": "2024-03-20T15:30:00.000Z",
  "level": 30,
  "logLevel": "info",
  "name": "MyWebApp",
  "correlationId": "123e4567-e89b-12d3-a456-426614174000",
  "http": {
    "request": {
      // ... previous request context ...
    },
    "response": {
      "statusCode": 201,
      "headers": {
        "content-type": "application/json"
      },
      "body": "{\"id\": \"123\", \"status\": \"created\"}"
    }
  }
}
```

#### Working with Correlation IDs

The logger automatically manages correlation IDs across services:

```typescript
// Get current correlation ID
const correlationId = logger.correlationId();

// Set a specific correlation ID
logger.setCorrelationId('123e4567-e89b-12d3-a456-426614174000');

// Reset correlation ID (generates new UUID)
logger.resetCorrelationId();

// Correlation ID is automatically extracted from:
// - HTTP headers (X-Correlation-Id)
// - SQS message attributes
// - Lambda context
```

#### Additional Context

You can add custom context at any time:

```typescript
// Add user context
logger.addUserContext({
    id: 'user123',
    email: 'user@example.com',
    role: 'admin',
});

// Add custom context
logger.addContext({
    feature: 'payment-processing',
    environment: 'production',
});

// Add telemetry fields
logger.addTelemetryFields({
    requestId: 'req123',
    duration: 150,
    namespace: 'payment-service',
});
```

### Configuration

The logger supports different configuration presets:

- MINIMAL: Basic context with essential information
- FULL: Complete context with all available information
- Custom: Configurable context selection

### Built With

- TypeScript
- AWS Lambda Integration
- Browser Detection
- UUID for correlation

#### Log Rotation

The logger supports file-based logging with automatic log rotation using the [rotating-file-stream](https://www.npmjs.com/package/rotating-file-stream) package. This is useful for server environments where you want to persist logs to disk with automatic file management.

**Configuration Options:**

- `logToFile`: `boolean` - Enable file logging (default: `true` in local environments, `false` in production)
- `rotation`: `RotationOptions` - Log rotation configuration

**Rotation Options:**

```typescript
type RotationOptions = {
    path: string; // Directory path for log files (default: '.smooai-logs')
    filenamePrefix: string; // Prefix for log file names (default: 'output')
    extension: string; // File extension (default: 'log')
    generator?: Generator; // Custom filename generator function
    size?: string; // File size limit (e.g., '1M', '10K', '1G')
    interval?: string; // Time-based rotation (e.g., '1d', '2h', '30m', '1M')
    maxFiles?: number; // Maximum number of rotated files to keep
    maxSize?: string; // Maximum total size of rotated files
    compress?: boolean | string | Compressor; // Compression method
    immutable?: boolean; // Use immutable file names
    intervalBoundary?: boolean; // Use interval boundaries for time-based rotation
    intervalUTC?: boolean; // Use UTC time for interval boundaries
    initialRotation?: boolean; // Perform initial rotation check on startup
    history?: string; // Custom history file name
    mode?: number; // File permissions (Unix file mode)
    encoding?: BufferEncoding; // File encoding
    omitExtension?: boolean; // Don't add compression extension
};

type Generator = (time: number | Date, index?: number) => string;
```

**Basic Usage:**

```typescript
// Enable file logging with default settings
const logger = new AwsServerLogger({
    name: 'MyService',
    logToFile: true,
});

// Custom rotation configuration
const logger = new AwsServerLogger({
    name: 'MyService',
    logToFile: true,
    rotation: {
        path: './logs',
        filenamePrefix: 'app',
        extension: 'txt',
        size: '10M', // Rotate at 10MB
        interval: '2h', // Rotate every 2 hours
        maxFiles: 5, // Keep only 5 rotated files
        compress: 'gzip', // Compress rotated files
    },
});
```

**Custom Filename Generator:**

```typescript
// Custom filename pattern: logs/2024/03/app-2024-03-20-001.ansi
const customGenerator = (time: Date, index?: number) => {
    if (!time) return 'app.ansi';

    const year = time.getFullYear();
    const month = String(time.getMonth() + 1).padStart(2, '0');
    const day = String(time.getDate()).padStart(2, '0');
    const fileIndex = index ? String(index).padStart(3, '0') : '001';

    return `${year}/${month}/app-${year}-${month}-${day}-${fileIndex}.ansi`;
};

const logger = new AwsServerLogger({
    name: 'MyService',
    logToFile: true,
    rotation: {
        path: './logs',
        filenamePrefix: 'app',
        extension: 'ansi',
        generator: customGenerator,
        size: '5M',
        interval: '1d',
    },
});
```

**Available Rotation Options:**

All options from [rotating-file-stream](https://www.npmjs.com/package/rotating-file-stream) are supported:

- `size`: File size limit (e.g., '1M', '10K', '1G')
- `interval`: Time-based rotation (e.g., '1d', '2h', '30m', '1M')
- `maxFiles`: Maximum number of rotated files to keep
- `maxSize`: Maximum total size of rotated files
- `compress`: Compression method ('gzip', 'brotli', or custom function)
- `immutable`: Use immutable file names (useful for log aggregation)
- `intervalBoundary`: Use interval boundaries for time-based rotation
- `intervalUTC`: Use UTC time for interval boundaries
- `initialRotation`: Perform initial rotation check on startup
- `history`: Custom history file name
- `mode`: File permissions (Unix file mode)
- `encoding`: File encoding
- `omitExtension`: Don't add compression extension

**File Structure Example:**

With default settings, your logs will be organized like this:

```
.smooai-logs/
├── output.ansi          # Current log file
├── output-2024-03-20-1.ansi.gz  # Yesterday's log (compressed)
├── output-2024-03-19-1.ansi.gz  # Day before (compressed)
└── output-2024-03-18-1.ansi.gz  # Older log (compressed)
```

**ANSI Color Output:**

By default, the logger outputs to `.ansi` files with ANSI color codes to help make log messages easier to read when scrolling through large log files. The colors provide visual distinction between different log levels and message types.

This works seamlessly with the [iliazeus.vscode-ansi](https://open-vsx.org/extension/iliazeus/vscode-ansi) extension in VS Code, which automatically displays ANSI colors in `.ansi` files by default. Simply install the extension and your log files will be displayed with proper color formatting, making it much easier to scan through logs and identify different message types at a glance.

**Default Settings and Environment Detection:**

**Default Rotation Settings:**

- `size`: `'1M'` - Rotate when file reaches 1MB
- `interval`: `'1d'` - Rotate daily at midnight
- `maxSize`: `'100M'` - Keep maximum 100MB of rotated files
- `path`: `'.smooai-logs'` - Log directory
- `filenamePrefix`: `'output'` - File prefix
- `extension`: `'ansi'` - File extension

**Automatic Local Environment Detection:**

The `logToFile` option is automatically enabled when running in a local development environment. The logger detects local environments using the following environment variables:

- `SST_DEV`: Set to `true` when running with SST development mode
- `IS_LOCAL`: Set to `true` for local development environments
- `IS_DEPLOYED_STAGE`: When set to any value other than `'true'`, indicates a non-production environment

```typescript
// Automatic detection function
export function isRunningLocally(): boolean {
    return (
        Boolean(process.env.SST_DEV) || Boolean(process.env.IS_LOCAL) || (Boolean(process.env.IS_DEPLOYED_STAGE) && process.env.IS_DEPLOYED_STAGE !== 'true')
    );
}
```

When `isRunningLocally()` returns `true`, `logToFile` defaults to `true`. In production environments, `logToFile` defaults to `false` unless explicitly enabled.

**Best Practices:**

1. **Use appropriate size limits** based on your log volume and storage constraints
2. **Enable compression** to save disk space for historical logs
3. **Set reasonable retention** with `maxFiles` or `maxSize` to prevent disk space issues
4. **Use custom generators** for better log organization in production environments
5. **Consider log aggregation** tools that can read from specific file patterns

## Contributing

Contributions are welcome! This project uses [changesets](https://github.com/changesets/changesets) to manage versions and releases.

### Development Workflow

1. Fork the repository
2. Create your branch (`git checkout -b amazing-feature`)
3. Make your changes
4. Add a changeset to document your changes:

    ```sh
    pnpm changeset
    ```

    This will prompt you to:

    - Choose the type of version bump (patch, minor, or major)
    - Provide a description of the changes

5. Commit your changes (`git commit -m 'Add some amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Pull Request Guidelines

- Reference any related issues in your PR description

The maintainers will review your PR and may request changes before merging.

<!-- CONTACT -->

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contact

Brent Rager

- [Email](mailto:brent@smoo.ai)
- [LinkedIn](https://www.linkedin.com/in/brentrager/)
- [BlueSky](https://bsky.app/profile/brentragertech.bsky.social)
- [TikTok](https://www.tiktok.com/@brentragertech)
- [Instagram](https://www.instagram.com/brentragertech/)

Smoo Github: [https://github.com/SmooAI](https://github.com/SmooAI)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->

[sst.dev-url]: https://reactjs.org/
[sst]: https://img.shields.io/badge/sst-EDE1DA?style=for-the-badge&logo=sst&logoColor=E27152
[sst-url]: https://sst.dev/
[next]: https://img.shields.io/badge/next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white
[next-url]: https://nextjs.org/
[aws]: https://img.shields.io/badge/aws-232F3E?style=for-the-badge&logo=amazonaws&logoColor=white
[aws-url]: https://tailwindcss.com/
[tailwindcss]: https://img.shields.io/badge/tailwind%20css-0B1120?style=for-the-badge&logo=tailwindcss&logoColor=#06B6D4
[tailwindcss-url]: https://tailwindcss.com/
[zod]: https://img.shields.io/badge/zod-3E67B1?style=for-the-badge&logoColor=3E67B1
[zod-url]: https://zod.dev/
[sanity]: https://img.shields.io/badge/sanity-F36458?style=for-the-badge
[sanity-url]: https://www.sanity.io/
[vitest]: https://img.shields.io/badge/vitest-1E1E20?style=for-the-badge&logo=vitest&logoColor=#6E9F18
[vitest-url]: https://vitest.dev/
[pnpm]: https://img.shields.io/badge/pnpm-F69220?style=for-the-badge&logo=pnpm&logoColor=white
[pnpm-url]: https://pnpm.io/
[turborepo]: https://img.shields.io/badge/turborepo-000000?style=for-the-badge&logo=turborepo&logoColor=#EF4444
[turborepo-url]: https://turbo.build/
