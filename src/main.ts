export interface RetryStatus<T> {
  /**
   * 🔄 Retry count, starting from 0.
   */
  count: number;

  /**
   * 🕒 Timestamp when the retry operation started
   */
  start_at: Date;

  /**
   * 🏁 Timestamp when the retry operation ended
   */
  end_at?: Date;

  /**
   * ⏱️ Total duration of retry attempts in milliseconds
   */
  duration: number;

  /**
   * 🚨 Array of errors encountered during retry attempts
   */
  errors: {
    /**
     * The actual error object
     */
    error: unknown;
    /**
     * When this error occurred
     */
    created_at: Date;
  }[];

  /**
   * ✅ Successfully resolved value
   */
  resolved?: T;

  /**
   * ❌ Final rejection reason
   */
  rejected?: unknown;
}

export interface RetryFn<T> {
  /**
   * 🎯 Main retry function signature
   * @param resolve - Function to resolve the promise with success value
   * @param reject - Function to reject the promise with error
   * @param status - Current retry status object
   */
  (
    resolve: (value: T | PromiseLike<T>) => void,
    reject: (reason?: any) => void,
    status: RetryStatus<T>
  ): Promise<T> | T;
}

export interface RetryCallback<T> {
  /**
   * 🔄 Generic callback function used for retry operations
   * @param status - Current retry status
   */
  (status: RetryStatus<any>): T | Promise<T>;
}

export interface AsyncRetryOptions<T> {
  /**
   * 🔢 Number of retry attempts
   * NOTE: Can be either a fixed number or a callback returning boolean
   */
  retries?: number | RetryCallback<boolean>;

  /**
   * ⏳ Delay between retry attempts
   * NOTE: Can be either milliseconds or a callback handling the delay
   */
  delay?: number | RetryCallback<void>;

  /**
   * 📢 Called before each retry attempt
   */
  onRetry?: (e: unknown, status: RetryStatus<T>) => void;

  /**
   * ❌ Called when the operation is finally rejected
   */
  onRejected?: (e: unknown, status: RetryStatus<T>) => void;

  /**
   * ✅ Called when the operation is successfully resolved
   */
  onResolved?: (ret: T, status: RetryStatus<T>) => void;
}

export async function retryAsync<T>(
  fn: RetryFn<T>,
  options: AsyncRetryOptions<T> = {}
): Promise<T> {
  // 🏁 Initialize retry status
  const status: RetryStatus<T> = {
    count: 0,
    start_at: new Date(),
    duration: 0,
    errors: [],
  };

  async function onCatch(error: unknown) {
    // NOTE: If already resolved, return the resolved value
    if (status.resolved) {
      return status.resolved;
    }
    const now = new Date();
    // NOTE: Record the error
    status.errors.push({
      error,
      created_at: now,
    });

    // NOTE: Calculate total duration
    status.duration = now.getTime() - status.start_at.getTime();

    // NOTE: Check if we should retry
    const shouldRetry = status.rejected
      ? false
      : typeof options.retries === "function"
      ? await options.retries(status)
      : status.count < (options.retries ?? 0);

    if (!shouldRetry) {
      status.end_at = now;
      if (status.rejected) {
        throw status.rejected;
      } else {
        status.rejected = error;
        options.onRejected?.(error, status);
        throw error;
      }
    }

    // NOTE: Trigger retry callback
    options.onRetry?.(error, status);

    // NOTE: Update retry counter
    status.count++;

    // NOTE: Handle delay before next retry
    if (options.delay) {
      const { delay } = options;
      if (typeof delay === "function") {
        await delay(status);
      } else {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // NOTE: Continue with next retry attempt
    return attempt();
  }

  async function attempt(): Promise<T> {
    try {
      return await new Promise<T>(async (resolve, reject) => {
        const toResolved = async (value: T | PromiseLike<T>) => {
          status.resolved = await value;
          options.onResolved?.(await value, status);
          resolve(value);
        };
        const toRejected = (err: unknown) => {
          status.rejected = err;
          options.onRejected?.(err, status);
          reject(err);
        };
        try {
          const value = await Promise.resolve(
            fn(toResolved, toRejected, status)
          );
          await toResolved(value);
        } catch (error) {
          // just reject current promise
          reject(error);
        }
      });
    } catch (error) {
      return onCatch(error);
    }
  }

  return attempt();
}
