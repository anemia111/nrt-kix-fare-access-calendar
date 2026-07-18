import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  defaultPlanConditions,
  parsePlanConditions,
  serializePlanConditions,
} from "@/domain/planSearch";
import { buildIcs } from "@/lib/ics";
import { copyToClipboard } from "@/lib/clipboard";
import { getRecentSnapshot, saveRecentSearch, clearRecentSearches } from "@/lib/recentSearches";

describe("URL共有と復元", () => {
  it("検索条件をURLへ直列化して復元できる", () => {
    const conditions = {
      ...defaultPlanConditions("2026-07-21"),
      routeId: "KIX-NRT" as const,
      adults: 3,
      checkedBaggage: true,
      periods: ["morning", "evening"] as const,
      departureTime: "07:45",
    };
    const query = serializePlanConditions(conditions);
    const restored = parsePlanConditions(new URLSearchParams(query), "2026-07-21");
    expect(restored.routeId).toBe("KIX-NRT");
    expect(restored.adults).toBe(3);
    expect(restored.checkedBaggage).toBe(true);
    expect(restored.periods).toEqual(["morning", "evening"]);
    expect(restored.departureTime).toBe("07:45");
    // 出発駅は路線から導かれる
    expect(restored.originStationCode).toBe("WAKAYAMA");
  });

  it("不正な値は既定へフォールバックする", () => {
    const restored = parsePlanConditions(
      new URLSearchParams("route=BAD&adults=99&dep=99:99&periods=x"),
      "2026-07-21",
    );
    expect(restored.routeId).toBe("NRT-KIX");
    expect(restored.adults).toBe(1);
    expect(restored.departureTime).toBeNull();
    expect(restored.periods).toEqual(["morning", "daytime", "evening"]);
  });
});

describe("LocalStorage による最近の検索", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearRecentSearches();
  });
  afterEach(() => {
    window.localStorage.clear();
  });

  it("保存した検索条件を復元できる", () => {
    const conditions = { ...defaultPlanConditions("2026-07-21"), adults: 2 };
    saveRecentSearch(conditions);
    const recent = getRecentSnapshot();
    expect(recent.length).toBe(1);
    expect(recent[0].adults).toBe(2);
  });

  it("同一条件は重複せず、新しいものが先頭に来る", () => {
    const a = { ...defaultPlanConditions("2026-07-21"), adults: 1 };
    const b = { ...defaultPlanConditions("2026-07-22"), adults: 1 };
    saveRecentSearch(a);
    saveRecentSearch(b);
    saveRecentSearch(a); // 再度 a
    const recent = getRecentSnapshot();
    expect(recent.length).toBe(2);
    expect(recent[0].date).toBe("2026-07-21");
  });
});

describe("ICS（空港到着目標のカレンダー保存）", () => {
  it("VEVENT と JST の開始時刻を含む", () => {
    const ics = buildIcs({
      title: "空港到着目標",
      description: "テスト",
      startAt: "2026-07-20T06:15:00+09:00",
      location: "成田国際空港 第1ターミナル",
    });
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("DTSTART;TZID=Asia/Tokyo:20260720T061500");
    expect(ics).toContain("SUMMARY:空港到着目標");
    expect(ics).toContain("TZID:Asia/Tokyo");
    // CRLF 区切り
    expect(ics).toContain("\r\n");
  });
});

describe("クリップボードのコピー", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("navigator.clipboard.writeText を使う", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const ok = await copyToClipboard("成田→関空");
    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith("成田→関空");
    vi.unstubAllGlobals();
  });
});
