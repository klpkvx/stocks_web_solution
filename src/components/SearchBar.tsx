import TickerSearchInput from "@/components/TickerSearchInput";
import { useI18n } from "@/components/I18nProvider";

export default function SearchBar({
  placeholder,
  onSubmit
}: {
  placeholder?: string;
  onSubmit: (value: string) => void;
}) {
  const { t } = useI18n();
  return (
    <TickerSearchInput
      className="z-[140]"
      placeholder={placeholder}
      buttonLabel={t("search.analyze")}
      inputAriaLabel={t("layout.searchTicker")}
      onSubmit={onSubmit}
    />
  );
}
