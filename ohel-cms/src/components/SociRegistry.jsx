import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import CONFIG from "../config/config";
import HeaderCompact from "./HeaderCompact";
import Footer from "./Footer";
import LoadingScreen from "./LoadingScreen";
import MessageDialog from "./MessageDialog";
import { clearAllCache } from "../utils/cacheManager";
import { logClientEvent } from "../utils/logger";

// Material-UI
import {
    Box,
    Container,
    Card,
    CardContent,
    Typography,
    Button,
    Stack,
    Chip,
    Avatar,
    TextField,
    InputAdornment,
    Grid,
    Divider,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SearchIcon from "@mui/icons-material/Search";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import PersonIcon from "@mui/icons-material/Person";
import EmailIcon from "@mui/icons-material/Email";
import CakeIcon from "@mui/icons-material/Cake";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import PhoneIcon from "@mui/icons-material/Phone";
import BadgeIcon from "@mui/icons-material/Badge";

// Palette Ohel
const OHEL_GREEN = "#2e5b43";
const OHEL_LIGHT_GREEN = "#f4f7f5";
const OHEL_TEXT_DARK = "#1e382b";
const OHEL_SAGE = "#52796f";
const OHEL_BLUE = "#2a6f97";

function SociRegistry() {
    const navigate = useNavigate();
    const [soci, setSoci] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [roleFilter, setRoleFilter] = useState("ALL"); // ALL, ADMIN, SOCIO
    const [dialog, setDialog] = useState({ open: false, title: "", message: "", severity: "info" });

    const { URL_APPS_SCRIPT } = CONFIG;

    const showDialog = (title, message, severity = "info") => {
        setDialog({ open: true, title, message, severity });
    };

    const handleLogout = () => {
        logClientEvent("CLIENT_LOGOUT", "Logout da Anagrafica Soci");
        clearAllCache();
        navigate("/", { replace: true });
    };

    useEffect(() => {
        const fetchSoci = async () => {
            const idToken = localStorage.getItem("authToken");
            const storedUser = localStorage.getItem("userProfile");

            if (!idToken || !storedUser) {
                handleLogout();
                return;
            }

            try {
                const user = JSON.parse(storedUser);
                if (!user.isAdmin) {
                    showDialog(
                        "Accesso Negato",
                        "Questa sezione è riservata esclusivamente ai soci amministratori.",
                        "error"
                    );
                    setTimeout(() => navigate("/dashboard"), 1800);
                    return;
                }

                // Invocazione backend: azione GET_ALL_SOCI
                const response = await fetch(URL_APPS_SCRIPT, {
                    method: "POST",
                    mode: "cors",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        action: "GET_ALL_SOCI",
                        token: idToken
                    })
                });

                const data = await response.json();

                if (data.status === "success" && Array.isArray(data.soci)) {
                    setSoci(data.soci);
                    logClientEvent("CLIENT_VIEW_SOCI", `Visualizzata anagrafica soci (${data.soci.length} iscritti)`);
                } else {
                    showDialog("Errore Dati", data.message || "Impossibile recuperare l'elenco dei soci.", "error");
                }
            } catch (err) {
                console.error("[ERRORE ANAGRAFICA SOCI]:", err);
                showDialog("Errore Connessione", "Impossibile connettersi al server per recuperare i soci.", "error");
            } finally {
                setLoading(false);
            }
        };

        fetchSoci();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [URL_APPS_SCRIPT]);

    // Filtraggio dinamico
    const filteredSoci = useMemo(() => {
        const q = searchTerm.toLowerCase().trim();
        return soci.filter((s) => {
            // Filtro ruolo
            if (roleFilter === "ADMIN" && !s.isAdmin) return false;
            if (roleFilter === "SOCIO" && s.isAdmin) return false;

            // Filtro ricerca testo
            if (q) {
                const fullName = `${s.nome || ""} ${s.cognome || ""}`.toLowerCase();
                const email = (s.email || "").toLowerCase();
                const birth = (s.dataNascita || "").toLowerCase();
                const phone = (s.telefono || "").toLowerCase();
                const cf = (s.codiceFiscale || "").toLowerCase();
                const regDate = (s.dataRegistrazione || "").toLowerCase();

                return (
                    fullName.includes(q) ||
                    email.includes(q) ||
                    birth.includes(q) ||
                    phone.includes(q) ||
                    cf.includes(q) ||
                    regDate.includes(q)
                );
            }
            return true;
        });
    }, [soci, searchTerm, roleFilter]);

    const adminCount = useMemo(() => soci.filter(s => s.isAdmin).length, [soci]);

    if (loading) {
        return <LoadingScreen message="Caricamento registro soci..." color={OHEL_GREEN} />;
    }

    return (
        <Box sx={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            backgroundColor: OHEL_LIGHT_GREEN,
            pt: "80px",
            boxSizing: "border-box"
        }}>
            <HeaderCompact subtitle="Anagrafica Soci" onLogout={handleLogout} />

            <Container maxWidth="md" sx={{ flex: 1, py: 2.5, px: { xs: 2, sm: 3 } }}>

                {/* PULSANTE INDIETRO */}
                <Box mb={2}>
                    <Button
                        startIcon={<ArrowBackIcon />}
                        onClick={() => navigate("/dashboard")}
                        sx={{
                            color: OHEL_GREEN,
                            fontWeight: 700,
                            textTransform: "none",
                            fontSize: "0.85rem",
                            px: 1.5,
                            py: 0.5,
                            borderRadius: "10px",
                            "&:hover": { backgroundColor: "#e8f0ec" }
                        }}
                    >
                        Torna alla Dashboard
                    </Button>
                </Box>

                {/* HERO CARD INTRODUTTIVA */}
                <Card sx={{
                    borderRadius: "20px",
                    border: "1px solid #e1ebe5",
                    background: "linear-gradient(135deg, #ffffff 0%, #f4f8f5 100%)",
                    boxShadow: "0 4px 14px rgba(46, 91, 67, 0.04)",
                    mb: 2.5
                }}>
                    <CardContent sx={{ p: 2.5 }}>
                        <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
                            <Box display="flex" alignItems="center" gap={1.5}>
                                <Box sx={{ backgroundColor: "#e0f2fe", p: 1.2, borderRadius: "12px", display: "flex" }}>
                                    <PeopleAltIcon sx={{ color: OHEL_BLUE, fontSize: "1.8rem" }} />
                                </Box>
                                <Box>
                                    <Typography variant="h6" fontWeight="800" sx={{ color: OHEL_TEXT_DARK, lineHeight: 1.2 }}>
                                        Anagrafica Soci dell'Associazione
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: OHEL_SAGE, fontSize: "0.84rem", mt: 0.3 }}>
                                        Generalità dei soci registrati tramite autenticazione Google OAuth 2.0
                                    </Typography>
                                </Box>
                            </Box>

                            <Stack direction="row" gap={1}>
                                <Chip
                                    label={`${soci.length} Soci Totali`}
                                    size="small"
                                    sx={{ fontWeight: 800, backgroundColor: "#f0fdf4", color: "#166534", border: "1px solid #dcfce7" }}
                                />
                                <Chip
                                    icon={<AdminPanelSettingsIcon style={{ fontSize: 13, color: "#c2410c" }} />}
                                    label={`${adminCount} Admin`}
                                    size="small"
                                    sx={{ fontWeight: 800, backgroundColor: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa" }}
                                />
                            </Stack>
                        </Box>
                    </CardContent>
                </Card>

                {/* BARRA RICERCA E FILTRI */}
                <Card sx={{ borderRadius: "16px", border: "1px solid #e1ebe5", backgroundColor: "#ffffff", mb: 2.5, p: 1.5 }}>
                    <Box display="flex" flexDirection={{ xs: "column", sm: "row" }} gap={1.5} alignItems="center" justifyContent="space-between">
                        <TextField
                            placeholder="Cerca per nome, email, data di nascita..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            size="small"
                            fullWidth
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon sx={{ color: OHEL_SAGE, fontSize: "1.2rem" }} />
                                    </InputAdornment>
                                ),
                            }}
                            sx={{
                                backgroundColor: "#f8faf9",
                                borderRadius: "10px",
                                "& .MuiOutlinedInput-notchedOutline": { borderColor: "#e1ebe5" }
                            }}
                        />

                        <Stack direction="row" gap={1} flexShrink={0}>
                            <Chip
                                label={`Tutti (${soci.length})`}
                                clickable
                                onClick={() => setRoleFilter("ALL")}
                                sx={{
                                    fontWeight: 700,
                                    fontSize: "0.75rem",
                                    backgroundColor: roleFilter === "ALL" ? OHEL_GREEN : "#f0f4f2",
                                    color: roleFilter === "ALL" ? "#ffffff" : OHEL_TEXT_DARK
                                }}
                            />
                            <Chip
                                icon={<AdminPanelSettingsIcon style={{ fontSize: 13, color: roleFilter === "ADMIN" ? "#ffffff" : "#c2410c" }} />}
                                label="Admin"
                                clickable
                                onClick={() => setRoleFilter("ADMIN")}
                                sx={{
                                    fontWeight: 700,
                                    fontSize: "0.75rem",
                                    backgroundColor: roleFilter === "ADMIN" ? "#c2410c" : "#fff7ed",
                                    color: roleFilter === "ADMIN" ? "#ffffff" : "#c2410c"
                                }}
                            />
                            <Chip
                                icon={<PersonIcon style={{ fontSize: 13, color: roleFilter === "SOCIO" ? "#ffffff" : "#166534" }} />}
                                label="Soci"
                                clickable
                                onClick={() => setRoleFilter("SOCIO")}
                                sx={{
                                    fontWeight: 700,
                                    fontSize: "0.75rem",
                                    backgroundColor: roleFilter === "SOCIO" ? "#166534" : "#f0fdf4",
                                    color: roleFilter === "SOCIO" ? "#ffffff" : "#166534"
                                }}
                            />
                        </Stack>
                    </Box>
                </Card>

                {/* ELENCO CARD SOCI */}
                {filteredSoci.length > 0 ? (
                    <Grid container spacing={2}>
                        {filteredSoci.map((socio) => {
                            const initials = `${(socio.nome || "?")[0]}${(socio.cognome || "")[0] || ""}`.toUpperCase();

                            return (
                                <Grid item xs={12} sm={6} key={socio.email}>
                                    <Card sx={{
                                        borderRadius: "18px",
                                        border: "1px solid #e1ebe5",
                                        borderLeft: `5px solid ${socio.isAdmin ? "#e65f2b" : OHEL_GREEN}`,
                                        backgroundColor: "#ffffff",
                                        boxShadow: "0 3px 12px rgba(46, 91, 67, 0.04)",
                                        height: "100%",
                                        display: "flex",
                                        flexDirection: "column",
                                        justifyContent: "space-between",
                                        transition: "transform 0.15s ease",
                                        "&:hover": { transform: "translateY(-2px)" }
                                    }}>
                                        <CardContent sx={{ p: { xs: 1.8, sm: 2.2 }, "&:last-child": { pb: { xs: 1.8, sm: 2.2 } } }}>
                                            {/* RIGA SUPERIORE: AVATAR, NOME E RUOLO (OTTIMIZZATO MOBILE) */}
                                            <Box display="flex" alignItems="center" justifyContent="space-between" gap={1} mb={1.2} sx={{ minWidth: 0 }}>
                                                <Box display="flex" alignItems="center" gap={1.2} sx={{ minWidth: 0, flex: 1, pr: 0.5 }}>
                                                    {socio.picture ? (
                                                        <Avatar
                                                            src={socio.picture.replace(/\s+/g, '')}
                                                            alt={`${socio.nome} ${socio.cognome}`}
                                                            sx={{ width: 42, height: 42, flexShrink: 0, border: `2px solid ${socio.isAdmin ? "#e65f2b" : OHEL_GREEN}` }}
                                                        />
                                                    ) : (
                                                        <Avatar sx={{
                                                            width: 42,
                                                            height: 42,
                                                            flexShrink: 0,
                                                            backgroundColor: socio.isAdmin ? "#fff7ed" : "#f0fdf4",
                                                            color: socio.isAdmin ? "#c2410c" : "#166534",
                                                            fontWeight: "800",
                                                            fontSize: "0.90rem",
                                                            border: `1.5px solid ${socio.isAdmin ? "#fed7aa" : "#dcfce7"}`
                                                        }}>
                                                            {initials}
                                                        </Avatar>
                                                    )}
                                                    <Box sx={{ minWidth: 0, flex: 1 }}>
                                                        <Typography
                                                            variant="subtitle1"
                                                            fontWeight="800"
                                                            noWrap
                                                            sx={{
                                                                color: OHEL_TEXT_DARK,
                                                                lineHeight: 1.25,
                                                                fontSize: "0.92rem",
                                                                overflow: "hidden",
                                                                textOverflow: "ellipsis"
                                                            }}
                                                        >
                                                            {socio.nome} {socio.cognome}
                                                        </Typography>
                                                        <Typography
                                                            variant="caption"
                                                            title={socio.email}
                                                            sx={{
                                                                color: "#64748b",
                                                                fontSize: "0.72rem",
                                                                display: "flex",
                                                                alignItems: "center",
                                                                gap: 0.4,
                                                                minWidth: 0,
                                                                overflow: "hidden"
                                                            }}
                                                        >
                                                            <EmailIcon sx={{ fontSize: "0.75rem", color: OHEL_SAGE, flexShrink: 0 }} />
                                                            <span style={{
                                                                overflow: "hidden",
                                                                textOverflow: "ellipsis",
                                                                whiteSpace: "nowrap",
                                                                display: "inline-block"
                                                            }}>
                                                                {socio.email}
                                                            </span>
                                                        </Typography>
                                                    </Box>
                                                </Box>

                                                <Chip
                                                    icon={socio.isAdmin ? <AdminPanelSettingsIcon style={{ fontSize: 12 }} /> : <PersonIcon style={{ fontSize: 12 }} />}
                                                    label={socio.isAdmin ? "Admin" : "Socio"}
                                                    size="small"
                                                    sx={{
                                                        flexShrink: 0,
                                                        height: 22,
                                                        backgroundColor: socio.isAdmin ? "#fff7ed" : "#f0fdf4",
                                                        color: socio.isAdmin ? "#c2410c" : "#166534",
                                                        borderColor: socio.isAdmin ? "#fed7aa" : "#dcfce7",
                                                        borderStyle: "solid",
                                                        borderWidth: "1px",
                                                        fontWeight: 800,
                                                        fontSize: "0.68rem"
                                                    }}
                                                />
                                            </Box>

                                            <Divider sx={{ my: 1, borderColor: "#f1f5f3" }} />

                                            {/* GENERALITÀ ANAGRAFICHE */}
                                            <Stack spacing={0.8} sx={{ fontSize: "0.78rem" }}>
                                                {/* Data di Nascita (mostrata solo se effettivamente presente) */}
                                                {socio.dataNascita && (
                                                    <Box display="flex" alignItems="center" justifyContent="space-between">
                                                        <Typography variant="caption" sx={{ color: "#64748b", display: "flex", alignItems: "center", gap: 0.6 }}>
                                                            <CakeIcon sx={{ fontSize: "0.85rem", color: OHEL_SAGE }} />
                                                            Data di Nascita:
                                                        </Typography>
                                                        <Typography variant="caption" fontWeight="700" sx={{ color: OHEL_TEXT_DARK }}>
                                                            {socio.dataNascita}
                                                        </Typography>
                                                    </Box>
                                                )}

                                                {/* Data Registrazione */}
                                                <Box display="flex" alignItems="center" justifyContent="space-between">
                                                    <Typography variant="caption" sx={{ color: "#64748b", display: "flex", alignItems: "center", gap: 0.6 }}>
                                                        <CalendarMonthIcon sx={{ fontSize: "0.85rem", color: OHEL_SAGE }} />
                                                        Iscritto il:
                                                    </Typography>
                                                    <Typography variant="caption" fontWeight="600" sx={{ color: OHEL_TEXT_DARK }}>
                                                        {socio.dataRegistrazione || "—"}
                                                    </Typography>
                                                </Box>

                                                {/* Telefono (se presente) */}
                                                {socio.telefono && (
                                                    <Box display="flex" alignItems="center" justifyContent="space-between">
                                                        <Typography variant="caption" sx={{ color: "#64748b", display: "flex", alignItems: "center", gap: 0.6 }}>
                                                            <PhoneIcon sx={{ fontSize: "0.85rem", color: OHEL_SAGE }} />
                                                            Telefono:
                                                        </Typography>
                                                        <Typography variant="caption" fontWeight="600" sx={{ color: OHEL_TEXT_DARK }}>
                                                            {socio.telefono}
                                                        </Typography>
                                                    </Box>
                                                )}

                                                {/* Codice Fiscale (se presente) */}
                                                {socio.codiceFiscale && (
                                                    <Box display="flex" alignItems="center" justifyContent="space-between">
                                                        <Typography variant="caption" sx={{ color: "#64748b", display: "flex", alignItems: "center", gap: 0.6 }}>
                                                            <BadgeIcon sx={{ fontSize: "0.85rem", color: OHEL_SAGE }} />
                                                            Codice Fiscale:
                                                        </Typography>
                                                        <Typography variant="caption" fontWeight="700" sx={{ color: OHEL_TEXT_DARK, fontFamily: "monospace" }}>
                                                            {socio.codiceFiscale}
                                                        </Typography>
                                                    </Box>
                                                )}
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            );
                        })}
                    </Grid>
                ) : (
                    <Card sx={{ borderRadius: "18px", border: "1px dashed #cbd5e1", backgroundColor: "#ffffff", p: 4, textAlign: "center" }}>
                        <PeopleAltIcon sx={{ fontSize: 36, color: OHEL_SAGE, mb: 1 }} />
                        <Typography variant="subtitle2" fontWeight="700" color="#64748b">
                            Nessun socio corrisponde ai criteri di ricerca.
                        </Typography>
                    </Card>
                )}

            </Container>

            <Footer />

            <MessageDialog
                open={dialog.open}
                onClose={() => setDialog(prev => ({ ...prev, open: false }))}
                title={dialog.title}
                message={dialog.message}
                severity={dialog.severity}
            />
        </Box>
    );
}

export default SociRegistry;

