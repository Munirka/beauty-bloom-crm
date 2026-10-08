"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Flower2, Check, CalendarDays, Clock3, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type Master,
  type Service,
  type Appointment,
  dateLabel,
  time,
  money,
} from "@/lib/domain";
import { AppointmentForm } from "../ui/booking-form";
import { api, Empty } from "../ui/shared";
type PublicData = {
  today: string;
  now: number;
  workspaceId: string;
  testBooking: boolean;
  masters: Master[];
  services: Service[];
  appointments: Appointment[];
};
export default function BookingPage() {
  const [data, setData] = useState<PublicData | null>(null),
    [error, setError] = useState(""),
    [success, setSuccess] = useState<{
      date: string;
      start: number;
      service: string;
      price: number;
    } | null>(null),
    [studio, setStudio] = useState("");
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("studio");
    void api<PublicData>(
      "public" + (id ? "?studio=" + encodeURIComponent(id) : ""),
    )
      .then((d) => {
        setStudio(id ?? "");
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, []);
  return (
    <div className="booking-page">
      <header className="booking-header">
        <Link href="/" className="booking-brand">
          <Flower2 size={31} strokeWidth={1.2} />
          <span>beauty bloom.</span>
        </Link>
        <span>АЛМАТЫ · СТУДИЯ КРАСОТЫ</span>
      </header>
      <main className="booking-layout">
        <aside className="booking-intro">
          <div className="eyebrow">ВРЕМЯ ДЛЯ СЕБЯ</div>
          <h1>
            Ваш маленький
            <br />
            ритуал красоты<span>.</span>
          </h1>
          <p>
            Маникюр, уход за волосами и внимание к каждой детали. Выберите
            удобное время — мы будем ждать вас.
          </p>
          <div className="booking-details">
            <span>
              <CalendarDays size={18} /> Понедельник — суббота
            </span>
            <span>
              <Clock3 size={18} /> 09:00–19:00 · время Алматы
            </span>
          </div>
          <div className="booking-demo-note">
            <strong>Демонстрационный салон</strong>
            <p>
              {data?.testBooking
                ? "Включена проверка email на одном разрешённом адресе. Салон и остальные контакты вымышлены."
                : "Записи сохраняются в тестовой студии. Используйте вымышленные контакты."}
            </p>
          </div>
          <Link href="/" className="text-button">
            Открыть CRM студии
          </Link>
        </aside>
        <section className="booking-form-card">
          {success ? (
            <div className="booking-success">
              <span className="success-icon">
                <Check size={34} />
              </span>
              <h2>Вы записаны!</h2>
              <p>{success.service}</p>
              <div className="success-summary">
                <span>
                  {dateLabel(success.date, {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}{" "}
                  · {time(success.start)}
                </span>
                <strong>{money(success.price)}</strong>
              </div>
              <p className="form-hint">
                {data?.testBooking
                  ? "Запись сохранена. При согласии на уведомления письмо на разрешённый email появится в очереди. Доставку можно проверить после запуска n8n."
                  : "Запись появилась в расписании студии. В демо внешние сообщения не отправляются."}
              </p>
              <Button
                variant="outline"
                onClick={async () => {
                  const d = await api<PublicData>(
                    "public" +
                      (studio ? "?studio=" + encodeURIComponent(studio) : ""),
                  );
                  setData(d);
                  setSuccess(null);
                }}
              >
                Записаться ещё
              </Button>
            </div>
          ) : data ? (
            <>
              <h2>Записаться в студию</h2>
              <p className="booking-form-caption">
                Выберите услугу, мастера и свободное время.
              </p>
              <AppointmentForm
                masters={data.masters}
                services={data.services}
                appointments={data.appointments}
                today={data.today}
                now={data.now}
                publicFlow
                testBooking={data.testBooking}
                onSubmit={async (value) => {
                  try {
                    const result = await api<typeof success>(
                      "public?studio=" + encodeURIComponent(data.workspaceId),
                      value,
                    );
                    setSuccess(result);
                  } catch (e) {
                    const d = await api<PublicData>(
                      "public?studio=" + encodeURIComponent(data.workspaceId),
                    );
                    setData(d);
                    throw e;
                  }
                }}
              />
            </>
          ) : error ? (
            <Empty title="Не удалось открыть запись" text={error} />
          ) : (
            <div className="loading-state">
              <Loader2 className="animate-spin" />
              Загружаем свободное время…
            </div>
          )}
        </section>
      </main>
      <footer className="booking-footer">
        Beauty Bloom · демонстрационный проект · цены в тенге
      </footer>
    </div>
  );
}
