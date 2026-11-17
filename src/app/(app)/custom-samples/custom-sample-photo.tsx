import Image from "next/image";
import { cn } from "@/lib/utils";

/** A sample's photo as a square thumbnail, or a grey block when it has none. */
export function CustomSampleThumb({
  url,
  className,
}: {
  url: string | null;
  className?: string;
}) {
  return url ? (
    <Image
      src={url}
      alt=""
      width={88}
      height={88}
      unoptimized
      className={cn("size-11 rounded-md object-cover", className)}
    />
  ) : (
    <div className={cn("size-11 rounded-md bg-muted", className)} />
  );
}
