import type { LocalizedText } from "../types";
import { translations, type TranslationKey } from "./translations";

export type Lang = "ja" | "en";

const STORAGE_KEY = "mapprofiler-lang";

function isLang(value: string | null): value is Lang {
  return value === "ja" || value === "en";
}

/** Nodeテスト環境(DOMなし)では常に既定言語(日本語)とする。 */
function detectBrowserLang(): Lang {
  if (typeof navigator === "undefined") return "ja";
  return navigator.language.toLowerCase().startsWith("ja") ? "ja" : "en";
}

/**
 * 表示言語を解決する(優先順: URLクエリ`?lang=`→保存済みの選択→ブラウザの言語設定)。
 * FOSS4G Hiroshima 2026のポスターセッション等で `?lang=en` を直接案内できるようにするため、
 * クエリパラメータを最優先とする。
 */
function resolveLang(): Lang {
  if (typeof window === "undefined") return "ja";

  const fromQuery = new URLSearchParams(window.location.search).get("lang");
  if (isLang(fromQuery)) {
    window.localStorage.setItem(STORAGE_KEY, fromQuery);
    return fromQuery;
  }

  const fromStorage = window.localStorage.getItem(STORAGE_KEY);
  if (isLang(fromStorage)) return fromStorage;

  return detectBrowserLang();
}

export const currentLang: Lang = resolveLang();

/** 表示言語を切り替え、ページを再読み込みする(状態を持つ画面が多く、再描画より再読込がシンプルなため)。 */
export function switchLang(lang: Lang): void {
  window.localStorage.setItem(STORAGE_KEY, lang);
  const url = new URL(window.location.href);
  url.searchParams.delete("lang");
  window.location.href = url.toString();
}

export function t(key: TranslationKey, vars?: Record<string, string | number>): string {
  let text = translations[currentLang][key];
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}

/** データ設定(タイル・DEMデータセット)に持たせた2言語テキストから現在の表示言語分を取り出す。 */
export function pick(text: LocalizedText): string {
  return text[currentLang];
}
