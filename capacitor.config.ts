import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl =
  process.env.CAPACITOR_SERVER_URL?.trim() || "https://asterial.vercel.app";
const serverHost = new URL(serverUrl).hostname;

const config: CapacitorConfig = {
  appId: "com.xhuracan.asterial",
  appName: "ASTERIAL",
  webDir: "mobile-shell",
  backgroundColor: "#050507",
  server: {
    url: serverUrl,
    cleartext: false,
    androidScheme: "https",
    errorPath: "offline.html",
    allowNavigation: [serverHost, "localhost"],
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    backgroundColor: "#050507",
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      style: "DARK",
      backgroundColor: "#050507",
    },
    Keyboard: {
      resizeOnFullScreen: true,
    },
  },
};

export default config;
