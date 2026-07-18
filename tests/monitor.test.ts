import { describe, expect, it } from "vitest";
import {
  buildIssueReport,
  diffSource,
  hashBody,
  isPathAllowed,
  nextState,
  normalizeForHash,
  parseRobots,
} from "../scripts/monitorLib.mjs";

const UA = "nrt-kix-fare-access-calendar-source-monitor";
const source = {
  id: "peach-checkin",
  name: "Peach 国内線 搭乗案内",
  url: "https://www.flypeach.com/lm/ai/airports/checkin",
  manualCheckItems: ["チェックイン締切"],
};

describe("robots.txt の解析", () => {
  it("Disallow を守る", () => {
    const robots = parseRobots("User-agent: *\nDisallow: /private");
    expect(isPathAllowed(robots, UA, "/private/page")).toBe(false);
    expect(isPathAllowed(robots, UA, "/public/page")).toBe(true);
  });

  it("空の Disallow は全許可", () => {
    const robots = parseRobots("User-agent: *\nDisallow:");
    expect(isPathAllowed(robots, UA, "/anything")).toBe(true);
  });

  it("Allow が Disallow より具体的なら許可する", () => {
    const robots = parseRobots("User-agent: *\nDisallow: /a\nAllow: /a/b");
    expect(isPathAllowed(robots, UA, "/a/b/c")).toBe(true);
    expect(isPathAllowed(robots, UA, "/a/x")).toBe(false);
  });

  it("ルールが無ければ許可する", () => {
    expect(isPathAllowed(parseRobots(""), UA, "/foo")).toBe(true);
  });
});

describe("本文の正規化（誤検出の防止）", () => {
  it("script/style/コメント/タグを除いた本文だけを比較する", () => {
    const a = `<html><head><style>.x{color:red}</style></head><body><!-- c1 -->
      <script>window.__NONCE__="aaaaaaaaaaaaaaaaaaaa";</script>
      <p>カウンターは出発の30分前まで</p></body></html>`;
    const b = `<html><head><style>.x{color:blue}</style></head><body><!-- c2 -->
      <script>window.__NONCE__="bbbbbbbbbbbbbbbbbbbb";</script>
      <p>カウンターは出発の30分前まで</p></body></html>`;
    // 見える本文が同じならハッシュも同じ（＝毎日の誤検出が起きない）
    expect(hashBody(a)).toBe(hashBody(b));
    expect(normalizeForHash(a)).toBe("カウンターは出発の30分前まで");
  });

  it("リクエストごとに変わる長いトークンを無視する", () => {
    const a = "<p>本文</p><div data-token='0123456789abcdef0123'></div>";
    const b = "<p>本文</p><div data-token='fedcba98765432100000'></div>";
    expect(hashBody(a)).toBe(hashBody(b));
  });

  it("本文が実際に変わればハッシュも変わる", () => {
    const before = "<p>カウンターは出発の30分前まで</p>";
    const after = "<p>カウンターは出発の45分前まで</p>";
    expect(hashBody(before)).not.toBe(hashBody(after));
  });
});

describe("変更検出", () => {
  const base = { checkedAt: "2026-07-16T00:00:00Z", hash: "OLD", etag: null, lastModified: null };

  it("ハッシュが変わったら changed とレポートを返す", () => {
    const diff = diffSource(source, base, {
      status: "ok",
      hash: "NEW",
      etag: 'W/"1"',
      lastModified: "Wed, 15 Jul 2026 00:00:00 GMT",
      httpStatus: 200,
      checkedAt: "2026-07-17T00:00:00Z",
    });
    expect(diff.outcome).toBe("changed");
    expect(diff.report?.title).toBe("公式情報の変更を検出: Peach 国内線 搭乗案内");
    expect(diff.report?.body).toContain("https://www.flypeach.com/lm/ai/airports/checkin");
    expect(diff.report?.body).toContain("前回ハッシュ");
    expect(diff.report?.body).toContain("今回ハッシュ");
    expect(diff.report?.body).toContain("HTTPステータス");
    expect(diff.report?.body).toContain("ETag");
    expect(diff.report?.body).toContain("Last-Modified");
    expect(diff.report?.body).toContain("チェックイン締切");
  });

  it("ハッシュが同じなら unchanged", () => {
    const diff = diffSource(source, base, {
      status: "ok",
      hash: "OLD",
      httpStatus: 200,
      checkedAt: "2026-07-17T00:00:00Z",
    });
    expect(diff.outcome).toBe("unchanged");
  });

  it("初回は baseline として記録する", () => {
    const diff = diffSource(source, undefined, {
      status: "ok",
      hash: "FIRST",
      httpStatus: 200,
      checkedAt: "2026-07-17T00:00:00Z",
    });
    expect(diff.outcome).toBe("baseline");
  });

  it("取得失敗時は last-known-good を維持する", () => {
    const diff = diffSource(source, base, {
      status: "fetch-failed",
      httpStatus: 503,
      checkedAt: "2026-07-17T00:00:00Z",
    });
    expect(diff.outcome).toBe("fetch-failed");
    expect(diff.keepPrevious).toBe(true);
    expect(diff.needsManualCheck).toBe(true);
  });

  it("robots で禁止されたページはスキップする", () => {
    const diff = diffSource(source, base, {
      status: "skipped-by-robots",
      checkedAt: "2026-07-17T00:00:00Z",
    });
    expect(diff.outcome).toBe("skipped");
    expect(diff.keepPrevious).toBe(true);
  });
});

describe("ETag による変更検出（ハッシュにも反映される）", () => {
  it("ETagが変わり本文ハッシュも変われば changed", () => {
    const prev = { checkedAt: "x", hash: hashBody("old body"), etag: 'W/"1"' };
    const diff = diffSource(source, prev, {
      status: "ok",
      hash: hashBody("new body"),
      etag: 'W/"2"',
      httpStatus: 200,
      checkedAt: "y",
    });
    expect(diff.outcome).toBe("changed");
  });
});

describe("状態の更新（last-known-good維持）", () => {
  it("取得成功は新しい値で上書きし、失敗は前回値を残す", () => {
    const previous = {
      a: { hash: "A_OLD", checkedAt: "old" },
      b: { hash: "B_OLD", checkedAt: "old" },
    };
    const results = [
      {
        source: { id: "a", name: "A", url: "https://a.example/" },
        current: {
          status: "ok" as const,
          hash: "A_NEW",
          etag: null,
          lastModified: null,
          checkedAt: "now",
        },
        diff: { id: "a", outcome: "changed" as const, keepPrevious: false },
      },
      {
        source: { id: "b", name: "B", url: "https://b.example/" },
        current: { status: "fetch-failed" as const, checkedAt: "now" },
        diff: { id: "b", outcome: "fetch-failed" as const, keepPrevious: true },
      },
    ];
    const state = nextState(previous, results);
    expect(state.a.hash).toBe("A_NEW");
    // b は前回のハッシュを保持（削除しない）
    expect(state.b.hash).toBe("B_OLD");
    expect(state.b.lastCheckedAt).toBe("now");
  });
});

describe("Issueレポート生成", () => {
  it("必要な項目を含む Markdown を作る", () => {
    const report = buildIssueReport(
      source,
      { checkedAt: "2026-07-16", hash: "OLD" },
      {
        status: "ok",
        hash: "NEW",
        etag: null,
        lastModified: null,
        httpStatus: 200,
        checkedAt: "2026-07-17",
      },
    );
    expect(report.title).toContain("公式情報の変更を検出");
    expect(report.body).toContain("自動変更していません");
    expect(report.body).toContain("- [ ] チェックイン締切");
  });
});
