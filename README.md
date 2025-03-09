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

SmooAI is a platform for building and deploying AI-powered apps.

Learn more on [smoo.ai](https://smoo.ai)

## SmooAI Packages

Check out other SmooAI packages at [npmjs.com/org/smooai](https://www.npmjs.com/org/smooai)

## About @smooai/logger

A powerful contextual logging system designed for AWS Lambda and Browser environments, with built-in support for structured logging, correlation tracking, and automatic context gathering.

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
- OpenTelemetry integration
- Circular reference handling in JSON serialization

#### AWS Lambda Logger

- Automatic AWS Lambda context extraction
- SQS message context tracking
- EventBridge context support
- API Gateway request/response context
- Lambda execution environment details
- Cross-service correlation ID propagation
- CloudWatch optimized output format

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
- OpenTelemetry Traces

### Usage Examples

```typescript
// AWS Lambda Logger
const logger = new AwsLambdaLogger();
logger.addLambdaContext(event, context);
logger.info('Processing request', { customData: 'value' });

// Browser Logger
const logger = new BrowserLogger();
logger.addRequestContext(request);
logger.info('User action completed', { action: 'click' });
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
- OpenTelemetry
- UUID for correlation

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
