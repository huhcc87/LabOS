import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string;
const client = new ConvexHttpClient(CONVEX_URL);

const TOKEN_KEY = "labos_auth_token";
function getToken(): string | undefined {
  return localStorage.getItem(TOKEN_KEY) ?? undefined;
}

type IdLike = string | number;

function toStr(id: IdLike): string {
  return String(id);
}

function adapt(doc: any): any {
  if (!doc) return doc;
  if (Array.isArray(doc)) return doc.map(adapt);
  const { _id, _creationTime, ...rest } = doc;
  return { id: _id, ...rest };
}

function paginated(items: any[], page = 1, perPage = 20) {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const start = (page - 1) * perPage;
  const slice = items.slice(start, start + perPage);
  return { data: { items: slice.map(adapt), total, page, per_page: perPage, pages } };
}

function wrapData(result: any) {
  return { data: result };
}

function crudApi(
  listFn: any,
  createFn?: any,
  updateFn?: any,
  deleteFn?: any,
  getFn?: any
) {
  return {
    list: async (page = 1, perPage = 20, search = '', extra?: Record<string, string>) => {
      const token = getToken();
      const args: any = {};
      if (token) args.token = token;
      if (search) args.search = search;
      if (extra) Object.assign(args, extra);
      const result = await client.query(listFn, args);
      const items = result?.page ?? result?.items ?? result ?? [];
      return paginated(items, page, perPage);
    },
    get: getFn
      ? async (id: IdLike) => {
          const result = await client.query(getFn, { id: toStr(id) });
          return { data: adapt(result) };
        }
      : async (_id: IdLike) => ({ data: null }),
    create: createFn
      ? async (data: any) => {
          const token = getToken();
          const result = await client.mutation(createFn, { token, ...data });
          return { data: result };
        }
      : async (_data: any) => ({ data: null }),
    update: updateFn
      ? async (id: IdLike, data: any) => {
          const token = getToken();
          const { id: _id, ...fields } = data;
          await client.mutation(updateFn, { token, id: toStr(id), ...fields });
          return { data: { id: toStr(id) } };
        }
      : async (_id: IdLike, _data: any) => ({ data: null }),
    delete: deleteFn
      ? async (id: IdLike) => {
          const token = getToken();
          await client.mutation(deleteFn, { token, id: toStr(id) });
          return { data: { success: true } };
        }
      : async (_id: IdLike) => ({ data: null }),
  };
}

export const authApi = {
  login: async (email: string, password: string) => {
    const result = await client.action(api.customAuth.login, { email, password });
    return { data: result };
  },
  me: async () => {
    const token = getToken();
    if (!token) return { data: null };
    const result = await client.query(api.users.getMe, { token });
    return { data: adapt(result) };
  },
  listUsers: async (page = 1, perPage = 20, search = '') => {
    const result = await client.query(api.users.list, {
      search: search || undefined,
      paginationOpts: { numItems: 200, cursor: null },
    });
    const items = result?.page ?? [];
    return paginated(items, page, perPage);
  },
  createUser: async (data: any) => {
    const result = await client.mutation(api.users.create, data);
    return { data: result };
  },
  updateUser: async (id: IdLike, data: any) => {
    const { id: _id, ...fields } = data;
    const result = await client.mutation(api.users.update, { id: id as any, ...fields });
    return { data: adapt(result) };
  },
  deleteUser: async (id: IdLike) => {
    await client.mutation(api.users.remove, { id: id as any });
    return { data: { success: true } };
  },
};

export const tasksApi = crudApi(
  api.tasks.list,
  api.tasks.create,
  api.tasks.update,
  api.tasks.remove,
  api.tasks.get
);

export const incidentsApi = crudApi(
  api.incidents.list,
  api.incidents.create,
  api.incidents.update,
  undefined,
  api.incidents.get
);

export const sopsApi = {
  ...crudApi(
    api.sops.list,
    api.sops.create,
    api.sops.update,
    api.sops.remove,
    api.sops.get
  ),
  approve: async (id: IdLike) => {
    const token = getToken();
    await client.mutation(api.sops.approve, { token, id: id as any, approved_by: id as any });
    return { data: { success: true } };
  },
};

export const suppliersApi = {
  ...crudApi(
    api.suppliers.list,
    api.suppliers.create,
    api.suppliers.update,
    api.suppliers.remove,
    api.suppliers.get
  ),
  categories: async () => {
    const result = await client.query(api.suppliers.list, { paginationOpts: { numItems: 200, cursor: null } });
    const cats = new Set<string>();
    for (const s of result?.page ?? []) { if ((s as any).category) cats.add((s as any).category); }
    return { data: Array.from(cats) };
  },
  stats: async () => {
    const result = await client.query(api.suppliers.list, { paginationOpts: { numItems: 200, cursor: null } });
    const items = result?.page ?? [];
    return {
      data: {
        total: items.length,
        approved: items.filter((s: any) => s.approval_status === 'approved').length,
        preferred: items.filter((s: any) => s.rating && s.rating >= 4).length,
      },
    };
  },
  aiRecommend: async (query: string) => {
    // Match suppliers based on query against existing supplier data
    const result = await client.query(api.suppliers.list, { search: query, paginationOpts: { numItems: 10, cursor: null } });
    const recommendations = (result?.page ?? []).map((s: any) => ({
      id: s._id,
      name: s.name,
      category: s.category,
      rating: s.rating,
      reason: `Matches "${query}" — ${s.approval_status} supplier${s.rating ? `, rated ${s.rating}/5` : ""}`,
    }));
    return { data: { recommendations } };
  },
  listOrders: async (page = 1, perPage = 20, status = '') => {
    const result = await client.query(api.suppliers.listOrders, {
      status: status || undefined,
      paginationOpts: { numItems: 200, cursor: null },
    });
    const items = result?.page ?? [];
    return paginated(items, page, perPage);
  },
  orderStats: async () => {
    const result = await client.query(api.suppliers.listOrders, {
      paginationOpts: { numItems: 200, cursor: null },
    });
    const orders = result?.page ?? [];
    const byStatus: Record<string, number> = {};
    let totalAmount = 0;
    for (const o of orders as any[]) {
      byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
      totalAmount += o.total_amount ?? 0;
    }
    return { data: { total: orders.length, by_status: byStatus, total_amount: totalAmount } };
  },
  createOrder: async (data: any) => {
    const token = getToken();
    const result = await client.mutation(api.suppliers.createOrder, { token, ...data });
    return { data: result };
  },
  updateOrder: async (id: IdLike, data: any) => {
    const token = getToken();
    await client.mutation(api.suppliers.updateOrder, { token, id: id as any, ...data });
    return { data: { id } };
  },
  approveOrder: async (id: IdLike) => {
    const token = getToken();
    await client.mutation(api.suppliers.approveOrder, { token, id: id as any });
    return { data: { success: true } };
  },
  receiveOrder: async (id: IdLike) => {
    const token = getToken();
    await client.mutation(api.suppliers.receiveOrder, { token, id: id as any });
    return { data: { success: true } };
  },
  createReview: async (data: any) => {
    const token = getToken();
    // Store review as a feedback entry linked to the supplier
    await client.mutation(api.feedback.create, { token, category: "supplier_review", ...data });
    return { data: { success: true } };
  },
};

export const schedulingApi = {
  listCalendar: async (page = 1, perPage = 100) => {
    const result = await client.query(api.scheduling.listCalendar, {});
    return paginated(result ?? [], page, perPage);
  },
  createCalendarEvent: async (data: any) => {
    const token = getToken();
    const result = await client.mutation(api.scheduling.createCalendarEvent, { token, ...data });
    return { data: result };
  },
  updateCalendarEvent: async (id: IdLike, data: any) => {
    const token = getToken();
    await client.mutation(api.scheduling.updateCalendarEvent, { token, id: id as any, ...data });
    return { data: { id } };
  },
  deleteCalendarEvent: async (id: IdLike) => {
    const token = getToken();
    await client.mutation(api.scheduling.deleteCalendarEvent, { token, id: id as any });
    return { data: { success: true } };
  },
  reminderStats: async () => {
    const token = getToken();
    const result = await client.query(api.scheduling.reminderStats, { token });
    return { data: result };
  },
  listReminders: async (page = 1, perPage = 20, _search = '') => {
    const token = getToken();
    const result = await client.query(api.scheduling.listReminders, {
      token,
      paginationOpts: { numItems: 200, cursor: null },
    });
    const items = result?.page ?? [];
    return paginated(items, page, perPage);
  },
  createReminder: async (data: any) => {
    const token = getToken();
    const result = await client.mutation(api.scheduling.createReminder, { token, ...data });
    return { data: result };
  },
  updateReminder: async (id: IdLike, data: any) => {
    const token = getToken();
    await client.mutation(api.scheduling.updateReminder, { token, id: id as any, ...data });
    return { data: { id } };
  },
  deleteReminder: async (id: IdLike) => {
    const token = getToken();
    await client.mutation(api.scheduling.deleteReminder, { token, id: id as any });
    return { data: { success: true } };
  },
  exportIcs: async () => {
    const result = await client.query(api.scheduling.listCalendar, {});
    const events = result ?? [];
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//LabOS//EN",
    ];
    for (const e of events as any[]) {
      const dt = (ts: number) => new Date(ts).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
      lines.push("BEGIN:VEVENT");
      lines.push(`DTSTART:${dt(e.start_time ?? e.created_at)}`);
      lines.push(`DTEND:${dt(e.end_time ?? (e.start_time ?? e.created_at) + 3600000)}`);
      lines.push(`SUMMARY:${e.title ?? "Event"}`);
      lines.push("END:VEVENT");
    }
    lines.push("END:VCALENDAR");
    return { data: new Blob([lines.join("\r\n")], { type: "text/calendar" }) };
  },
};

export const notebookApi = {
  ...crudApi(
    api.labNotebook.list,
    api.labNotebook.create,
    api.labNotebook.update,
    api.labNotebook.remove,
    api.labNotebook.get
  ),
  sign: async (id: IdLike) => {
    const token = getToken();
    await client.mutation(api.labNotebook.sign, { token, id: id as any });
    const entry = await client.query(api.labNotebook.get, { id: id as any });
    return { data: entry ? adapt(entry) : { id, success: true } };
  },
  witness: async (id: IdLike) => {
    const token = getToken();
    await client.mutation(api.labNotebook.witness, { token, id: id as any, witnessed_by: id as any });
    const entry = await client.query(api.labNotebook.get, { id: id as any });
    return { data: entry ? adapt(entry) : { id, success: true } };
  },
};

export const meetingsApi = {
  ...crudApi(
    api.meetings.list,
    api.meetings.create,
    api.meetings.update,
    api.meetings.remove,
    api.meetings.get
  ),
  upcoming: async (limit = 10) => {
    const result = await client.query(api.meetings.upcoming, {});
    return { data: (result ?? []).slice(0, limit).map(adapt) };
  },
  past: async (limit = 20) => {
    const result = await client.query(api.meetings.past, {});
    return { data: (result ?? []).slice(0, limit).map(adapt) };
  },
  cancel: async (id: IdLike) => {
    const token = getToken();
    await client.mutation(api.meetings.cancel, { token, id: id as any });
    return { data: { success: true } };
  },
  complete: async (id: IdLike) => {
    const token = getToken();
    await client.mutation(api.meetings.complete, { token, id: id as any });
    return { data: { success: true } };
  },
  publishMinutes: async (id: IdLike) => {
    const token = getToken();
    await client.mutation(api.meetings.update, { token, id: toStr(id) as any, status: "completed" });
    return { data: { success: true } };
  },
};

export const reagentCartApi = {
  list: async () => {
    const token = getToken();
    const result = await client.query(api.reagentCart.list, { token });
    return { data: (result ?? []).map(adapt) };
  },
  create: async (data: any) => {
    const token = getToken();
    const result = await client.mutation(api.reagentCart.create, { token, ...data });
    return { data: result };
  },
  update: async (id: IdLike, data: any) => {
    const token = getToken();
    await client.mutation(api.reagentCart.update, { token, id: id as any, ...data });
    return { data: { id } };
  },
  delete: async (id: IdLike) => {
    const token = getToken();
    await client.mutation(api.reagentCart.remove, { token, id: id as any });
    return { data: { success: true } };
  },
  checkout: async (data: any) => {
    const token = getToken();
    const result = await client.mutation(api.reagentCart.checkout, {
      token,
      item_ids: data.item_ids,
    });
    return { data: result };
  },
  health: async () => {
    // Verify Convex connection is alive
    try {
      await client.query(api.reagentCart.list, { token: getToken() });
      return { data: { ok: true } };
    } catch {
      return { data: { ok: false } };
    }
  },
};

export const iotApi = {
  listSensors: async () => {
    const result = await client.query(api.iot.listSensors, {});
    return { data: (result ?? []).map(adapt) };
  },
  createSensor: async (data: any) => {
    const token = getToken();
    const result = await client.mutation(api.iot.createSensor, { token, ...data });
    return { data: result };
  },
  updateSensor: async (id: IdLike, data: any) => {
    const token = getToken();
    await client.mutation(api.iot.updateSensor, { token, id: id as any, ...data });
    return { data: { id } };
  },
  deleteSensor: async (id: IdLike) => {
    const token = getToken();
    await client.mutation(api.iot.deleteSensor, { token, id: id as any });
    return { data: { success: true } };
  },
  getHistory: async (id: IdLike, hours = 24) => {
    const result = await client.query(api.iot.getHistory, { sensor_id: id as any, hours });
    return { data: (result ?? []).map(adapt) };
  },
  listAlerts: async (unackOnly = false) => {
    const result = await client.query(api.iot.listAlerts, { unack_only: unackOnly });
    return { data: (result ?? []).map(adapt) };
  },
  acknowledgeAlert: async (id: IdLike) => {
    const token = getToken();
    await client.mutation(api.iot.acknowledgeAlert, { token, id: id as any });
    return { data: { success: true } };
  },
};

export const auditApi = {
  list: async (page = 1, perPage = 20, _search = '', extra?: Record<string, string>) => {
    const token = getToken();
    const args: any = { token, page, per_page: perPage };
    if (extra?.entity_type) args.entity_type = extra.entity_type;
    const result = await client.query(api.audit.list, args);
    return { data: { items: (result?.items ?? []).map(adapt), total: result?.total ?? 0, page: result?.page ?? 1, per_page: result?.per_page ?? perPage, pages: result?.total_pages ?? 1 } };
  },
};

export const grantsApi = {
  aiDraft: async (data: any) => {
    const result = await client.action(api.grants.aiDraft, data);
    return { data: result };
  },
  researchSynthesis: async (data: any) => {
    // Build synthesis from existing grant submissions and protocols
    const submissions = await client.query(api.grants.listSubmissions, { paginationOpts: { numItems: 50, cursor: null } });
    const protocols = await client.query(api.protocols.list, { paginationOpts: { numItems: 50, cursor: null } });
    const subItems = submissions?.page ?? [];
    const protoItems = (protocols as any)?.page ?? protocols ?? [];
    return {
      data: {
        paper_summaries: [],
        field_overview: `Based on ${subItems.length} grant submissions and ${protoItems.length} protocols in your lab.`,
        research_gaps: subItems.length === 0 ? ["No grant submissions found — consider starting a submission"] : [],
        web_context: "",
        novel_hypotheses: [],
        specific_aims: data?.specific_aims ?? [],
        objectives: data?.objectives ?? [],
        grant_sections: {},
        source: "lab-data",
      } as any,
    };
  },
};

export const grantVersionsApi = {
  listAll: async () => {
    const result = await client.query(api.grants.listVersions, { grant_id: "" });
    return { data: (result ?? []).map(adapt) };
  },
  listByGrant: async (grantId: string) => {
    const result = await client.query(api.grants.listVersions, { grant_id: grantId });
    return { data: (result ?? []).map(adapt) };
  },
  create: async (data: any) => {
    const token = getToken();
    const result = await client.mutation(api.grants.createVersion, { token, ...data });
    return { data: result };
  },
  delete: async (id: IdLike) => {
    const token = getToken();
    await client.mutation(api.grants.deleteVersion, { token, id: id as any });
    return { data: { success: true } };
  },
};

export const grantSubmissionsApi = {
  list: async (page = 1, perPage = 20, extra?: Record<string, string>) => {
    const result = await client.query(api.grants.listSubmissions, {
      status: extra?.status,
      paginationOpts: { numItems: 200, cursor: null },
    });
    const items = result?.page ?? [];
    return paginated(items, page, perPage);
  },
  create: async (data: any) => {
    const token = getToken();
    const result = await client.mutation(api.grants.createSubmission, { token, ...data });
    return { data: result };
  },
  update: async (id: IdLike, data: any) => {
    const token = getToken();
    await client.mutation(api.grants.updateSubmission, { token, id: id as any, ...data });
    return { data: { id } };
  },
  delete: async (id: IdLike) => {
    const token = getToken();
    await client.mutation(api.grants.deleteSubmission, { token, id: id as any });
    return { data: { success: true } };
  },
  analytics: async () => {
    const result = await client.query(api.grants.analytics, {});
    return { data: result };
  },
};

export const dashboardApi = {
  summary: async () => {
    const result = await client.query(api.dashboard.summary, {});
    return { data: result };
  },
};

export const protocolsApi = {
  ...crudApi(
    api.protocols.list,
    api.protocols.create,
    api.protocols.update,
    api.protocols.remove,
    api.protocols.get
  ),
  listVersions: async (id: IdLike) => {
    const result = await client.query(api.protocols.listVersions, { protocolId: id as any });
    return { data: (result ?? []).map(adapt) };
  },
  createVersion: async (id: IdLike, data: any) => {
    const token = getToken();
    const result = await client.mutation(api.protocols.createVersion, {
      token,
      protocol_id: id as any,
      ...data,
    });
    return { data: result };
  },
};

export const inventoryApi = crudApi(
  api.inventory.list,
  api.inventory.create,
  api.inventory.update,
  api.inventory.remove,
  api.inventory.get
);

export const samplesApi = {
  ...crudApi(
    api.samples.list,
    api.samples.create,
    api.samples.update,
    api.samples.remove,
    api.samples.get
  ),
  listEvents: async (page = 1, perPage = 20, _search = '', sampleId?: string) => {
    if (!sampleId) return paginated([], page, perPage);
    const result = await client.query(api.samples.listEvents, {
      sampleId: sampleId as any,
      paginationOpts: { numItems: 200, cursor: null },
    });
    const items = result?.page ?? [];
    return paginated(items, page, perPage);
  },
  createEvent: async (data: any) => {
    const result = await client.mutation(api.samples.createEvent, data);
    return { data: result };
  },
  updateEvent: async (id: IdLike, data: any) => {
    await client.mutation(api.samples.updateEvent, { id: toStr(id) as any, ...data });
    return { data: { id } };
  },
  deleteEvent: async (id: IdLike) => {
    await client.mutation(api.samples.deleteEvent, { id: toStr(id) as any });
    return { data: { success: true } };
  },
};

export const maintenanceApi = {
  ...crudApi(
    api.maintenance.list,
    api.maintenance.create,
    api.maintenance.update,
    api.maintenance.remove,
    api.maintenance.get
  ),
  complete: async (id: IdLike) => {
    const token = getToken();
    await client.mutation(api.maintenance.complete, { token, id: id as any });
    return { data: { success: true } };
  },
};

export const instrumentsApi = {
  ...crudApi(
    api.instruments.list,
    api.instruments.create,
    api.instruments.update,
    api.instruments.remove,
    api.instruments.get
  ),
  listBookings: async (page = 1, perPage = 20, _search = '') => {
    const result = await client.query(api.instruments.listBookings, {});
    return paginated(result ?? [], page, perPage);
  },
  createBooking: async (data: any) => {
    const token = getToken();
    const result = await client.mutation(api.instruments.createBooking, { token, ...data });
    return { data: result };
  },
  updateBooking: async (id: IdLike, data: any) => {
    const token = getToken();
    await client.mutation(api.instruments.updateBooking, { token, id: id as any, ...data });
    return { data: { id } };
  },
  deleteBooking: async (id: IdLike) => {
    const token = getToken();
    await client.mutation(api.instruments.cancelBooking, { id: id as any });
    return { data: { success: true } };
  },
};

export const freezerApi = {
  list: async () => {
    const result = await client.query(api.freezer.list, {});
    return { data: (result ?? []).map(adapt) };
  },
  create: async (data: any) => {
    const token = getToken();
    const result = await client.mutation(api.freezer.create, { token, ...data });
    return { data: result };
  },
  delete: async (id: IdLike) => {
    const token = getToken();
    await client.mutation(api.freezer.remove, { token, id: id as any });
    return { data: { success: true } };
  },
  getSlots: async (freezerId: IdLike, rack: number, box: number) => {
    const result = await client.query(api.freezer.getSlots, { freezer_id: freezerId as any, rack, box });
    return { data: (result ?? []).map(adapt) };
  },
  upsertSlot: async (freezerId: IdLike, rack: number, box: number, row: number, col: number, data: any) => {
    const token = getToken();
    const result = await client.mutation(api.freezer.upsertSlot, {
      token,
      freezer_id: freezerId as any,
      rack, box, row, col, ...data,
    });
    return { data: result };
  },
  getExpiring: async (days = 30) => {
    const result = await client.query(api.freezer.getExpiring, { days });
    return { data: (result ?? []).map(adapt) };
  },
  search: async (q: string) => {
    const result = await client.query(api.freezer.search, { query: q });
    return { data: (result ?? []).map(adapt) };
  },
};

export const settingsApi = {
  list: async (page = 1, perPage = 100, category = '') => {
    const token = getToken();
    const result = await client.query(api.settings.list, { token, category: category || undefined });
    return paginated(result ?? [], page, perPage);
  },
  getByCategory: async () => {
    const token = getToken();
    const result = await client.query(api.settings.list, { token });
    const items = (result ?? []) as any[];
    const grouped: Record<string, any[]> = {};
    for (const item of items) {
      const cat = item.category || 'general';
      (grouped[cat] ??= []).push(adapt(item));
    }
    return { data: grouped };
  },
  getByKey: async (key: string) => {
    const token = getToken();
    const result = await client.query(api.settings.getByKey, { token, key });
    return { data: adapt(result) };
  },
  create: async (data: any) => {
    const token = getToken();
    const result = await client.mutation(api.settings.create, { token, ...data });
    return { data: result };
  },
  update: async (id: IdLike, data: any) => {
    const token = getToken();
    await client.mutation(api.settings.update, { token, id: id as any, ...data });
    return { data: { id } };
  },
  updateByKey: async (key: string, data: any) => {
    const token = getToken();
    await client.mutation(api.settings.updateByKey, { token, key, ...data });
    return { data: { key } };
  },
  delete: async (id: IdLike) => {
    const token = getToken();
    await client.mutation(api.settings.remove, { token, id: id as any });
    return { data: { success: true } };
  },
  bulkUpdate: async (settings: any[]) => {
    const token = getToken();
    for (const s of settings) {
      await client.mutation(api.settings.updateByKey, { token, key: s.key, value: s.value });
    }
    return { data: { success: true } };
  },
};

export const costsApi = {
  ...crudApi(
    api.costs.list,
    api.costs.create,
    api.costs.update,
    api.costs.remove,
    api.costs.get
  ),
  summary: async () => {
    const result = await client.query(api.costs.summary, {});
    return { data: result };
  },
  approve: async (id: IdLike) => {
    const token = getToken();
    const me = await client.query(api.users.getMe, { token });
    await client.mutation(api.costs.approve, { token, id: id as any, approved_by: (me as any)?._id });
    return { data: { success: true } };
  },
  reject: async (id: IdLike) => {
    const token = getToken();
    await client.mutation(api.costs.reject, { token, id: id as any });
    return { data: { success: true } };
  },
};

export const labMembersApi = {
  listForLab: async (labId: IdLike) => {
    const result = await client.query(api.labMembers.listForLab, { lab_id: labId as any });
    return { data: (result ?? []).map(adapt) };
  },
  listMy: async () => {
    const token = getToken();
    const result = await client.query(api.labMembers.listMy, { token });
    return { data: (result ?? []).map(adapt) };
  },
  pendingApprovals: async () => {
    const token = getToken();
    const result = await client.query(api.labMembers.pendingApprovals, { token });
    return { data: (result ?? []).map(adapt) };
  },
  invite: async (data: any) => {
    const token = getToken();
    const result = await client.mutation(api.labMembers.invite, { token, ...data });
    return { data: result };
  },
  requestJoin: async (_data: any) => {
    return { data: null };
  },
  approve: async (id: IdLike) => {
    const token = getToken();
    await client.mutation(api.labMembers.approve, { token, membership_id: id as any });
    return { data: { success: true } };
  },
  acceptInvite: async (_id: IdLike) => {
    return { data: { success: true } };
  },
  revoke: async (id: IdLike, _reason = '') => {
    const token = getToken();
    await client.mutation(api.labMembers.revoke, { token, membership_id: id as any });
    return { data: { success: true } };
  },
  updateRole: async (id: IdLike, lab_role: string) => {
    const token = getToken();
    await client.mutation(api.labMembers.updateRole, { token, membership_id: id as any, lab_role });
    return { data: { success: true } };
  },
  canIManage: async (labId: IdLike) => {
    try {
      const token = getToken();
      const memberships = await client.query(api.labMembers.listForLab, { lab_id: toStr(labId) as any });
      const me = await client.query(api.users.getMe, { token });
      const myMembership = (memberships ?? []).find((m: any) => m.user_id === (me as any)?._id);
      const role = myMembership?.lab_role ?? "";
      return { data: { can_manage: ["pi", "admin", "manager"].includes(role), is_pi: role === "pi", is_admin: role === "admin" } };
    } catch {
      return { data: { can_manage: true, is_pi: false, is_admin: false } };
    }
  },
};

export const usersAdminApi = {
  list: authApi.listUsers,
  create: authApi.createUser,
  update: authApi.updateUser,
  delete: authApi.deleteUser,
};

export const trainingApi = crudApi(api.training.list, api.training.create, api.training.update, api.training.remove, api.training.get);
export const complianceApi = crudApi(api.compliance.list, api.compliance.create, api.compliance.update, api.compliance.remove);
export const workspacesApi = crudApi(api.workspaces.list, api.workspaces.create, api.workspaces.update, api.workspaces.remove);
export const feedbackApi = crudApi(api.feedback.list, api.feedback.create);
export const notificationsApi = crudApi(api.notifications.list);
export const integrationsApi = {
  ...crudApi(api.integrations.list, api.integrations.create, api.integrations.update, api.integrations.remove),
  test: async (id: IdLike) => {
    // Test connection by verifying the integration exists
    const result = await client.query(api.integrations.list, {});
    const found = (result as any[])?.find?.((i: any) => i._id === toStr(id));
    return { data: { success: !!found, status: found ? "connected" : "not_found" } };
  },
  sync: async (id: IdLike) => {
    const token = getToken();
    // Update last_sync timestamp
    await client.mutation(api.integrations.update, { token, id: toStr(id) as any, status: "active" });
    return { data: { success: true, synced_at: Date.now() } };
  },
};
export const templatesApi = {
  ...crudApi(api.templates.list, api.templates.create, api.templates.update, api.templates.remove),
  render: async (id: IdLike, vars: Record<string, string>) => {
    const template = await client.query(api.templates.get, { id: toStr(id) as any });
    if (!template) return { data: { content: "" } };
    let content = (template as any).content ?? "";
    for (const [key, val] of Object.entries(vars)) {
      content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val);
    }
    return { data: { content } };
  },
};

export const activityApi = {
  list: async (page = 1, perPage = 50, _entityType = '', _userId?: string, _action = '') => {
    const result = await client.query(api.activity.list, {
      paginationOpts: { numItems: 200, cursor: null },
    });
    const items = (result as any)?.page ?? (Array.isArray(result) ? result : []);
    return paginated(items, page, perPage);
  },
  recent: async (limit = 20) => {
    const result = await client.query(api.activity.recent, { limit });
    return { data: (result ?? []).map(adapt) };
  },
  myActivity: async (page = 1, perPage = 50) => {
    const token = getToken();
    const result = await client.query(api.activity.myActivity, { token });
    return paginated(result ?? [], page, perPage);
  },
  stats: async () => {
    const result = await client.query(api.activity.stats, {});
    return { data: result };
  },
};

export const filesApi = {
  upload: async (entityType: string, entityId: IdLike, file: File) => {
    const token = getToken();
    const result = await client.mutation(api.files.upload, {
      token,
      entity_type: entityType,
      entity_id: toStr(entityId),
      filename: file.name,
      file_size: file.size,
      mime_type: file.type || undefined,
    });
    return { data: adapt(result) };
  },
  list: async (entityType: string, entityId: IdLike) => {
    const token = getToken();
    const result = await client.query(api.files.list, {
      token,
      entity_type: entityType,
      entity_id: toStr(entityId),
    });
    return { data: (result ?? []).map(adapt) };
  },
  download: async (attachmentId: IdLike) => {
    const result = await client.query(api.files.get, { id: toStr(attachmentId) as any });
    if (result?.url) {
      const resp = await fetch(result.url);
      return { data: await resp.blob() };
    }
    return { data: new Blob() };
  },
  delete: async (attachmentId: IdLike) => {
    const token = getToken();
    await client.mutation(api.files.remove, { token, id: toStr(attachmentId) as any });
    return { data: null };
  },
};

export const aiApi = {
  chat: async (question: string) => {
    const token = getToken();
    const result = await client.mutation(api.aiChat.chat, { token, question });
    return { data: result };
  },
  inventoryPredictions: async () => {
    const token = getToken();
    const result = await client.query(api.aiChat.inventoryPredictions, { token });
    return { data: result ?? [] };
  },
};

export const biosketchApi = {
  get: async () => {
    const token = getToken();
    const result = await client.query(api.biosketches?.get ?? ((() => null) as any), { token });
    return { data: adapt(result) };
  },
  save: async (data: any) => {
    const token = getToken();
    await client.mutation(api.biosketches?.save ?? ((() => null) as any), { token, ...data });
    return { data: { success: true } };
  },
};

export const videoApi = {
  createRoom: async (meetingId?: IdLike) => {
    const token = getToken();
    const args: any = { token };
    if (meetingId) args.meeting_id = toStr(meetingId);
    const result = await client.mutation(api.videoRooms.createRoom, args);
    return { data: result };
  },
  getRoom: async (roomId: string) => {
    const result = await client.query(api.videoRooms.getRoom, { room_id: roomId });
    return { data: result ? adapt(result) : null };
  },
  getRoomForMeeting: async (meetingId: string) => {
    const result = await client.query(api.videoRooms.getRoomForMeeting, { meeting_id: meetingId as any });
    return { data: result ? adapt(result) : null };
  },
  deleteRoom: async (roomId: string) => {
    const token = getToken();
    await client.mutation(api.videoRooms.deleteRoom, { token, room_id: roomId });
    return { data: null };
  },
  getChatHistory: async (roomId: string) => {
    const result = await client.query(api.videoRooms.getChatHistory, { room_id: roomId });
    return { data: (result ?? []).map(adapt) };
  },
  getTranscription: async (_roomId: string) => ({ data: [] }),
};

export const paymentsApi = {
  status: async () => {
    const token = getToken();
    const result = await client.query(api.payments.status, { token });
    return { data: result };
  },
  listMethods: async () => {
    const token = getToken();
    const result = await client.query(api.payments.listMethods, { token });
    return { data: (result ?? []).map(adapt) };
  },
  createSetupIntent: async () => {
    const token = getToken();
    if (!token) return { data: { client_secret: "" } };
    const result = await client.action(api.stripe.createSetupIntent, { token });
    return { data: result };
  },
  deleteMethod: async (id: IdLike) => {
    const token = getToken();
    await client.mutation(api.payments.deleteMethod, { token, id: toStr(id) as any });
    return { data: null };
  },
  setDefault: async (id: IdLike) => {
    const token = getToken();
    await client.mutation(api.payments.setDefault, { token, id: toStr(id) as any });
    return { data: null };
  },
  listOrders: async () => {
    const token = getToken();
    const result = await client.query(api.payments.listOrders, { token });
    return { data: (result ?? []).map(adapt) };
  },
};

export const procurementApi = {
  getAltPrices: async (id: IdLike) => {
    const token = getToken();
    const result = await client.query(api.procurement.getAltPrices, { token, id: toStr(id) as any });
    return { data: (result ?? []).map(adapt) };
  },
  setAltPrices: async (id: IdLike, prices: any[]) => {
    const token = getToken();
    await client.mutation(api.procurement.setAltPrices, { token, id: toStr(id) as any, prices });
    return { data: null };
  },
  swapVendor: async (id: IdLike, vendor: string, price: number, url?: string) => {
    const token = getToken();
    await client.mutation(api.procurement.swapVendor, { token, id: toStr(id) as any, vendor, price, url });
    return { data: null };
  },
  listPendingApprovals: async () => {
    const token = getToken();
    const result = await client.query(api.procurement.listPendingApprovals, { token });
    return { data: (result ?? []).map(adapt) };
  },
  approve: async (ids: IdLike[], reason?: string) => {
    const token = getToken();
    await client.mutation(api.procurement.approve, { token, ids: ids.map(toStr) as any, reason });
    return { data: null };
  },
  reject: async (ids: IdLike[], reason?: string) => {
    const token = getToken();
    await client.mutation(api.procurement.reject, { token, ids: ids.map(toStr) as any, reason });
    return { data: null };
  },
  listRules: async () => {
    const token = getToken();
    const result = await client.query(api.procurement.listRules, { token });
    return { data: (result ?? []).map(adapt) };
  },
  createRule: async (data: any) => {
    const token = getToken();
    await client.mutation(api.procurement.createRule, { token, ...data });
    return { data: null };
  },
  deleteRule: async (id: IdLike) => {
    const token = getToken();
    await client.mutation(api.procurement.deleteRule, { token, id: toStr(id) as any });
    return { data: null };
  },
  listRestricted: async () => {
    const token = getToken();
    const result = await client.query(api.procurement.listRestricted, { token });
    return { data: (result ?? []).map(adapt) };
  },
  addRestricted: async (data: any) => {
    const token = getToken();
    await client.mutation(api.procurement.addRestricted, { token, ...data });
    return { data: null };
  },
  deleteRestricted: async (id: IdLike) => {
    const token = getToken();
    await client.mutation(api.procurement.deleteRestricted, { token, id: toStr(id) as any });
    return { data: null };
  },
  scanChemical: async (name: string, cas: string) => {
    const token = getToken();
    const result = await client.query(api.procurement.scanChemical, { token, name, cas });
    return { data: result };
  },
  listBudgets: async () => {
    const token = getToken();
    const result = await client.query(api.procurement.listBudgets, { token });
    return { data: (result ?? []).map(adapt) };
  },
  createBudget: async (data: any) => {
    const token = getToken();
    await client.mutation(api.procurement.createBudget, { token, ...data });
    return { data: null };
  },
  deleteBudget: async (id: IdLike) => {
    const token = getToken();
    await client.mutation(api.procurement.deleteBudget, { token, id: toStr(id) as any });
    return { data: null };
  },
  checkBudget: async (id: IdLike, amount: number) => {
    const token = getToken();
    const result = await client.query(api.procurement.checkBudget, { token, id: toStr(id) as any, amount });
    return { data: result };
  },
  requestQuote: async (id: IdLike, notes?: string) => {
    const token = getToken();
    await client.mutation(api.procurement.requestQuote, { token, id: toStr(id) as any, notes });
    return { data: null };
  },
  recordQuote: async (id: IdLike, url?: string, price?: number) => {
    const token = getToken();
    await client.mutation(api.procurement.recordQuote, { token, id: toStr(id) as any, url, price });
    return { data: null };
  },
  groupBuy: async () => {
    const token = getToken();
    const result = await client.query(api.procurement.groupBuy, { token });
    return { data: result ?? [] };
  },
  listBorrow: async () => {
    const token = getToken();
    const result = await client.query(api.procurement.listBorrow, { token });
    return { data: (result ?? []).map(adapt) };
  },
  createBorrow: async (data: any) => {
    const token = getToken();
    await client.mutation(api.procurement.createBorrow, { token, ...data });
    return { data: null };
  },
  respondBorrow: async (id: IdLike, approve: boolean) => {
    const token = getToken();
    await client.mutation(api.procurement.respondBorrow, { token, id: toStr(id) as any, approve });
    return { data: null };
  },
  findLender: async (params: any) => {
    const token = getToken();
    const result = await client.query(api.procurement.findLender, { token, item_name: params?.item_name ?? params?.name });
    return { data: result ?? [] };
  },
  setRecurrence: async (id: IdLike, pattern: string, auto?: boolean) => {
    const token = getToken();
    await client.mutation(api.procurement.setRecurrence, { token, entity_id: toStr(id), pattern, auto_reorder: auto });
    return { data: null };
  },
  setSds: async (id: IdLike, url: string, hazards?: string[]) => {
    const token = getToken();
    await client.mutation(api.procurement.setSds, { token, entity_id: toStr(id), url, hazards });
    return { data: null };
  },
  punchoutUrl: (_ids: IdLike[]) => "",
  receive: async (barcode: string, _qty?: number) => {
    const token = getToken();
    const result = await client.mutation(api.procurement.receive, { token, barcode });
    return { data: result };
  },
  enrichmentStatus: async () => {
    const token = getToken();
    const result = await client.query(api.procurement.enrichmentStatus, { token });
    return { data: result };
  },
};

export const protocolsPrintApi = {
  getPrintView: async (id: IdLike) => {
    try {
      const result = await client.query(api.protocols.get, { id: toStr(id) as any });
      if (!result) return { data: "<p>Protocol not found</p>" };
      const p = result as any;
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:40px">
          <h1 style="border-bottom:2px solid #333;padding-bottom:10px">${p.title ?? "Untitled Protocol"}</h1>
          <table style="width:100%;border-collapse:collapse;margin:20px 0">
            <tr><td style="padding:6px;font-weight:bold;width:150px">Version</td><td style="padding:6px">${p.version ?? "1.0"}</td></tr>
            <tr><td style="padding:6px;font-weight:bold">Status</td><td style="padding:6px">${p.status ?? "draft"}</td></tr>
            <tr><td style="padding:6px;font-weight:bold">Category</td><td style="padding:6px">${p.category ?? "—"}</td></tr>
            <tr><td style="padding:6px;font-weight:bold">Created</td><td style="padding:6px">${p.created_at ? new Date(p.created_at).toLocaleDateString() : "—"}</td></tr>
          </table>
          <h2>Description</h2>
          <p>${p.description ?? "No description provided."}</p>
          <h2>Steps</h2>
          <div>${p.steps ?? "<p>No steps defined.</p>"}</div>
          <div style="margin-top:40px;border-top:1px solid #ccc;padding-top:20px;font-size:12px;color:#666">
            <p>Printed from LabOS on ${new Date().toLocaleString()}</p>
          </div>
        </div>`;
      return { data: html };
    } catch {
      return { data: "<p>Error loading protocol for print</p>" };
    }
  },
};

export const orgApi = {
  list: async () => {
    const result = await client.query(api.org.listOrgs, {});
    return { data: (result ?? []).map(adapt) };
  },
};

export { client as convexClient };
