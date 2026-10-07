"use client";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  Clock3,
  Check,
  CalendarClock,
  Phone,
  Mail,
} from "lucide-react";
import { dateLabel, time, money, statusLabels } from "@/lib/domain";
import { useStudio, ErrorText } from "./shared";
import { BookingDialog } from "./booking-form";
export function AppointmentDetail({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const { data, run } = useStudio();
  const a = data.appointments.find((x) => x.id === id);
  const [moving, setMoving] = useState(false),
    [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function status(value: string) {
    if (!a) return;
    setBusy(true);
    setError("");
    try {
      await run(
        "appointments/status",
        { id: a.id, version: a.version, status: value },
        "Статус записи обновлён",
      );
      setConfirm("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Sheet
        open={!!a}
        onOpenChange={(v) => {
          if (!v) {
            onClose();
            setError("");
          }
        }}
      >
        <SheetContent className="detail-sheet">
          <SheetHeader>
            <SheetTitle>Детали визита</SheetTitle>
            <SheetDescription>{a?.service_name}</SheetDescription>
          </SheetHeader>
          {a && (
            <div className="detail-body">
              <div className="detail-person">
                <span className={"avatar large " + a.color}>
                  {a.client_name[0]}
                </span>
                <h2>{a.client_name}</h2>
                <span className={"status " + a.status}>
                  {statusLabels[a.status]}
                </span>
              </div>
              <div className="detail-lines">
                <span>
                  <CalendarDays size={18} />
                  {dateLabel(a.date, {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <span>
                  <Clock3 size={18} />
                  {time(a.start)}–{time(a.start + a.duration)} · {a.duration}{" "}
                  мин
                </span>
                <span>
                  <Phone size={18} />
                  {a.client_phone}
                </span>
                {a.client_email && (
                  <span>
                    <Mail size={18} />
                    {a.client_email}
                  </span>
                )}
              </div>
              <div className="rail-divider" />
              <div className="rail-meta">
                <span>Мастер</span>
                <strong>{a.master_name}</strong>
              </div>
              <div className="rail-meta">
                <span>Стоимость визита</span>
                <strong>{money(a.price)}</strong>
              </div>
              <div className="rail-meta">
                <span>Источник</span>
                <strong>
                  {a.source === "online" ? "Онлайн-запись" : "Администратор"}
                </strong>
              </div>
              {a.notes && (
                <div className="note-block">
                  <h3>Комментарий</h3>
                  <p>{a.notes}</p>
                </div>
              )}
              <ErrorText error={error} />
              {a.status === "confirmed" && (
                <div className="detail-actions">
                  <Button
                    className="primary-button"
                    disabled={busy}
                    onClick={() => status("completed")}
                  >
                    <Check size={17} /> Завершить визит
                  </Button>
                  {data.role === "admin" && (
                    <Button variant="outline" onClick={() => setMoving(true)}>
                      <CalendarClock size={17} /> Перенести
                    </Button>
                  )}
                  <div className="form-row">
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => setConfirm("no_show")}
                    >
                      Не пришёл
                    </Button>
                    <Button
                      variant="outline"
                      className="danger-text"
                      disabled={busy}
                      onClick={() => setConfirm("cancelled")}
                    >
                      Отменить запись
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
      {a && (
        <BookingDialog
          open={moving}
          onClose={() => setMoving(false)}
          date={a.date < data.today ? data.today : a.date}
          moving={a}
        />
      )}
      <AlertDialog
        open={!!confirm}
        onOpenChange={(v) => {
          if (!v) setConfirm("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "no_show" ? "Отметить неявку?" : "Отменить запись?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Время освободится в расписании. Ожидающие уведомления по записи
              будут отменены.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ErrorText error={error} />
          <AlertDialogFooter>
            <AlertDialogCancel>Назад</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void status(confirm);
              }}
            >
              Подтвердить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
