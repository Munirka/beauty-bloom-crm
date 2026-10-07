import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
export const workspaces = sqliteTable(
  "workspaces",
  {
    id: text("id").primaryKey(),
    owner: text("owner"),
    createdAt: integer("created_at").notNull(),
    confirmation: integer("confirmation").notNull().default(1),
    reminder: integer("reminder").notNull().default(1),
    rebook: integer("rebook").notNull().default(1),
    integrationHash: text("integration_hash"),
  },
  (t) => [uniqueIndex("workspaces_owner").on(t.owner)],
);
export const sessions = sqliteTable("sessions", {
  hash: text("hash").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  role: text("role").notNull(),
  masterId: text("master_id"),
  expiresAt: integer("expires_at").notNull(),
});
export const masters = sqliteTable(
  "masters",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    name: text("name").notNull(),
    specialty: text("specialty").notNull(),
    category: text("category").notNull(),
    color: text("color").notNull(),
    start: integer("start").notNull(),
    end: integer("end").notNull(),
    days: text("days").notNull(),
    active: integer("active").notNull().default(1),
  },
  (t) => [index("masters_workspace").on(t.workspaceId)],
);
export const services = sqliteTable(
  "services",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    name: text("name").notNull(),
    category: text("category").notNull(),
    duration: integer("duration").notNull(),
    price: integer("price").notNull(),
    active: integer("active").notNull().default(1),
  },
  (t) => [index("services_workspace").on(t.workspaceId)],
);
export const clients = sqliteTable(
  "clients",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email").notNull().default(""),
    notes: text("notes").notNull().default(""),
    consent: integer("consent").notNull().default(0),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("clients_workspace_phone").on(t.workspaceId, t.phone)],
);
export const appointments = sqliteTable(
  "appointments",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id),
    masterId: text("master_id")
      .notNull()
      .references(() => masters.id),
    serviceId: text("service_id")
      .notNull()
      .references(() => services.id),
    date: text("date").notNull(),
    start: integer("start").notNull(),
    duration: integer("duration").notNull(),
    price: integer("price").notNull(),
    serviceName: text("service_name").notNull(),
    status: text("status").notNull(),
    notes: text("notes").notNull().default(""),
    source: text("source").notNull(),
    version: integer("version").notNull().default(1),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("appointments_workspace_date_master").on(
      t.workspaceId,
      t.date,
      t.masterId,
    ),
    index("appointments_workspace_client").on(t.workspaceId, t.clientId),
  ],
);
export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    appointmentId: text("appointment_id")
      .notNull()
      .references(() => appointments.id),
    kind: text("kind").notNull(),
    dueAt: integer("due_at").notNull(),
    status: text("status").notNull(),
    message: text("message").notNull(),
    attempts: integer("attempts").notNull().default(0),
    lease: text("lease"),
    leaseUntil: integer("lease_until"),
    error: text("error"),
    finishedAt: integer("finished_at"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("jobs_workspace_due").on(t.workspaceId, t.status, t.dueAt)],
);
export const audit = sqliteTable(
  "audit",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    text: text("text").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("audit_workspace_created").on(t.workspaceId, t.createdAt)],
);
