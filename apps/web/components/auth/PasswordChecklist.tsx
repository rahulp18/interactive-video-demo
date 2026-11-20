import { CheckIcon, CircleIcon } from "lucide-react";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/auth/validation";
import { cn } from "@/lib/utils";

/**
 * Live feedback for the rules the server enforces (length and matching). Neutral until a rule is met, so it never
 * scolds someone who has not finished typing; submit-time errors are still shown under the fields.
 */
export function PasswordChecklist({ password, confirm }: { password: string; confirm: string }) {
  const rules = [
    { label: `At least ${PASSWORD_MIN} characters`, met: password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX },
    { label: "Both passwords match", met: confirm.length > 0 && confirm === password },
  ];
  return (
    <ul aria-label="Password requirements" className="-mt-1 space-y-1.5 text-sm">
      {rules.map(({ label, met }) => (
        <li key={label} className={cn("flex items-center gap-2 transition-colors", met ? "text-foreground" : "text-muted-foreground")}>
          {met ? <CheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden /> : <CircleIcon className="size-4" aria-hidden />}
          <span>{label}</span>
          <span className="sr-only">{met ? "(met)" : "(not met yet)"}</span>
        </li>
      ))}
    </ul>
  );
}
