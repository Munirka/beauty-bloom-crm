import { env } from "cloudflare:workers";
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import {
  dateInAlmaty,
  addDays,
  time,
  timestamp,
  weekday,
  availableSlots,
  bookingInput,
  clientInput,
  masterInput,
  serviceInput,
  dateInput,
  type Master,
  type Service,
  type Appointment,
} from "./domain";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
type Context = {
  workspace_id: string;
  role: string;
  master_id: string | null;
  expires_at: number;
};
const COOKIE = "beauty_bloom_session";
const db = () => {
  if (!env.DB)
    throw new ApiError(
      503,
      "Хранилище временно недоступно. Попробуйте ещё раз.",
    );
  return env.DB;
};
const statement = (sql: string, ...args: unknown[]) =>
  db()
    .prepare(sql)
    .bind(...args);
async function rows<T = Record<string, unknown>>(
  sql: string,
  ...args: unknown[]
): Promise<T[]> {
  return (await statement(sql, ...args).all<T>()).results;
}
async function first<T = Record<string, unknown>>(
  sql: string,
  ...args: unknown[]
): Promise<T | null> {
  return statement(sql, ...args).first<T>();
}
const uuid = () => crypto.randomUUID();
async function hash(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
function checkOrigin(req: Request) {
  if (req.headers.get("origin") !== new URL(req.url).origin)
    throw new ApiError(403, "Запрос должен быть отправлен из приложения.");
}
function admin(c: Context) {
  if (c.role !== "admin")
    throw new ApiError(403, "Это действие доступно администратору.");
}
async function log(c: Context, text: string) {
  await statement(
    "INSERT INTO audit (id,workspace_id,text,created_at) VALUES (?,?,?,?)",
    uuid(),
    c.workspace_id,
    text,
    Date.now(),
  ).run();
}

async function seed(workspaceId: string, owner: string | null) {
  const now = Date.now(),
    today = dateInAlmaty(now),
    prefix = (s: string) => workspaceId + "_" + s;
  const masters = [
    ["alina", "Алина", "Нейл-мастер", "nails", "pink", 540, 1140],
    ["diana", "Диана", "Нейл-мастер", "nails", "lilac", 540, 1140],
    ["sofia", "София", "Стилист", "hair", "peach", 600, 1140],
  ];
  const services = [
    ["manicure", "Маникюр + покрытие", "nails", 90, 9000],
    ["pedicure", "Педикюр + покрытие", "nails", 90, 12000],
    ["strength", "Укрепление ногтей", "nails", 60, 8000],
    ["haircut", "Стрижка + укладка", "hair", 60, 15000],
    ["color", "Окрашивание", "hair", 120, 25000],
    ["care", "Уход для волос", "hair", 60, 14000],
  ];
  const names = [
    "Аружан Садыкова",
    "Мария Ким",
    "Анна Ли",
    "Айгерим Омарова",
    "Екатерина Волкова",
    "Дана Ахметова",
    "Алина Петрова",
    "Мадина Касымова",
    "Дарья Соколова",
    "Сабина Нурова",
    "Юлия Орлова",
    "Алия Ибраева",
  ];
  const batch = [
    statement(
      "INSERT OR IGNORE INTO workspaces (id,owner,created_at) VALUES (?,?,?)",
      workspaceId,
      owner,
      now,
    ),
  ];
  for (const [id, name, specialty, category, color, start, end] of masters)
    batch.push(
      statement(
        "INSERT OR IGNORE INTO masters (id,workspace_id,name,specialty,category,color,start,end,days,active) VALUES (?,?,?,?,?,?,?,?,?,1)",
        prefix(String(id)),
        workspaceId,
        name,
        specialty,
        category,
        color,
        start,
        end,
        "[1,2,3,4,5,6]",
      ),
    );
  for (const [id, name, category, duration, price] of services)
    batch.push(
      statement(
        "INSERT OR IGNORE INTO services (id,workspace_id,name,category,duration,price,active) VALUES (?,?,?,?,?,?,1)",
        prefix(String(id)),
        workspaceId,
        name,
        category,
        duration,
        price,
      ),
    );
  names.forEach((name, i) =>
    batch.push(
      statement(
        "INSERT OR IGNORE INTO clients (id,workspace_id,name,phone,email,notes,consent,created_at) VALUES (?,?,?,?,?,?,1,?)",
        prefix("client" + i),
        workspaceId,
        name,
        "+700000000" + String(i + 1).padStart(2, "0"),
        "client" + (i + 1) + "@example.com",
        i === 0
          ? "Предпочитает короткую длину и нюдовые оттенки."
          : i === 5
            ? "Предпочитает запись после 14:00."
            : "",
        now - 86400000 * (i + 12),
      ),
    ),
  );
  const seeds: Array<{
    id: string;
    day: string;
    master: number;
    client: number;
    service: number;
    start: number;
    status: string;
  }> = [];
  for (let n = 21; n > 0; n--) {
    const day = addDays(today, -n);
    if (weekday(day) === 0) continue;
    for (let m = 0; m < 3; m++)
      seeds.push({
        id: "past" + n + "_" + m,
        day,
        master: m,
        client: (n + m * 3) % 12,
        service: m === 2 ? 3 : n % 2 === 0 ? 0 : 1,
        start: m === 2 ? 660 : 600 + m * 60,
        status: n === 4 && m === 1 ? "no_show" : "completed",
      });
  }
  const dayEntries = [
    [0, 0, 0, 600],
    [0, 1, 2, 750],
    [1, 2, 1, 630],
    [1, 3, 0, 840],
    [2, 4, 3, 660],
    [2, 5, 4, 900],
  ];
  for (let n = 0; n < 7; n++) {
    const day = addDays(today, n);
    if (weekday(day) === 0) continue;
    dayEntries.forEach(([master, client, service, start], i) => {
      if (n > 0 && i > 2) return;
      seeds.push({
        id: "next" + n + "_" + i,
        day,
        master,
        client: (client + n) % 12,
        service,
        start,
        status: "confirmed",
      });
    });
  }
  for (const a of seeds) {
    const s = services[a.service];
    batch.push(
      statement(
        "INSERT OR IGNORE INTO appointments (id,workspace_id,client_id,master_id,service_id,date,start,duration,price,service_name,status,notes,source,version,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1,?)",
        prefix(a.id),
        workspaceId,
        prefix("client" + a.client),
        prefix(String(masters[a.master][0])),
        prefix(String(s[0])),
        a.day,
        a.start,
        s[3],
        s[4],
        s[1],
        a.status,
        "",
        "admin",
        now - 86400000,
      ),
    );
    if (a.status === "confirmed") {
      const due = Math.max(now, timestamp(a.day, a.start) - 86400000);
      batch.push(
        statement(
          "INSERT OR IGNORE INTO jobs (id,workspace_id,appointment_id,kind,due_at,status,message,created_at) VALUES (?,?,?,?,?,?,?,?)",
          prefix("reminder" + a.id),
          workspaceId,
          prefix(a.id),
          "reminder",
          due,
          "pending",
          `Beauty Bloom: ждём вас ${a.day} в ${time(a.start)} на ${s[1]}.`,
          now,
        ),
      );
    }
  }
  batch.push(
    statement(
      "INSERT OR IGNORE INTO audit (id,workspace_id,text,created_at) VALUES (?,?,?,?)",
      prefix("welcome"),
      workspaceId,
      "Создана демонстрационная студия с вымышленными данными",
      now,
    ),
  );
  await db().batch(batch);
}

async function session(
  req: Request,
  create = false,
): Promise<{ ctx: Context; cookie?: string }> {
  const token = req.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(COOKIE + "="))
    ?.slice(COOKIE.length + 1);
  if (token) {
    const tokenHash = await hash(token);
    const ctx = await first<Context>(
      "SELECT workspace_id,role,master_id,expires_at FROM sessions WHERE hash=? AND expires_at>?",
      tokenHash,
      Date.now(),
    );
    if (ctx) {
      const user = await getChatGPTUser();
      const workspace = await first<{ owner: string | null }>(
        "SELECT owner FROM workspaces WHERE id=?",
        ctx.workspace_id,
      );
      if (user) {
        let owned = await first<{ id: string }>(
          "SELECT id FROM workspaces WHERE owner=?",
          user.userId,
        );
        if (!owned && workspace?.owner === null) {
          try {
            await statement(
              "UPDATE workspaces SET owner=? WHERE id=? AND owner IS NULL",
              user.userId,
              ctx.workspace_id,
            ).run();
          } catch (error) {
            if (!String(error).includes("UNIQUE")) throw error;
          }
          owned = await first<{ id: string }>(
            "SELECT id FROM workspaces WHERE owner=?",
            user.userId,
          );
        }
        if (!owned) {
          const id = "user_" + (await hash(user.userId)).slice(0, 32);
          await seed(id, user.userId);
          owned = { id };
        }
        if (owned.id !== ctx.workspace_id) {
          await statement(
            "UPDATE sessions SET workspace_id=?,role='admin',master_id=NULL WHERE hash=?",
            owned.id,
            tokenHash,
          ).run();
          return {
            ctx: {
              ...ctx,
              workspace_id: owned.id,
              role: "admin",
              master_id: null,
            },
          };
        }
        return { ctx };
      }
      if (workspace?.owner === null) return { ctx };
    }
  }
  if (!create)
    throw new ApiError(401, "Сессия завершилась. Обновите страницу.");
  const user = await getChatGPTUser();
  let workspaceId: string;
  if (user) {
    const existing = await first<{ id: string }>(
      "SELECT id FROM workspaces WHERE owner=?",
      user.userId,
    );
    workspaceId =
      existing?.id ?? "user_" + (await hash(user.userId)).slice(0, 32);
    if (!existing) await seed(workspaceId, user.userId);
  } else {
    workspaceId = uuid();
    await seed(workspaceId, null);
  }
  const raw = uuid() + uuid(),
    expires = Date.now() + 7 * 86400000;
  await statement(
    "INSERT INTO sessions (hash,workspace_id,role,expires_at) VALUES (?,?,?,?)",
    await hash(raw),
    workspaceId,
    "admin",
    expires,
  ).run();
  return {
    ctx: {
      workspace_id: workspaceId,
      role: "admin",
      master_id: null,
      expires_at: expires,
    },
    cookie: `${COOKIE}=${raw}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${new URL(req.url).protocol === "https:" ? "; Secure" : ""}`,
  };
}

const appointmentQuery =
  "SELECT a.*,c.name client_name,c.phone client_phone,c.email client_email,m.name master_name,m.color,m.category FROM appointments a JOIN clients c ON c.id=a.client_id JOIN masters m ON m.id=a.master_id WHERE a.workspace_id=?";
function testConfiguration() {
  const operator =
    env.BEAUTY_BLOOM_TEST_OPERATOR_EMAIL?.trim().toLowerCase() ?? "";
  const recipient = env.BEAUTY_BLOOM_TEST_RECIPIENT?.trim().toLowerCase() ?? "";
  return {
    operator,
    recipient,
    configured: !!operator && z.string().email().safeParse(recipient).success,
  };
}
async function testOperator(c: Context) {
  const config = testConfiguration(),
    user = await getChatGPTUser();
  if (
    !config.configured ||
    !user ||
    user.email.toLowerCase() !== config.operator
  )
    return false;
  const owned = await first(
    "SELECT id FROM workspaces WHERE id=? AND owner=?",
    c.workspace_id,
    user.userId,
  );
  return !!owned;
}
async function requireTestOperator(c: Context) {
  admin(c);
  if (!(await testOperator(c)))
    throw new ApiError(
      403,
      "Тестовая почта доступна только вошедшему владельцу приложения",
    );
}

async function bootstrap(c: Context) {
  const w = c.workspace_id;
  const masters = (
    await rows<Omit<Master, "days"> & { days: string }>(
      "SELECT * FROM masters WHERE workspace_id=? ORDER BY rowid",
      w,
    )
  ).map((m) => ({ ...m, days: JSON.parse(m.days) }));
  const appointments = await rows<Appointment>(
    appointmentQuery +
      (c.role === "master" ? " AND a.master_id=?" : "") +
      " ORDER BY a.date,a.start",
    ...(c.role === "master" ? [w, c.master_id] : [w]),
  );
  const clients = await rows(
    "SELECT * FROM clients WHERE workspace_id=?" +
      (c.role === "master"
        ? " AND id IN (SELECT client_id FROM appointments WHERE workspace_id=? AND master_id=?)"
        : "") +
      " ORDER BY name",
    ...(c.role === "master" ? [w, w, c.master_id] : [w]),
  );
  const settings = await first<{
    confirmation: number;
    reminder: number;
    rebook: number;
    integration_hash: string | null;
    delivery_mode: "demo" | "test";
    test_started_at: number | null;
  }>(
    "SELECT confirmation,reminder,rebook,integration_hash,delivery_mode,test_started_at FROM workspaces WHERE id=?",
    w,
  );
  const canTest = c.role === "admin" && (await testOperator(c));
  return {
    today: dateInAlmaty(),
    now: Date.now(),
    workspaceId: w,
    role: c.role,
    masterId: c.master_id,
    expiresAt: c.expires_at,
    masters,
    services: await rows(
      "SELECT * FROM services WHERE workspace_id=? ORDER BY rowid",
      w,
    ),
    clients,
    appointments,
    jobs:
      c.role === "admin"
        ? await rows(
            "SELECT j.*,c.name client_name,c.email FROM jobs j JOIN appointments a ON a.id=j.appointment_id JOIN clients c ON c.id=a.client_id WHERE j.workspace_id=? ORDER BY j.created_at DESC LIMIT 100",
            w,
          )
        : [],
    audit:
      c.role === "admin"
        ? await rows(
            "SELECT * FROM audit WHERE workspace_id=? ORDER BY created_at DESC LIMIT 20",
            w,
          )
        : [],
    settings: {
      confirmation: settings?.confirmation ?? 1,
      reminder: settings?.reminder ?? 1,
      rebook: settings?.rebook ?? 1,
      integrationReady: !!settings?.integration_hash,
      deliveryMode: settings?.delivery_mode ?? "demo",
      testAvailable: canTest,
      testEmail: canTest ? testConfiguration().recipient : null,
      testStartedAt: settings?.test_started_at ?? null,
    },
  };
}

async function appointment(c: Context, id: string) {
  const a = await first<Appointment>(
    appointmentQuery + " AND a.id=?",
    c.workspace_id,
    id,
  );
  if (!a) throw new ApiError(404, "Запись не найдена");
  if (c.role === "master" && a.master_id !== c.master_id)
    throw new ApiError(403, "Доступны только ваши записи");
  return a;
}
async function master(c: Context, id: string) {
  const m = await first<Omit<Master, "days"> & { days: string }>(
    "SELECT * FROM masters WHERE workspace_id=? AND id=?",
    c.workspace_id,
    id,
  );
  if (!m) throw new ApiError(404, "Мастер не найден");
  return { ...m, days: JSON.parse(m.days) } as Master;
}
async function service(c: Context, id: string, existing = false) {
  const s = await first<Service>(
    "SELECT * FROM services WHERE workspace_id=? AND id=?" +
      (existing ? "" : " AND active=1"),
    c.workspace_id,
    id,
  );
  if (!s) throw new ApiError(404, "Услуга недоступна");
  return s;
}
async function validateSlot(
  c: Context,
  masterId: string,
  serviceId: string,
  date: string,
  start: number,
  excludeId?: string,
  duration?: number,
) {
  const m = await master(c, masterId),
    s = await service(c, serviceId, !!excludeId);
  if (duration) s.duration = duration;
  if (date < dateInAlmaty() || date > addDays(dateInAlmaty(), 90))
    throw new ApiError(400, "Выберите дату в ближайшие 90 дней");
  const busy = await rows<Appointment>(
    "SELECT * FROM appointments WHERE workspace_id=? AND date=? AND master_id=?",
    c.workspace_id,
    date,
    masterId,
  );
  if (!availableSlots(m, s, date, busy, Date.now(), excludeId).includes(start))
    throw new ApiError(
      409,
      "Время уже занято или вне графика мастера. Выберите другое.",
    );
  return { m, s };
}
async function addClient(c: Context, input: unknown) {
  const v = clientInput.parse(input),
    id = uuid();
  const existing = await first<{ id: string }>(
    "SELECT id FROM clients WHERE workspace_id=? AND phone=?",
    c.workspace_id,
    v.phone,
  );
  if (existing) return existing.id;
  await statement(
    "INSERT OR IGNORE INTO clients (id,workspace_id,name,phone,email,notes,consent,created_at) VALUES (?,?,?,?,?,?,?,?)",
    id,
    c.workspace_id,
    v.name,
    v.phone,
    v.email,
    v.notes,
    v.consent ? 1 : 0,
    Date.now(),
  ).run();
  return (await first<{ id: string }>(
    "SELECT id FROM clients WHERE workspace_id=? AND phone=?",
    c.workspace_id,
    v.phone,
  ))!.id;
}
function jobInsert(
  c: Context,
  id: string,
  kind: string,
  dueAt: number,
  message: string,
) {
  return statement(
    `INSERT INTO jobs (id,workspace_id,appointment_id,kind,due_at,status,message,created_at) SELECT ?,?,?,?, ?,CASE WHEN c.email='' OR c.consent=0 THEN 'skipped' ELSE 'pending' END,?,? FROM appointments a JOIN clients c ON c.id=a.client_id WHERE a.id=? AND a.workspace_id=?`,
    uuid(),
    c.workspace_id,
    id,
    kind,
    dueAt,
    message,
    Date.now(),
    id,
    c.workspace_id,
  );
}
async function createBooking(c: Context, input: unknown, publicFlow = false) {
  if (!publicFlow) admin(c);
  const v = bookingInput.parse(input);
  if (publicFlow && v.clientId)
    throw new ApiError(400, "Укажите контакты клиента");
  const { s } = await validateSlot(c, v.masterId, v.serviceId, v.date, v.start);
  const clientId = v.clientId ?? (await addClient(c, v.client));
  if (
    !(await first(
      "SELECT id FROM clients WHERE workspace_id=? AND id=?",
      c.workspace_id,
      clientId,
    ))
  )
    throw new ApiError(404, "Клиент не найден");
  const id = uuid(),
    now = Date.now();
  const insert = statement(
    `INSERT INTO appointments (id,workspace_id,client_id,master_id,service_id,date,start,duration,price,service_name,status,notes,source,created_at) SELECT ?,?,?,?,?,?,?,?,?,?,'confirmed',?,?,? WHERE NOT EXISTS (SELECT 1 FROM appointments WHERE workspace_id=? AND master_id=? AND date=? AND status NOT IN ('cancelled','no_show') AND start<? AND start+duration>?)`,
    id,
    c.workspace_id,
    clientId,
    v.masterId,
    v.serviceId,
    v.date,
    v.start,
    s.duration,
    s.price,
    s.name,
    v.notes,
    publicFlow ? "online" : "admin",
    now,
    c.workspace_id,
    v.masterId,
    v.date,
    v.start + s.duration,
    v.start,
  );
  const result = await db().batch([
    insert,
    jobInsert(
      c,
      id,
      "confirmation",
      now,
      `Beauty Bloom: запись подтверждена. ${v.date}, ${time(v.start)}, ${s.name}.`,
    ),
    jobInsert(
      c,
      id,
      "reminder",
      Math.max(now, timestamp(v.date, v.start) - 86400000),
      `Beauty Bloom: ждём вас ${v.date} в ${time(v.start)} на ${s.name}.`,
    ),
  ]);
  if (!result[0].meta.changes)
    throw new ApiError(409, "Это время только что заняли. Выберите другое.");
  await log(
    c,
    `Новая ${publicFlow ? "онлайн-" : ""}запись: ${s.name}, ${v.date} ${time(v.start)}`,
  );
  return { id, date: v.date, start: v.start, service: s.name, price: s.price };
}

async function mutate(c: Context, path: string, body: unknown) {
  const b = body as Record<string, unknown>;
  if (path === "session/role") {
    const v = z
      .object({
        role: z.enum(["admin", "master"]),
        masterId: z.string().nullable().optional(),
      })
      .parse(body);
    if (v.role === "master") {
      if (!v.masterId) throw new ApiError(400, "Выберите мастера");
      await master(c, v.masterId);
    }
    return { role: v.role, masterId: v.role === "master" ? v.masterId : null };
  }
  if (path === "appointments") return createBooking(c, body);
  if (path === "appointments/status") {
    const v = z
        .object({
          id: z.string(),
          version: z.number().int(),
          status: z.enum(["completed", "cancelled", "no_show", "confirmed"]),
        })
        .parse(body),
      a = await appointment(c, v.id);
    if (v.status === "confirmed") {
      admin(c);
      throw new ApiError(
        400,
        "Создайте новую запись вместо восстановления отменённой",
      );
    }
    if (a.status !== "confirmed" || a.version !== v.version)
      throw new ApiError(
        409,
        "Запись уже обработана или изменилась. Обновите страницу.",
      );
    const result = await db().batch([
      statement(
        "UPDATE appointments SET status=?,version=version+1 WHERE id=? AND workspace_id=? AND version=? AND status=?",
        v.status,
        v.id,
        c.workspace_id,
        v.version,
        "confirmed",
      ),
      statement(
        `UPDATE jobs SET status='cancelled',lease=NULL,lease_until=NULL WHERE appointment_id=? AND workspace_id=? AND status IN ('pending','processing','failed') AND EXISTS (SELECT 1 FROM appointments WHERE id=? AND workspace_id=? AND version=? AND status=?)`,
        v.id,
        c.workspace_id,
        v.id,
        c.workspace_id,
        v.version + 1,
        v.status,
      ),
    ]);
    if (!result[0].meta.changes)
      throw new ApiError(409, "Запись изменилась в другой вкладке");
    if (v.status === "completed")
      await jobInsert(
        c,
        v.id,
        "rebook",
        Date.now() + (a.category === "hair" ? 42 : 21) * 86400000,
        `Beauty Bloom: пора обновить ваш образ. Будем рады новой встрече!`,
      ).run();
    await log(
      c,
      `${v.status === "completed" ? "Завершён визит" : v.status === "cancelled" ? "Отменена запись" : "Отмечена неявка"}: ${a.client_name}`,
    );
    return { ok: true };
  }
  if (path === "appointments/move") {
    admin(c);
    const v = z
        .object({
          id: z.string(),
          version: z.number().int(),
          date: dateInput,
          start: z.number().int(),
          masterId: z.string(),
        })
        .parse(body),
      a = await appointment(c, v.id);
    if (a.status !== "confirmed" || a.version !== v.version)
      throw new ApiError(
        409,
        "Запись уже обработана или изменилась. Обновите страницу.",
      );
    await validateSlot(
      c,
      v.masterId,
      a.service_id,
      v.date,
      v.start,
      a.id,
      a.duration,
    );
    const result = await db().batch([
      statement(
        `UPDATE appointments SET date=?,start=?,master_id=?,version=version+1 WHERE id=? AND workspace_id=? AND version=? AND status='confirmed' AND NOT EXISTS (SELECT 1 FROM appointments x WHERE x.workspace_id=? AND x.master_id=? AND x.date=? AND x.id!=? AND x.status NOT IN ('cancelled','no_show') AND x.start<? AND x.start+x.duration>?)`,
        v.date,
        v.start,
        v.masterId,
        v.id,
        c.workspace_id,
        v.version,
        c.workspace_id,
        v.masterId,
        v.date,
        v.id,
        v.start + a.duration,
        v.start,
      ),
      statement(
        `UPDATE jobs SET status='cancelled',lease=NULL,lease_until=NULL WHERE workspace_id=? AND appointment_id=? AND kind IN ('confirmation','reminder') AND status IN ('pending','processing','failed') AND EXISTS (SELECT 1 FROM appointments WHERE id=? AND version=?)`,
        c.workspace_id,
        v.id,
        v.id,
        v.version + 1,
      ),
    ]);
    if (!result[0].meta.changes)
      throw new ApiError(
        409,
        "Время занято или запись изменилась. Обновите данные.",
      );
    await db().batch([
      jobInsert(
        c,
        a.id,
        "confirmation",
        Date.now(),
        `Beauty Bloom: запись перенесена на ${v.date}, ${time(v.start)}.`,
      ),
      jobInsert(
        c,
        a.id,
        "reminder",
        Math.max(Date.now(), timestamp(v.date, v.start) - 86400000),
        `Beauty Bloom: ждём вас ${v.date} в ${time(v.start)} на ${a.service_name}.`,
      ),
    ]);
    await log(c, `Перенос: ${a.client_name}, ${v.date} ${time(v.start)}`);
    return { ok: true };
  }
  if (path === "clients") {
    admin(c);
    return { id: await addClient(c, body) };
  }
  if (path === "clients/update") {
    admin(c);
    const id = z.string().parse(b.id),
      v = clientInput.parse(b);
    const exists = await first(
      "SELECT id FROM clients WHERE workspace_id=? AND id=?",
      c.workspace_id,
      id,
    );
    if (!exists) throw new ApiError(404, "Клиент не найден");
    await statement(
      "UPDATE clients SET name=?,phone=?,email=?,notes=?,consent=? WHERE workspace_id=? AND id=?",
      v.name,
      v.phone,
      v.email,
      v.notes,
      v.consent ? 1 : 0,
      c.workspace_id,
      id,
    ).run();
    if (!v.consent || !v.email)
      await statement(
        `UPDATE jobs SET status='skipped',lease=NULL,lease_until=NULL WHERE workspace_id=? AND appointment_id IN (SELECT id FROM appointments WHERE workspace_id=? AND client_id=?) AND status IN ('pending','processing','failed')`,
        c.workspace_id,
        c.workspace_id,
        id,
      ).run();
    await log(c, `Обновлена карточка клиента: ${v.name}`);
    return { ok: true };
  }
  if (path === "masters") {
    admin(c);
    const v = masterInput.parse(body),
      id = typeof b.id === "string" ? b.id : uuid();
    if (typeof b.id === "string") {
      await master(c, id);
      const appointments = await rows<Appointment>(
        "SELECT * FROM appointments WHERE workspace_id=? AND master_id=? AND date>=? AND status=?",
        c.workspace_id,
        id,
        dateInAlmaty(),
        "confirmed",
      );
      if (
        appointments.some(
          (a) =>
            !v.active ||
            a.start < v.start ||
            a.start + a.duration > v.end ||
            !v.days.includes(weekday(a.date)),
        )
      )
        throw new ApiError(
          409,
          "В новом графике есть активные записи. Сначала перенесите или отмените их",
        );
      const old = await master(c, id);
      if (old.category !== v.category && appointments.length)
        throw new ApiError(
          409,
          "Нельзя менять специализацию при активных записях",
        );
      await statement(
        "UPDATE masters SET name=?,specialty=?,category=?,color=?,start=?,end=?,days=?,active=? WHERE workspace_id=? AND id=?",
        v.name,
        v.specialty,
        v.category,
        v.color,
        v.start,
        v.end,
        JSON.stringify(v.days),
        v.active ? 1 : 0,
        c.workspace_id,
        id,
      ).run();
    } else
      await statement(
        "INSERT INTO masters (id,workspace_id,name,specialty,category,color,start,end,days,active) VALUES (?,?,?,?,?,?,?,?,?,?)",
        id,
        c.workspace_id,
        v.name,
        v.specialty,
        v.category,
        v.color,
        v.start,
        v.end,
        JSON.stringify(v.days),
        v.active ? 1 : 0,
      ).run();
    await log(c, `Сохранён график мастера: ${v.name}`);
    return { id };
  }
  if (path === "services") {
    admin(c);
    const v = serviceInput.parse(body),
      id = typeof b.id === "string" ? b.id : uuid();
    if (typeof b.id === "string") {
      const existing = await first<{ category: string }>(
        "SELECT * FROM services WHERE workspace_id=? AND id=?",
        c.workspace_id,
        id,
      );
      if (!existing) throw new ApiError(404, "Услуга не найдена");
      if (
        existing.category !== v.category &&
        (await first(
          "SELECT id FROM appointments WHERE workspace_id=? AND service_id=? AND status='confirmed' LIMIT 1",
          c.workspace_id,
          id,
        ))
      )
        throw new ApiError(
          409,
          "Сначала перенесите активные записи перед изменением направления услуги",
        );
      await statement(
        "UPDATE services SET name=?,category=?,duration=?,price=?,active=? WHERE workspace_id=? AND id=?",
        v.name,
        v.category,
        v.duration,
        v.price,
        v.active ? 1 : 0,
        c.workspace_id,
        id,
      ).run();
    } else
      await statement(
        "INSERT INTO services (id,workspace_id,name,category,duration,price,active) VALUES (?,?,?,?,?,?,?)",
        id,
        c.workspace_id,
        v.name,
        v.category,
        v.duration,
        v.price,
        v.active ? 1 : 0,
      ).run();
    await log(c, `Сохранена услуга: ${v.name}`);
    return { id };
  }
  if (path === "settings") {
    admin(c);
    const v = z
      .object({
        confirmation: z.boolean(),
        reminder: z.boolean(),
        rebook: z.boolean(),
      })
      .parse(body);
    await statement(
      "UPDATE workspaces SET confirmation=?,reminder=?,rebook=? WHERE id=?",
      +v.confirmation,
      +v.reminder,
      +v.rebook,
      c.workspace_id,
    ).run();
    return { ok: true };
  }
  if (path === "automation/demo") {
    admin(c);
    const mode = await first<{ delivery_mode: string }>(
      "SELECT delivery_mode FROM workspaces WHERE id=?",
      c.workspace_id,
    );
    if (mode?.delivery_mode === "test")
      throw new ApiError(
        409,
        "Приостановите тестовую отправку перед демо-проверкой",
      );
    const w = await first<Record<string, number>>(
      "SELECT confirmation,reminder,rebook FROM workspaces WHERE id=?",
      c.workspace_id,
    );
    const result = await statement(
      `UPDATE jobs SET status='demo_done',finished_at=? WHERE workspace_id=? AND status='pending' AND due_at<=? AND ((kind='confirmation' AND ?=1) OR (kind='reminder' AND ?=1) OR (kind='rebook' AND ?=1))`,
      Date.now(),
      c.workspace_id,
      Date.now(),
      w?.confirmation,
      w?.reminder,
      w?.rebook,
    ).run();
    await log(
      c,
      `Демо-проверка автоматизаций: ${result.meta.changes} уведомлений. Внешние сообщения не отправлялись`,
    );
    return { count: result.meta.changes };
  }
  if (path === "automation/test-mode") {
    await requireTestOperator(c);
    const { enabled } = z.object({ enabled: z.boolean() }).parse(body);
    await statement(
      "UPDATE workspaces SET delivery_mode=?,test_started_at=CASE WHEN ?=1 THEN COALESCE(test_started_at,?) ELSE test_started_at END WHERE id=?",
      enabled ? "test" : "demo",
      +enabled,
      Date.now(),
      c.workspace_id,
    ).run();
    await log(
      c,
      enabled
        ? "Включена тестовая отправка только на разрешённый адрес"
        : "Тестовая отправка приостановлена",
    );
    return { ok: true };
  }
  if (path === "automation/test-ready") {
    await requireTestOperator(c);
    const { id } = z.object({ id: z.string() }).parse(body),
      config = testConfiguration();
    const result = await statement(
      `UPDATE jobs SET due_at=? WHERE workspace_id=? AND id=? AND kind IN ('reminder','rebook') AND status IN ('pending','failed') AND attempts<5 AND EXISTS (SELECT 1 FROM workspaces w JOIN appointments a ON a.id=jobs.appointment_id JOIN clients c ON c.id=a.client_id WHERE w.id=jobs.workspace_id AND w.delivery_mode='test' AND jobs.created_at>=w.test_started_at AND lower(c.email)=? AND c.consent=1 AND ((jobs.kind='reminder' AND a.status='confirmed') OR (jobs.kind='rebook' AND a.status='completed')))`,
      Date.now(),
      c.workspace_id,
      id,
      config.recipient,
    ).run();
    if (!result.meta.changes)
      throw new ApiError(409, "Эта задача недоступна для ускоренного теста");
    await log(
      c,
      "Уведомление поставлено в очередь сейчас для проверки доставки",
    );
    return { ok: true };
  }
  if (path === "integration/key") {
    admin(c);
    const token = uuid() + uuid();
    await statement(
      "UPDATE workspaces SET integration_hash=? WHERE id=?",
      await hash(token),
      c.workspace_id,
    ).run();
    return { token };
  }
  if (path === "reset") {
    admin(c);
    const w = c.workspace_id;
    const deletes = [
      "jobs",
      "audit",
      "appointments",
      "clients",
      "masters",
      "services",
    ].map((table) => statement(`DELETE FROM ${table} WHERE workspace_id=?`, w));
    await db().batch(deletes);
    const owner = await first<{ owner: string | null }>(
      "SELECT owner FROM workspaces WHERE id=?",
      w,
    );
    await seed(w, owner?.owner ?? null);
    return { ok: true };
  }
  throw new ApiError(404, "Действие не найдено");
}

async function integration(req: Request, path: string) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token || token.length < 50)
    throw new ApiError(401, "Нужен токен интеграции");
  const workspace = await first<{
    id: string;
    confirmation: number;
    reminder: number;
    rebook: number;
    delivery_mode: string;
    test_started_at: number | null;
  }>(
    "SELECT id,confirmation,reminder,rebook,delivery_mode,test_started_at FROM workspaces WHERE integration_hash=?",
    await hash(token),
  );
  if (!workspace) throw new ApiError(401, "Токен интеграции недействителен");
  if (path === "integration/claim") {
    const config = testConfiguration();
    if (
      !config.configured ||
      workspace.delivery_mode !== "test" ||
      !workspace.test_started_at
    )
      return { mode: "demo", jobs: [] };
    const lease = uuid(),
      now = Date.now();
    await statement(
      `UPDATE jobs SET lease=?,lease_until=?,status='processing',attempts=attempts+1 WHERE id IN (SELECT j.id FROM jobs j JOIN appointments a ON a.id=j.appointment_id JOIN clients c ON c.id=a.client_id WHERE j.workspace_id=? AND j.due_at<=? AND j.attempts<5 AND (j.status IN ('pending','failed') OR (j.status='processing' AND j.lease_until<?)) AND c.consent=1 AND lower(c.email)=? AND j.created_at>=? AND ((j.kind='rebook' AND a.status='completed' AND ?=1) OR (j.kind='confirmation' AND a.status='confirmed' AND ?=1) OR (j.kind='reminder' AND a.status='confirmed' AND ?=1)) ORDER BY j.due_at LIMIT 20)`,
      lease,
      now + 600000,
      workspace.id,
      now,
      now,
      config.recipient,
      workspace.test_started_at,
      workspace.rebook,
      workspace.confirmation,
      workspace.reminder,
    ).run();
    return {
      mode: "test",
      jobs: await rows(
        "SELECT j.id,j.kind,'[ТЕСТ Beauty Bloom] ' || j.message AS message,j.lease,c.email FROM jobs j JOIN appointments a ON a.id=j.appointment_id JOIN clients c ON c.id=a.client_id WHERE j.workspace_id=? AND j.lease=?",
        workspace.id,
        lease,
      ),
    };
  }
  if (path === "integration/ack") {
    const v = z
      .object({
        id: z.string(),
        lease: z.string(),
        success: z.boolean(),
        error: z.string().max(500).optional(),
      })
      .parse(await req.json());
    const result = await statement(
      `UPDATE jobs SET status=?,finished_at=?,error=?,lease=NULL,lease_until=NULL,due_at=? WHERE workspace_id=? AND id=? AND lease=? AND status='processing' AND lease_until>=?`,
      v.success ? "sent" : "failed",
      v.success ? Date.now() : null,
      v.success ? null : (v.error ?? "Ошибка отправки"),
      Date.now() + 300000,
      workspace.id,
      v.id,
      v.lease,
      Date.now(),
    ).run();
    if (!result.meta.changes)
      throw new ApiError(409, "Задача уже обработана или срок обработки истёк");
    return { ok: true };
  }
  throw new ApiError(404, "Действие не найдено");
}

export async function handle(req: Request) {
  let cookie: string | undefined;
  try {
    const url = new URL(req.url),
      path = url.pathname.replace(/^\/api\//, "");
    let result: unknown;
    if (path.startsWith("integration/") && path !== "integration/key") {
      if (req.method !== "POST") throw new ApiError(405, "Используйте POST");
      result = await integration(req, path);
    } else {
      if (req.method === "POST") checkOrigin(req);
      const resolved = await session(
        req,
        path === "bootstrap" || path === "public",
      );
      cookie = resolved.cookie;
      const c = resolved.ctx;
      if (req.method === "GET" && path === "bootstrap")
        result = await bootstrap(c);
      else if (path === "public") {
        const target = url.searchParams.get("studio") ?? c.workspace_id;
        if (!(await first("SELECT id FROM workspaces WHERE id=?", target)))
          throw new ApiError(404, "Студия не найдена");
        const publicContext = { ...c, workspace_id: target, role: "customer" };
        if (req.method === "GET") {
          const publicSettings = await first<{ delivery_mode: string }>(
            "SELECT delivery_mode FROM workspaces WHERE id=?",
            target,
          );
          const masters = (
            await rows<Omit<Master, "days"> & { days: string }>(
              "SELECT * FROM masters WHERE workspace_id=? AND active=1 ORDER BY rowid",
              target,
            )
          ).map((m) => ({ ...m, days: JSON.parse(m.days) }));
          result = {
            today: dateInAlmaty(),
            now: Date.now(),
            workspaceId: target,
            testBooking:
              publicSettings?.delivery_mode === "test" &&
              testConfiguration().configured,
            masters,
            services: await rows(
              "SELECT * FROM services WHERE workspace_id=? AND active=1 ORDER BY rowid",
              target,
            ),
            appointments: await rows(
              "SELECT id,date,master_id,start,duration,status FROM appointments WHERE workspace_id=? AND date>=? AND date<=? AND status NOT IN ('cancelled','no_show')",
              target,
              dateInAlmaty(),
              addDays(dateInAlmaty(), 90),
            ),
          };
        } else {
          const count = await first<{ n: number }>(
            "SELECT count(*) n FROM appointments WHERE workspace_id=? AND source='online' AND created_at>?",
            target,
            Date.now() - 86400000,
          );
          if ((count?.n ?? 0) >= 50)
            throw new ApiError(429, "Достигнут дневной лимит демо-записей");
          const body = (await req.json()) as { client?: { email?: string } };
          const targetSettings = await first<{ delivery_mode: string }>(
            "SELECT delivery_mode FROM workspaces WHERE id=?",
            target,
          );
          const isTestAddress =
            targetSettings?.delivery_mode === "test" &&
            testConfiguration().configured &&
            body.client?.email?.trim().toLowerCase() ===
              testConfiguration().recipient;
          if (
            body?.client?.email &&
            !String(body.client.email).endsWith("@example.com") &&
            !isTestAddress
          )
            throw new ApiError(
              400,
              "В публичном демо используйте email с окончанием @example.com",
            );
          result = await createBooking(publicContext, body, true);
        }
      } else if (req.method === "POST") {
        const body = await req.json();
        result = await mutate(c, path, body);
        if (path === "session/role") {
          const v = result as { role: string; masterId: string | null };
          const token = req.headers
            .get("cookie")!
            .split(";")
            .map((s) => s.trim())
            .find((s) => s.startsWith(COOKIE + "="))!
            .slice(COOKIE.length + 1);
          await statement(
            "UPDATE sessions SET role=?,master_id=? WHERE hash=?",
            v.role,
            v.masterId,
            await hash(token),
          ).run();
        }
      } else throw new ApiError(404, "Страница не найдена");
    }
    return Response.json(result, {
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        ...(cookie ? { "Set-Cookie": cookie } : {}),
      },
    });
  } catch (error) {
    const status =
      error instanceof ApiError
        ? error.status
        : error instanceof z.ZodError
          ? 400
          : String(error).includes("UNIQUE constraint")
            ? 409
            : 500;
    const message =
      error instanceof ApiError
        ? error.message
        : error instanceof z.ZodError
          ? error.issues[0]?.message
          : String(error).includes("UNIQUE constraint")
            ? "Такой телефон уже есть в базе"
            : "Не удалось выполнить действие. Данные формы сохранены — попробуйте ещё раз.";
    if (status === 500) console.error("Beauty Bloom API", error);
    return Response.json(
      { error: message },
      {
        status,
        headers: {
          "Cache-Control": "no-store",
          ...(cookie ? { "Set-Cookie": cookie } : {}),
        },
      },
    );
  }
}
