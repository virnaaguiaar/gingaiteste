import { ImageResponse } from "next/og";

// Ícone do app: "AI" branco sobre o rosa do Baile 10D.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f62681",
          color: "#ffffff",
          fontSize: 100,
          fontWeight: 900,
          letterSpacing: -4,
        }}
      >
        AI
      </div>
    ),
    size,
  );
}
