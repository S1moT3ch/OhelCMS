import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import CONFIG from "../config/config";
import HeaderCompact from "./HeaderCompact";
import Footer from "../components/Footer";
import { getCache, setCache, clearAllCache } from "../utils/cacheManager";
import { prefetchBackgroundData } from "../utils/prefetchManager";
import LoadingScreen from "./LoadingScreen";

// Importazioni Material-UI
import {
    Box,
    Typography,
    Button,
    Container,
    Card,
    CardContent,
    Avatar,
    Stack,
    Chip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import BarChartIcon from "@mui/icons-material/BarChart";
import AssessmentIcon from "@mui/icons-material/Assessment";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import HowToVoteIcon from "@mui/icons-material/HowToVote";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import PersonIcon from "@mui/icons-material/Person";
import TuneIcon from "@mui/icons-material/Tune";

// Palette cromatica Associazione Ohel
const OHEL_GREEN = "#2e5b43";      // Verde brand Ohel (Sondaggi da compilare)
const OHEL_SAGE = "#52796f";       // Testi secondari e note
const OHEL_OCHRE = "#d9922b";      // Ocra (Sondaggi già compilati)
const OHEL_ORANGE = "#e65f2b";     // Arancione (Creazione Sondaggi Admin)
const OHEL_BLUE = "#2a6f97";       // Blu (Registro presenze Admin)
const OHEL_PURPLE = "#6b5b95";     // Viola (Risultati Sondaggi)
const OHEL_TEAL = "#0f766e";       // Verde Smeraldo (Gestione Sondaggi Admin)
const OHEL_LIGHT_GREEN = "#f4f7f5";
const OHEL_TEXT_DARK = "#1e382b";

function Dashboard() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [surveys, setSurveys] = useState([]);
    const [loading, setLoading] = useState(true);

    const { URL_APPS_SCRIPT } = CONFIG;

    useEffect(() => {
        const inizializzaDashboard = async () => {
            const idToken = localStorage.getItem("authToken");

            if (!idToken) {
                handleLogout();
                return;
            }

            let initialEmail = null;
            const storedUser = localStorage.getItem("userProfile");
            if (storedUser) {
                try {
                    const parsedUser = JSON.parse(storedUser);
                    setUser(parsedUser);
                    if (parsedUser?.email) {
                        initialEmail = parsedUser.email;
                        const cachedSurveys = getCache(`surveys_active_${parsedUser.email}`);
                        if (cachedSurveys) {
                            setSurveys(cachedSurveys.data || []);
                            setLoading(false);
                            prefetchBackgroundData(parsedUser.email, cachedSurveys.data || [], Boolean(parsedUser.isAdmin));
                        }
                    }
                } catch (e) {
                    console.warn("Errore parsing userProfile locale:", e);
                }
            }

            try {
                const loginPromise = fetch(URL_APPS_SCRIPT, {
                    method: "POST",
                    mode: "cors",
                    body: JSON.stringify({ action: "LOGIN", token: idToken }),
                });

                const surveysPromise = initialEmail
                    ? fetch(`${URL_APPS_SCRIPT}?action=GET_ACTIVE_SURVEYS&email=${encodeURIComponent(initialEmail)}`, { method: "GET", mode: "cors" })
                    : null;

                const [responseUser, responseSurveysInitial] = await Promise.all([
                    loginPromise,
                    surveysPromise
                ]);

                const dataUser = await responseUser.json();

                if (dataUser.status === "success" && dataUser.exists) {
                    setUser(dataUser.user);
                    localStorage.setItem("userProfile", JSON.stringify(dataUser.user));

                    let finalSurveys = [];
                    if (responseSurveysInitial) {
                        const dataSurveys = await responseSurveysInitial.json();
                        if (dataSurveys.status === "success") {
                            finalSurveys = dataSurveys.surveys || [];
                        }
                    } else {
                        const responseSurveys = await fetch(
                            `${URL_APPS_SCRIPT}?action=GET_ACTIVE_SURVEYS&email=${encodeURIComponent(dataUser.user.email)}`,
                            {
                                method: "GET",
                                mode: "cors"
                            }
                        );
                        const dataSurveys = await responseSurveys.json();
                        if (dataSurveys.status === "success") {
                            finalSurveys = dataSurveys.surveys || [];
                        }
                    }

                    setSurveys(finalSurveys);
                    setCache(`surveys_active_${dataUser.user.email}`, finalSurveys, 5 * 60 * 1000);
                    prefetchBackgroundData(dataUser.user.email, finalSurveys, Boolean(dataUser.user.isAdmin));
                } else {
                    handleLogout();
                }
            } catch (err) {
                console.error("Errore durante il caricamento dei dati della dashboard:", err);
                const storedUserFallback = localStorage.getItem("userProfile");
                if (storedUserFallback) setUser(JSON.parse(storedUserFallback));
            } finally {
                setLoading(false);
            }
        };

        inizializzaDashboard();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [URL_APPS_SCRIPT]);

    const handleLogout = () => {
        clearAllCache();
        navigate("/", { replace: true });
    };

    const getDatesCountLabel = (datesArray) => {
        if (!datesArray || datesArray.length === 0) return "Nessuna data";
        return datesArray.length === 1 ? "1 data" : `${datesArray.length} date`;
    };

    if (loading) {
        return <LoadingScreen message="Caricamento Dashboard..." color={OHEL_GREEN} />;
    }

    if (!user) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
                <Typography color="error">Errore di caricamento del profilo.</Typography>
            </Box>
        );
    }

    const pendingSurveysCount = surveys.filter(s => !s.voted).length;

    return (
        <Box sx={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            backgroundColor: OHEL_LIGHT_GREEN,
            boxSizing: "border-box",
            pt: "72px"
        }}>
            <HeaderCompact onLogout={handleLogout} />

            <Container maxWidth="md" sx={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                py: 2.5,
                px: { xs: 2, sm: 3 },
                boxSizing: "border-box"
            }}>

                {/* GRIGLIA BENTO BOX CON SPAZIATURA MAGGIORE */}
                <Box sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(12, 1fr)" },
                    gap: 2.5,
                    flex: 1,
                    alignContent: "start"
                }}>

                    {/* 1. TESSERA PROFILO HERO */}
                    <Card sx={{
                        gridColumn: { xs: "span 2", sm: "span 12" },
                        borderRadius: "18px",
                        border: "1px solid #e1ebe5",
                        background: "linear-gradient(135deg, #ffffff 0%, #f4f8f5 100%)",
                        boxShadow: "0 4px 14px rgba(46, 91, 67, 0.04)",
                    }}>
                        <CardContent sx={{ p: 2.2, "&:last-child": { pb: 2.2 } }}>
                            <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.2}>
                                <Box display="flex" alignItems="center" gap={1.5}>
                                    {user.picture ? (
                                        <Avatar
                                            src={user.picture.replace(/\s+/g, '')}
                                            alt="Profilo"
                                            sx={{ width: 46, height: 46, border: `2px solid ${OHEL_GREEN}`, boxShadow: "0 2px 8px rgba(46, 91, 67, 0.1)" }}
                                        />
                                    ) : (
                                        <Avatar sx={{ width: 46, height: 46, backgroundColor: OHEL_GREEN, fontWeight: "750", fontSize: "1rem", boxShadow: "0 2px 8px rgba(46, 91, 67, 0.1)" }}>
                                            {user.nome.charAt(0)}
                                        </Avatar>
                                    )}
                                    <Box>
                                        <Typography variant="subtitle1" fontWeight="800" sx={{ color: OHEL_TEXT_DARK, lineHeight: 1.15, fontSize: "1rem" }}>
                                            Ciao, {user.nome}!
                                        </Typography>
                                    </Box>
                                </Box>

                                <Stack direction="row" alignItems="center" gap={1}>
                                    <Chip
                                        icon={user.isAdmin ? <AdminPanelSettingsIcon style={{ fontSize: 14 }} /> : <PersonIcon style={{ fontSize: 14 }} />}
                                        label={user.isAdmin ? "Admin" : "Socio"}
                                        size="small"
                                        sx={{
                                            height: 24,
                                            backgroundColor: user.isAdmin ? "#fff7ed" : "#f0fdf4",
                                            color: user.isAdmin ? "#c2410c" : "#166534",
                                            borderColor: user.isAdmin ? "#ffedd5" : "#dcfce7",
                                            borderStyle: "solid",
                                            borderWidth: "1px",
                                            fontWeight: 700,
                                            fontSize: "0.72rem",
                                            px: 0.5,
                                        }}
                                    />
                                    {pendingSurveysCount > 0 ? (
                                        <Chip
                                            icon={<HowToVoteIcon style={{ fontSize: 13, color: "#15803d" }} />}
                                            label={`${pendingSurveysCount} in sospeso`}
                                            size="small"
                                            sx={{ height: 24, backgroundColor: "#dcfce7", color: "#15803d", fontWeight: 700, fontSize: "0.72rem" }}
                                        />
                                    ) : (
                                        <Chip
                                            icon={<CheckCircleOutlineIcon style={{ fontSize: 13, color: "#475569" }} />}
                                            label="Tutto ok"
                                            size="small"
                                            variant="outlined"
                                            sx={{ height: 24, borderColor: "#cbd5e1", color: "#475569", fontWeight: 700, fontSize: "0.72rem" }}
                                        />
                                    )}
                                </Stack>
                            </Box>
                        </CardContent>
                    </Card>

                    {/* 2. TESSERA CONSULTAZIONI ATTIVE */}
                    <Box sx={{ gridColumn: { xs: "span 2", sm: "span 12" } }}>
                        <Typography variant="caption" fontWeight="800" sx={{ color: OHEL_GREEN, textTransform: "uppercase", letterSpacing: "0.06em", pl: 0.5, mb: 1.5, display: "block", fontSize: "0.75rem" }}>
                            ⚡ Consultazioni Attive
                        </Typography>

                        {surveys.length > 0 ? (
                            /* ✨ STACK CON GAP MAGGIORE (2.5 = 20px) PER DARE PIÙ SPAZIO TRA LE CARD */
                            <Stack gap={2.5}>
                                {surveys.map((survey) => (
                                    <Card
                                        key={survey.idSondaggio}
                                        sx={{
                                            borderRadius: "18px",
                                            border: "1px solid #e1ebe5",
                                            borderLeft: `6px solid ${survey.voted ? OHEL_OCHRE : OHEL_GREEN}`,
                                            backgroundColor: "#ffffff",
                                            boxShadow: "0 4px 14px rgba(46, 91, 67, 0.04)",
                                            transition: "transform 0.2s ease, box-shadow 0.2s ease",
                                            "&:hover": {
                                                transform: "translateY(-2px)",
                                                boxShadow: "0 6px 18px rgba(46, 91, 67, 0.08)"
                                            }
                                        }}
                                    >
                                        <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
                                            <Box display="flex" alignItems="center" justifyContent="space-between" gap={2} flexWrap="wrap">
                                                <Box flex={1} minWidth="200px">
                                                    <Box display="flex" alignItems="center" gap={1} mb={0.6}>
                                                        <Typography variant="subtitle1" fontWeight="800" sx={{ color: OHEL_TEXT_DARK, lineHeight: 1.2, fontSize: "0.98rem" }}>
                                                            {survey.title}
                                                        </Typography>
                                                        <Chip
                                                            label={survey.voted ? "Già Compilato" : "Da Compilare"}
                                                            size="small"
                                                            sx={{
                                                                height: 22,
                                                                backgroundColor: survey.voted ? "#fef3c7" : "#dcfce7",
                                                                color: survey.voted ? "#92400e" : "#166534",
                                                                fontWeight: 700,
                                                                fontSize: "0.70rem",
                                                                borderRadius: "6px",
                                                            }}
                                                        />
                                                    </Box>
                                                    {survey.description && (
                                                        <Typography variant="body2" sx={{ color: "#52796f", fontSize: "0.84rem", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                                                            {survey.description}
                                                        </Typography>
                                                    )}
                                                </Box>

                                                <Box display="flex" alignItems="center" gap={1.5}>
                                                    <Chip
                                                        icon={<CalendarMonthIcon style={{ fontSize: 14, color: survey.voted ? OHEL_OCHRE : OHEL_GREEN }} />}
                                                        label={getDatesCountLabel(survey.dates)}
                                                        variant="outlined"
                                                        size="small"
                                                        sx={{
                                                            height: 26,
                                                            borderColor: survey.voted ? "#fde68a" : "#bbf7d0",
                                                            backgroundColor: survey.voted ? "#fffbeb" : "#f0fdf4",
                                                            color: survey.voted ? "#b45309" : "#15803d",
                                                            fontWeight: 600,
                                                            fontSize: "0.74rem"
                                                        }}
                                                    />

                                                    <Button
                                                        variant={survey.voted ? "outlined" : "contained"}
                                                        size="small"
                                                        onClick={() => navigate(`/surveys/${survey.idSondaggio.replace("SURV_", "")}`)}
                                                        sx={{
                                                            height: 36,
                                                            px: 2.2,
                                                            backgroundColor: survey.voted ? "transparent" : OHEL_GREEN,
                                                            borderColor: survey.voted ? OHEL_OCHRE : "transparent",
                                                            color: survey.voted ? OHEL_OCHRE : "#ffffff",
                                                            borderRadius: "10px",
                                                            textTransform: "none",
                                                            fontWeight: "700",
                                                            fontSize: "0.80rem",
                                                            boxShadow: survey.voted ? "none" : "0 2px 8px rgba(46, 91, 67, 0.15)",
                                                            "&:hover": {
                                                                backgroundColor: survey.voted ? "#fffbeb" : "#1e382b",
                                                            }
                                                        }}
                                                    >
                                                        {survey.voted ? "Modifica Risposte →" : "Compila Disponibilità →"}
                                                    </Button>
                                                </Box>
                                            </Box>
                                        </CardContent>
                                    </Card>
                                ))}
                            </Stack>
                        ) : (
                            <Card sx={{ borderRadius: "18px", border: "1px dashed #cbd5e1", backgroundColor: "#ffffff" }}>
                                <CardContent sx={{ p: 2.5, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 1 }}>
                                    <CheckCircleOutlineIcon sx={{ fontSize: 20, color: OHEL_SAGE }} />
                                    <Typography variant="body2" fontWeight="600" sx={{ color: "#64748b", fontSize: "0.84rem" }}>
                                        Nessuna consultazione in sospeso. Tutto aggiornato!
                                    </Typography>
                                </CardContent>
                            </Card>
                        )}
                    </Box>

                    {/* 3. SCORCIATOIE STRUMENTI */}
                    <Box sx={{ gridColumn: { xs: "span 2", sm: "span 12" }, mt: 1 }}>
                        <Typography variant="caption" fontWeight="800" sx={{ color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", pl: 0.5, mb: 1.5, display: "block", fontSize: "0.75rem" }}>
                            📌 Strumenti Gestionali
                        </Typography>

                        <Box sx={{
                            display: "grid",
                            gridTemplateColumns: user.isAdmin ? { xs: "repeat(2, 1fr)", sm: "repeat(12, 1fr)" } : "1fr",
                            gap: 2
                        }}>

                            {/* TESSERA 1: RISULTATI SONDAGGI */}
                            <Card sx={{
                                gridColumn: user.isAdmin ? { xs: "span 1", sm: "span 3" } : "1 / -1",
                                display: "flex",
                                flexDirection: "column",
                                minHeight: "140px",
                                borderRadius: "18px",
                                border: "1px solid #e1ebe5",
                                borderTop: `5px solid ${OHEL_PURPLE}`,
                                backgroundColor: "#ffffff",
                                boxShadow: "0 3px 12px rgba(46, 91, 67, 0.04)",
                                transition: "all 0.2s ease",
                                "&:hover": { transform: "translateY(-2px)" }
                            }}>
                                <CardContent sx={{ p: 2.2, "&:last-child": { pb: 2.2 }, display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
                                    <Box mb={1.5}>
                                        <Box display="flex" alignItems="center" gap={1} mb={0.6}>
                                            <Box sx={{ backgroundColor: "#f3e8ff", p: 0.7, borderRadius: "8px", display: "flex", shrink: 0 }}>
                                                <AssessmentIcon sx={{ color: OHEL_PURPLE, fontSize: "1.2rem" }} />
                                            </Box>
                                            <Typography variant="subtitle1" fontWeight="800" sx={{ color: OHEL_TEXT_DARK, fontSize: "0.88rem", lineHeight: 1.15 }}>
                                                Risultati Sondaggi
                                            </Typography>
                                        </Box>
                                        <Typography variant="caption" sx={{ color: "#64748b", fontSize: "0.75rem", lineHeight: 1.3, display: "block" }}>
                                            Preferenze e dati della comunità
                                        </Typography>
                                    </Box>

                                    <Button
                                        variant="contained"
                                        size="small"
                                        fullWidth
                                        onClick={() => navigate("/surveys/results")}
                                        sx={{
                                            height: 34,
                                            backgroundColor: OHEL_PURPLE,
                                            color: "#ffffff",
                                            borderRadius: "10px",
                                            textTransform: "none",
                                            fontWeight: "700",
                                            fontSize: "0.76rem",
                                            boxShadow: "0 2px 8px rgba(107, 91, 149, 0.15)",
                                            "&:hover": { backgroundColor: "#52467b" }
                                        }}
                                    >
                                        Vedi Risultati
                                    </Button>
                                </CardContent>
                            </Card>

                            {/* TESSERA 2: NUOVO SONDAGGIO */}
                            {user.isAdmin && (
                                <Card sx={{
                                    gridColumn: { xs: "span 1", sm: "span 3" },
                                    display: "flex",
                                    flexDirection: "column",
                                    minHeight: "140px",
                                    borderRadius: "18px",
                                    border: "1px solid #e1ebe5",
                                    borderTop: `5px solid ${OHEL_ORANGE}`,
                                    backgroundColor: "#ffffff",
                                    boxShadow: "0 3px 12px rgba(46, 91, 67, 0.04)",
                                    transition: "all 0.2s ease",
                                    "&:hover": { transform: "translateY(-2px)" }
                                }}>
                                    <CardContent sx={{ p: 2.2, "&:last-child": { pb: 2.2 }, display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
                                        <Box mb={1.5}>
                                            <Box display="flex" alignItems="center" gap={1} mb={0.6}>
                                                <Box sx={{ backgroundColor: "#ffedd5", p: 0.7, borderRadius: "8px", display: "flex", shrink: 0 }}>
                                                    <AddIcon sx={{ color: OHEL_ORANGE, fontSize: "1.2rem" }} />
                                                </Box>
                                                <Typography variant="subtitle1" fontWeight="800" sx={{ color: OHEL_TEXT_DARK, fontSize: "0.88rem", lineHeight: 1.15 }}>
                                                    Nuovo Sondaggio
                                                </Typography>
                                            </Box>
                                            <Typography variant="caption" sx={{ color: "#64748b", fontSize: "0.75rem", lineHeight: 1.3, display: "block" }}>
                                                Crea e pubblica nuove date
                                            </Typography>
                                        </Box>

                                        <Button
                                            variant="contained"
                                            size="small"
                                            fullWidth
                                            onClick={() => navigate("/surveys/edit")}
                                            sx={{
                                                height: 34,
                                                backgroundColor: OHEL_ORANGE,
                                                color: "#ffffff",
                                                borderRadius: "10px",
                                                textTransform: "none",
                                                fontWeight: "700",
                                                fontSize: "0.76rem",
                                                boxShadow: "0 2px 8px rgba(230, 95, 43, 0.15)",
                                                "&:hover": { backgroundColor: "#c2410c" }
                                            }}
                                        >
                                            Crea Ora
                                        </Button>
                                    </CardContent>
                                </Card>
                            )}

                            {/* TESSERA 3: GESTIONE SONDAGGI */}
                            {user.isAdmin && (
                                <Card sx={{
                                    gridColumn: { xs: "span 1", sm: "span 3" },
                                    display: "flex",
                                    flexDirection: "column",
                                    minHeight: "140px",
                                    borderRadius: "18px",
                                    border: "1px solid #e1ebe5",
                                    borderTop: `5px solid ${OHEL_TEAL}`,
                                    backgroundColor: "#ffffff",
                                    boxShadow: "0 3px 12px rgba(46, 91, 67, 0.04)",
                                    transition: "all 0.2s ease",
                                    "&:hover": { transform: "translateY(-2px)" }
                                }}>
                                    <CardContent sx={{ p: 2.2, "&:last-child": { pb: 2.2 }, display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
                                        <Box mb={1.5}>
                                            <Box display="flex" alignItems="center" gap={1} mb={0.6}>
                                                <Box sx={{ backgroundColor: "#ccfbf1", p: 0.7, borderRadius: "8px", display: "flex", shrink: 0 }}>
                                                    <TuneIcon sx={{ color: OHEL_TEAL, fontSize: "1.2rem" }} />
                                                </Box>
                                                <Typography variant="subtitle1" fontWeight="800" sx={{ color: OHEL_TEXT_DARK, fontSize: "0.88rem", lineHeight: 1.15 }}>
                                                    Gestione Sondaggi
                                                </Typography>
                                            </Box>
                                            <Typography variant="caption" sx={{ color: "#64748b", fontSize: "0.75rem", lineHeight: 1.3, display: "block" }}>
                                                Modifica o elimina sondaggi
                                            </Typography>
                                        </Box>

                                        <Button
                                            variant="contained"
                                            size="small"
                                            fullWidth
                                            onClick={() => navigate("/surveys/manage")}
                                            sx={{
                                                height: 34,
                                                backgroundColor: OHEL_TEAL,
                                                color: "#ffffff",
                                                borderRadius: "10px",
                                                textTransform: "none",
                                                fontWeight: "700",
                                                fontSize: "0.76rem",
                                                boxShadow: "0 2px 8px rgba(15, 118, 110, 0.15)",
                                                "&:hover": { backgroundColor: "#115e59" }
                                            }}
                                        >
                                            Gestisci
                                        </Button>
                                    </CardContent>
                                </Card>
                            )}

                            {/* TESSERA 4: REGISTRO PRESENZE */}
                            {user.isAdmin && (
                                <Card sx={{
                                    gridColumn: { xs: "span 1", sm: "span 3" },
                                    display: "flex",
                                    flexDirection: "column",
                                    minHeight: "140px",
                                    borderRadius: "18px",
                                    border: "1px solid #e1ebe5",
                                    borderTop: `5px solid ${OHEL_BLUE}`,
                                    backgroundColor: "#ffffff",
                                    boxShadow: "0 3px 12px rgba(46, 91, 67, 0.04)",
                                    transition: "all 0.2s ease",
                                    "&:hover": { transform: "translateY(-2px)" }
                                }}>
                                    <CardContent sx={{ p: 2.2, "&:last-child": { pb: 2.2 }, display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
                                        <Box mb={1.5}>
                                            <Box display="flex" alignItems="center" gap={1} mb={0.6}>
                                                <Box sx={{ backgroundColor: "#e0f2fe", p: 0.7, borderRadius: "8px", display: "flex", shrink: 0 }}>
                                                    <BarChartIcon sx={{ color: OHEL_BLUE, fontSize: "1.2rem" }} />
                                                </Box>
                                                <Typography variant="subtitle1" fontWeight="800" sx={{ color: OHEL_TEXT_DARK, fontSize: "0.88rem", lineHeight: 1.15 }}>
                                                    Registro Presenze
                                                </Typography>
                                            </Box>
                                            <Typography variant="caption" sx={{ color: "#64748b", fontSize: "0.75rem", lineHeight: 1.3, display: "block" }}>
                                                Statistiche & profili cibari
                                            </Typography>
                                        </Box>

                                        <Button
                                            variant="contained"
                                            size="small"
                                            fullWidth
                                            onClick={() => navigate("/disponibilita")}
                                            sx={{
                                                height: 34,
                                                backgroundColor: OHEL_BLUE,
                                                color: "#ffffff",
                                                borderRadius: "10px",
                                                textTransform: "none",
                                                fontWeight: "700",
                                                fontSize: "0.76rem",
                                                boxShadow: "0 2px 8px rgba(42, 111, 151, 0.15)",
                                                "&:hover": { backgroundColor: "#1d4ed8" }
                                            }}
                                        >
                                            Consulta
                                        </Button>
                                    </CardContent>
                                </Card>
                            )}

                        </Box>
                    </Box>

                </Box>

                <Footer />
            </Container>
        </Box>
    );
}

export default Dashboard;