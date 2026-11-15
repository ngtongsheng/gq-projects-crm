import {
  Camera,
  ClipboardCheck,
  FileCheck,
  Hammer,
  MapPin,
  Package,
  Ruler,
  Truck,
  Wrench,
} from "lucide-react";
import type { SiteActivity } from "@/lib/domain/site-log";

export const ACTIVITY_ICON: Record<SiteActivity, typeof Hammer> = {
  measurement: Ruler,
  inspection: ClipboardCheck,
  installation: Hammer,
  handover: FileCheck,
  shooting: Camera,
  touch_up: Wrench,
  delivery: Truck,
  stock_return: Package,
  others: MapPin,
};
