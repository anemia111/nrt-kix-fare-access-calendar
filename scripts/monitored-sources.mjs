/**
 * 日次監視の対象となる公式ページ一覧。
 *
 * ここに載せるのは「公式サイトの一次情報」だけ。値（締切時間など）を自動で
 * 書き換えることはしない。変更が検出されたら人手での確認を促す。
 */

export const MONITORED_SOURCES = [
  {
    id: "peach-checkin",
    name: "Peach 国内線 搭乗案内",
    url: "https://www.flypeach.com/lm/ai/airports/checkin",
    manualCheckItems: ["チェックイン締切", "手荷物預け締切", "保安検査通過", "搭乗口締切"],
  },
  {
    id: "peach-nrt",
    name: "Peach 成田空港案内",
    url: "https://www.flypeach.com/lm/ai/airports/airportguide_domestic/nrt",
    manualCheckItems: ["利用ターミナル", "空港内の締切時刻"],
  },
  {
    id: "peach-kix",
    name: "Peach 関西空港案内",
    url: "https://www.flypeach.com/lm/ai/airports/airportguide_domestic/kix",
    manualCheckItems: ["利用ターミナル", "第2ターミナルへのアクセス"],
  },
  {
    id: "jetstar-airport-timing",
    name: "ジェットスター 空港手続きの締切",
    url: "https://www.jetstar.com/jp/ja/help/when-do-i-need-to-get-to-the-airport",
    manualCheckItems: ["カウンター締切", "搭乗ゲート締切", "オンラインチェックイン締切"],
  },
  {
    id: "jetstar-nrt-t3",
    name: "ジェットスター 成田空港 第3ターミナル案内",
    url: "https://www.jetstar.com/jp/ja/help/nrt-t3",
    manualCheckItems: ["ターミナルへのアクセス", "徒歩・連絡バスの所要時間"],
  },
  {
    id: "ana-domestic-checkin",
    name: "ANA 国内線 搭乗手続きの流れ",
    url: "https://www.ana.co.jp/ja/jp/guide/boarding-procedures/checkin/domestic/flow_airport/",
    manualCheckItems: ["保安検査通過締切", "搭乗口締切"],
  },
  {
    id: "jal-domestic-attention",
    name: "JAL 国内線 ご搭乗のお客さまへのお願い",
    url: "https://www.jal.co.jp/jp/ja/dom/boarding_attention/",
    manualCheckItems: ["保安検査通過締切", "搭乗口締切", "手荷物締切"],
  },
  {
    id: "narita-terminal-t3",
    name: "成田空港 空港第2ビル駅と第3ターミナル間の移動",
    url: "https://www.narita-airport.jp/ja/access/train/railway-route-3/",
    manualCheckItems: ["徒歩所要時間", "連絡バス所要時間"],
  },
  {
    id: "kansai-terminal-t2",
    name: "関西空港 第2ターミナルへの連絡バス",
    url: "https://www.kansai-airport.or.jp/access/t2",
    manualCheckItems: ["連絡バス所要時間", "乗り場"],
  },
  {
    id: "cao-holidays-page",
    name: "内閣府 国民の祝日について",
    url: "https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html",
    manualCheckItems: ["祝日の追加・変更"],
  },
  {
    id: "cao-holidays-csv",
    name: "内閣府 国民の祝日CSV",
    url: "https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv",
    manualCheckItems: ["CSVの内容変更（holidays.generated.json の再生成が必要）"],
  },
];
