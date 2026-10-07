"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Search, Plus, CalendarDays } from "lucide-react";
import {
  money,
  dateLabel,
  time,
  statusLabels,
  type Client,
} from "@/lib/domain";
import { ContactFields } from "./booking-form";
import { useStudio, Empty, Submit, ErrorText } from "./shared";
export function Clients({ onDetail }: { onDetail: (id: string) => void }) {
  const { data, run } = useStudio();
  const [search, setSearch] = useState(""),
    [selected, setSelected] = useState<Client | null>(null),
    [creating, setCreating] = useState(false);
  const list = data.clients.filter((c) =>
    `${c.name} ${c.phone} ${c.email}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const history = selected
    ? data.appointments
        .filter((a) => a.client_id === selected.id)
        .sort((a, b) => b.date.localeCompare(a.date) || b.start - a.start)
    : [];
  return (
    <>
      <div className="list-toolbar">
        <label className="search-field">
          <Search size={18} />
          <Input
            aria-label="Поиск клиентов"
            placeholder="Имя, телефон или email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <span>{list.length} клиентов</span>
        {data.role === "admin" && (
          <Button variant="outline" onClick={() => setCreating(true)}>
            <Plus size={17} /> Добавить клиента
          </Button>
        )}
      </div>
      <section className="table-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Клиент</TableHead>
              <TableHead>Контакты</TableHead>
              <TableHead>Визиты</TableHead>
              <TableHead>Оплачено</TableHead>
              <TableHead>Последний визит</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((c) => {
              const visits = data.appointments.filter(
                (a) => a.client_id === c.id && a.status === "completed",
              );
              const last = visits.at(-1);
              return (
                <TableRow key={c.id}>
                  <TableCell>
                    <button
                      className="person-cell"
                      onClick={() => setSelected(c)}
                    >
                      <span className="avatar pink">{c.name[0]}</span>
                      <span>
                        <strong>{c.name}</strong>
                        <small>Открыть карточку</small>
                      </span>
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="cell-stack">
                      <span>{c.phone}</span>
                      <small>{c.email || "Email не указан"}</small>
                    </div>
                  </TableCell>
                  <TableCell>{visits.length}</TableCell>
                  <TableCell>
                    {money(visits.reduce((n, a) => n + a.price, 0))}
                  </TableCell>
                  <TableCell>
                    {last ? dateLabel(last.date) : "Ещё не было"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {!list.length && (
          <Empty
            title="Клиенты не найдены"
            text={
              search ? "Попробуйте другой запрос." : "Добавьте первого клиента."
            }
          />
        )}
      </section>
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="studio-dialog">
          <DialogHeader>
            <DialogTitle>Новый клиент</DialogTitle>
            <DialogDescription>
              Контакты и пожелания для будущих визитов.
            </DialogDescription>
          </DialogHeader>
          <ClientForm
            onSubmit={async (v) => {
              await run("clients", v, "Клиент добавлен");
              setCreating(false);
            }}
          />
        </DialogContent>
      </Dialog>
      <Sheet
        open={!!selected}
        onOpenChange={(v) => {
          if (!v) setSelected(null);
        }}
      >
        <SheetContent className="detail-sheet">
          <SheetHeader>
            <SheetTitle>{selected?.name}</SheetTitle>
            <SheetDescription>
              Карточка клиента и история посещений
            </SheetDescription>
          </SheetHeader>
          {selected && (
            <div className="detail-body">
              <ClientForm
                key={selected.id}
                client={selected}
                disabled={data.role !== "admin"}
                onSubmit={async (v) => {
                  await run(
                    "clients/update",
                    { ...v, id: selected.id },
                    "Карточка сохранена",
                  );
                }}
              />
              <div className="rail-divider" />
              <h3 className="subheading">История посещений</h3>
              <div className="history-list">
                {history.map((a) => (
                  <button
                    className="history-item"
                    key={a.id}
                    onClick={() => {
                      setSelected(null);
                      onDetail(a.id);
                    }}
                  >
                    <CalendarDays size={18} />
                    <span>
                      <strong>{a.service_name}</strong>
                      <small>
                        {dateLabel(a.date)} · {time(a.start)} · {a.master_name}
                      </small>
                    </span>
                    <span className={"status " + a.status}>
                      {statusLabels[a.status]}
                    </span>
                  </button>
                ))}
              </div>
              {!history.length && <Empty title="Первый визит впереди" />}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
function ClientForm({
  client,
  disabled = false,
  onSubmit,
}: {
  client?: Client;
  disabled?: boolean;
  onSubmit: (v: {
    name: string;
    phone: string;
    email: string;
    notes: string;
    consent: boolean;
  }) => Promise<void>;
}) {
  const [value, setValue] = useState({
      name: client?.name ?? "",
      phone: client?.phone ?? "",
      email: client?.email ?? "",
      notes: client?.notes ?? "",
      consent: !!client?.consent,
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
          await onSubmit(value);
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <ContactFields value={value} onChange={setValue} disabled={disabled} />
      <ErrorText error={error} />
      {!disabled && (
        <div className="form-actions">
          <Submit busy={busy} />
        </div>
      )}
    </form>
  );
}
