"use client";

import { useState } from "react";
import { toast } from "sonner";
import { DeleteConfirm } from "@/components/app/delete-confirm";

export function DeleteConfirmDemo() {
  const [asking, setAsking] = useState(false);
  const shared = {
    pending: false,
    question: "Delete this lead?",
    asking,
    onAskingChange: setAsking,
    onDelete: () => {
      setAsking(false);
      toast.success("Lead deleted.");
    },
  };
  return (
    <form
      className="grid w-full max-w-md gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        toast.success("Saved");
      }}
    >
      <DeleteConfirm {...shared} showDelete />
      <DeleteConfirm {...shared} showDelete inUse />
      <DeleteConfirm {...shared} showDelete={false} />
    </form>
  );
}
