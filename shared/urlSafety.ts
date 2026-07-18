/**
 * 外部URLの安全性検証（フロントエンドと Worker で共有）。
 *
 * ドメイン判定を単純な部分一致にしてはいけない。`fake-peach.com` や
 * `flypeach.example.com` を公式として許可してしまうため。必ず URL として解析し、
 * ホスト名が「許可済みドメインそのもの」または「その正式なサブドメイン」の
 * 場合だけ許可する。
 */

export type UrlValidation =
  | { readonly ok: true; readonly url: string; readonly host: string }
  | { readonly ok: false; readonly reason: string };

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, "");
}

/**
 * ホスト名が許可済みドメインに一致するか。
 * 一致条件は「完全一致」または「正式なサブドメイン」のみ。
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

/**
 * 外部URLを検証する。https 限定、userinfo 偽装・非既定ポートを拒否する。
 * `javascript:` や `data:` はスキーム判定で弾かれる。
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

  // ユーザー情報付きURLは偽装に使われるため一律拒否する
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

/** https であることだけを確認する（提供元が任意ドメインの場合の最低条件）。 */
export function isSafeHttpsUrl(rawUrl: string | null | undefined): boolean {
  if (!rawUrl || typeof rawUrl !== "string") return false;
  try {
    const parsed = new URL(rawUrl);
    return (
      parsed.protocol === "https:" &&
      parsed.username === "" &&
      parsed.password === "" &&
      (parsed.port === "" || parsed.port === "443")
    );
  } catch {
    return false;
  }
}
