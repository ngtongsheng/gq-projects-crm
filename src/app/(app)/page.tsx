import { APP_NAME } from "@/lib/app-name";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center">
      <h1 className="text-3xl font-semibold tracking-tight">{APP_NAME}</h1>
    </main>
  );
}
