export type FileIconName = "showDisks" | "up" | "dir" | "kblayoutsDir" | "themesDir" | "symlink" | "file" | "config" | "settings" | "markdown" | "image";

export interface CanonicalFileEntry {
  icon: FileIconName;
  name: string;
  category: "navigation" | "directory" | "symlink" | "file";
}

// Runtime snapshot from the exact eDEX-UI screenshot committed after v2.2.0. The entry
// categories follow filesystem.class.js so source typography and behavior can
// be applied without coupling them to the page renderer.
export const canonicalFileEntries: readonly CanonicalFileEntry[] = [
  { icon: "showDisks", name: "Show disks", category: "navigation" },
  { icon: "up", name: "Go up", category: "navigation" },
  ...["blob_storage", "Cache", "databases", "fonts", "GPUCache", "IndexedDB"].map((name) => ({ icon: "dir" as const, name, category: "directory" as const })),
  { icon: "kblayoutsDir", name: "keyboards", category: "directory" },
  { icon: "dir", name: "Local Storage", category: "directory" },
  { icon: "themesDir", name: "themes", category: "directory" },
  { icon: "dir", name: "webrtc_events", category: "directory" },
  ...["SingletonCookie", "SingletonLock", "SS"].map((name) => ({ icon: "symlink" as const, name, category: "symlink" as const })),
  { icon: "file", name: "Cookies", category: "file" },
  { icon: "file", name: "Cookies-journal", category: "file" },
  { icon: "file", name: "Preferences", category: "file" },
  { icon: "config", name: "QuotaManager", category: "file" },
  { icon: "file", name: "QuotaManager-journal", category: "file" },
  { icon: "file", name: "Network State", category: "file" },
  { icon: "settings", name: "TransportSecurity", category: "file" }
];
