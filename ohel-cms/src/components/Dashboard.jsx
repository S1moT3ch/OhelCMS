import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import CONFIG from "../config/config";
import HeaderCompact from "./HeaderCompact";
import Footer from "../components/Footer";

// Importazioni Material-UI
import {
    Box,
    Typography,
    Button,
    Container,
    Card,
    CardContent,
    Avatar,
    CircularProgress,
    Stack
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import BarChartIcon from "@mui/icons-material/BarChart";

// Palette cromatica Associazione Ohel totalmente differenziata
const OHEL_GREEN = "#2e5b43";      // Per i sondaggi da compilare (Nuovi)
const OHEL_SAGE = "#52796f";       // Testi secondari e note
const OHEL_OCHRE = "#d9922b";      // Per lo stato "Già Compilato / Modifica"
const OHEL_ORANGE = "#e65f2b";     // ✨ NUOVO: Colore specifico per la Creazione Sondaggi
const OHEL_BLUE = "#2a6f97";       // Per il registro delle presenze
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

            try {
                const responseUser = await fetch(URL_APPS_SCRIPT, {
                    method: "POST",
                    mode: "cors",
                    body: JSON.stringify({ action: "LOGIN", token: idToken }),
                });
                const dataUser = await responseUser.json();

                if (dataUser.status === "success" && dataUser.exists) {
                    setUser(dataUser.user);

                    const responseSurveys = await fetch(
                        `${URL_APPS_SCRIPT}?action=GET_ACTIVE_SURVEYS&email=${encodeURIComponent(dataUser.user.email)}`,
                        {
                            method: "GET",
                            mode: "cors"
                        }
                    );
                    const dataSurveys = await responseSurveys.json();

                    if (dataSurveys.status === "success") {
                        setSurveys(dataSurveys.surveys);
                    }
                } else {
                    handleLogout();
                }
            } catch (err) {
                console.error("Errore durante il caricamento dei dati della dashboard:", err);
                const storedUser = localStorage.getItem("userProfile");
                if (storedUser) setUser(JSON.parse(storedUser));
            } finally {
                setLoading(false);
            }
        };

        inizializzaDashboard();
    }, []);

    const handleLogout = () => {
        localStorage.removeItem("authToken");
        localStorage.removeItem("userProfile");
        navigate("/", { replace: true });
    };

    const getDatesCountLabel = (datesArray) => {
        if (!datesArray || datesArray.length === 0) return "Nessuna data configurata";
        return datesArray.length === 1 ? "1 data disponibile" : `${datesArray.length} date disponibili`;
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh" backgroundColor={OHEL_LIGHT_GREEN}>
                <CircularProgress size={50} sx={{ color: OHEL_GREEN }} />
            </Box>
        );
    }

    if (!user) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
                <Typography color="error">Errore di caricamento del profilo.</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh", backgroundColor: OHEL_LIGHT_GREEN, pt: "84px", boxSizing: "border-box" }}>
            <HeaderCompact onLogout={handleLogout} />

            <Container maxWidth="xs" sx={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>

                {/* CARD PROFILO UTENTE */}
                <Card sx={{ borderRadius: "20px", border: "1px solid #e1ebe5", boxShadow: "0 4px 12px rgba(46, 91, 67, 0.03)" }}>
                    <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
                        <Box display="flex" alignItems="center" gap={2}>
                            {user.picture ? (
                                <Avatar
                                    src={user.picture.replace(/\s+/g, '')}
                                    alt="Profilo"
                                    sx={{ width: 56, height: 56, border: `2px solid ${OHEL_GREEN}` }}
                                />
                            ) : (
                                <Avatar sx={{ width: 56, height: 56, backgroundColor: OHEL_GREEN, fontWeight: "750" }}>
                                    {user.nome.charAt(0)}
                                </Avatar>
                            )}
                            <Box>
                                <Typography variant="h6" fontWeight="750" sx={{ color: OHEL_TEXT_DARK }}>
                                    Ciao, {user.nome}!
                                </Typography>
                                <Typography variant="caption" sx={{ color: OHEL_SAGE, fontWeight: 600 }}>
                                    {user.isAdmin ? "Pannello Amministratore" : "Area Socio"}
                                </Typography>
                            </Box>
                        </Box>
                    </CardContent>
                </Card>

                {/* SEZIONE 1: CARDS FUNZIONE AMMINISTRATIVE (SOLO ADMIN) */}
                {user.isAdmin && (
                    <>
                        <Typography variant="caption" fontWeight="700" sx={{ color: "#406353", textTransform: "uppercase", letterSpacing: "0.05em", pl: 0.5, mt: 0.5 }}>
                            Strumenti Gestione Admin
                        </Typography>

                        <Stack gap={1.5}>
                            {/* CARD FUNZIONE 1: CREA SONDAGGIO (ARANCIONE ZUCCA) */}
                            <Card sx={{
                                borderRadius: "20px",
                                border: "1px solid #e1ebe5",
                                borderLeft: `5px solid ${OHEL_ORANGE}`,
                                backgroundColor: "#ffffff",
                                boxShadow: "0 4px 12px rgba(46, 91, 67, 0.02)"
                            }}>
                                <CardContent sx={{ p: 2.2 }}>
                                    <Stack direction="row" alignItems="center" gap={1} mb={0.5}>
                                        <AddIcon sx={{ color: OHEL_ORANGE, fontSize: "1.3rem" }} />
                                        <Typography variant="subtitle1" fontWeight="800" sx={{ color: OHEL_TEXT_DARK }}>
                                            Nuovo Sondaggio Presenze
                                        </Typography>
                                    </Stack>
                                    <Typography variant="body2" sx={{ color: "#52796f", mb: 2, pl: 3.6, fontSize: "0.85rem", lineHeight: 1.3 }}>
                                        Configura e pubblica nuove date e fasce orarie per raccogliere la disponibilità dei soci.
                                    </Typography>
                                    <Button
                                        variant="contained"
                                        fullWidth
                                        onClick={() => navigate("/surveys/edit")}
                                        sx={{
                                            backgroundColor: OHEL_ORANGE,
                                            color: "#ffffff",
                                            borderRadius: "12px",
                                            textTransform: "none",
                                            fontWeight: "700",
                                            boxShadow: "0 4px 12px rgba(230, 95, 43, 0.15)",
                                            "&:hover": { backgroundColor: "#c2410c" }
                                        }}
                                    >
                                        Apri Configurazione →
                                    </Button>
                                </CardContent>
                            </Card>

                            {/* CARD FUNZIONE 2: REGISTRO PRESENZE (BLU REALE) */}
                            <Card sx={{
                                borderRadius: "20px",
                                border: "1px solid #e1ebe5",
                                borderLeft: `5px solid ${OHEL_BLUE}`,
                                backgroundColor: "#ffffff",
                                boxShadow: "0 4px 12px rgba(46, 91, 67, 0.02)"
                            }}>
                                <CardContent sx={{ p: 2.2 }}>
                                    <Stack direction="row" alignItems="center" gap={1} mb={0.5}>
                                        <BarChartIcon sx={{ color: OHEL_BLUE, fontSize: "1.3rem" }} />
                                        <Typography variant="subtitle1" fontWeight="800" sx={{ color: OHEL_TEXT_DARK }}>
                                            Registro Presenze Completo
                                        </Typography>
                                    </Stack>
                                    <Typography variant="body2" sx={{ color: "#52796f", mb: 2, pl: 3.6, fontSize: "0.85rem", lineHeight: 1.3 }}>
                                        Visualizza i dati aggregati, le statistiche dei turni compilati e i profili alimentari.
                                    </Typography>
                                    <Button
                                        variant="contained"
                                        fullWidth
                                        onClick={() => navigate("/disponibilita")}
                                        sx={{
                                            backgroundColor: OHEL_BLUE,
                                            color: "#ffffff",
                                            borderRadius: "12px",
                                            textTransform: "none",
                                            fontWeight: "700",
                                            boxShadow: "0 4px 12px rgba(42, 111, 151, 0.15)",
                                            "&:hover": { backgroundColor: "#1d4ed8" }
                                        }}
                                    >
                                        Consulta i Dati →
                                    </Button>
                                </CardContent>
                            </Card>
                        </Stack>
                    </>
                )}

                {/* SEZIONE 2: CONSULTAZIONI E SONDAGGI ATTIVI */}
                <Typography variant="caption" fontWeight="700" sx={{ color: "#406353", textTransform: "uppercase", letterSpacing: "0.05em", pl: 0.5, mt: 1.5 }}>
                    Sondaggi e Consultazioni Attive
                </Typography>

                <Stack gap={1.5} sx={{ mb: 4 }}>
                    {surveys.length > 0 ? (
                        surveys.map((survey) => (
                            <Card
                                key={survey.idSondaggio}
                                sx={{
                                    borderRadius: "20px",
                                    border: "1px solid #e1ebe5",
                                    borderLeft: `5px solid ${survey.voted ? OHEL_OCHRE : OHEL_GREEN}`,
                                    boxShadow: "0 4px 12px rgba(46, 91, 67, 0.02)"
                                }}
                            >
                                <CardContent sx={{ p: 2.5 }}>
                                    <Typography variant="subtitle1" fontWeight="800" sx={{ color: OHEL_TEXT_DARK, mb: 0.5 }}>
                                        {survey.title}
                                    </Typography>

                                    {survey.description && (
                                        <Typography variant="body2" sx={{ color: "#52796f", mb: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                                            {survey.description}
                                        </Typography>
                                    )}

                                    <Typography variant="caption" display="block" sx={{ color: survey.voted ? OHEL_OCHRE : OHEL_GREEN, fontWeight: 700, mb: 2 }}>
                                        📅 {getDatesCountLabel(survey.dates)} {survey.voted && " • (Già Compilato)"}
                                    </Typography>

                                    <Button
                                        variant="contained"
                                        fullWidth
                                        onClick={() => navigate(`/surveys/${survey.idSondaggio.replace("SURV_", "")}`)}
                                        sx={{
                                            backgroundColor: survey.voted ? OHEL_OCHRE : OHEL_GREEN,
                                            color: "#ffffff",
                                            borderRadius: "12px",
                                            textTransform: "none",
                                            fontWeight: "700",
                                            "&:hover": { backgroundColor: survey.voted ? "#bd7f22" : OHEL_TEXT_DARK }
                                        }}
                                    >
                                        {survey.voted ? "✏️ Modifica Disponibilità →" : "Compila Disponibilità →"}
                                    </Button>
                                </CardContent>
                            </Card>
                        ))
                    ) : (
                        <Card sx={{ borderRadius: "20px", border: "1px solid #e1ebe5" }}>
                            <CardContent sx={{ p: 3, textAlign: "center" }}>
                                <Typography variant="body2" sx={{ color: "#52796f", fontStyle: "italic" }}>
                                    Nessuna consultazione attiva al momento.
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

export default Dashboard;