import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import CONFIG from "../config/config";
import HeaderCompact from "./HeaderCompact";
import Footer from "../components/Footer";

// Importazioni Material-UI
import {
    Box,
    Container,
    Card,
    CardContent,
    Typography,
    Button,
    CircularProgress,
    Stack,
    Chip
} from "@mui/material";
import AssessmentIcon from "@mui/icons-material/Assessment";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";

// Palette cromatica Associazione Ohel
const OHEL_SAGE = "#52796f";
const OHEL_PURPLE = "#6b5b95";
const OHEL_LIGHT_GREEN = "#f4f7f5";
const OHEL_TEXT_DARK = "#1e382b";

function SurveyResultsList() {
    const navigate = useNavigate();
    const [surveys, setSurveys] = useState([]);
    const [loading, setLoading] = useState(true);

    const { URL_APPS_SCRIPT } = CONFIG;

    useEffect(() => {
        const caricaSondaggi = async () => {
            const idToken = localStorage.getItem("authToken");
            const storedUserProfile = localStorage.getItem("userProfile");

            if (!idToken || !storedUserProfile) {
                handleLogout();
                return;
            }

            const currentUser = JSON.parse(storedUserProfile);

            try {
                // Recuperiamo i sondaggi attivi dal backend Apps Script
                const response = await fetch(
                    `${URL_APPS_SCRIPT}?action=GET_ACTIVE_SURVEYS&email=${encodeURIComponent(currentUser.email)}`,
                    {
                        method: "GET",
                        mode: "cors"
                    }
                );
                const data = await response.json();

                if (data.status === "success") {
                    setSurveys(data.surveys || []);
                } else {
                    alert("Errore nel recupero dati: " + data.message);
                }
            } catch (err) {
                console.error("Errore nel caricamento dei sondaggi:", err);
                alert("Impossibile connettersi al server del backend.");
            } finally {
                setLoading(false);
            }
        };

        caricaSondaggi();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [URL_APPS_SCRIPT]);

    const handleLogout = () => {
        localStorage.removeItem("authToken");
        localStorage.removeItem("userProfile");
        navigate("/", { replace: true });
    };

    const getCleanSurveyId = (fullId) => {
        return fullId.replace("SURV_", "");
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh" backgroundColor={OHEL_LIGHT_GREEN}>
                <CircularProgress size={50} sx={{ color: OHEL_PURPLE }} />
            </Box>
        );
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh", backgroundColor: OHEL_LIGHT_GREEN, pt: "84px", boxSizing: "border-box" }}>
            <HeaderCompact subtitle="Risultati Sondaggi" onLogout={handleLogout} />

            <Container maxWidth="xs" sx={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 2, mt: 1, mb: 4 }}>

                {/* INTESTAZIONE PAGINA */}
                <Box pl={0.5}>
                    <Stack direction="row" alignItems="center" gap={1} mb={0.5}>
                        <AssessmentIcon sx={{ color: OHEL_PURPLE, fontSize: "1.8rem" }} />
                        <Typography variant="h6" fontWeight="800" sx={{ color: OHEL_TEXT_DARK, lineHeight: 1.2 }}>
                            Risultati Consultazioni
                        </Typography>
                    </Stack>
                    <Typography variant="caption" sx={{ color: OHEL_SAGE, fontWeight: 600 }}>
                        Seleziona un sondaggio per visualizzare le disponibilità e i report aggregati della comunità.
                    </Typography>
                </Box>

                {/* LISTA CARD SONDAGGI */}
                <Stack gap={2} mt={1}>
                    {surveys.length > 0 ? (
                        surveys.map((survey) => {
                            const cleanId = getCleanSurveyId(survey.idSondaggio);
                            const datesCount = survey.dates?.length || 0;

                            return (
                                <Card
                                    key={survey.idSondaggio}
                                    sx={{
                                        borderRadius: "20px",
                                        border: "1px solid #e1ebe5",
                                        borderLeft: `5px solid ${OHEL_PURPLE}`,
                                        backgroundColor: "#ffffff",
                                        boxShadow: "0 4px 12px rgba(46, 91, 67, 0.03)",
                                        transition: "transform 0.15s ease",
                                        "&:hover": { transform: "translateY(-2px)" }
                                    }}
                                >
                                    <CardContent sx={{ p: 2.5 }}>
                                        <Typography variant="subtitle1" fontWeight="800" sx={{ color: OHEL_TEXT_DARK, mb: 0.5 }}>
                                            {survey.title}
                                        </Typography>

                                        {survey.description && (
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    color: "#52796f",
                                                    mb: 1.5,
                                                    fontSize: "0.85rem",
                                                    display: "-webkit-box",
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: "vertical",
                                                    overflow: "hidden"
                                                }}
                                            >
                                                {survey.description}
                                            </Typography>
                                        )}

                                        <Stack direction="row" alignItems="center" gap={1} mb={2}>
                                            <Chip
                                                icon={<CalendarMonthIcon fontSize="small" sx={{ color: `${OHEL_PURPLE} !important` }} />}
                                                label={`${datesCount} ${datesCount === 1 ? "giornata configurata" : "giornate configurate"}`}
                                                size="small"
                                                sx={{
                                                    backgroundColor: "#f2eff7",
                                                    color: OHEL_PURPLE,
                                                    fontWeight: "700",
                                                    fontSize: "0.75rem",
                                                    borderRadius: "8px"
                                                }}
                                            />
                                        </Stack>

                                        {/* TASTO DI REINDIRIZZAMENTO A /surveys/results/:idsondaggio */}
                                        <Button
                                            variant="contained"
                                            fullWidth
                                            onClick={() => navigate(`/surveys/results/${cleanId}`)}
                                            sx={{
                                                backgroundColor: OHEL_PURPLE,
                                                color: "#ffffff",
                                                borderRadius: "12px",
                                                textTransform: "none",
                                                fontWeight: "700",
                                                py: 1.2,
                                                boxShadow: "0 4px 12px rgba(107, 91, 149, 0.15)",
                                                "&:hover": { backgroundColor: "#52467b" }
                                            }}
                                        >
                                            Visualizza Disponibilità →
                                        </Button>
                                    </CardContent>
                                </Card>
                            );
                        })
                    ) : (
                        <Card sx={{ borderRadius: "20px", border: "1px solid #e1ebe5" }}>
                            <CardContent sx={{ p: 3, textAlign: "center" }}>
                                <Typography variant="body2" sx={{ color: OHEL_SAGE, fontStyle: "italic" }}>
                                    Nessun sondaggio disponibile al momento.
                                </Typography>
                            </CardContent>
                        </Card>
                    )}
                </Stack>

            </Container>

            <Footer />
        </Box>
    );
}

export default SurveyResultsList;