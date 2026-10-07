"use client";
import { useState } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { money, addDays, dateLabel, time, weekday } from "@/lib/domain";
import { useStudio, Choice, Empty } from "./shared";
export function Overview({ onDetail }: { onDetail: (id: string) => void }) {
  const { data } = useStudio();
  const [period, setPeriod] = useState("month");
  const start =
    period === "week"
      ? addDays(data.today, -6)
      : data.today.slice(0, 7) + "-01";
  const periodAppointments = data.appointments.filter(
    (a) => a.date >= start && a.date <= data.today,
  );
  const completed = periodAppointments.filter((a) => a.status === "completed");
  const revenue = completed.reduce((n, a) => n + a.price, 0);
  const activeToday = data.appointments.filter(
    (a) => a.date === data.today && a.status === "confirmed",
  );
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(data.today, i - 6);
    return {
      date,
      value: data.appointments
        .filter((a) => a.date === date && a.status === "completed")
        .reduce((n, a) => n + a.price, 0),
    };
  });
  const maximum = Math.max(...last7.map((d) => d.value), 1);
  const totalAvailable = data.masters
    .filter(
      (m) => m.active && (data.role === "admin" || m.id === data.masterId),
    )
    .reduce(
      (n, m) =>
        n + (m.days.includes(weekday(data.today)) ? m.end - m.start : 0),
      0,
    );
  const totalBusy = data.appointments
    .filter(
      (a) =>
        a.date === data.today && !["cancelled", "no_show"].includes(a.status),
    )
    .reduce((n, a) => n + a.duration, 0);
  return (
    <>
      <div className="overview-toolbar">
        <Choice
          label="Период отчёта"
          value={period}
          onChange={setPeriod}
          options={[
            { value: "month", label: "Текущий месяц" },
            { value: "week", label: "Последние 7 дней" },
          ]}
        />
        <span>
          {dateLabel(start)} – {dateLabel(data.today)}
        </span>
      </div>
      <div className="stat-strip">
        {[
          ["Выручка", money(revenue), "По завершённым визитам"],
          [
            "Завершённые визиты",
            String(completed.length),
            "За выбранный период",
          ],
          [
            "Средний чек",
            money(
              completed.length ? Math.round(revenue / completed.length) : 0,
            ),
            "По завершённым визитам",
          ],
          [
            "Загрузка сегодня",
            `${totalAvailable ? Math.round((totalBusy / totalAvailable) * 100) : 0}%`,
            "Занятые минуты / рабочие минуты",
          ],
        ].map(([label, value, note]) => (
          <div className="stat" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{note}</small>
          </div>
        ))}
      </div>
      <div className="overview-grid">
        <section className="panel revenue-panel">
          <div className="section-toolbar">
            <h2>Выручка за 7 дней</h2>
            <span>Завершённые визиты</span>
          </div>
          <div
            className="revenue-chart"
            role="img"
            aria-label={last7
              .map((d) => `${dateLabel(d.date)}: ${money(d.value)}`)
              .join("; ")}
          >
            {last7.map((d) => (
              <div
                className={
                  "revenue-bar " + (d.date === data.today ? "today" : "")
                }
                key={d.date}
              >
                <span>{money(d.value)}</span>
                <div className="bar-track">
                  <div style={{ height: `${(d.value / maximum) * 100}%` }} />
                </div>
                <small>
                  {dateLabel(d.date, { day: "numeric", month: "short" })}
                </small>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2>Услуги за период</h2>
          <div className="service-ranking">
            {data.services
              .map((s) => ({
                s,
                n: completed.filter((a) => a.service_id === s.id).length,
              }))
              .sort((a, b) => b.n - a.n)
              .filter((x) => x.n)
              .map(({ s, n }) => (
                <div key={s.id}>
                  <span>{s.name}</span>
                  <strong>{n} визитов</strong>
                  <div className="ranking-track">
                    <div
                      style={{
                        width: `${(n / Math.max(completed.length, 1)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
          </div>
          {!completed.length && (
            <Empty
              title="Визитов пока нет"
              text="Завершите визит, чтобы увидеть статистику."
            />
          )}
        </section>
      </div>
      <div className="section-toolbar">
        <h2>Ожидаемые визиты сегодня</h2>
        <span>{activeToday.length} записей</span>
      </div>
      <section className="table-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Время</TableHead>
              <TableHead>Клиент</TableHead>
              <TableHead>Услуга</TableHead>
              <TableHead>Мастер</TableHead>
              <TableHead>Стоимость</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeToday.map((a) => (
              <TableRow key={a.id}>
                <TableCell>{time(a.start)}</TableCell>
                <TableCell>
                  <button
                    className="text-button"
                    onClick={() => onDetail(a.id)}
                  >
                    {a.client_name}
                  </button>
                </TableCell>
                <TableCell>{a.service_name}</TableCell>
                <TableCell>{a.master_name}</TableCell>
                <TableCell>{money(a.price)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!activeToday.length && (
          <Empty title="На сегодня всё" text="Нет ожидаемых визитов." />
        )}
      </section>
      {data.role === "admin" && (
        <section className="panel activity-panel">
          <h2>Последние события</h2>
          {data.audit.map((a) => (
            <div className="activity-line" key={a.id}>
              <span>{a.text}</span>
              <small>
                {new Intl.DateTimeFormat("ru-RU", {
                  timeZone: "Asia/Almaty",
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(a.created_at)}
              </small>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
