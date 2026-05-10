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
  if (name.length > 100) return { error: "Name must be 100 characters or fewer." };

  const costStr = getString(form, "cost");
  const cost = Number.parseFloat(costStr);
  if (!Number.isFinite(cost) || cost <= 0) return { error: "Cost must be greater than 0." };
  if (cost > 1_000_000) return { error: "Cost is unrealistically large." };

  const currency = getString(form, "currency");
  if (!currency) return { error: "Currency is required." };
  if (currency.length > 10) return { error: "Currency must be 10 characters or fewer." };

  const category = getString(form, "category");
  if (!category) return { error: "Category is required." };
  if (category.length > 50) return { error: "Category must be 50 characters or fewer." };

  const renewalDayStr = getString(form, "renewalDay");
  const renewalDay = Number.parseInt(renewalDayStr, 10);
  if (!Number.isInteger(renewalDay) || renewalDay < 1 || renewalDay > 31) {
    return { error: "Renewal day must be a whole number between 1 and 31." };
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

  try {
    await saveSubscriptions([...subs, validated.sub]);
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
