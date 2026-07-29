import React from "react";
import { Box, Typography } from "@mui/material";

// Palette cromatica OhelCMS
const OHEL_GREEN = "#2e5b43";
const OHEL_SAGE = "#52796f";
const OHEL_LIGHT_GREEN = "#f4f7f5";

/**
 * Componente per il caricamento dinamico con estetica moderna (Glassmorphism, doppio anello concentrico animato, logo con effetto respiro e punti pulsanti).
 */
const LoadingScreen = ({ message = "Caricamento in corso...", color = OHEL_GREEN, fullScreen = true }) => {
    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: fullScreen ? "100vh" : "300px",
                width: "100%",
                backgroundColor: fullScreen ? OHEL_LIGHT_GREEN : "transparent",
                px: 2,
                boxSizing: "border-box",
                "@keyframes pulseGlow": {
                    "0%, 100%": {
                        transform: "scale(1)",
                        boxShadow: `0 0 20px ${color}33, 0 0 40px ${color}1a`,
                    },
                    "50%": {
                        transform: "scale(1.06)",
                        boxShadow: `0 0 35px ${color}66, 0 0 60px ${color}33`,
                    },
                },
                "@keyframes spinClockwise": {
                    "0%": { transform: "rotate(0deg)" },
                    "100%": { transform: "rotate(360deg)" },
                },
                "@keyframes spinCounterClockwise": {
                    "0%": { transform: "rotate(360deg)" },
                    "100%": { transform: "rotate(0deg)" },
                },
                "@keyframes dotBounce": {
                    "0%, 80%, 100%": { transform: "scale(0)", opacity: 0.3 },
                    "40%": { transform: "scale(1)", opacity: 1 },
                },
                "@keyframes textShimmer": {
                    "0%": { backgroundPosition: "-200% 0" },
                    "100%": { backgroundPosition: "200% 0" },
                },
            }}
        >
            {/* Card Glassmorphic */}
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    p: { xs: 4, sm: 5 },
                    borderRadius: "24px",
                    background: "rgba(255, 255, 255, 0.85)",
                    backdropFilter: "blur(16px)",
                    boxShadow: "0 12px 40px rgba(46, 91, 67, 0.08), 0 2px 6px rgba(0,0,0,0.02)",
                    border: "1px solid rgba(255, 255, 255, 0.9)",
                    position: "relative",
                    overflow: "hidden",
                }}
            >
                {/* Contenitore Spinner e Logo */}
                <Box
                    sx={{
                        position: "relative",
                        width: 90,
                        height: 90,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        mb: 3,
                    }}
                >
                    {/* Anello Esterno (Senso Orario) */}
                    <Box
                        sx={{
                            position: "absolute",
                            inset: 0,
                            borderRadius: "50%",
                            border: `3px solid transparent`,
                            borderTopColor: color,
                            borderRightColor: color,
                            animation: "spinClockwise 1.2s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite",
                        }}
                    />

                    {/* Anello Interno (Senso Antiorario) */}
                    <Box
                        sx={{
                            position: "absolute",
                            inset: 8,
                            borderRadius: "50%",
                            border: `3px solid transparent`,
                            borderBottomColor: OHEL_SAGE,
                            borderLeftColor: OHEL_SAGE,
                            animation: "spinCounterClockwise 1.6s ease-in-out infinite",
                        }}
                    />

                    {/* Logo Ohel al Centro con effetto respiro */}
                    <Box
                        sx={{
                            width: 50,
                            height: 50,
                            borderRadius: "50%",
                            backgroundColor: "#ffffff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            animation: "pulseGlow 2.5s ease-in-out infinite",
                            zIndex: 2,
                            p: 0.5,
                        }}
                    >
                        <img
                            src="/logo_Ohel.png"
                            alt="Ohel Logo"
                            style={{
                                width: "80%",
                                height: "80%",
                                objectFit: "contain",
                            }}
                        />
                    </Box>
                </Box>

                {/* Testo di Caricamento con Sfumatura */}
                <Typography
                    variant="subtitle1"
                    fontWeight="700"
                    sx={{
                        color: "#1e382b",
                        letterSpacing: "0.5px",
                        textAlign: "center",
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                    }}
                >
                    {message}
                </Typography>

                {/* Puntini Animati */}
                <Box sx={{ display: "flex", gap: 0.8, mt: 1.5, alignItems: "center" }}>
                    <Box
                        sx={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            backgroundColor: color,
                            animation: "dotBounce 1.4s infinite ease-in-out both",
                            animationDelay: "-0.32s",
                        }}
                    />
                    <Box
                        sx={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            backgroundColor: OHEL_SAGE,
                            animation: "dotBounce 1.4s infinite ease-in-out both",
                            animationDelay: "-0.16s",
                        }}
                    />
                    <Box
                        sx={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            backgroundColor: "#d9922b",
                            animation: "dotBounce 1.4s infinite ease-in-out both",
                        }}
                    />
                </Box>
            </Box>
        </Box>
    );
};

export default LoadingScreen;
