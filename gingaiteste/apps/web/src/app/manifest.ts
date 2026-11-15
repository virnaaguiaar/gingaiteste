import type { MetadataRoute } from "next";
import { APP_NAME, APP_TAGLINE } from "@/lib/app-info";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: APP_TAGLINE,
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fdf2f8",
    theme_color: "#f62681",
    icons: [{ src: "/apple-icon", sizes: "180x180", type: "image/png" }],
  };
}
