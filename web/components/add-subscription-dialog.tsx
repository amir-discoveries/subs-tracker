"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { addSubscription, type AddState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CATEGORIES = [
  "Entertainment",
  "Music",
  "Software",
  "Cloud / Storage",
  "News / Media",
  "Productivity",
  "Fitness / Health",
  "Utilities",
  "Other",
];

const CURRENCIES = ["USD", "EUR"];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Adding…" : "Add subscription"}
    </Button>
  );
}

export function AddSubscriptionDialog() {
  const [open, setOpen] = useState(false);
  const [submittedSinceOpen, setSubmittedSinceOpen] = useState(false);
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [renewalMode, setRenewalMode] = useState<"date" | "days">("date");

  const wrappedAction = async (prevState: AddState, formData: FormData): Promise<AddState> => {
    setSubmittedSinceOpen(true);
    return addSubscription(prevState, formData);
  };
  const [state, formAction] = useActionState<AddState, FormData>(wrappedAction, null);

  useEffect(() => {
    if (state && "ok" in state && state.ok) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- close-on-success: React 19 has no first-class API for "consume action result then close dialog"; effect-driven close is the documented idiom.
      setOpen(false);
    }
  }, [state]);

  const costSuffix = cycle === "yearly" ? "/ yr" : "/ mo";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setSubmittedSinceOpen(false);
          setCycle("monthly");
          setRenewalMode("date");
        }
      }}
    >
      <DialogTrigger render={<Button>Add subscription</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a subscription</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-5">
          <div className="space-y-1.5">
            <Label>Cycle</Label>
            <div className="flex rounded-md border bg-muted p-1">
              <label className={`flex-1 text-center text-sm py-1.5 rounded cursor-pointer ${cycle === "monthly" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}>
                <input type="radio" name="cycle" value="monthly" className="sr-only" checked={cycle === "monthly"} onChange={() => setCycle("monthly")} />
                Monthly
              </label>
              <label className={`flex-1 text-center text-sm py-1.5 rounded cursor-pointer ${cycle === "yearly" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}>
                <input type="radio" name="cycle" value="yearly" className="sr-only" checked={cycle === "yearly"} onChange={() => setCycle("yearly")} />
                Yearly
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cost">Cost {costSuffix}</Label>
              <Input id="cost" name="cost" type="number" step="0.01" min="0.01" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="currency">Currency</Label>
              <Select name="currency" defaultValue="USD">
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="category">Category</Label>
            <Select name="category">
              <SelectTrigger id="category">
                <SelectValue placeholder="Pick a category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Next renewal</Label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="renewalMode"
                  value="date"
                  checked={renewalMode === "date"}
                  onChange={() => setRenewalMode("date")}
                />
                <span className="text-sm w-20">On date</span>
                <Input
                  type="date"
                  name="renewalDate"
                  disabled={renewalMode !== "date"}
                  className="flex-1"
                />
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="renewalMode"
                  value="days"
                  checked={renewalMode === "days"}
                  onChange={() => setRenewalMode("days")}
                />
                <span className="text-sm w-20">In days</span>
                <Input
                  type="number"
                  name="renewalInDays"
                  min="0"
                  max="730"
                  placeholder="e.g., 220"
                  disabled={renewalMode !== "days"}
                  className="flex-1"
                />
              </label>
            </div>
          </div>

          {submittedSinceOpen && state && "error" in state && (
            <p className="text-sm text-destructive" role="alert">{state.error}</p>
          )}

          <DialogFooter>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
