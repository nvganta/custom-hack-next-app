import { LocaleSwitcher } from "lingo.dev/react/client";

export default function AppLocaleSwitcher() {
  return (
    <LocaleSwitcher
      locales={["en", "es", "fr", "de"]}
      className="absolute top-2 right-3 z-50 border border-gray-800 rounded-md p-2 text-white bg-primary cursor-pointer hover:bg-primary/80 transition-colors"
    />
  );
}
