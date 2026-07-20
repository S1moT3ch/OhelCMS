import React from "react";
import {Avatar} from "@mui/material";

function HeaderCompact({ subtitle, onLogout }) {
    return (
        <header style={styles.headerCompact}>
            <div style={styles.leftSection}>
                <Avatar
                    src="/logo_Ohel.png"
                    variant="rounded"
                    imgProps={{ style: { objectFit: "contain", height: "auto", padding: "4px" } }}
                    sx={{ width: 40, height: 40, backgroundColor: "#ffffff" }}
                />
                <div style={styles.textContainerCompact}>
                    <h1 style={styles.titleCompact}>Ohel CMS</h1>
                    {subtitle && <p style={styles.subtitleCompact}>{subtitle}</p>}
                </div>
            </div>

            {onLogout && (
                <button style={styles.logoutHeaderButton} onClick={onLogout}>
                    Esci
                </button>
            )}
        </header>
    );
}

const styles = {
    headerCompact: {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "64px",
        backgroundColor: "#ffffff",
        borderBottom: "1px solid #e1ebe5",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        boxShadow: "0 2px 8px rgba(46, 91, 67, 0.04)",
        zIndex: 10,
        boxSizing: "border-box",
        fontFamily: "system-ui, -apple-system, sans-serif",
    },
    leftSection: {
        display: "flex",
        alignItems: "center",
    },
    logoCompact: {
        width: "30px",
        height: "10px",             // Rimosso il 100% per evitare che si deformi
        maxHeight: "30px",
        objectFit: "contain",
        borderRadius: "6px",
        border: "1px solid #e8f0ec",
        marginRight: "12px",
        backgroundColor: "#ffffff",
        padding: "3px",
        boxSizing: "border-box"
    },
    textContainerCompact: {
        display: "flex",
        flexDirection: "column",
        textAlign: "left"
    },
    titleCompact: {
        fontSize: "1.1rem",
        color: "#1e382b",
        margin: 0,
        fontWeight: "800",
    },
    subtitleCompact: {
        fontSize: "0.8rem",
        color: "#52796f",
        margin: 0,
        fontWeight: "500",
    },
    logoutHeaderButton: {
        backgroundColor: "transparent",
        color: "#b91c1c",
        border: "1px solid #fca5a5",
        borderRadius: "8px",
        padding: "6px 12px",
        fontSize: "0.85rem",
        fontWeight: "600",
        cursor: "pointer",
        transition: "all 0.2s ease",
    }
};

export default HeaderCompact;