"use client";

import React, { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Reelriot Status Error]", error);
  }, [error]);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "60vh",
      padding: "2rem",
      textAlign: "center"
    }}>
      <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem" }}>
        Something went wrong!
      </h2>
      <p style={{ color: "#71717a", marginBottom: "1.5rem", maxWidth: "400px" }}>
        {error.message || "An unexpected error occurred while loading system status."}
      </p>
      <button
        onClick={() => reset()}
        style={{
          padding: "0.5rem 1.25rem",
          background: "#8b5cf6",
          color: "#fff",
          borderRadius: "0.375rem",
          border: "none",
          fontWeight: 600,
          cursor: "pointer"
        }}
      >
        Try again
      </button>
    </div>
  );
}
