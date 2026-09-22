export type Locale = "en" | "zh-CN";

const english = {
  startup: "System startup", source: "Unofficial browser port · original by", initialize: "Initialize system",
  skipIntro: "Skip intro", panel: "PANEL", system: "SYSTEM", terminal: "TERMINAL", files: "FILES",
  reboot: "REBOOT", mainShell: "MAIN SHELL", network: "NETWORK", uptime: "UPTIME", type: "TYPE",
  power: "POWER", charge: "CHARGE", manufacturer: "MANUFACTURER", model: "MODEL", chassis: "CHASSIS",
  cpuUsage: "CPU USAGE", simulated: "SIMULATED", average: "Avg.", temp: "TEMP", min: "MIN", max: "MAX",
  tasks: "TASKS", memory: "MEMORY", using: "USING", of: "OF", swap: "SWAP",
  topProcesses: "TOP PROCESSES", welcomeBack: "Welcome back,", empty: "EMPTY", article: "ARTICLE",
  sessionReady: "SESSION // READY", terminalHelp: "TYPE HELP FOR COMMANDS", networkStatus: "NETWORK STATUS",
  state: "STATE", online: "ONLINE", worldView: "WORLD VIEW", globalMap: "GLOBAL NETWORK MAP",
  endpoint: "ENDPOINT LAT/LON", initializingGlobe: "INITIALIZING GLOBE", networkTraffic: "NETWORK TRAFFIC",
  trafficRate: "UP / DOWN, MB/S", total: "TOTAL", up: "UP", down: "DOWN",
  filesystem: "FILESYSTEM", home: "HOME", disks: "Showing available block devices",
  mounted: "Mount /home/squared used 71%", returnToDeck: "RETURN TO DECK",
  systemTelemetry: "System telemetry", mainTerminal: "Main terminal", terminalSessions: "Terminal sessions",
  terminalCommand: "Terminal command", networkTelemetry: "Network telemetry", keyboard: "On-screen QWERTY keyboard",
  contentBrowser: "Content browser", closeBrowser: "Close content browser", articleBody: "Article body",
  originalGlobe: "Original eDEX network globe", mediaViewer: "MEDIA VIEWER", previous: "← PREV",
  next: "NEXT →", previousImage: "Previous image", nextImage: "Next image", zoomOut: "Zoom out",
  zoomIn: "Zoom in", decoding: "DECODING MEDIA", resolving: "RESOLVING IMAGE",
  decodeError: "MEDIA DECODE ERROR", raster: "RASTER ACQUISITION",
  soundOn: "SOUND ON", soundOff: "SOUND OFF", gateSoundOn: "Sound: on", gateSoundOff: "Sound: off",
  language: "Language"
} as const;

const chinese: Record<keyof typeof english, string> = {
  startup: "系统启动", source: "非官方浏览器移植 · 原作者", initialize: "初始化系统",
  skipIntro: "跳过开场", panel: "面板", system: "系统", terminal: "终端", files: "文件",
  reboot: "重新启动", mainShell: "主终端", network: "网络", uptime: "运行时间", type: "类型",
  power: "电源", charge: "充电中", manufacturer: "制造商", model: "型号", chassis: "机型",
  cpuUsage: "处理器使用率", simulated: "模拟数据", average: "平均", temp: "温度", min: "最低", max: "最高",
  tasks: "任务", memory: "内存", using: "已使用", of: "总计", swap: "交换空间",
  topProcesses: "主要进程", welcomeBack: "欢迎回来，", empty: "空白", article: "文章",
  sessionReady: "会话 // 就绪", terminalHelp: "输入 HELP 查看命令", networkStatus: "网络状态",
  state: "状态", online: "在线", worldView: "世界视图", globalMap: "全球网络地图",
  endpoint: "端点经纬度", initializingGlobe: "正在初始化地球", networkTraffic: "网络流量",
  trafficRate: "上行 / 下行，MB/秒", total: "总计", up: "上行", down: "下行",
  filesystem: "文件系统", home: "主页", disks: "显示可用块设备",
  mounted: "/home/squared 已使用 71%", returnToDeck: "返回工作台",
  systemTelemetry: "系统状态", mainTerminal: "主终端", terminalSessions: "终端会话",
  terminalCommand: "终端命令", networkTelemetry: "网络状态", keyboard: "屏幕 QWERTY 键盘",
  contentBrowser: "内容浏览器", closeBrowser: "关闭内容浏览器", articleBody: "文章正文",
  originalGlobe: "eDEX 原版网络地球", mediaViewer: "图片查看器", previous: "← 上一张",
  next: "下一张 →", previousImage: "上一张图片", nextImage: "下一张图片", zoomOut: "缩小",
  zoomIn: "放大", decoding: "正在解码图片", resolving: "正在解析图片",
  decodeError: "图片解码失败", raster: "正在载入图像",
  soundOn: "声音 开", soundOff: "声音 关", gateSoundOn: "声音：开", gateSoundOff: "声音：关",
  language: "语言"
};

export type MessageKey = keyof typeof english;
export function translate(locale: Locale, key: MessageKey): string {
  return locale === "zh-CN" ? chinese[key] : english[key];
}

const storageKey = "seker-edex-locale";
export function readLocale(storage: Pick<Storage, "getItem"> | undefined): Locale {
  try { return storage?.getItem(storageKey) === "zh-CN" ? "zh-CN" : "en"; }
  catch { return "en"; }
}
export function saveLocale(storage: Pick<Storage, "setItem"> | undefined, locale: Locale): void {
  try { storage?.setItem(storageKey, locale); } catch { /* Language still changes for this visit. */ }
}

export function localizeElements(root: ParentNode, locale: Locale): void {
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n as MessageKey;
    element.textContent = translate(locale, key);
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-aria]").forEach((element) => {
    const key = element.dataset.i18nAria as MessageKey;
    element.setAttribute("aria-label", translate(locale, key));
  });
}
