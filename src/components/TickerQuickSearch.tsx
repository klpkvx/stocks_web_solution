import { useRouter } from "next/router";
import { useI18n } from "@/components/I18nProvider";
import TickerSearchInput from "@/components/TickerSearchInput";

export default function TickerQuickSearch({
  className = "",
  compact = true
}: {
  className?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <div className={`relative z-[140] ${compact ? "w-[220px]" : "w-full"} ${className}`}>
      <TickerSearchInput
        compact={compact}
        placeholder={t("search.ticker")}
        buttonLabel={t("search.go")}
        inputAriaLabel={t("layout.searchTicker")}
        onSubmit={(ticker) => router.push(`/stock/${ticker}`)}
      />
    </div>
  );
}
