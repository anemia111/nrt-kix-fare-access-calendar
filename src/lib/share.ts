/**
 * Web Share API による共有。非対応環境ではクリップボードへフォールバックする。
 */

import { copyToClipboard } from "./clipboard";

export type ShareResult = "shared" | "copied" | "failed";

export async function shareUrl(input: {
  title: string;
  text: string;
  url: string;
}): Promise<ShareResult> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share(input);
      return "shared";
    } catch (error) {
      // ユーザーがキャンセルした場合は AbortError。失敗として扱わない。
      if (error instanceof DOMException && error.name === "AbortError") {
        return "failed";
      }
      // それ以外はコピーへフォールバック
    }
  }
  const ok = await copyToClipboard(input.url);
  return ok ? "copied" : "failed";
}

export function canWebShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}
