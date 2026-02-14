import { Head, Html, Main, NextScript } from "next/document";

const THEME_BOOTSTRAP = `
(function () {
  try {
    var themeKey = "theme-preference";
    var saved = window.localStorage.getItem(themeKey);
    var theme = (saved === "dark" || saved === "light")
      ? saved
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;

    var localeKey = "ui-locale";
    var localeSaved = window.localStorage.getItem(localeKey);
    var locale = (localeSaved === "ru" || localeSaved === "en")
      ? localeSaved
      : (window.navigator.language.toLowerCase().indexOf("ru") === 0 ? "ru" : "en");
    document.documentElement.lang = locale;

    var perfKey = "performance-mode";
    var perfSaved = window.localStorage.getItem(perfKey);
    var perfMode = (perfSaved === "performance" || perfSaved === "quality" || perfSaved === "auto")
      ? perfSaved
      : "auto";
    var reduced = perfMode === "performance";
    if (perfMode === "auto") {
      var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      var lowCpu = (navigator.hardwareConcurrency || 8) <= 4;
      var lowMemory = typeof navigator.deviceMemory === "number" && navigator.deviceMemory <= 4;
      reduced = reducedMotion || lowCpu || lowMemory;
    }
    document.documentElement.setAttribute("data-performance", reduced ? "performance" : "quality");
  } catch (e) {}
})();
`;

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
