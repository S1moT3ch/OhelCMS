import React from "react";
import { Avatar, IconButton } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";

function HeaderCompact({ subtitle, onLogout, onBack }) {
    const navigate = useNavigate();

    const handleBackClick = () => {
        if (onBack) {
            onBack();
        } else {
            navigate(-1); // Torna alla pagina precedente della cronologia
        }
    };

    return (
        <header style={styles.headerCompact}>
            <div style={styles.leftSection}>
                {/* Freccia per tornare indietro */}
                <IconButton
                    onClick={handleBackClick}
                    size="small"
                    sx={{
                        color: "#1e382b",
                        padding: "6px",
                        marginRight: "6px",
                        "&:hover": { backgroundColor: "#f0f4f2" }
                    }}
                    aria-label="Torna indietro"
                >
                    <ArrowBackIcon fontSize="small" />
                </IconButton>

                {/* Logo Ohel */}
                <Avatar
                    src="/logo_Ohel.png"
                    variant="rounded"
                    imgProps={{ style: { objectFit: "contain", height: "auto", padding: "3px" } }}
                    sx={{
                        width: 38,
                        height: 38,
                        backgroundColor: "#ffffff",
                        border: "1px solid #e1ebe5",
                        borderRadius: "8px",
                        marginRight: "12px" // Spazio generoso prima del testo
                    }}
                />

                {/* Titolo e Sottotitolo */}
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
        padding: "0 16px",
        boxShadow: "0 2px 8px rgba(46, 91, 67, 0.04)",
        zIndex: 10,
        boxSizing: "border-box",
        fontFamily: "system-ui, -apple-system, sans-serif",
    },
    leftSection: {
        display: "flex",
        alignItems: "center",
    },
    textContainerCompact: {
        display: "flex",
        flexDirection: "column",
        textAlign: "left"
    },
    titleCompact: {
        fontSize: "1.05rem",
        color: "#1e382b",
        margin: 0,
        fontWeight: "800",
        lineHeight: 1.1
    },
    subtitleCompact: {
        fontSize: "0.78rem",
        color: "#52796f",
        margin: "2px 0 0 0",
        fontWeight: "600",
        lineHeight: 1.1
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