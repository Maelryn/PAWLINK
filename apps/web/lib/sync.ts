"use client";

import { apiOn } from "./api/client";
import { adoptions as adoptionsApi, services as servicesApi, notifications as notificationsApi } from "./api/endpoints";
import { store } from "./store";

/** Pull notifications from the API into the store when the feature is on. */
export async function syncNotifications(userId: string | null) {
  if (!apiOn("notifications") || !userId) return;
  try {
    const page = await notificationsApi.list({ pageSize: 50 });
    store.setNotifications(page.items.map((n) => ({ ...n, userId: n.userId ?? userId })));
  } catch {}
}

/** Pull adoptions from the API into the store when the feature is on. */
export async function syncAdoptions() {
  if (!apiOn("adoptions")) return;
  try {
    const page = await adoptionsApi.list({ pageSize: 100 });
    store.setAdoptions(page.items);
  } catch {}
}

/** Pull services from the API into the store when the feature is on. */
export async function syncServices() {
  if (!apiOn("services")) return;
  try {
    const page = await servicesApi.list({ pageSize: 100 });
    store.setServices(page.items);
  } catch {}
}
