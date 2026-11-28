"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/** A form's submit button that is disabled while the form is submitting, so a double-click acts once. */
export function SubmitButton({
  pendingLabel = "Working…",
  children,
  ...props
}: React.ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
