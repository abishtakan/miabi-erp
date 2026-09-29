"use client";

import { useTransition } from "react";
import { deleteOrder } from "@/app/actions";

export function DeleteOrderButton({ orderId }: { orderId: string }) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (window.confirm("Are you sure you want to delete this sale? This will restore the product stock.")) {
      startTransition(async () => {
        const result = await deleteOrder(orderId);
        if (!result.ok) {
          window.alert(result.message);
        }
      });
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={pending}
      className="text-xs font-bold text-zinc-400 hover:text-red-400 disabled:opacity-50"
    >
      {pending ? "Deleting..." : "Delete"}
    </button>
  );
}
