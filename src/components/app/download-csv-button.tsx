import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Link to a CSV export route; pass the page's current filters on `query` so the file matches the list. */
export function DownloadCsvButton({
  path,
  query,
}: {
  path: string;
  query?: Record<string, string | undefined>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value) params.set(key, value);
  }
  const search = params.toString();
  return (
    <Button asChild variant="outline">
      <a href={search ? `${path}?${search}` : path} download>
        <Download data-icon="inline-start" />
        Download CSV
      </a>
    </Button>
  );
}
