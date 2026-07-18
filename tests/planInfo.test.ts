import { describe, expect, it } from "vitest";
import { buildPlan, judgeOvernight } from "@/services/planInfo";
import { defaultPlanConditions } from "@/domain/planSearch";
import { clockOfJstDateTime } from "@/lib/time";

const CALCULATED_AT = "2026-07-17T09:00:00+09:00";

function conditions(overrides: Partial<ReturnType<typeof defaultPlanConditions>> = {}) {
  return { ...defaultPlanConditions("2026-07-21"), ...overrides };
}

describe("実用モードの計画（架空データを含まない）", () => {
  it("対象路線を運航する Peach とジェットスターを返す", () => {
    const plan = buildPlan(conditions(), CALCULATED_AT);
    const codes = plan.carriers.map((carrier) => carrier.airlineCode).sort();
    expect(codes).toEqual(["GK", "MM"]);
  });

  it("価格・空席・便時刻・便名を一切持たない", () => {
    const plan = buildPlan(conditions(), CALCULATED_AT);
    const json = JSON.stringify(plan);
    // 架空の価格や空席を表す語が計画データに含まれないこと
    expect(json).not.toContain("totalPriceYen");
    expect(json).not.toContain("availability");
    expect(json).not.toContain("flightNumber");
    for (const carrier of plan.carriers) {
      expect(carrier).not.toHaveProperty("price");
      expect(carrier).not.toHaveProperty("seats");
    }
  });

  it("出発時刻が未入力なら空港到着目標を計算しない", () => {
    const plan = buildPlan(conditions({ departureTime: null }), CALCULATED_AT);
    for (const carrier of plan.carriers) {
      expect(carrier.boarding).toBeNull();
      expect(carrier.overnight).toBeNull();
    }
  });

  it("出発時刻を入力すると空港到着目標を計算する", () => {
    const plan = buildPlan(conditions({ departureTime: "08:15" }), CALCULATED_AT);
    const peach = plan.carriers.find((carrier) => carrier.airlineCode === "MM");
    expect(peach?.boarding).not.toBeNull();
    // Peach 成田第1ターミナル: 保安検査25分前・搭乗口20分前 → 空港到着目標は 08:15 より前
    expect(peach?.boarding && clockOfJstDateTime(peach.boarding.airportStationTargetAt) < "08:15").toBe(
      true,
    );
  });

  it("各社の情報に出所（provenance）と最終確認日が付く", () => {
    const plan = buildPlan(conditions(), CALCULATED_AT);
    for (const carrier of plan.carriers) {
      expect(["official", "manualVerified", "unavailable"]).toContain(carrier.provenance.kind);
      if (carrier.provenance.kind === "official") {
        expect(carrier.provenance.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it("公式リンクは航空会社の公式ドメインを指す", () => {
    const plan = buildPlan(conditions(), CALCULATED_AT);
    const peach = plan.carriers.find((carrier) => carrier.airlineCode === "MM");
    expect(peach?.officialLink.ok).toBe(true);
    if (peach?.officialLink.ok) {
      expect(peach.officialLink.host).toContain("flypeach.com");
    }
  });
});

describe("前泊の判断", () => {
  it("早朝の空港到着目標は前泊検討を促す", () => {
    const result = judgeOvernight("2026-07-21T04:30:00+09:00");
    expect(result.recommend).toBe(true);
    expect(result.note).toContain("公式の経路検索");
  });

  it("通常時間帯は前泊必須にしないが、公式確認を促す", () => {
    const result = judgeOvernight("2026-07-21T09:00:00+09:00");
    expect(result.recommend).toBe(false);
    expect(result.note).toContain("公式の経路検索");
  });

  it("料金を推測した数値を含めない", () => {
    const result = judgeOvernight("2026-07-21T04:00:00+09:00");
    expect(`${result.reason}${result.note}`).not.toMatch(/\d+\s*円/);
  });
});
