"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Flower2,
  CalendarDays,
  Users,
  Scissors,
  LayoutDashboard,
  Zap,
  Plus,
  ExternalLink,
  Sparkles,
  RefreshCw,
  Loader2,
} from "lucide-react";
import {
  Sidebar,
  SidebarProvider,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Toaster, toast } from "sonner";
import { type StudioData } from "@/lib/domain";
import { StudioContext, api, Choice, Empty } from "./ui/shared";
import { Schedule } from "./ui/schedule";
import { Clients } from "./ui/clients";
import { Team } from "./ui/team";
import { Overview } from "./ui/overview";
import { Automations } from "./ui/automations";
import { BookingDialog } from "./ui/booking-form";
import { AppointmentDetail } from "./ui/appointment-detail";
const navigation = [
  {
    id: "overview",
    icon: LayoutDashboard,
    label: "Обзор",
    title: "Студия в цифрах",
    subtitle: "Красота в деталях. Результаты — в цифрах.",
  },
  {
    id: "schedule",
    icon: CalendarDays,
    label: "Расписание",
    title: "Расписание студии",
    subtitle: "Всё готово для красивого дня.",
  },
  {
    id: "clients",
    icon: Users,
    label: "Клиенты",
    title: "Ваши клиенты",
    subtitle: "Помнить детали — значит заботиться.",
  },
  {
    id: "team",
    icon: Scissors,
    label: "Мастера и услуги",
    title: "Команда красоты",
    subtitle: "Люди и услуги, за которыми возвращаются.",
  },
  {
    id: "automations",
    icon: Zap,
    label: "Автоматизации",
    title: "Забота без рутины",
    subtitle: "Сценарии, которые помогают оставаться на связи.",
  },
];
export default function Studio({
  signedIn = false,
  signInPath = "/signin-with-chatgpt?return_to=%2F",
}: {
  signedIn?: boolean;
  signInPath?: string;
}) {
  const [data, setData] = useState<StudioData | null>(null),
    [error, setError] = useState(""),
    [view, setView] = useState("schedule"),
    [date, setDate] = useState(""),
    [booking, setBooking] = useState<{
      date: string;
      masterId?: string;
    } | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [roleBusy, setRoleBusy] = useState(false);
  const reload = useCallback(async () => {
    const d = await api<StudioData>("bootstrap");
    setData(d);
    setDate((v) => v || d.today);
    setError("");
  }, []);
  useEffect(() => {
    void api<StudioData>("bootstrap")
      .then((d) => {
        setData(d);
        setDate((v) => v || d.today);
        setError("");
        const initial = new URLSearchParams(window.location.search).get("view");
        if (navigation.some((n) => n.id === initial)) setView(initial!);
      })
      .catch((e) => setError(e.message));
    const pop = () =>
      setView(
        new URLSearchParams(window.location.search).get("view") ?? "schedule",
      );
    window.addEventListener("popstate", pop);
    const id = setInterval(() => {
      void reload().catch(() => {});
    }, 45000);
    return () => {
      window.removeEventListener("popstate", pop);
      clearInterval(id);
    };
  }, [reload]);
  const navigate = (id: string) => {
    setView(id);
    window.scrollTo({ top: 0, behavior: "instant" });
    history.pushState(null, "", id === "schedule" ? "/" : "/?view=" + id);
  };
  const run = useCallback(
    async (path: string, body: unknown, message?: string) => {
      try {
        const result = await api(path, body);
        await reload();
        if (message) toast.success(message);
        return result;
      } catch (e) {
        void reload().catch(() => {});
        throw e;
      }
    },
    [reload],
  );
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (tool: unknown, options: unknown) => unknown;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    const tools = [
      {
        name: "read_studio_schedule",
        title: "Посмотреть расписание студии",
        description:
          "Read visible studio appointments for a date. Does not change data.",
        inputSchema: {
          type: "object",
          properties: { date: { type: "string" } },
          required: ["date"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: async (input: unknown) => {
          const d = (input as { date?: unknown })?.date;
          if (typeof d !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d))
            throw new Error("Date must be YYYY-MM-DD");
          const current = await api<StudioData>("bootstrap");
          setData(current);
          return {
            date: d,
            appointments: current.appointments
              .filter((a) => a.date === d)
              .map((a) => ({
                id: a.id,
                start: a.start,
                duration: a.duration,
                client: a.client_name,
                service: a.service_name,
                master: a.master_name,
                status: a.status,
              })),
          };
        },
      },
      {
        name: "start_studio_booking",
        title: "Открыть форму записи",
        description:
          "Open and stage the visible booking form for an administrator. Does not create an appointment.",
        inputSchema: {
          type: "object",
          properties: { date: { type: "string" } },
          required: ["date"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: (input: unknown) => {
          const d = (input as { date?: unknown })?.date;
          if (typeof d !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d))
            throw new Error("Date must be YYYY-MM-DD");
          if (data?.role !== "admin")
            throw new Error("Administrator role is required");
          setBooking({ date: d });
          return { opened: true, date: d };
        },
      },
    ];
    for (const t of tools) {
      try {
        void Promise.resolve(
          context.registerTool(t, { signal: controller.signal }),
        ).catch(() => {});
      } catch {}
    }
    return () => controller.abort();
  }, [data?.role]);
  const current = navigation.find((n) => n.id === view) ?? navigation[1];
  const roleValue =
    data?.role === "master" ? "master:" + data.masterId : "admin";
  return (
    <SidebarProvider
      style={{ "--sidebar-width": "230px" } as React.CSSProperties}
    >
      <Sidebar className="studio-sidebar">
        <SidebarHeader>
          <Link href="/" className="brand">
            <Flower2 size={35} strokeWidth={1.2} />
            <span>
              beauty<span>bloom.</span>
            </span>
          </Link>
          <div className="salon-location">СТУДИЯ КРАСОТЫ · АЛМАТЫ</div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navigation
              .filter((n) => data?.role !== "master" || n.id !== "automations")
              .map(({ id, icon: Icon, label }) => (
                <SidebarMenuItem key={id}>
                  <SidebarMenuButton
                    isActive={view === id}
                    className="nav-button"
                    onClick={() => navigate(id)}
                  >
                    <Icon size={20} />
                    <span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
          </SidebarMenu>
          <div className="sidebar-note">
            <Sparkles size={20} />
            <p>
              Каждый визит —<br />
              маленькое преображение.
            </p>
          </div>
        </SidebarContent>
        <SidebarFooter>
          {data && (
            <Choice
              label="Режим демо"
              value={roleValue}
              disabled={roleBusy}
              onChange={async (v) => {
                setRoleBusy(true);
                try {
                  await run(
                    "session/role",
                    v === "admin"
                      ? { role: "admin" }
                      : { role: "master", masterId: v.slice(7) },
                  );
                  navigate("schedule");
                  setSelected(null);
                  setBooking(null);
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setRoleBusy(false);
                }
              }}
              options={[
                { value: "admin", label: "Администратор" },
                ...data.masters
                  .filter((m) => m.active)
                  .map((m) => ({
                    value: "master:" + m.id,
                    label: "Мастер · " + m.name,
                  })),
              ]}
            />
          )}
          <div className="profile">
            <span className="avatar">
              {data?.role === "master"
                ? data.masters.find((m) => m.id === data.masterId)?.name[0]
                : "А"}
            </span>
            <div>
              <strong>
                {data?.role === "master"
                  ? data.masters.find((m) => m.id === data.masterId)?.name
                  : "Администратор"}
              </strong>
              <small>Beauty Bloom</small>
            </div>
          </div>
          <span className="demo-note">Демо · вымышленные данные</span>
          {!signedIn && (
            <a href={signInPath} target="_top" className="save-studio-link">
              Войти через ChatGPT
            </a>
          )}
          {signedIn && (
            <a
              href="/signout-with-chatgpt?return_to=%2F"
              target="_top"
              className="save-studio-link"
            >
              Выйти из аккаунта
            </a>
          )}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="studio-main">
        <header className="topbar">
          <div className="topbar-title">
            <SidebarTrigger className="md:hidden" />
            <span>Рабочее пространство</span>
            <span className="crumb">/</span>
            <strong>{current.label}</strong>
          </div>
          <div className="topbar-actions">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Обновить данные"
              onClick={() => {
                void reload().catch((e) => toast.error(e.message));
              }}
            >
              <RefreshCw size={16} />
            </Button>
            <a
              className="booking-link"
              href={
                data
                  ? "/booking?studio=" + encodeURIComponent(data.workspaceId)
                  : "/booking"
              }
              target="_blank"
              rel="noopener"
            >
              Онлайн-запись <ExternalLink size={15} />
            </a>
          </div>
        </header>
        <div className="workspace">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                BEAUTY BLOOM ·{" "}
                {data?.role === "master"
                  ? "КАБИНЕТ МАСТЕРА"
                  : "РАБОЧИЙ ДЕНЬ СТУДИИ"}
              </div>
              <h1>
                {current.title}
                <span>.</span>
              </h1>
              <p>{current.subtitle}</p>
            </div>
            {data?.role === "admin" && view !== "automations" && (
              <Button
                className="primary-button"
                onClick={() =>
                  setBooking({ date: date < data.today ? data.today : date })
                }
              >
                <Plus size={18} /> Новая запись
              </Button>
            )}
          </div>
          {data ? (
            <StudioContext.Provider value={{ data, reload, run }}>
              {view === "schedule" && (
                <Schedule
                  date={date}
                  setDate={setDate}
                  onCreate={(d, m) =>
                    setBooking({
                      date: d < data.today ? data.today : d,
                      masterId: m,
                    })
                  }
                  onDetail={setSelected}
                  onAutomations={() => navigate("automations")}
                />
              )}{" "}
              {view === "overview" && <Overview onDetail={setSelected} />}{" "}
              {view === "clients" && <Clients onDetail={setSelected} />}{" "}
              {view === "team" && <Team />}{" "}
              {view === "automations" && data.role === "admin" && (
                <Automations />
              )}
              <BookingDialog
                open={!!booking}
                onClose={() => setBooking(null)}
                date={booking?.date ?? date}
                masterId={booking?.masterId}
              />
              <AppointmentDetail
                id={selected}
                onClose={() => setSelected(null)}
              />
            </StudioContext.Provider>
          ) : error ? (
            <Empty
              title="Не удалось открыть студию"
              text={error}
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setError("");
                    void reload().catch((e) => setError(e.message));
                  }}
                >
                  Попробовать снова
                </Button>
              }
            />
          ) : (
            <div className="loading-state" role="status">
              <Loader2 className="animate-spin" />
              Открываем вашу студию…
            </div>
          )}
          <footer className="workspace-footer">
            <span>Beauty Bloom · портфолио-проект</span>
            <span>Время Алматы · ₸ KZT</span>
          </footer>
        </div>
      </SidebarInset>
      <Toaster position="bottom-right" richColors closeButton />
    </SidebarProvider>
  );
}
