"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, Clock3, Flower2, Plus } from "lucide-react";
import {
  dateLabel,
  addDays,
  weekday,
  time,
  money,
  statusLabels,
  type Appointment,
} from "@/lib/domain";
import { useStudio, Choice, Empty } from "./shared";
const SCALE = 1.3;
export function Schedule({
  date,
  setDate,
  onCreate,
  onDetail,
  onAutomations,
}: {
  date: string;
  setDate: (v: string) => void;
  onCreate: (date: string, masterId?: string) => void;
  onDetail: (id: string) => void;
  onAutomations: () => void;
}) {
  const { data } = useStudio();
  const [mode, setMode] = useState("day"),
    [masterFilter, setMasterFilter] = useState("all");
  const allMasters = data.masters.filter(
    (m) => m.active && (data.role === "admin" || m.id === data.masterId),
  );
  const masters = allMasters.filter(
    (m) => masterFilter === "all" || m.id === masterFilter,
  );
  const START =
      Math.floor(Math.min(540, ...masters.map((m) => m.start)) / 60) * 60,
    END = Math.ceil(Math.max(1140, ...masters.map((m) => m.end)) / 60) * 60;
  const day = data.appointments.filter(
    (a) => a.date === date && !["cancelled", "no_show"].includes(a.status),
  );
  const revenue = day.reduce((n, a) => n + a.price, 0);
  const capacity = masters.reduce(
    (n, m) => n + (m.days.includes(weekday(date)) ? m.end - m.start : 0),
    0,
  );
  const busyMinutes = day
    .filter((a) => masters.some((m) => m.id === a.master_id))
    .reduce((n, a) => n + a.duration, 0);
  const next = day.find((a) => a.status === "confirmed") ?? null;
  const monday = addDays(date, -((weekday(date) + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const appointmentButton = (a: Appointment, style?: React.CSSProperties) => (
    <button
      className={
        "appointment " +
        a.color +
        (a.status === "completed" ? " is-completed" : "")
      }
      key={a.id}
      style={style}
      onClick={() => onDetail(a.id)}
      aria-label={`${time(a.start)} ${a.client_name}, ${a.service_name}, ${statusLabels[a.status]}`}
    >
      <span className="appointment-time">
        {time(a.start)} <span>· {a.duration} мин</span>
      </span>
      <strong>{a.client_name}</strong>
      <span>{a.service_name}</span>
      <span className="appointment-status">{statusLabels[a.status]}</span>
    </button>
  );
  return (
    <>
      <div className="stat-strip">
        {[
          ["Записи на день", String(day.length), "Активные и завершённые"],
          ["Выручка за день", money(revenue), "Включая ожидаемые визиты"],
          [
            "Мастера в студии",
            String(
              masters.filter((m) => m.days.includes(weekday(date))).length,
            ),
            "По рабочему графику",
          ],
          [
            "Свободное время",
            `${Math.max(0, Math.round((capacity - busyMinutes) / 6) / 10)} ч`,
            "В выбранном расписании",
          ],
        ].map(([label, value, note]) => (
          <div className="stat" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{note}</small>
          </div>
        ))}
      </div>
      <div className="schedule-layout">
        <section className="calendar-card">
          <div className="calendar-toolbar">
            <div className="date-nav">
              <Button
                variant="outline"
                size="icon"
                aria-label="Предыдущий день"
                onClick={() => setDate(addDays(date, mode === "day" ? -1 : -7))}
              >
                <ChevronLeft size={17} />
              </Button>
              <div className="calendar-date">
                <h2>
                  {mode === "day"
                    ? dateLabel(date)
                    : `${dateLabel(days[0], { day: "numeric", month: "short" })} – ${dateLabel(days[6], { day: "numeric", month: "short" })}`}
                  <span>
                    {mode === "day"
                      ? dateLabel(date, { weekday: "long" })
                      : "Неделя"}
                  </span>
                </h2>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => {
                    if (e.target.value) setDate(e.target.value);
                  }}
                  aria-label="Дата расписания"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                aria-label="Следующий день"
                onClick={() => setDate(addDays(date, mode === "day" ? 1 : 7))}
              >
                <ChevronRight size={17} />
              </Button>
              <Button variant="outline" onClick={() => setDate(data.today)}>
                Сегодня
              </Button>
            </div>
            <Tabs value={mode} onValueChange={setMode}>
              <TabsList>
                <TabsTrigger value="day">День</TabsTrigger>
                <TabsTrigger value="week">Неделя</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="calendar-filters">
            <Choice
              label="Показать мастера"
              value={masterFilter}
              onChange={setMasterFilter}
              options={[
                { value: "all", label: "Все мастера" },
                ...allMasters.map((m) => ({ value: m.id, label: m.name })),
              ]}
            />
            <span>{dateLabel(date, { year: "numeric" })} · Алматы</span>
          </div>
          {mode === "day" ? (
            <div className="schedule-scroll">
              <div
                className="schedule-head"
                style={{
                  gridTemplateColumns: `54px repeat(${Math.max(masters.length, 1)}, minmax(180px,1fr))`,
                }}
              >
                <span />
                {masters.map((p) => (
                  <div key={p.id} className="master-head">
                    <span className={"avatar " + p.color}>{p.name[0]}</span>
                    <div>
                      <strong>{p.name}</strong>
                      <small>{p.specialty}</small>
                    </div>
                  </div>
                ))}
              </div>
              <div
                className="schedule-grid"
                style={{
                  gridTemplateColumns: `54px repeat(${Math.max(masters.length, 1)},minmax(180px,1fr))`,
                }}
              >
                <div
                  className="time-axis"
                  style={{ height: (END - START) * SCALE }}
                >
                  {Array.from({ length: (END - START) / 60 + 1 }, (_, i) => (
                    <span
                      key={i}
                      style={{
                        position: "absolute",
                        top: i * 60 * SCALE - 7,
                        height: "auto",
                        width: "100%",
                        margin: 0,
                      }}
                    >
                      {time(START + i * 60)}
                    </span>
                  ))}
                </div>
                {masters.map((m) => (
                  <div
                    className={
                      "master-column " +
                      (!m.days.includes(weekday(date)) ? "off-day" : "")
                    }
                    style={{ height: (END - START) * SCALE }}
                    key={m.id}
                  >
                    {Array.from({ length: (END - START) / 60 }, (_, i) => (
                      <button
                        className="hour-cell"
                        key={i}
                        style={{ height: 60 * SCALE }}
                        onClick={() => {
                          if (data.role === "admin") onCreate(date, m.id);
                        }}
                        aria-label={`Записать к мастеру ${m.name}, ${time(START + i * 60)}`}
                        disabled={
                          data.role !== "admin" ||
                          !m.days.includes(weekday(date))
                        }
                      />
                    ))}
                    {!m.days.includes(weekday(date)) && (
                      <span className="off-day-label">Выходной</span>
                    )}
                    {day
                      .filter((a) => a.master_id === m.id)
                      .map((a) =>
                        appointmentButton(a, {
                          top: (a.start - START) * SCALE + 4,
                          height: a.duration * SCALE - 8,
                        }),
                      )}
                  </div>
                ))}
              </div>
              {!masters.length && (
                <Empty
                  title="Мастеров пока нет"
                  text="Добавьте мастера в разделе команды."
                />
              )}
            </div>
          ) : (
            <div className="week-scroll">
              <div className="week-grid">
                {days.map((d) => (
                  <div
                    className={
                      "week-day " + (d === data.today ? "is-today" : "")
                    }
                    key={d}
                  >
                    <button
                      className="week-day-head"
                      onClick={() => {
                        setDate(d);
                        setMode("day");
                      }}
                    >
                      <span>{dateLabel(d, { weekday: "short" })}</span>
                      <strong>
                        {dateLabel(d, { day: "numeric", month: "short" })}
                      </strong>
                    </button>
                    {data.appointments
                      .filter(
                        (a) =>
                          a.date === d &&
                          masters.some((m) => m.id === a.master_id) &&
                          !["cancelled", "no_show"].includes(a.status),
                      )
                      .map((a) => appointmentButton(a))}
                    {data.role === "admin" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="week-add"
                        onClick={() => onCreate(d)}
                        aria-label={`Новая запись ${d}`}
                      >
                        <Plus size={15} /> Запись
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="calendar-footer">
            <span>
              <span className="legend pink" /> Маникюр
            </span>
            <span>
              <span className="legend peach" /> Волосы
            </span>
            <span>
              <Clock3 size={14} /> {time(START)}–{time(END)}
            </span>
          </div>
        </section>
        <aside className="day-rail">
          <section className="rail-card">
            <div className="section-label">
              <h2>Первый ожидаемый визит</h2>
              <Clock3 size={18} />
            </div>
            {next ? (
              <>
                <button
                  className="next-visit"
                  onClick={() => onDetail(next.id)}
                >
                  <div className="next-time">
                    {time(next.start)}
                    <span>{next.duration} минут</span>
                  </div>
                  <h3>{next.client_name}</h3>
                  <p>{next.service_name}</p>
                </button>
                <div className="rail-divider" />
                <div className="rail-meta">
                  <span>Мастер</span>
                  <strong>{next.master_name}</strong>
                </div>
                <div className="rail-meta">
                  <span>Стоимость</span>
                  <strong>{money(next.price)}</strong>
                </div>
              </>
            ) : (
              <Empty
                title="Всё спокойно"
                text="На этот день нет ожидаемых визитов."
              />
            )}
          </section>
          {data.role === "admin" && (
            <button className="bloom-card" onClick={onAutomations}>
              <Flower2 size={42} strokeWidth={1} />
              <h2>
                Больше заботы.
                <br />
                Меньше рутины.
              </h2>
              <p>Подтверждения и напоминания о визите — в одном месте.</p>
              <span>Открыть автоматизации</span>
            </button>
          )}
          <section className="rail-card">
            <h2>Команда в этот день</h2>
            {masters.map((m) => (
              <div className="team-line" key={m.id}>
                <span className={"avatar " + m.color}>{m.name[0]}</span>
                <div>
                  <strong>{m.name}</strong>
                  <small>
                    {m.days.includes(weekday(date))
                      ? `${time(m.start)}–${time(m.end)}`
                      : "Выходной"}
                  </small>
                </div>
                <span>
                  {day.filter((a) => a.master_id === m.id).length} записей
                </span>
              </div>
            ))}
          </section>
        </aside>
      </div>
    </>
  );
}
