/** Shared layout for generated Open Graph images (rendered by next/og, so inline styles only). */
export function OgCard({ eyebrow, title, footer }: { eyebrow: string; title: string; footer: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px",
        background: "linear-gradient(135deg, #0a0a0a 0%, #1c1c2e 100%)",
        color: "#fafafa",
      }}
    >
      <div style={{ display: "flex", fontSize: 28, color: "#a5b4fc", letterSpacing: 1 }}>{eyebrow}</div>
      <div
        style={{
          display: "flex",
          fontSize: title.length > 70 ? 56 : 68,
          fontWeight: 700,
          lineHeight: 1.1,
          maxWidth: 1000,
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28, color: "#a3a3a3" }}>
        <div
          style={{
            display: "flex",
            width: 44,
            height: 44,
            borderRadius: 10,
            background: "#fafafa",
            color: "#0a0a0a",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 26,
            fontWeight: 700,
          }}
        >
          I
        </div>
        {footer}
      </div>
    </div>
  );
}
