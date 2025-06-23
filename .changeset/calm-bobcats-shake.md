---
'@smooai/logger': major
---

Breaking Change: Changed AwsLambdaLogger to AwsServerLogger.

AwsServerLogger is growing to have functionality beyond just Lambda (to soon include ECS) so it makes sense to change it now to AwsServerLogger.

Fixed ANSI colors in all places.

Added file log output and log rotation enabled by default when running on server locally.
