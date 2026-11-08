import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FixLayer",
    short_name: "FixLayer",
    description: "Practical fixes for websites, hosting and modern web apps.",
    start_url: "/",
    display: "browser",
    background_color: "#F7F6F2",
    theme_color: "#F7F6F2",
    icons: [
      { src: "/icon", sizes: "64x64", type: "image/png" },
      { src: "/brand-assets/logo-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
