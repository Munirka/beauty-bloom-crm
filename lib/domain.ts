import { z } from "zod";
export type Master = {
  id: string;
  name: string;
  specialty: string;
  category: "nails" | "hair";
  color: string;
  start: number;
  end: number;
  days: number[];
  active: number;
};
export type Service = {
  id: string;
  name: string;
  category: "nails" | "hair";
  duration: number;
  price: number;
  active: number;
};
export type Client = {
  id: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
  consent: number;
  created_at: number;
};
export type Appointment = {
  id: string;
  client_id: string;
  master_id: string;
  service_id: string;
  date: string;
  start: number;
  duration: number;
  price: number;
  service_name: string;
  status: "confirmed" | "completed" | "cancelled" | "no_show";
  notes: string;
  source: string;
  version: number;
  created_at: number;
  client_name: string;
  client_phone: string;
  client_email: string;
  master_name: string;
  color: string;
  category: string;
};
export type Job = {
  id: string;
  appointment_id: string;
  kind: string;
  due_at: number;
  status: string;
  message: string;
  attempts: number;
  error: string | null;
  finished_at: number | null;
  client_name: string;
  email: string;
};
export type StudioData = {
  today: string;
  now: number;
  workspaceId: string;
  role: "admin" | "master";
  masterId: string | null;
  masters: Master[];
  services: Service[];
  clients: Client[];
  appointments: Appointment[];
  jobs: Job[];
  audit: { id: string; text: string; created_at: number }[];
  settings: {
    confirmation: number;
    reminder: number;
    rebook: number;
    integrationReady: boolean;
  };
  expiresAt: number;
};
export const money = (n: number) =>
  new Intl.NumberFormat("ru-RU").format(n) + " ₸";
export const time = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
export function dateInAlmaty(now = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Almaty",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
}
export function addDays(date: string, n: number) {
  return new Date(new Date(date + "T12:00:00Z").getTime() + n * 86400000)
    .toISOString()
    .slice(0, 10);
}
export function weekday(date: string) {
  return new Date(date + "T12:00:00Z").getUTCDay();
}
export const timestamp = (date: string, start: number) =>
  new Date(`${date}T${time(start)}:00+05:00`).getTime();
export function dateLabel(
  date: string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" },
) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Almaty",
    ...options,
  }).format(new Date(date + "T12:00:00+05:00"));
}
export function availableSlots(
  master: Master,
  service: Service,
  date: string,
  appointments: Pick<
    Appointment,
    "id" | "date" | "master_id" | "start" | "duration" | "status"
  >[],
  now = Date.now(),
  excludeId?: string,
) {
  if (
    !master.active ||
    master.category !== service.category ||
    !master.days.includes(weekday(date))
  )
    return [];
  const busy = appointments.filter(
    (a) =>
      a.id !== excludeId &&
      a.master_id === master.id &&
      a.date === date &&
      a.status !== "cancelled" &&
      a.status !== "no_show",
  );
  const result: number[] = [];
  for (
    let start = master.start;
    start + service.duration <= master.end;
    start += 30
  ) {
    if (timestamp(date, start) <= now) continue;
    if (
      !busy.some(
        (a) =>
          start < a.start + a.duration && start + service.duration > a.start,
      )
    )
      result.push(start);
  }
  return result;
}
export const statusLabels: Record<string, string> = {
  confirmed: "Подтверждено",
  completed: "Завершено",
  cancelled: "Отменено",
  no_show: "Не пришёл",
};
export const kindLabels: Record<string, string> = {
  confirmation: "Подтверждение",
  reminder: "Напоминание",
  rebook: "Повторная запись",
};
const name = z.string().trim().min(2, "Укажите имя, минимум 2 символа").max(80);
const phone = z
  .string()
  .trim()
  .transform((s) => s.replace(/[^+\d]/g, ""))
  .refine((s) => /^\+?\d{10,15}$/.test(s), "Укажите телефон: от 10 до 15 цифр");
export const clientInput = z.object({
  name,
  phone,
  email: z
    .union([z.literal(""), z.string().email("Проверьте email")])
    .default(""),
  notes: z.string().max(1500).default(""),
  consent: z.boolean().default(false),
});
export const dateInput = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(s + "T12:00:00Z");
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "Некорректная дата");
export const bookingInput = z
  .object({
    clientId: z.string().optional(),
    client: clientInput.optional(),
    masterId: z.string().min(1),
    serviceId: z.string().min(1),
    date: dateInput,
    start: z.number().int().min(0).max(1439),
    notes: z.string().max(1500).default(""),
  })
  .refine(
    (x) => !!x.clientId || !!x.client,
    "Выберите клиента или укажите его контакты",
  );
export const masterInput = z
  .object({
    name,
    specialty: z.string().trim().min(2).max(80),
    category: z.enum(["nails", "hair"]),
    color: z.enum(["pink", "lilac", "peach", "mint"]),
    start: z.number().int().min(360).max(1200),
    end: z.number().int().min(360).max(1380),
    days: z.array(z.number().int().min(0).max(6)).min(1),
    active: z.boolean().default(true),
  })
  .refine(
    (x) => x.end > x.start,
    "Конец рабочего дня должен быть позже начала",
  );
export const serviceInput = z.object({
  name,
  category: z.enum(["nails", "hair"]),
  duration: z
    .number()
    .int()
    .min(30)
    .max(300)
    .refine((n) => n % 30 === 0, "Длительность должна быть кратна 30 минутам"),
  price: z.number().int().min(0).max(1000000),
  active: z.boolean().default(true),
});
