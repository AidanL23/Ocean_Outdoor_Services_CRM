"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";

/**
 * A button that asks before it acts: the first click shows the question with
 * Confirm and Cancel; only Confirm submits `action`.
 */
export function ConfirmButton({
  action,
  label,
  question,
  confirmLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  label: string;
  question: string;
  confirmLabel: string;
}) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <Button type="button" variant="secondary" onClick={() => setAsking(true)}>
        {label}
      </Button>
    );
  }

  return (
    <form
      action={action}
      role="alertdialog"
      aria-label={question}
      className="flex flex-wrap items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-1.5"
    >
      <span className="text-sm text-red-900">{question}</span>
      <SubmitButton variant="danger">{confirmLabel}</SubmitButton>
      <Button type="button" variant="ghost" onClick={() => setAsking(false)}>
        Cancel
      </Button>
    </form>
  );
}
