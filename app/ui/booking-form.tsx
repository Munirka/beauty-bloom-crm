"use client";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  availableSlots,
  money,
  addDays,
  type Master,
  type Service,
  type Appointment,
  type Client,
} from "@/lib/domain";
import { useStudio, Choice, Field, Slots, Submit, ErrorText } from "./shared";
export function ContactFields({
  value,
  onChange,
  disabled = false,
}: {
  value: {
    name: string;
    phone: string;
    email: string;
    notes: string;
    consent: boolean;
  };
  onChange: (v: typeof value) => void;
  disabled?: boolean;
}) {
  return (
    <>
      <div className="form-row">
        <Field label="Имя клиента">
          <Input
            autoComplete="name"
            required
            minLength={2}
            maxLength={80}
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            disabled={disabled}
          />
        </Field>
        <Field label="Телефон">
          <Input
            type="tel"
            autoComplete="tel"
            required
            placeholder="+7 000 000 00 00"
            value={value.phone}
            onChange={(e) => onChange({ ...value, phone: e.target.value })}
            disabled={disabled}
          />
        </Field>
      </div>
      <Field label="Email для уведомлений">
        <Input
          type="email"
          autoComplete="email"
          placeholder="client@example.com"
          value={value.email}
          onChange={(e) => onChange({ ...value, email: e.target.value })}
          disabled={disabled}
        />
      </Field>
      <Field label="Заметки">
        <Textarea
          rows={3}
          maxLength={1500}
          value={value.notes}
          onChange={(e) => onChange({ ...value, notes: e.target.value })}
          disabled={disabled}
        />
      </Field>
      <label className="checkbox-label">
        <Checkbox
          checked={value.consent}
          onCheckedChange={(v) => onChange({ ...value, consent: v === true })}
          disabled={disabled}
        />{" "}
        Клиент согласен получать уведомления и приглашения на повторный визит
      </label>
    </>
  );
}
export function AppointmentForm({
  masters,
  services,
  appointments,
  today,
  now,
  clients,
  initialDate,
  initialMaster,
  onSubmit,
  publicFlow = false,
  moving,
}: {
  masters: Master[];
  services: Service[];
  appointments: Pick<
    Appointment,
    "id" | "date" | "master_id" | "start" | "duration" | "status"
  >[];
  today: string;
  now: number;
  clients?: Client[];
  initialDate?: string;
  initialMaster?: string;
  onSubmit: (value: unknown) => Promise<void>;
  publicFlow?: boolean;
  moving?: Appointment;
}) {
  const [clientMode, setClientMode] = useState(publicFlow ? "new" : "existing"),
    [clientId, setClientId] = useState(clients?.[0]?.id ?? "");
  const [contact, setContact] = useState({
    name: "",
    phone: "",
    email: "",
    notes: "",
    consent: false,
  });
  const [serviceId, setServiceId] = useState(
      moving?.service_id ?? services.find((s) => s.active)?.id ?? "",
    ),
    [masterId, setMasterId] = useState(
      moving?.master_id ?? initialMaster ?? "",
    ),
    [date, setDate] = useState(initialDate ?? today),
    [start, setStart] = useState<number | null>(null),
    [notes, setNotes] = useState(moving?.notes ?? ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const service = services.find((s) => s.id === serviceId);
  const compatible = masters.filter(
    (m) => m.active && m.category === service?.category,
  );
  const selectedMaster =
    compatible.find((m) => m.id === masterId) ?? compatible[0];
  const slotService = service
    ? { ...service, duration: moving?.duration ?? service.duration }
    : undefined;
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  const slots =
    selectedMaster && slotService
      ? availableSlots(
          selectedMaster,
          slotService,
          date,
          appointments,
          Math.max(now, clock),
          moving?.id,
        )
      : [];
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (start === null || !slots.includes(start) || !selectedMaster) {
      setError("Выберите свободное время");
      return;
    }
    setBusy(true);
    try {
      await onSubmit(
        moving
          ? {
              id: moving.id,
              version: moving.version,
              date,
              start,
              masterId: selectedMaster.id,
            }
          : {
              ...(clientMode === "existing"
                ? { clientId }
                : { client: contact }),
              serviceId,
              masterId: selectedMaster.id,
              date,
              start,
              notes,
            },
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="studio-form" onSubmit={submit}>
      {!moving && (
        <>
          {!publicFlow && (
            <Tabs value={clientMode} onValueChange={setClientMode}>
              <TabsList className="w-full">
                <TabsTrigger value="existing">Из базы клиентов</TabsTrigger>
                <TabsTrigger value="new">Новый клиент</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          {clientMode === "existing" ? (
            <Choice
              label="Клиент"
              value={clientId}
              onChange={setClientId}
              options={(clients ?? []).map((c) => ({
                value: c.id,
                label: c.name + " · " + c.phone,
              }))}
            />
          ) : (
            <ContactFields value={contact} onChange={setContact} />
          )}
        </>
      )}
      <div className="form-row">
        <Choice
          label="Услуга"
          value={serviceId}
          onChange={(v) => {
            setServiceId(v);
            setStart(null);
          }}
          disabled={!!moving}
          options={services
            .filter((s) => s.active || s.id === moving?.service_id)
            .map((s) => ({ value: s.id, label: s.name }))}
        />
        <Choice
          label="Мастер"
          value={selectedMaster?.id ?? ""}
          onChange={(v) => {
            setMasterId(v);
            setStart(null);
          }}
          options={compatible.map((m) => ({ value: m.id, label: m.name }))}
        />
      </div>
      {service && (
        <div className="service-summary">
          <span>{moving?.duration ?? service.duration} минут</span>
          <strong>{money(moving?.price ?? service.price)}</strong>
        </div>
      )}
      <Field label="Дата визита">
        <Input
          type="date"
          required
          min={today}
          max={addDays(today, 90)}
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setStart(null);
          }}
        />
      </Field>
      <Slots slots={slots} value={start} onChange={setStart} />
      {!publicFlow && !moving && (
        <Field label="Комментарий к записи">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={1500}
            rows={2}
          />
        </Field>
      )}
      {publicFlow && (
        <p className="form-hint">
          Это демо для портфолио. Используйте вымышленные контакты и email с
          окончанием @example.com.
        </p>
      )}
      <ErrorText error={error} />
      <div className="form-actions">
        <Submit
          busy={busy}
          label={
            moving
              ? "Перенести запись"
              : publicFlow
                ? "Подтвердить запись"
                : "Создать запись"
          }
        />
      </div>
    </form>
  );
}
export function BookingDialog({
  open,
  onClose,
  date,
  masterId,
  moving,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
  masterId?: string;
  moving?: Appointment;
}) {
  const { data, run } = useStudio();
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="studio-dialog">
        <DialogHeader>
          <DialogTitle>
            {moving ? "Перенести запись" : "Новая запись"}
          </DialogTitle>
          <DialogDescription>
            {moving
              ? `${moving.client_name} · ${moving.service_name}`
              : "Выберите клиента, услугу и свободное время."}
          </DialogDescription>
        </DialogHeader>
        <AppointmentForm
          key={moving?.id ?? date + masterId}
          masters={data.masters}
          services={data.services}
          appointments={data.appointments}
          clients={data.clients}
          today={data.today}
          now={data.now}
          initialDate={date}
          initialMaster={masterId}
          moving={moving}
          onSubmit={async (v) => {
            await run(
              moving ? "appointments/move" : "appointments",
              v,
              moving ? "Запись перенесена" : "Запись создана",
            );
            onClose();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
