# `@quik-fe/async-retry`

`@quik-fe/async-retry` is a lightweight and flexible library for handling retry logic in asynchronous operations. It provides a customizable mechanism to retry operations with support for delays, backoff strategies, and hooks for handling retries and failures.

## Installation

```bash
npm install @quik-fe/async-retry
```

or

```bash
yarn add @quik-fe/async-retry
```

## Usage

### Basic Example

```typescript
import { retryAsync } from "@quik-fe/async-retry";

async function main() {
  const result = await retryAsync(
    async (_1,reject,status) => {
      const response = await fetch("https://api.example.com/data");
      if (response.status === 555) {
        reject(new Error("Err 555"));
        throw new Error("Err 555");
      }
      return await response.text();
    },
    {
      retries: 5,
      delay: 1000, // 1 second delay between retries
    }
  );
  console.log("Final result:", result);
}

main();
```

### Advanced Example with Exponential Backoff

```typescript
import { retryAsync } from "@quik-fe/async-retry";

async function main() {
  const result = await retryAsync(
    async (_1,reject,status) => {
      console.log(`Attempt ${status.count + 1}`);
      const response = await fetch("https://api.example.com/data");
      if (response.status === 555) {
        reject(new Error("Err 555"));
        throw new Error("Err 555");
      }
      return await fetchData();
    },
    {
      retries: 5,
      delay: (status) => {
        const delayMs = Math.min(1000 * Math.pow(2, status.count), 16000); // Max 16s
        console.log(`Delaying for ${delayMs}ms`);
        return new Promise((resolve) => setTimeout(resolve, delayMs));
      },
      onRetry: (error, status) => {
        console.warn(`Retry attempt ${status.count}:`, error);
      },
      onResolved: (value, status) => {
        console.log("Successfully resolved:", value, "after", status.count, "retries");
      },
      onRejected: (error, status) => {
        console.error("Operation failed after retries:", status.count, "error:", error);
      },
    }
  );
  console.log("Final result:", result);
}

main();
```

## API Reference

### `retryAsync`

#### Parameters

```typescript
function retryAsync<T>(
  fn: RetryFn<T>,                // Function containing the logic to retry
  options: AsyncRetryOptions<T>  // Configuration options for retries
): Promise<T>;
```

#### `RetryFn<T>`

The function to execute, which should resolve or reject depending on the operation's result. Receives:

- `resolve`: A function to resolve the promise with a successful result.
- `reject`: A function to reject the promise with an error.
- `status`: Current retry status, including count, errors, and timing information.

#### `AsyncRetryOptions<T>`

| Option       | Type                                   | Description                                                                                       |
|--------------|----------------------------------------|---------------------------------------------------------------------------------------------------|
| `retries`    | `number` \| `(status) => boolean`      | Number of retries or a function to determine if retrying should continue. Default is `0`.         |
| `delay`      | `number` \| `(status) => Promise<void>`         | Delay (in ms) between retries or a function to handle delay. Default is `0`.                     |
| `onRetry`    | `(error, status) => void`              | Callback invoked before each retry attempt.                                                      |
| `onResolved` | `(value, status) => void`              | Callback invoked when the operation resolves successfully.                                        |
| `onRejected` | `(error, status) => void`              | Callback invoked when the operation is rejected after exhausting all retries.                    |

## Return Value

Returns a `Promise<T>` that resolves with the result of the successful operation or rejects after exhausting all retries.

## Status Object

The `status` object passed to callbacks provides the following properties:

| Property      | Type              | Description                                                  |
|---------------|-------------------|--------------------------------------------------------------|
| `count`       | `number`          | Current retry attempt, starting from `0`.                    |
| `start_at`    | `Date`            | Timestamp when the retry operation started.                  |
| `end_at`      | `Date` (optional) | Timestamp when the retry operation ended.                    |
| `duration`    | `number`          | Total duration of retry attempts in milliseconds.            |
| `errors`      | `Array<{error, created_at}>` | List of errors encountered during retries.                  |
| `resolved`    | `T` (optional)    | Successfully resolved value (set when resolved).             |
| `rejected`    | `unknown` (optional) | Final rejection reason (set when rejected).                  |

## License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT).

## Contributing

Feel free to report issues or submit pull requests on the [GitHub repository](https://github.com/quik-fe/async-retry). Contributions are welcome!

## Author

Developed by [zhzluke96](https://github.com/zhzluke96).

## Links

- **NPM Package**: [@quik-fe/async-retry](https://www.npmjs.com/package/@quik-fe/async-retry)
- **GitHub Repository**: [quik-fe/async-retry](https://github.com/quik-fe/async-retry)
- **Issues**: [Submit a Bug Report](https://github.com/quik-fe/async-retry/issues)
- **Homepage**: [Documentation](https://github.com/quik-fe/async-retry#readme)