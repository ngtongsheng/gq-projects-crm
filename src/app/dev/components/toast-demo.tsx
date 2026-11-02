"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ToastDemo() {
  return (
    <Button
      variant="outline"
      onClick={() => toast.success("Saved", { description: "Lead updated." })}
    >
      Show toast
    </Button>
  );
}
