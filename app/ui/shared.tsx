"use client";
import { createContext, useContext, type ReactNode } from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Flower2, Loader2 } from "lucide-react";
import { type StudioData, time } from "@/lib/domain";
export async function api<T = unknown>(
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch("/api/" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || "Не удалось загрузить данные");
  return data;
}
export const StudioContext = createContext<{
  data: StudioData;
  reload: () => Promise<void>;
  run: (path: string, body: unknown, message?: string) => Promise<unknown>;
}>({} as never);
export const useStudio = () => useContext(StudioContext);
export function Choice({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="form-select" aria-label={label}>
          <SelectValue placeholder="Выберите" />
        </SelectTrigger>
        <SelectContent position="popper">
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}
export function Slots({
  slots,
  value,
  onChange,
}: {
  slots: number[];
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div className="field">
      <span className="field-label">Свободное время</span>
      {slots.length ? (
        <RadioGroup
          aria-label="Свободное время"
          value={value === null ? "" : String(value)}
          onValueChange={(v) => onChange(Number(v))}
          className="slot-grid"
        >
          {slots.map((s) => (
            <label
              className={"slot " + (value === s ? "selected" : "")}
              key={s}
            >
              <RadioGroupItem value={String(s)} className="sr-only" />
              {time(s)}
            </label>
          ))}
        </RadioGroup>
      ) : (
        <div className="empty-small">
          На эту дату нет свободного времени. Выберите другой день или мастера.
        </div>
      )}
    </div>
  );
}
export function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Flower2 size={36} strokeWidth={1.2} />
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}
export function Submit({
  busy,
  label = "Сохранить",
}: {
  busy: boolean;
  label?: string;
}) {
  return (
    <Button type="submit" className="primary-button" disabled={busy}>
      {busy ? <Loader2 size={17} className="animate-spin" /> : null}
      {busy ? "Сохраняем…" : label}
    </Button>
  );
}
export function ErrorText({ error }: { error: string }) {
  return error ? (
    <div className="form-error" role="alert">
      {error}
    </div>
  ) : null;
}
