"use client";

import { CheckIcon, CopyIcon, ExternalLinkIcon, Link2Icon, LoaderCircleIcon } from "lucide-react";
import { useRef, useState, useSyncExternalStore } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { videosApi } from "@/lib/videos/client";

const noopSubscribe = () => () => {};
const getOrigin = () => window.location.origin;

/** Owner control for the public watch link: create, copy, open and stop sharing. */
export function SharePanel({ videoId, initialShareId, initialListed }: { videoId: number; initialShareId: string | null; initialListed: boolean }) {
  const origin = useSyncExternalStore(noopSubscribe, getOrigin, () => "");
  const [shareId, setShareId] = useState(initialShareId);
  const [listed, setListed] = useState(initialListed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const path = shareId ? `/watch/${shareId}` : null;
  const url = path ? `${origin}${path}` : "";

  async function run(action: () => Promise<void>, fallback: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : fallback);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard API unavailable (insecure context / permissions): select the text so Ctrl+C works.
      inputRef.current?.select();
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section aria-label="Public link" className="rounded-xl border p-4" data-testid="share-panel">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1 basis-60">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Link2Icon className="size-4" aria-hidden /> Public link
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {shareId ? "Anyone with this link can watch and answer. Sign-in is optional; signed-in viewers' answers are saved for you under their name." : "Private. Create a link to let anyone watch and answer without signing in."}
          </p>
        </div>
        {!shareId && (
          <Button
            type="button"
            disabled={busy}
            onClick={() => void run(async () => setShareId(await videosApi.enableShare(videoId)), "Could not create the link.")}
          >
            {busy && <LoaderCircleIcon className="animate-spin" aria-hidden />} Create public link
          </Button>
        )}
      </div>

      {shareId && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input ref={inputRef} readOnly value={url} aria-label="Public link URL" onFocus={(e) => e.currentTarget.select()} className="h-9 min-w-0 flex-1 basis-64 font-mono text-xs" />
            <Button type="button" variant="outline" size="lg" onClick={() => void copy()}>
              {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />} {copied ? "Copied" : "Copy"}
            </Button>
            <a href={path ?? "#"} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border bg-background px-2.5 text-sm font-medium hover:bg-muted">
              <ExternalLinkIcon className="size-4" aria-hidden /> Open
            </a>
          </div>
          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={listed}
              disabled={busy}
              onChange={(e) => void run(async () => setListed((await videosApi.setListed(videoId, e.target.checked)).isListed), "Could not update the Library.")}
              className="mt-0.5 size-4 accent-primary"
            />
            <span>
              <span className="font-medium">List in the Library</span>
              <span className="block text-xs text-muted-foreground">Signed-in members can discover and watch this video from the Library tab, with your name shown as the author.</span>
            </span>
          </label>
          {!confirmStop ? (
            <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirmStop(true)}>
              Stop sharing
            </Button>
          ) : (
            <div className="flex flex-wrap items-center gap-2" role="alertdialog" aria-label="Confirm stop sharing">
              <span className="text-xs text-muted-foreground">The current link will stop working immediately.</span>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await videosApi.disableShare(videoId);
                    setShareId(null);
                    setListed(false);
                    setConfirmStop(false);
                  }, "Could not stop sharing.")
                }
              >
                {busy && <LoaderCircleIcon className="animate-spin" aria-hidden />} Confirm
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setConfirmStop(false)}>
                Keep sharing
              </Button>
            </div>
          )}
        </div>
      )}
      {error && (
        <Alert variant="destructive" role="alert" className="mt-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </section>
  );
}
