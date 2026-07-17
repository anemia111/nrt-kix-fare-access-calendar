/**
 * 外部リンクの安全性検証（要件15・31）。
 *
 * ドメイン判定を単純な部分一致にしてはいけない。`fake-peach.com` や
 * `flypeach.example.com`、`jetstar-login.example.net` を公式サイトとして
 * 許可してしまうため。必ず URL として解析し、ホスト名が
 * 「許可済みドメインそのもの」または「その正式なサブドメイン」の場合だけ許可する。
 */

export type UrlValidation =
  | { readonly ok: true; readonly url: string; readonly host: string }
  | { readonly ok: false; readonly reason: string };

/**
 * ホスト名が許可済みドメインに一致するか。
 *
 * 一致条件は次の2つだけ:
 *  - ホスト名が許可ドメインと完全一致（例: flypeach.com）
 *  - ホスト名が許可ドメインの正式なサブドメイン（例: www.flypeach.com）
 *
 * `flypeach.com.evil.com` や `notflypeach.com` は、末尾一致でも
 * ドット区切りの境界を満たさないため拒否される。
 */
export function isAllowedHost(host: string, allowedDomains: readonly string[]): boolean {
  const normalizedHost = normalizeHost(host);
  if (!normalizedHost) return false;

  return allowedDomains.some((domain) => {
    const normalizedDomain = normalizeHost(domain);
    if (!normalizedDomain) return false;
    if (normalizedHost === normalizedDomain) return true;
    return normalizedHost.endsWith(`.${normalizedDomain}`);
  });
}

function normalizeHost(host: string): string {
  // 末尾ドット（絶対FQDN表記）と大文字小文字を正規化する。
  return host.trim().toLowerCase().replace(/\.$/, "");
}

/**
 * 外部URLを検証する。許可した場合のみリンクとして表示してよい。
 *
 * `javascript:` や `data:` などの危険なスキームは https 限定のチェックで弾かれる。
 * `https://flypeach.com@evil.com/` のような userinfo を使った偽装は、
 * URL 解析でホストが evil.com になるため弾かれる（加えて userinfo 自体を拒否する）。
 */
export function validateExternalUrl(
  rawUrl: string | null | undefined,
  allowedDomains: readonly string[],
): UrlValidation {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { ok: false, reason: "URLが指定されていません" };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "URLとして解析できません" };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, reason: `https以外のスキームは許可されていません: ${parsed.protocol}` };
  }

  // ユーザー情報付きURLは偽装に使われるため一律拒否する。
  if (parsed.username !== "" || parsed.password !== "") {
    return { ok: false, reason: "ユーザー情報を含むURLは許可されていません" };
  }

  if (parsed.port !== "" && parsed.port !== "443") {
    return { ok: false, reason: `既定以外のポートは許可されていません: ${parsed.port}` };
  }

  if (!isAllowedHost(parsed.hostname, allowedDomains)) {
    return { ok: false, reason: `許可されていないドメインです: ${parsed.hostname}` };
  }

  return { ok: true, url: parsed.toString(), host: parsed.hostname };
}

/**
 * 外部リンクに必ず付ける属性。
 * `noopener` はタブナビング（開いた先から window.opener 経由で元ページを
 * すり替えられる攻撃）を防ぐ。`noreferrer` は参照元の漏洩を防ぐ。
 */
export const EXTERNAL_LINK_ATTRIBUTES = {
  target: "_blank",
  rel: "noopener noreferrer",
} as const;
