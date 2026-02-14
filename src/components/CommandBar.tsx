import { useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { parseCommand } from "@/lib/nlp";

export default function CommandBar({
  onCommand
}: {
  onCommand: (action: ReturnType<typeof parseCommand>) => void;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState("");

  return (
    <div className="glass rounded-3xl px-6 py-5">
      <p className="text-xs uppercase tracking-[0.3em] text-muted">
        {t("command.center")}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          className="flex-1 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm text-ink placeholder:text-muted outline-none transition focus:border-glow/60"
          placeholder={t("command.placeholder")}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && value.trim()) {
              event.preventDefault();
              onCommand(parseCommand(value));
              setValue("");
            }
          }}
        />
        <button
          className="rounded-full bg-gradient-to-r from-glow to-lavender px-5 py-3 text-sm font-semibold text-night shadow-glow transition hover:opacity-90"
          onClick={() => {
            if (!value.trim()) return;
            onCommand(parseCommand(value));
            setValue("");
          }}
        >
          {t("command.run")}
        </button>
      </div>
      <p className="mt-3 text-xs text-muted">
        {t("command.hint")}
      </p>
    </div>
  );
}
