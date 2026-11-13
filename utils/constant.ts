import type { ShortcutDefinition } from "@gorth-io/structure/modules/desktop";
import {
  Rocket,
  Palette,
  Network,
  PanelsTopLeft,
  ShieldCheck,
  LockKeyhole,
  Wallet,
  Sparkles,
  RefreshCw,
  Search,
  Puzzle,
  UserRound,
  ListChecks,
  Languages,
  Download,
  Accessibility,
  Settings,
  RotateCcw,
  Info,
  Bookmark,
  CircleAlert,
  Clock3,
  FlaskConical,
  House,
  CircleHelp,
  Keyboard,
  Archive,
  type LucideIcon,
  Eye,
  Folder,
  Columns2,
  BookOpen,
  GitFork,
  Globe2,
  History,
  Maximize,
} from "@gorth-io/primitive/cores/lucide";
import type { Theme } from "@/lib/theme";
import type { BrowserInternalPage } from "@/lib/browser/internal-pages";
import type { DownloadState } from "@/lib/browser/downloads";
import type { BrowserPreferences } from "@/lib/browser/persistence";
import type { ShieldPreferences } from "@/lib/browser/shields";
import type { InternalPageDefinition } from "@/lib/browser/internal-pages";

export const BROWSER_CHROME_HEIGHT = 112;
export const SIDEBAR_WIDTH = 56;
export const APP_ID = "com.gorth.browser";
export const APP_NAME = "Gorth Browser";
export const DEFAULT_PROFILE_ID = "default";
export const MAIN_WINDOW_ID = "main";

export const settingsPageDefinitions = {
  "settings/folders": { title: "Folders", url: "gorth://settings/folders" },
  "settings/proxy": { title: "Proxy", url: "gorth://settings/proxy" },
  "settings/profile": {
    title: "Gorth profile",
    url: "gorth://settings/profile",
  },
  "settings/get-started": {
    title: "General",
    url: "gorth://settings/get-started",
  },
  "settings/appearance": {
    title: "Appearance",
    url: "gorth://settings/appearance",
  },
  "settings/shortcuts": {
    title: "Shortcuts",
    url: "gorth://settings/shortcuts",
  },
  "settings/content": { title: "Content", url: "gorth://settings/content" },
  "settings/shields": { title: "Shields", url: "gorth://settings/shields" },
  "settings/privacy": {
    title: "Privacy and security",
    url: "gorth://settings/privacy",
  },
  "settings/web3": { title: "Web3", url: "gorth://settings/web3" },
  "settings/leo": { title: "Leo", url: "gorth://settings/leo" },
  "settings/sync": { title: "Sync", url: "gorth://settings/sync" },
  "settings/search": { title: "Search engine", url: "gorth://settings/search" },
  "settings/extensions": {
    title: "Extensions",
    url: "gorth://settings/extensions",
  },
  "settings/autofill": {
    title: "Autofill and passwords",
    url: "gorth://settings/autofill",
  },
  "settings/languages": {
    title: "Languages",
    url: "gorth://settings/languages",
  },
  "settings/downloads": {
    title: "Downloads",
    url: "gorth://settings/downloads",
  },
  "settings/accessibility": {
    title: "Accessibility",
    url: "gorth://settings/accessibility",
  },
  "settings/system": { title: "System", url: "gorth://settings/system" },
  "settings/reset": { title: "Reset settings", url: "gorth://settings/reset" },
  "settings/help": { title: "About Gorth", url: "gorth://settings/help" },
} as const;

export const internalPageDefinitions = {
  auth: { title: "Gorth Account", url: "gorth://auth" },
  archive: { title: "Archived tabs", url: "gorth://archive" },
  shortcuts: { title: "Keyboard shortcuts", url: "gorth://shortcuts" },
  help: { title: "Help", url: "gorth://help" },
  welcome: { title: "Welcome to Gorth", url: "gorth://welcome" },
  "whats-new": { title: "What's new", url: "gorth://whats-new" },
  error: { title: "Page unavailable", url: "gorth://error" },
  settings: { title: "Settings", url: "gorth://settings" },
  downloads: { title: "Downloads", url: "gorth://downloads" },
  bookmarks: { title: "Bookmarks", url: "gorth://bookmarks" },
  history: { title: "History", url: "gorth://history" },
  flags: { title: "Experiments", url: "gorth://flags" },
  extensions: { title: "Extensions", url: "gorth://extensions" },
  ...settingsPageDefinitions,
} as const satisfies Record<string, InternalPageDefinition>;

export const settingsPagesFirst = [
  {
    id: "settings/get-started",
    title: "General",
    icon: Rocket,
    description: "Choose how you start browsing.",
  },
  {
    id: "settings/appearance",
    title: "Appearance",
    icon: Palette,
    description: "Customize the browser interface.",
  },
  {
    id: "settings/content",
    title: "Content",
    icon: PanelsTopLeft,
    description: "Manage website content preferences.",
  },
  {
    id: "settings/shortcuts",
    title: "Shortcuts",
    icon: Keyboard,
    description: "Customize keyboard shortcuts.",
  },
  {
    id: "settings/profile",
    title: "Profile",
    icon: UserRound,
    description: "Manage your Gorth account.",
  },
  {
    id: "settings/shields",
    title: "Shields",
    icon: ShieldCheck,
    description: "Configure protection from trackers and unwanted content.",
  },
  {
    id: "settings/privacy",
    title: "Privacy and security",
    icon: LockKeyhole,
    description: "Manage privacy and browsing data.",
  },
  {
    id: "settings/web3",
    title: "Web3",
    icon: Wallet,
    description: "Manage decentralized web integrations.",
  },
  {
    id: "settings/leo",
    title: "Leo",
    icon: Sparkles,
    description: "Configure your browsing assistant.",
  },
  {
    id: "settings/sync",
    title: "Sync",
    icon: RefreshCw,
    description: "Keep browsing data synchronized between devices.",
  },
  {
    id: "settings/search",
    title: "Search engine",
    icon: Search,
    description: "Choose how searches are handled.",
  },
  {
    id: "settings/extensions",
    title: "Extensions",
    icon: Puzzle,
    description: "Configure extension preferences.",
  },
] as const;

export const settingsPagesSecond = [
  {
    id: "settings/proxy",
    title: "Proxy",
    icon: Network,
    description: "Configure the app network proxy.",
  },
  {
    id: "settings/autofill",
    title: "Autofill and passwords",
    icon: ListChecks,
    description: "Manage saved form information and passwords.",
  },
  {
    id: "settings/languages",
    title: "Languages",
    icon: Languages,
    description: "Choose language and translation preferences.",
  },
  {
    id: "settings/downloads",
    title: "Downloads",
    icon: Download,
    description: "Configure file download preferences.",
  },
  {
    id: "settings/accessibility",
    title: "Accessibility",
    icon: Accessibility,
    description: "Customize accessibility preferences.",
  },
  {
    id: "settings/system",
    title: "System",
    icon: Settings,
    description: "Manage browser system preferences.",
  },
  {
    id: "settings/reset",
    title: "Reset settings",
    icon: RotateCcw,
    description: "Restore browser preferences.",
  },
  {
    id: "settings/help",
    title: "About Gorth",
    icon: Info,
    description: "Learn about Gorth Browser and internal pages.",
  },
] as const;

export const settingsPages = [
  ...settingsPagesFirst,
  ...settingsPagesSecond,
] as const;

export const defaultBrowserPreferences: BrowserPreferences = {
  sidebarCollapsible: false,
  sidebarCollapseMode: "icon",
  tabLayout: "separate",
  enableWorkspace: false,
  sleepAfterMinutes: 15,
  archiveAfterDays: 0,
  flags: { memorySaver: true, smoothScrolling: true },
  sidebarSide: "left",
  showTitlebarLogo: true,
  theme: "system",
  verticalCollapsed: false,
  verticalTabs: false,
};

export const defaultShieldPreferences: ShieldPreferences = {
  enabled: true,
  automaticUpdates: true,
  disabledSites: [],
  customFilters: "",
};

export const themeLabels: Record<Theme, string> = {
  dark: "Dark",
  light: "Light",
  system: "System",
};

export const internalIcons = {
  auth: UserRound,
  archive: Archive,
  shortcuts: Keyboard,
  help: CircleHelp,
  welcome: Rocket,
  "whats-new": Sparkles,
  error: CircleAlert,
  "new-tab": House,
  settings: Settings,
  downloads: Download,
  bookmarks: Bookmark,
  history: Clock3,
  flags: FlaskConical,
  extensions: Puzzle,
} satisfies Record<
  Exclude<BrowserInternalPage, `settings/${string}`>,
  LucideIcon
>;

export const groupModes = [
  { mode: "normal", label: "Normal", icon: Folder },
  { mode: "split", label: "Split", icon: Columns2 },
  { mode: "glance", label: "Glance", icon: Eye },
] as const;

export const systemPageButtons = [
  { page: "archive", label: "Archive", icon: Archive },
  { page: "shortcuts", label: "Shortcuts", icon: Keyboard },
  { page: "bookmarks", label: "Bookmarks", icon: BookOpen },
  { page: "history", label: "History", icon: Clock3 },
  { page: "downloads", label: "Downloads", icon: Download },
  { page: "extensions", label: "Extensions", icon: Puzzle },
  { page: "flags", label: "Experiments", icon: FlaskConical },
  { page: "settings", label: "Settings", icon: Settings },
] as const satisfies ReadonlyArray<{
  page: Exclude<BrowserInternalPage, "new-tab" | "error">;
  label: string;
  icon: typeof Settings;
}>;

export const quickLinks = [
  {
    label: "Google",
    description: "Search the web",
    url: "https://www.google.com",
    icon: Search,
  },
  {
    label: "GitHub",
    description: "Explore source code",
    url: "https://github.com",
    icon: GitFork,
  },
  {
    label: "Wikipedia",
    description: "Look up knowledge",
    url: "https://www.wikipedia.org",
    icon: Globe2,
  },
];

export const whatsNewFeatures = [
  {
    icon: History,
    title: "Pick up where you left off",
    description:
      "Your tabs and window position are restored when you return. Reopen a recently closed tab with Cmd/Ctrl+Shift+T.",
  },
  {
    icon: Search,
    title: "Find in page",
    description:
      "Press Cmd/Ctrl+F to search the current page, see the match count, and move between results.",
  },
  {
    icon: Maximize,
    title: "More ways to browse",
    description:
      "Use vertical tabs and split view, or enter a website's fullscreen mode for more room.",
  },
  {
    icon: Sparkles,
    title: "Settings, organized",
    description:
      "Explore the settings sidebar, customize your appearance, and access welcome and feature highlights from Help.",
  },
];

export const downloadStateLabels: Record<DownloadState, string> = {
  progressing: "Downloading",
  paused: "Paused",
  completed: "Completed",
  cancelled: "Cancelled",
  interrupted: "Interrupted",
};

export const shortcutDefinitions: ShortcutDefinition[] = [
  { id: "new-tab", label: "New Tab", defaultAccelerator: "CmdOrCtrl+T" },
  { id: "new-window", label: "New Window", defaultAccelerator: "CmdOrCtrl+N" },
  { id: "close-tab", label: "Close Tab", defaultAccelerator: "CmdOrCtrl+W" },
  {
    id: "reopen-closed-tab",
    label: "Reopen Closed Tab",
    defaultAccelerator: "CmdOrCtrl+Shift+T",
  },
  {
    id: "find-in-page",
    label: "Find in Page",
    defaultAccelerator: "CmdOrCtrl+F",
  },
  { id: "reload-tab", label: "Reload", defaultAccelerator: "CmdOrCtrl+R" },
  {
    id: "force-reload-tab",
    label: "Force Reload",
    defaultAccelerator: "CmdOrCtrl+Shift+R",
  },
  { id: "next-tab", label: "Next Tab", defaultAccelerator: "Ctrl+Tab" },
  {
    id: "previous-tab",
    label: "Previous Tab",
    defaultAccelerator: "Ctrl+Shift+Tab",
  },
  { id: "settings", label: "Settings…", defaultAccelerator: "CmdOrCtrl+," },
  {
    id: "shortcuts",
    label: "Keyboard Shortcuts",
    defaultAccelerator: "CmdOrCtrl+Shift+K",
  },
];

export const updateRepository = {
  owner: "gorth-io",
  repository: "gorth-browser",
} as const;

export const reservedShortcuts = [
  "CmdOrCtrl+C",
  "CmdOrCtrl+V",
  "CmdOrCtrl+X",
  "CmdOrCtrl+A",
  "CmdOrCtrl+Z",
  "CmdOrCtrl+Shift+Z",
  "CmdOrCtrl+Q",
  "CmdOrCtrl+H",
  "CmdOrCtrl+M",
  "CmdOrCtrl+Shift+W",
  "CmdOrCtrl+Alt+I",
  "Ctrl+Shift+I",
  "F11",
];

export const SPACE_BAR_WIDTH = 56;
