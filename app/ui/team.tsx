"use client";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Clock3, Scissors } from "lucide-react";
import { money, time, type Master, type Service } from "@/lib/domain";
import { useStudio, Choice, Field, Submit, ErrorText, Empty } from "./shared";
const dayNames = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
export function Team() {
  const { data } = useStudio();
  const [tab, setTab] = useState("masters"),
    [master, setMaster] = useState<Master | null | undefined>(undefined),
    [service, setService] = useState<Service | null | undefined>(undefined);
  return (
    <>
      <Tabs value={tab} onValueChange={setTab}>
        <div className="list-toolbar">
          <TabsList>
            <TabsTrigger value="masters">
              Команда · {data.masters.filter((m) => m.active).length}
            </TabsTrigger>
            <TabsTrigger value="services">
              Услуги · {data.services.filter((s) => s.active).length}
            </TabsTrigger>
          </TabsList>
          {data.role === "admin" && (
            <Button
              variant="outline"
              onClick={() =>
                tab === "masters" ? setMaster(null) : setService(null)
              }
            >
              <Plus size={17} />
              {tab === "masters" ? "Добавить мастера" : "Добавить услугу"}
            </Button>
          )}
        </div>
        <TabsContent value="masters">
          <div className="team-cards">
            {data.masters.map((m) => (
              <section
                className={"master-card " + (!m.active ? "archived" : "")}
                key={m.id}
              >
                <div className="master-card-top">
                  <span className={"avatar large " + m.color}>{m.name[0]}</span>
                  {data.role === "admin" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Изменить мастера ${m.name}`}
                      onClick={() => setMaster(m)}
                    >
                      <Pencil size={17} />
                    </Button>
                  )}
                </div>
                <h2>{m.name}</h2>
                <p>{m.specialty}</p>
                <div className="master-hours">
                  <Clock3 size={16} />
                  {time(m.start)}–{time(m.end)}
                </div>
                <div className="days-list">
                  {dayNames.map((day, i) => (
                    <span
                      key={day}
                      className={m.days.includes(i) ? "active" : ""}
                    >
                      {day}
                    </span>
                  ))}
                </div>
                <div className="rail-divider" />
                <div className="rail-meta">
                  <span>Направление</span>
                  <strong>
                    {m.category === "nails" ? "Ногтевой сервис" : "Волосы"}
                  </strong>
                </div>
                <div className="rail-meta">
                  <span>Статус</span>
                  <strong>{m.active ? "Работает" : "В архиве"}</strong>
                </div>
              </section>
            ))}
          </div>
          {!data.masters.length && <Empty title="Добавьте первого мастера" />}
        </TabsContent>
        <TabsContent value="services">
          <div className="services-grid">
            {data.services.map((s) => (
              <section
                className={"service-card " + (!s.active ? "archived" : "")}
                key={s.id}
              >
                <span
                  className={
                    "service-icon " +
                    (s.category === "nails" ? "pink" : "peach")
                  }
                >
                  <Scissors size={21} />
                </span>
                <div>
                  <h2>{s.name}</h2>
                  <p>
                    {s.category === "nails" ? "Ногтевой сервис" : "Волосы"} ·{" "}
                    {s.duration} мин{s.active ? "" : " · Архив"}
                  </p>
                </div>
                <strong>{money(s.price)}</strong>
                {data.role === "admin" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Изменить услугу ${s.name}`}
                    onClick={() => setService(s)}
                  >
                    <Pencil size={17} />
                  </Button>
                )}
              </section>
            ))}
          </div>
        </TabsContent>
      </Tabs>
      <Dialog
        open={master !== undefined}
        onOpenChange={(v) => {
          if (!v) setMaster(undefined);
        }}
      >
        <DialogContent className="studio-dialog">
          <DialogHeader>
            <DialogTitle>
              {master ? "График мастера" : "Новый мастер"}
            </DialogTitle>
            <DialogDescription>
              Рабочие часы учитываются при выборе свободного времени.
            </DialogDescription>
          </DialogHeader>
          {master !== undefined && (
            <MasterForm
              key={master?.id ?? "new"}
              master={master ?? undefined}
              onClose={() => setMaster(undefined)}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={service !== undefined}
        onOpenChange={(v) => {
          if (!v) setService(undefined);
        }}
      >
        <DialogContent className="studio-dialog">
          <DialogHeader>
            <DialogTitle>
              {service ? "Изменить услугу" : "Новая услуга"}
            </DialogTitle>
            <DialogDescription>
              Изменения цены и длительности применяются к новым записям.
            </DialogDescription>
          </DialogHeader>
          {service !== undefined && (
            <ServiceForm
              key={service?.id ?? "new"}
              service={service ?? undefined}
              onClose={() => setService(undefined)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
function MasterForm({
  master,
  onClose,
}: {
  master?: Master;
  onClose: () => void;
}) {
  const { run } = useStudio();
  const [v, setV] = useState({
      name: master?.name ?? "",
      specialty: master?.specialty ?? "Нейл-мастер",
      category: master?.category ?? "nails",
      color: master?.color ?? "pink",
      start: master?.start ?? 540,
      end: master?.end ?? 1140,
      days: master?.days ?? [1, 2, 3, 4, 5, 6],
      active: master ? !!master.active : true,
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      className="studio-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await run(
            "masters",
            { ...v, ...(master ? { id: master.id } : {}) },
            "График сохранён",
          );
          onClose();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-row">
        <Field label="Имя мастера">
          <Input
            required
            minLength={2}
            maxLength={80}
            value={v.name}
            onChange={(e) => setV({ ...v, name: e.target.value })}
          />
        </Field>
        <Field label="Специализация">
          <Input
            required
            value={v.specialty}
            onChange={(e) => setV({ ...v, specialty: e.target.value })}
          />
        </Field>
      </div>
      <div className="form-row">
        <Choice
          label="Направление"
          value={v.category}
          onChange={(category) =>
            setV({ ...v, category: category as "nails" | "hair" })
          }
          options={[
            { value: "nails", label: "Ногтевой сервис" },
            { value: "hair", label: "Волосы" },
          ]}
        />
        <Choice
          label="Цвет в расписании"
          value={v.color}
          onChange={(color) => setV({ ...v, color })}
          options={[
            { value: "pink", label: "Розовый" },
            { value: "lilac", label: "Сиреневый" },
            { value: "peach", label: "Персиковый" },
            { value: "mint", label: "Мятный" },
          ]}
        />
      </div>
      <div className="form-row">
        {(["start", "end"] as const).map((key) => (
          <Field label={key === "start" ? "Начало дня" : "Конец дня"} key={key}>
            <Input
              type="time"
              required
              step="1800"
              value={time(v[key])}
              onChange={(e) => {
                const [h, m] = e.target.value.split(":").map(Number);
                setV({ ...v, [key]: h * 60 + m });
              }}
            />
          </Field>
        ))}
      </div>
      <div className="field">
        <span className="field-label">Рабочие дни</span>
        <div className="day-checkboxes">
          {dayNames.map((d, i) => (
            <label key={d}>
              <Checkbox
                checked={v.days.includes(i)}
                onCheckedChange={(checked) =>
                  setV({
                    ...v,
                    days: checked
                      ? [...v.days, i]
                      : v.days.filter((n) => n !== i),
                  })
                }
              />
              {d}
            </label>
          ))}
        </div>
      </div>
      <label className="checkbox-label">
        <Switch
          checked={v.active}
          onCheckedChange={(active) => setV({ ...v, active })}
        />
        Мастер работает в студии
      </label>
      <ErrorText error={error} />
      <div className="form-actions">
        <Submit busy={busy} />
      </div>
    </form>
  );
}
function ServiceForm({
  service,
  onClose,
}: {
  service?: Service;
  onClose: () => void;
}) {
  const { run } = useStudio();
  const [v, setV] = useState({
      name: service?.name ?? "",
      category: service?.category ?? "nails",
      duration: service?.duration ?? 90,
      price: service?.price ?? 9000,
      active: service ? !!service.active : true,
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      className="studio-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await run(
            "services",
            { ...v, ...(service ? { id: service.id } : {}) },
            "Услуга сохранена",
          );
          onClose();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label="Название услуги">
        <Input
          required
          minLength={2}
          maxLength={80}
          value={v.name}
          onChange={(e) => setV({ ...v, name: e.target.value })}
        />
      </Field>
      <Choice
        label="Направление"
        value={v.category}
        onChange={(category) =>
          setV({ ...v, category: category as "nails" | "hair" })
        }
        options={[
          { value: "nails", label: "Ногтевой сервис" },
          { value: "hair", label: "Волосы" },
        ]}
      />
      <div className="form-row">
        <Field label="Длительность, минут">
          <Input
            required
            type="number"
            min={30}
            max={300}
            step={30}
            value={v.duration}
            onChange={(e) => setV({ ...v, duration: Number(e.target.value) })}
          />
        </Field>
        <Field label="Цена, ₸">
          <Input
            required
            type="number"
            min={0}
            max={1000000}
            step={100}
            value={v.price}
            onChange={(e) => setV({ ...v, price: Number(e.target.value) })}
          />
        </Field>
      </div>
      <label className="checkbox-label">
        <Switch
          checked={v.active}
          onCheckedChange={(active) => setV({ ...v, active })}
        />
        Услуга доступна для записи
      </label>
      <ErrorText error={error} />
      <div className="form-actions">
        <Submit busy={busy} />
      </div>
    </form>
  );
}
