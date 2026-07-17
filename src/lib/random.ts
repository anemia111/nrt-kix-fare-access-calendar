/**
 * シード付き疑似乱数。
 *
 * デモデータは決定論的である必要がある。理由は3つ:
 *  - リロードのたびに価格が変わると、デモだと分かっていても挙動が信用できない
 *  - 静的エクスポートしてもブラウザ内で同じ結果を再現できる
 *  - テストが安定する
 *
 * 暗号用途には使わない。
 */

/** FNV-1a による文字列ハッシュ。 */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32。0以上1未満の乱数を返す関数を作る。 */
export function mulberry32(seed: number): () => number {
    let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** キー文字列から決定論的な乱数生成器を作る。 */
export function seededRandom(key: string): () => number {
  return mulberry32(hashString(key));
}

/** min 以上 max 以下の整数を返す。 */
export function randomInt(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

/** 配列から1つ選ぶ。 */
export function pickOne<T>(random: () => number, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}
