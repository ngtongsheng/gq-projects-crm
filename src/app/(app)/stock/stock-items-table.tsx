import { Boxes } from "lucide-react";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import {
  availableQty,
  overHeldQty,
  STOCK_UNIT_LABEL,
} from "@/lib/domain/reservation";
import { formatQuantity } from "@/lib/format/quantity";
import { heldQty } from "./reservation-filters";
import type { Reservation, StockItem } from "./stock-data";
import { StockItemDialog } from "./stock-item-dialog";

/** What is on hand, held and still available per SKU. */
export function StockItemsTable({
  items,
  reservations,
  arranges,
}: {
  items: StockItem[];
  reservations: Reservation[];
  arranges: boolean;
}) {
  return (
    <DataTable
      rows={items}
      getRowKey={(item) => item.id}
      empty={
        <EmptyState
          icon={Boxes}
          title="No stock items yet"
          description="Whoever arranges stock adds each SKU here."
        />
      }
      columns={[
        {
          key: "sku",
          header: "SKU",
          cell: (item) => (
            <div className="flex min-w-40 flex-col">
              <span className="font-mono text-sm font-medium">{item.sku}</span>
              <span className="text-xs text-muted-foreground">
                {item.collection}
              </span>
            </div>
          ),
        },
        {
          key: "supplier",
          header: "Supplier",
          cell: (item) => item.supplier,
        },
        {
          key: "onHand",
          header: "On hand",
          numeric: true,
          cell: (item) =>
            `${formatQuantity(item.qty)} ${STOCK_UNIT_LABEL[item.unit]}`,
        },
        {
          key: "held",
          header: "Held",
          numeric: true,
          cell: (item) => formatQuantity(heldQty(item.id, reservations)),
        },
        {
          key: "available",
          header: "Available",
          numeric: true,
          cell: (item) => {
            const lines = reservations.filter(
              (line) => line.itemId === item.id,
            );
            const over = overHeldQty(item.qty, lines);
            return (
              <div className="flex flex-col items-end">
                <span className="font-semibold">
                  {formatQuantity(availableQty(item.qty, lines))}
                </span>
                {over > 0 ? (
                  <span className="text-xs text-warn">
                    over-held by {formatQuantity(over)}
                  </span>
                ) : null}
              </div>
            );
          },
        },
        {
          key: "actions",
          header: "",
          cell: (item) => (arranges ? <StockItemDialog item={item} /> : null),
        },
      ]}
    />
  );
}
