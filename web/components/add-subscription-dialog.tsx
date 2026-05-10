"use client";

import { useActionState, useEffect, useRef, useState } from "react";
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
  const [state, formAction] = useActionState<AddState, FormData>(addSubscription, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && "ok" in state && state.ok) {
      formRef.current?.reset();
      setOpen(false);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>+ Add subscription</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a subscription</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
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
          {state && "error" in state && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          <DialogFooter>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
