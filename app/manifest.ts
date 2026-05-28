import type { MetadataRoute } from "next";

/**
 * Web App Manifest. Lets users add the dashboard to their phone/desktop home
 * screen (most useful for /configurator while playing) and theme the system
 * UI to match the app. Service worker / offline support deliberately
 * out of scope — the configurator is a thin client to a live Pi over LAN,
 * offline doesn't mean much.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Digital Ocarina",
    short_name: "Ocarina",
    description:
      "Live monitor + button configurator for the Digital Ocarina hardware.",
    start_url: "/configurator",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#1c1917",
    theme_color: "#d97706",
    icons: [
      {
        src: "/icon-512.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-512.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
