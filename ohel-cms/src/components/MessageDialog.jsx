import React from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
} from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

const OHEL_GREEN = "#2e5b43";

function MessageDialog({ open, onClose, title, message, severity = "info", confirmText = "Ho capito" }) {

    const getSeverityConfig = () => {
        switch (severity) {
            case "error":
                return {
                    icon: <ErrorOutlineIcon sx={{ color: "#ef4444", fontSize: "1.8rem" }} />,
                    headerBg: "#fef2f2",
                    titleColor: "#991b1b",
                    btnBg: "#dc2626"
                };
            case "warning":
                return {
                    icon: <WarningAmberIcon sx={{ color: "#f59e0b", fontSize: "1.8rem" }} />,
                    headerBg: "#fffbeb",
                    titleColor: "#92400e",
                    btnBg: "#d97706"
                };
            case "success":
                return {
                    icon: <CheckCircleOutlineIcon sx={{ color: "#10b981", fontSize: "1.8rem" }} />,
                    headerBg: "#f0fdf4",
                    titleColor: "#166534",
                    btnBg: OHEL_GREEN
                };
            default:
                return {
                    icon: <InfoOutlinedIcon sx={{ color: "#3b82f6", fontSize: "1.8rem" }} />,
                    headerBg: "#eff6ff",
                    titleColor: "#1e40af",
                    btnBg: OHEL_GREEN
                };
        }
    };

    const config = getSeverityConfig();

    return (
        <Dialog
            open={Boolean(open)}
            onClose={onClose}
            maxWidth="xs"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: "20px",
                    overflow: "hidden",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.12)"
                }
            }}
        >
            <DialogTitle
                sx={{
                    backgroundColor: config.headerBg,
                    py: 2,
                    px: 2.5,
                    display: "flex",
                    alignItems: "center",
                    gap: 1.2
                }}
            >
                {config.icon}
                <Typography variant="subtitle1" fontWeight="800" sx={{ color: config.titleColor, fontSize: "1.05rem" }}>
                    {title || "Avviso"}
                </Typography>
            </DialogTitle>

            <DialogContent sx={{ p: 2.5, pt: "20px !important" }}>
                <Typography variant="body2" sx={{ color: "#475569", fontSize: "0.9rem", lineHeight: 1.55 }}>
                    {message}
                </Typography>
            </DialogContent>

            <DialogActions sx={{ p: 2, pt: 0, justifyContent: "flex-end" }}>
                <Button
                    onClick={onClose}
                    variant="contained"
                    sx={{
                        backgroundColor: config.btnBg,
                        color: "#ffffff",
                        borderRadius: "10px",
                        fontWeight: 700,
                        textTransform: "none",
                        px: 3,
                        py: 0.8,
                        fontSize: "0.85rem",
                        boxShadow: "none",
                        "&:hover": { opacity: 0.9 }
                    }}
                >
                    {confirmText}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default MessageDialog;
