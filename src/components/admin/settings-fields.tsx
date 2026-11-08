import type { FieldSpec } from "@/server/settings/fields";

/** Server-renderable inputs for a settings group (values come from the parsed settings). */
export function SettingsFields({ fields, values, prefix }: { fields: FieldSpec[]; values: Record<string, unknown>; prefix: string }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {fields.map((f) => {
        const id = `${prefix}-${f.name}`;
        const v = values[f.name];
        const wide = f.type === "textarea" || f.type === "lines" || f.type === "links";
        if (f.type === "bool")
          return (
            <label key={f.name} className="flex items-start gap-2.5 text-[14px] md:col-span-2">
              <input type="checkbox" name={f.name} defaultChecked={Boolean(v)} className="checkbox mt-0.5" />
              <span>
                {f.label}
                {f.hint ? <span className="block text-[12.5px] text-muted">{f.hint}</span> : null}
              </span>
            </label>
          );
        return (
          <div key={f.name} className={wide ? "md:col-span-2" : ""}>
            <label htmlFor={id} className="field-label">
              {f.label}
            </label>
            {f.type === "textarea" ? (
              <textarea id={id} name={f.name} defaultValue={String(v ?? "")} className="textarea min-h-[80px]" />
            ) : f.type === "lines" ? (
              <textarea id={id} name={f.name} defaultValue={Array.isArray(v) ? v.join("\n") : ""} className="textarea min-h-[100px]" />
            ) : f.type === "links" ? (
              <textarea id={id} name={f.name} defaultValue={Array.isArray(v) ? (v as { label: string; url: string }[]).map((l) => `${l.label} | ${l.url}`).join("\n") : ""} className="textarea min-h-[100px] font-mono text-[13px]" />
            ) : f.type === "select" ? (
              <select id={id} name={f.name} defaultValue={String(v ?? "")} className="select">
                {f.options?.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input id={id} name={f.name} type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"} defaultValue={String(v ?? "")} className="input" />
            )}
            {f.hint ? <p className="field-hint">{f.hint}</p> : null}
          </div>
        );
      })}
    </div>
  );
}
