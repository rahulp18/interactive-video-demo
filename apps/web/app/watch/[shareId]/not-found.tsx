import { LinkIcon } from "lucide-react";

export default function WatchNotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="max-w-sm text-center">
        <LinkIcon className="mx-auto mb-3 size-8 text-muted-foreground" aria-hidden />
        <h1 className="text-lg font-semibold">This link is not available</h1>
        <p className="mt-1 text-sm text-muted-foreground">The video may have been made private or removed. Ask the person who shared it for a new link.</p>
      </div>
    </main>
  );
}
