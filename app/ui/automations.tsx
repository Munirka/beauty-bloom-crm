"use client";
import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  CheckCheck,
  BellRing,
  Flower2,
  Play,
  Plug,
  Download,
  RefreshCw,
} from "lucide-react";
import { kindLabels } from "@/lib/domain";
import { useStudio, Empty, ErrorText } from "./shared";
const flows = [
  {
    key: "confirmation",
    icon: CheckCheck,
    title: "Подтверждение записи",
    when: "Сразу после создания или переноса",
    description: "Клиент получает дату, время и название услуги.",
  },
  {
    key: "reminder",
    icon: BellRing,
    title: "Напоминание о визите",
    when: "За 24 часа до визита",
    description:
      "Если запись создана позже, напоминание ставится в очередь сразу.",
  },
  {
    key: "rebook",
    icon: Flower2,
    title: "Приглашение вернуться",
    when: "Через 21 день · волосы: 42 дня",
    description:
      "После завершённого визита, при согласии клиента на сообщения.",
  },
] as const;
const jobLabels: Record<string, string> = {
  pending: "В очереди",
  processing: "Отправляется",
  sent: "Отправлено",
  failed: "Ошибка",
  cancelled: "Отменено",
  skipped: "Нет email или согласия",
  demo_done: "Проверено в демо",
};
export function Automations() {
  const { data, run } = useStudio();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [integration, setIntegration] = useState(false),
    [token, setToken] = useState(""),
    [reset, setReset] = useState(false);
  async function perform(action: string, body: unknown, message: string) {
    setBusy(true);
    setError("");
    try {
      return await run(action, body, message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="automation-notice">
        <div>
          <Plug size={22} />
          <span>
            <strong>Очередь готова к подключению</strong>
            <p>
              В демо сообщения не отправляются. Для работы по расписанию
              подключите n8n и сервис email.
            </p>
          </span>
        </div>
        <Button variant="outline" onClick={() => setIntegration(true)}>
          Подключить n8n
        </Button>
      </div>
      <ErrorText error={error} />
      <div className="automation-cards">
        {flows.map(({ key, icon: Icon, title, when, description }) => (
          <section className="automation-card" key={key}>
            <div className="automation-card-top">
              <span className="service-icon pink">
                <Icon size={22} />
              </span>
              <Switch
                aria-label={title}
                checked={!!data.settings[key]}
                disabled={busy}
                onCheckedChange={(checked) => {
                  void perform(
                    "settings",
                    {
                      confirmation: !!data.settings.confirmation,
                      reminder: !!data.settings.reminder,
                      rebook: !!data.settings.rebook,
                      [key]: checked,
                    },
                    "Настройки сохранены",
                  );
                }}
              />
            </div>
            <h2>{title}</h2>
            <span className="flow-when">{when}</span>
            <p>{description}</p>
            <div className="flow-path">
              <span>Событие</span>
              <span>Очередь</span>
              <span>Email</span>
            </div>
            <small>{data.settings[key] ? "Включена" : "Приостановлена"}</small>
          </section>
        ))}
      </div>
      <div className="section-toolbar">
        <div>
          <h2>Журнал уведомлений</h2>
          <p>Статус каждой задачи и результат обработки.</p>
        </div>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            void perform(
              "automation/demo",
              {},
              "Демо-проверка выполнена. Внешние сообщения не отправлялись.",
            );
          }}
        >
          <Play size={16} /> Проверить в демо
        </Button>
      </div>
      <section className="table-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Клиент</TableHead>
              <TableHead>Сценарий</TableHead>
              <TableHead>Когда</TableHead>
              <TableHead>Статус</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.jobs.map((j) => (
              <TableRow key={j.id}>
                <TableCell>
                  <div className="cell-stack">
                    <strong>{j.client_name}</strong>
                    <small>{j.email || "Нет email"}</small>
                  </div>
                </TableCell>
                <TableCell title={j.message}>{kindLabels[j.kind]}</TableCell>
                <TableCell>
                  {new Intl.DateTimeFormat("ru-RU", {
                    timeZone: "Asia/Almaty",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(j.due_at)}
                </TableCell>
                <TableCell>
                  <span
                    className={"status " + j.status}
                    title={j.error ?? undefined}
                  >
                    {j.status === "pending" &&
                    !data.settings[j.kind as "reminder"]
                      ? "Приостановлено"
                      : (jobLabels[j.status] ?? j.status)}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!data.jobs.length && (
          <Empty
            title="Уведомлений пока нет"
            text="Они появятся после создания записи."
          />
        )}
      </section>
      <div className="reset-section">
        <span>Можно восстановить исходные данные вашей демо-студии.</span>
        <Button variant="ghost" onClick={() => setReset(true)}>
          <RefreshCw size={15} /> Сбросить демо
        </Button>
      </div>
      <Dialog
        open={integration}
        onOpenChange={(v) => {
          setIntegration(v);
          if (!v) setToken("");
        }}
      >
        <DialogContent className="studio-dialog">
          <DialogHeader>
            <DialogTitle>Подключение автоматизаций</DialogTitle>
            <DialogDescription>
              n8n забирает задачи каждые 5 минут и отправляет письма через ваш
              SMTP.
            </DialogDescription>
          </DialogHeader>
          <ol className="setup-steps">
            <li>Скачайте и импортируйте шаблон в n8n.</li>
            <li>Задайте переменные BEAUTY_BLOOM_URL и BEAUTY_BLOOM_TOKEN.</li>
            <li>Подключите SMTP к узлу «Send email» и включите сценарий.</li>
          </ol>
          <p className="form-hint">
            Адрес приложения:{" "}
            {typeof window !== "undefined" ? window.location.origin : ""}. Токен
            действует только для очереди этой студии. Повторное создание
            отзывает предыдущий.
          </p>
          <a
            className="download-link"
            href="/automation/beauty-bloom-n8n.json"
            download
          >
            <Download size={17} /> Скачать шаблон n8n
          </a>
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              const v = (await perform(
                "integration/key",
                {},
                "Токен создан",
              )) as { token: string } | undefined;
              if (v) setToken(v.token);
            }}
          >
            Создать токен подключения
          </Button>
          {token && (
            <div className="token-box">
              <label htmlFor="integration-token">
                Скопируйте токен сейчас — он показывается один раз
              </label>
              <textarea id="integration-token" readOnly value={token} />
            </div>
          )}
          <ErrorText error={error} />
        </DialogContent>
      </Dialog>
      <AlertDialog open={reset} onOpenChange={setReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Восстановить демо-студию?</AlertDialogTitle>
            <AlertDialogDescription>
              Ваши изменения в тестовых записях, клиентах и услугах будут
              заменены исходными вымышленными данными. Студии других посетителей
              не изменятся.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ErrorText error={error} />
          <AlertDialogFooter>
            <AlertDialogCancel>Назад</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={async (e) => {
                e.preventDefault();
                const v = await perform(
                  "reset",
                  {},
                  "Демо-данные восстановлены",
                );
                if (v) setReset(false);
              }}
            >
              Восстановить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
