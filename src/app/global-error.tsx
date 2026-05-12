"use client"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body>
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          padding: "2rem",
        }}>
          <div style={{ textAlign: "center", maxWidth: 420 }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
              Something went wrong
            </h2>
            <p style={{ color: "#666", fontSize: 14, marginBottom: 20 }}>
              {error.message || "An unexpected error occurred."}
            </p>
            <button
              onClick={reset}
              style={{
                padding: "10px 24px",
                borderRadius: 8,
                border: "none",
                background: "#111",
                color: "#fff",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}