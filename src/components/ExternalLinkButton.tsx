/**
 * 外部リンクのボタン（要件15）。
 *
 * 検証済みのURLだけを受け取る。`target="_blank"` と
 * `rel="noopener noreferrer"` を必ず付け、外部サイトであることをアイコンで示す。
 */

import { EXTERNAL_LINK_ATTRIBUTES } from "@/lib/externalUrl";

type Props = {
  /** `validateExternalUrl` で検証済みのURL。 */
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
};

export function ExternalLinkButton({
  href,
  children,
  variant = "primary",
  className = "",
}: Props) {
  const base =
    "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-bold transition-colors";
  const styles =
    variant === "primary"
      ? "bg-blue-700 text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
      : "border-2 border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-muted)]";

  return (
    <a
      href={href}
      target={EXTERNAL_LINK_ATTRIBUTES.target}
      rel={EXTERNAL_LINK_ATTRIBUTES.rel}
      className={`${base} ${styles} ${className}`}
    >
      {children}
      <ExternalIcon />
    </a>
  );
}

/** 外部サイトであることを示すアイコン。 */
export function ExternalIcon() {
  return (
    <svg
      aria-label="外部サイトを新しいタブで開きます"
      role="img"
      viewBox="0 0 24 24"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  );
}
