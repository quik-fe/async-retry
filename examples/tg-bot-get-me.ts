import "dotenv/config";
import { retryAsync } from "../src/main";
// @ts-ignore
import _fetch from "node-fetch-with-proxy";

const fetch = _fetch as typeof globalThis.fetch;

const { BOT_TOKEN } = process.env;

if (!BOT_TOKEN) {
  throw new Error("Missing BOT_TOKEN environment variable");
}

interface TelegramError {
  ok: false;
  error_code: number;
  description: string;
  parameters?: {
    retry_after?: number;
  };
}

// 判断是否是 Telegram 错误响应
function isTelegramError(error: any): error is TelegramError {
  return (
    error &&
    typeof error === "object" &&
    error.ok === false &&
    "error_code" in error &&
    "description" in error
  );
}

// 封装 Telegram API 请求
async function callTelegramAPI<T>(
  apiMethod: string,
  params: Record<string, any>
): Promise<T> {
  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/${apiMethod}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw data;
  }

  return data;
}

// 使用重试机制包装 API 调用
async function callApi<T = any>(
  apiMethod: string,
  params: Record<string, any> = {},
  retryOptions?: {
    factor?: number;
    minTimeout?: number;
    maxTimeout?: number;
    randomize?: boolean;
  }
): Promise<T> {
  return retryAsync<T>(
    //
    async () => await callTelegramAPI<T>(apiMethod, params),
    {
      retries: 5,
      delay: async (status) => {
        const lastError = status.errors[status.errors.length - 1]?.error;
        let after_ms = 0;

        if (isTelegramError(lastError) && lastError.error_code === 429) {
          const retryAfter = lastError.parameters?.retry_after ?? 30;
          console.log(
            `[Telegram API] Rate limited. Retrying after ${retryAfter}s...`,
            `Attempt ${status.count}`
          );
          after_ms = retryAfter * 1000; // 转换为毫秒
        } else {
          // 其他错误使用指数退避
          const {
            factor = 2,
            minTimeout = 1000,
            maxTimeout = 30000,
            randomize = false,
          } = retryOptions ?? {};
          after_ms = Math.min(
            minTimeout * Math.pow(factor, status.count) +
              (randomize ? 1 + Math.random() : 0),
            maxTimeout
          );
        }

        await new Promise((resolve) => setTimeout(resolve, after_ms));
      },
      onRetry: (error, status) => {
        if (isTelegramError(error) && error.error_code === 429) {
          console.log(
            `[Telegram API] Rate limit error:`,
            `Description: ${error.description}`,
            `Retry after: ${error.parameters?.retry_after}s`
          );
        } else {
          console.log(
            `[Telegram API] Retry attempt ${status.count + 1}:`,
            error instanceof Error ? error.message : error
          );
        }
      },
      onRejected: (error, status) => {
        console.error(
          `[Telegram API] All retry attempts failed:`,
          `Total attempts: ${status.count}`,
          `Duration: ${status.duration}ms`,
          `Last error:`,
          error
        );
      },
    }
  );
}

// 使用示例
async function example() {
  try {
    const result = await callApi("getMe", {});
    console.log(result);
  } catch (error) {
    console.error("Failed to send message:", error);
  }
}

example().catch(console.error);
