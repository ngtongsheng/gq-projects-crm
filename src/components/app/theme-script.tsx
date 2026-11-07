import { THEME_STORAGE_KEY } from "@/lib/theme";

// Runs before first paint so the page never flashes the wrong theme. It is rendered by the
// server layout, not a client component, because React 19 warns about scripts in client trees.
const script = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light")}catch(e){}`;

export function ThemeScript() {
  // biome-ignore lint/security/noDangerouslySetInnerHtml: the script is a fixed constant above; React would HTML-escape the quotes if passed as children.
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
