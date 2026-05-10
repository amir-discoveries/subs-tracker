"use server";

import { revalidatePath } from "next/cache";
import { loadSubscriptions, saveSubscriptions, type Subscription, type Cycle } from "@/lib/data";

export type AddState = { ok: true } | { error: string } | null;

function getString(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

type ResolvedRenewal = { renewalDay: number; renewalMonth?: number };

function resolveRenewal(form: FormData, cycle: Cycle): ResolvedRenewal | { error: string } {
  const dateStr = getString(form, "renewalDate");
  const daysStr = getString(form, "renewalInDays");

  if (dateStr && daysStr) return { error: "Provide either a date or a number of days, not both." };
  if (!dateStr && !daysStr) return { error: "Pick a renewal date or enter days from today." };

  let target: Date;
  if (dateStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { error: "Renewal date must be YYYY-MM-DD." };
    const [y, m, d] = dateStr.split("-").map(Number);
    target = new Date(y, m - 1, d);
    if (Number.isNaN(target.getTime()) || target.getMonth() !== m - 1) {
      return { error: "Renewal date is not a real calendar date." };
    }
  } else {
    if (!/^\d+$/.test(daysStr)) return { error: "Days from today must be a non-negative whole number." };
    const n = Number.parseInt(daysStr, 10);
    if (n > 730) return { error: "Days from today must be 730 or fewer." };
    const today = new Date();
    target = new Date(today.getFullYear(), today.getMonth(), today.getDate() + n);
  }

  // Validate target is in [today, today + 730 days].
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffDays = Math.round((startTarget.getTime() - startToday.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { error: "Renewal date must be today or later." };
  if (diffDays > 730) return { error: "Renewal date must be within the next 730 days." };

  if (cycle === "yearly") {
    return { renewalDay: target.getDate(), renewalMonth: target.getMonth() + 1 };
  }
  return { renewalDay: target.getDate() };
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

  const cycleRaw = getString(form, "cycle");
  const cycle: Cycle = cycleRaw === "yearly" ? "yearly" : "monthly";

  const renewal = resolveRenewal(form, cycle);
  if ("error" in renewal) return { error: renewal.error };

  const sub: Subscription = {
    name,
    cost,
    currency,
    category,
    cycle,
    renewalDay: renewal.renewalDay,
  };
  if (renewal.renewalMonth !== undefined) sub.renewalMonth = renewal.renewalMonth;

  return { sub };
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
  if (next.length === subs.length) return;

  await saveSubscriptions(next);
  revalidatePath("/");
}
