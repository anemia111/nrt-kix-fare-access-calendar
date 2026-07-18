import { describe, expect, it } from "vitest";
import {
  decideHolidayFileUpdate,
  normalizeHolidayDate,
  parseHolidayCsv,
} from "../scripts/holidayCsv.mjs";

describe("祝日CSVの日付正規化", () => {
  it("スラッシュ区切りを YYYY-MM-DD に変換する", () => {
    expect(normalizeHolidayDate("2026/1/1")).toBe("2026-01-01");
    expect(normalizeHolidayDate("2026/12/31")).toBe("2026-12-31");
    expect(normalizeHolidayDate(" 2026/7/20 ")).toBe("2026-07-20");
  });

  it("不正な日付を拒否する", () => {
    expect(normalizeHolidayDate("2026-01-01")).toBeNull();
    expect(normalizeHolidayDate("2026/13/1")).toBeNull();
    expect(normalizeHolidayDate("2026/2/30")).toBeNull();
    expect(normalizeHolidayDate("国民の祝日・休日月日")).toBeNull();
    expect(normalizeHolidayDate("")).toBeNull();
  });
});

describe("祝日CSVの変換", () => {
  // 内閣府CSVを模した入力（Shift-JISはデコード済みの想定）
  const csv = [
    "国民の祝日・休日月日,国民の祝日・休日名称",
    "2026/1/1,元日",
    "2026/5/3,憲法記念日",
    "2026/5/6,休日",
    "2027/1/1,元日",
    "", // 空行
    "不正な行",
  ].join("\n");

  it("ヘッダーと不正行を除いて祝日を抽出する", () => {
    const { holidays } = parseHolidayCsv(csv);
    expect(holidays["2026-01-01"]).toBe("元日");
    expect(holidays["2026-05-03"]).toBe("憲法記念日");
    // 振替休日・国民の休日はCSVの表記のまま保持する
    expect(holidays["2026-05-06"]).toBe("休日");
    expect(holidays["2027-01-01"]).toBe("元日");
    expect(Object.keys(holidays)).toHaveLength(4);
  });

  it("含まれる年を昇順で返す", () => {
    expect(parseHolidayCsv(csv).years).toEqual([2026, 2027]);
  });
});

describe("生成ファイルの更新判断（last-known-good維持）", () => {
  const existing = { _meta: { hash: "OLD" }, years: [2026], holidays: { "2026-01-01": "元日" } };
  const validCsv = "2026/1/1,元日\n2027/1/1,元日";

  it("取得成功かつハッシュが異なれば書き込む", () => {
    const decision = decideHolidayFileUpdate(existing, {
      ok: true,
      text: validCsv,
      hash: "NEW",
    });
    expect(decision.action).toBe("write");
  });

  it("ハッシュが一致すれば更新しない", () => {
    const decision = decideHolidayFileUpdate(existing, {
      ok: true,
      text: validCsv,
      hash: "OLD",
    });
    expect(decision.action).toBe("no-change");
  });

  it("取得失敗時は既存を維持する（削除しない）", () => {
    const decision = decideHolidayFileUpdate(existing, { ok: false, error: "network" });
    expect(decision.action).toBe("keep-last-known-good");
  });

  it("解釈0件のときも既存を維持する", () => {
    const decision = decideHolidayFileUpdate(existing, {
      ok: true,
      text: "ヘッダーのみ\n不正な行",
      hash: "NEW",
    });
    expect(decision.action).toBe("keep-last-known-good");
  });

  it("既存ファイルが無く取得も失敗したら初期生成が必要と判断する", () => {
    const decision = decideHolidayFileUpdate(null, { ok: false });
    expect(decision.action).toBe("initial-required");
  });
});
