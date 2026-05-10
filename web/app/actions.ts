"use server";

import { revalidatePath } from "next/cache";
import { loadSubscriptions, saveSubscriptions, type Subscription } from "@/lib/data";

export type AddState = { ok: true } | { error: string } | null;

function getString(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function validate(form: FormData): { sub: Subscription } | { error: string } {
  const name = getString(form, "name");
  if (!name) return { error: "Name is required." };

  const costStr = getString(form, "cost");
  if (!/^\d+(\.\d{1,2})?$/.test(costStr)) {
    return { error: "Cost must be a positive number with up to 2 decimals." };
  }
  const cost = Number.parseFloat(costStr);
  if (cost <= 0) return { error: "Cost must be greater than 0." };

  const currencyRaw = getString(form, "currency");
  const currency = (currencyRaw || "USD").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    return { error: "Currency must be 3 letters (e.g., USD, EUR)." };
  }

  const category = getString(form, "category");
  if (!category) return { error: "Category is required." };

  const renewalDayStr = getString(form, "renewalDay");
  if (!/^\d+$/.test(renewalDayStr)) {
    return { error: "Renewal day must be an integer between 1 and 31." };
  }
  const renewalDay = Number.parseInt(renewalDayStr, 10);
  if (renewalDay < 1 || renewalDay > 31) {
    return { error: "Renewal day must be an integer between 1 and 31." };
  }

  return { sub: { name, cost, currency, category, renewalDay } };
}

export async function addSubscription(_prevState: AddState, formData: FormData): Promise<AddState> {
  const validated = validate(formData);
  if ("error" in validated) return { error: validated.error };

  let subs: Subscription[];
  try {
    subs = await loadSubscriptions();
  } catch (err) {
    return { error: `Couldn't read data file: ${(err as Error).message}` };
  }

  const newName = validated.sub.name.toLowerCase();
  if (subs.some((s) => s.name.toLowerCase() === newName)) {
    return { error: `A subscription named "${validated.sub.name}" already exists.` };
  }

  const newSub: Subscription = {
    ...validated.sub,
    addedAt: new Date().toISOString(),
  };

  try {
    await saveSubscriptions([...subs, newSub]);
  } catch (err) {
    return { error: `Couldn't save: ${(err as Error).message}` };
  }

  revalidatePath("/");
  return { ok: true };
}

export async function removeSubscription(formData: FormData): Promise<void> {
  const name = getString(formData, "name").toLowerCase();
  if (!name) return;

  const subs = await loadSubscriptions();
  const next = subs.filter((s) => s.name.toLowerCase() !== name);
  if (next.length === subs.length) return; // already gone

  await saveSubscriptions(next);
  revalidatePath("/");
}
