"use client";

import { UserPlusIcon } from "lucide-react";
import { useState, useTransition, type FormEvent } from "react";
import { addStudent } from "@/app/(app)/students/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Fields = Partial<Record<"name" | "username" | "pin", string>>;

/** Teacher-only: creates a child's sign-in (name + username + 4-digit PIN). The PIN is shown once, then forgotten. */
export function AddStudentForm() {
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Fields>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ name: string; username: string; pin: string } | null>(null);
  const [resetKey, setResetKey] = useState(0);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const input = { name: String(data.get("name") ?? ""), username: String(data.get("username") ?? ""), pin: String(data.get("pin") ?? "") };
    setErrors({});
    setFormError(null);
    setCreated(null);
    start(async () => {
      const result = await addStudent(input);
      if (result.ok) {
        setCreated({ name: result.name, username: result.username, pin: input.pin });
        setResetKey((k) => k + 1); // clears the inputs, so the PIN is not left in the form
      } else {
        setErrors((result.fields as Fields | undefined) ?? {});
        setFormError(result.fields ? null : result.error);
      }
    });
  }

  return (
    <Card className="mb-6">
      <CardContent>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <UserPlusIcon className="size-5" aria-hidden /> Add a student
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a username and a 4-digit PIN. Give both to the child: they sign in with them on the student page.
        </p>
        <form key={resetKey} onSubmit={onSubmit} noValidate aria-busy={pending} className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_8rem_auto] sm:items-start">
          <div className="space-y-1.5">
            <Label htmlFor="new-student-name">Child&rsquo;s name</Label>
            <Input id="new-student-name" name="name" autoComplete="off" maxLength={100} aria-invalid={!!errors.name} disabled={pending} />
            {errors.name && <p role="alert" className="text-sm text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-student-username">Username</Label>
            <Input
              id="new-student-username"
              name="username"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={20}
              aria-invalid={!!errors.username}
              disabled={pending}
            />
            {errors.username && <p role="alert" className="text-sm text-destructive">{errors.username}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-student-pin">4-digit PIN</Label>
            <Input
              id="new-student-pin"
              name="pin"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              autoComplete="off"
              aria-invalid={!!errors.pin}
              disabled={pending}
            />
            {errors.pin && <p role="alert" className="text-sm text-destructive">{errors.pin}</p>}
          </div>
          <Button type="submit" disabled={pending} className="sm:mt-[1.625rem]">
            {pending ? "Adding…" : "Add student"}
          </Button>
        </form>
        {formError && <p role="alert" className="mt-3 text-sm text-destructive">{formError}</p>}
        {created && (
          <p role="status" className="mt-3 rounded-xl bg-success/10 px-3 py-2 text-sm font-semibold text-success" data-testid="student-created">
            {created.name} can now sign in with username <span className="font-mono">{created.username}</span> and PIN <span className="font-mono">{created.pin}</span>. Write it down: the PIN is not shown again.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
