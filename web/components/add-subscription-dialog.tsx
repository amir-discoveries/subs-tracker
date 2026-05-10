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

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setSubmittedSinceOpen(false);
      }}
    >
      <DialogTrigger render={<Button>+ Add subscription</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a subscription</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required maxLength={100} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="cost">Cost (monthly)</Label>
              <Input
                id="cost"
                name="cost"
                type="number"
                step="0.01"
                min="0.01"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" name="currency" required maxLength={10} defaultValue="USD" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="category">Category</Label>
              <Input id="category" name="category" required maxLength={50} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="renewalDay">Renews on day</Label>
              <Input
                id="renewalDay"
                name="renewalDay"
                type="number"
                min="1"
                max="31"
                required
              />
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
