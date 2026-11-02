import { redirect } from "next/navigation";

// Leftover stock is the first Stock page; the stock list (task 23) takes this over.
export default function StockPage() {
  redirect("/stock/leftover");
}
