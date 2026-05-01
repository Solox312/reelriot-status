"use client";

import React from "react";

const StatusFooter = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer style={{ 
      padding: "40px 20px", 
      background: "rgba(0,0,0,0.2)", 
      borderTop: "1px solid rgba(255,255,255,0.05)",
      marginTop: "60px"
    }}>
      <div style={{ maxWidth: "1000px", margin: "0 auto", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
          <span style={{ fontWeight: 900, letterSpacing: "0.2em", fontSize: "1rem", color: "#fff" }}>REELRIOT STATUS</span>
        </div>
        
        <div style={{ display: "flex", justifyContent: "center", gap: "24px", marginBottom: "24px", fontSize: "0.85rem" }}>
          <a href="https://reelriot.app/terms" style={{ color: "var(--text-muted)", textDecoration: "none" }}>Terms</a>
          <a href="https://reelriot.app/privacy" style={{ color: "var(--text-muted)", textDecoration: "none" }}>Privacy</a>
          <a href="https://reelriot.app/about" style={{ color: "var(--text-muted)", textDecoration: "none" }}>Contact</a>
        </div>

        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", lineHeight: "1.8", opacity: 0.6 }}>
          <p>&copy; {currentYear} Webcap Media Ltd. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default StatusFooter;
