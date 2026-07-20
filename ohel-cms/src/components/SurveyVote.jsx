import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
    Chip,
    Divider,
    FormGroup,
    FormControlLabel,
    Checkbox,
    TextField,
    List,
    ListItem
} from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import RestaurantIcon from "@mui/icons-material/Restaurant";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import BlockIcon from "@mui/icons-material/Block";

// Palette cromatica Associazione Ohel
const OHEL_GREEN = "#2e5b43";
const OHEL_SAGE = "#52796f";
const OHEL_OCHRE = "#d9922b";
const OHEL_LIGHT_GREEN = "#f4f7f5";
const OHEL_TEXT_DARK = "#1e382b";

// Opzioni intolleranze aggiornate
const COMMON_INTOLERANCES = [
    "Glutine (Celiachia)",
    "Lattosio / Latticini",
    "Frutta a guscio / Arachidi",
    "Uova"
];

function SurveyVote() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [survey, setSurvey] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Gestione dello Step Corrente (1: Turni, 2: Intolleranze, 3: Riepilogo)
    const [step, setStep] = useState(1);

    // Stato Turni: { "YYYY-MM-DD": ["Mattina", "Sera"], ... }
    const [selections, setSelections] = useState({});

    // Stato Assenze: { "YYYY-MM-DD": true / false }
    const [absences, setAbsences] = useState({});

    // Stati Intolleranze
    const [selectedIntolerances, setSelectedIntolerances] = useState([]);
    const [customIntolerance, setCustomIntolerance] = useState("");

    const { URL_APPS_SCRIPT } = CONFIG;

    useEffect(() => {
        const caricaDettagliESelezioni = async () => {
            const idToken = localStorage.getItem("authToken");
            const storedUserProfile = localStorage.getItem("userProfile");

            if (!idToken || !storedUserProfile) {
                handleLogout();
                return;
            }

            const currentUser = JSON.parse(storedUserProfile);

            try {
                // 1. Recuperiamo tutti i sondaggi attivi via GET (passando l'email per verificare il voto)
                const response = await fetch(`${URL_APPS_SCRIPT}?action=GET_ACTIVE_SURVEYS&email=${encodeURIComponent(currentUser.email)}`, {
                    method: "GET",
                    mode: "cors"
                });
                const data = await response.json();

                if (data.status === "success") {
                    const targetSurvey = data.surveys.find(s => s.idSondaggio === `SURV_${id}`);
                    if (!targetSurvey) {
                        alert("Sondaggio non trovato o non più attivo.");
                        navigate("/dashboard");
                        return;
                    }

                    setSurvey(targetSurvey);

                    // Struttura iniziale pulita
                    const initialSelections = {};
                    const initialAbsences = {};
                    targetSurvey.dates.forEach(d => {
                        initialSelections[d.date] = [];
                        initialAbsences[d.date] = false;
                    });

                    // 2. Se l'utente ha già risposto, scarichiamo le sue specifiche preferenze per popolare le card
                    if (targetSurvey.voted) {
                        // Creiamo una nuova azione sul backend per leggere i dati salvati
                        const responseVotes = await fetch(`${URL_APPS_SCRIPT}?action=GET_USER_VOTES&email=${encodeURIComponent(currentUser.email)}&idSondaggio=SURV_${id}`, {
                            method: "GET",
                            mode: "cors"
                        });
                        const dataVotes = await responseVotes.json();

                        if (dataVotes.status === "success" && dataVotes.data) {
                            const userVotes = dataVotes.data.selections; // { "2026-07-29": ["Mattina", "ASSENTE"] }
                            const userIntolerances = dataVotes.data.intolerances || [];

                            Object.keys(userVotes).forEach(dateStr => {
                                if (userVotes[dateStr].includes("ASSENTE")) {
                                    initialAbsences[dateStr] = true;
                                    initialSelections[dateStr] = [];
                                } else {
                                    initialAbsences[dateStr] = false;
                                    initialSelections[dateStr] = userVotes[dateStr];
                                }
                            });

                            // Pre-popoliamo il profilo alimentare
                            const standardIntolerances = userIntolerances.filter(i => COMMON_INTOLERANCES.includes(i));
                            const customIntolerancesList = userIntolerances.filter(i => !COMMON_INTOLERANCES.includes(i) && i !== "Nessuna");

                            setSelectedIntolerances(standardIntolerances);
                            if (customIntolerancesList.length > 0) {
                                setCustomIntolerance(customIntolerancesList.join(", "));
                            }
                        }
                    }

                    setSelections(initialSelections);
                    setAbsences(initialAbsences);

                } else {
                    alert("Errore nel recupero dati: " + data.message);
                }
            } catch (err) {
                console.error("Errore di rete nel caricamento del sondaggio:", err);
                alert("Impossibile connettersi al server del backend.");
            } finally {
                setLoading(false);
            }
        };

        caricaDettagliESelezioni();
    }, [id, URL_APPS_SCRIPT, navigate]);

    const handleLogout = () => {
        localStorage.removeItem("authToken");
        localStorage.removeItem("userProfile");
        navigate("/", { replace: true });
    };

    const handleSlotClick = (dateStr, slot) => {
        if (absences[dateStr]) {
            absences[dateStr] = false;
        }

        const currentSlots = selections[dateStr] || [];
        let updatedSlots = currentSlots.includes(slot)
            ? currentSlots.filter(s => s !== slot)
            : [...currentSlots, slot];

        setSelections({ ...selections, [dateStr]: updatedSlots });
    };

    const handleAbsenceClick = (dateStr) => {
        const isCurrentlyAbsent = absences[dateStr];

        setAbsences({
            ...absences,
            [dateStr]: !isCurrentlyAbsent
        });

        if (!isCurrentlyAbsent) {
            setSelections({
                ...selections,
                [dateStr]: []
            });
        }
    };

    const formatDateItalian = (dateValue) => {
        try {
            const dateObj = new Date(dateValue);
            const formatted = new Intl.DateTimeFormat("it-IT", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric"
            }).format(dateObj);
            return formatted.charAt(0).toUpperCase() + formatted.slice(1);
        } catch (e) {
            return dateValue;
        }
    };

    const handleIntoleranceChange = (option) => {
        let updated = [...selectedIntolerances];
        if (updated.includes(option)) {
            updated = updated.filter(item => item !== option);
        } else {
            updated.push(option);
        }
        setSelectedIntolerances(updated);
    };

    const handleNextStep = () => {
        if (step === 1) {
            const incompleteDates = survey?.dates.filter(d => selections[d.date].length === 0 && !absences[d.date]);

            if (incompleteDates && incompleteDates.length > 0) {
                alert("Per favore, indica la tua disponibilità o seleziona 'Non sarò presente' per tutte le giornate.");
                return;
            }
            setStep(2);
        } else if (step === 2) {
            setStep(3);
        }
    };

    const handleVoteSubmit = async () => {
        setSubmitting(true);
        const idToken = localStorage.getItem("authToken");

        const intolleranzeFinali = [...selectedIntolerances];
        if (customIntolerance.trim()) {
            intolleranzeFinali.push(customIntolerance.trim());
        }

        const finalSelections = {};
        survey?.dates.forEach(d => {
            if (absences[d.date]) {
                finalSelections[d.date] = ["ASSENTE"];
            } else {
                finalSelections[d.date] = selections[d.date];
            }
        });

        const votePayload = {
            idSondaggio: `SURV_${id}`,
            selections: finalSelections,
            intolerances: intolleranzeFinali.length > 0 ? intolleranzeFinali : ["Nessuna"]
        };

        try {
            const response = await fetch(URL_APPS_SCRIPT, {
                method: "POST",
                mode: "cors",
                body: JSON.stringify({
                    action: "SUBMIT_PRESENCES",
                    token: idToken,
                    payload: votePayload
                }),
            });

            const data = await response.json();

            if (data.status === "success") {
                alert("🎉 Disponibilità aggiornate con successo!");
                navigate("/dashboard");
            } else {
                alert("Errore durante l'invio: " + data.message);
            }
        } catch (err) {
            console.error("Errore durante il salvataggio dei voti:", err);
            alert("Errore di connessione. Riprova più tardi.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh" backgroundColor={OHEL_LIGHT_GREEN}>
                <CircularProgress size={50} sx={{ color: OHEL_GREEN }} />
            </Box>
        );
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh", backgroundColor: OHEL_LIGHT_GREEN, pt: "84px", boxSizing: "border-box" }}>
            <HeaderCompact subtitle={step === 1 ? "Turni" : step === 2 ? "Alimentazione" : "Riepilogo"} onLogout={handleLogout} />

            <Container maxWidth="xs" sx={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 2, mt: 1, mb: 4 }}>

                {step < 3 && (
                    <Box pl={0.5}>
                        <Typography variant="h6" fontWeight="800" sx={{ color: OHEL_TEXT_DARK, lineHeight: 1.2, mb: 0.5 }}>
                            {survey?.title}
                        </Typography>
                        <Typography variant="caption" sx={{ color: OHEL_OCHRE, fontWeight: 700, textTransform: "uppercase" }}>
                            {survey?.voted ? "Modifica Risposte" : "Nuova Compilazione"} • Fase {step} di 3
                        </Typography>
                    </Box>
                )}

                {/* ---------------- STEP 1: SELEZIONE TURNI ---------------- */}
                {step === 1 && (
                    <Stack gap={2}>
                        {survey?.dates.map((dateItem) => {
                            const isAbsent = absences[dateItem.date];
                            const isDateSelected = selections[dateItem.date]?.length > 0;

                            let borderLeftColor = "#bad1c6";
                            if (isAbsent) borderLeftColor = "#d32f2f";
                            else if (isDateSelected) borderLeftColor = OHEL_GREEN;

                            return (
                                <Card
                                    key={dateItem.date}
                                    sx={{
                                        borderRadius: "20px",
                                        border: "1px solid #e1ebe5",
                                        borderLeft: `5px solid ${borderLeftColor}`,
                                        backgroundColor: isAbsent ? "#fffcfc" : "#ffffff",
                                        transition: "all 0.2s ease"
                                    }}
                                >
                                    <CardContent sx={{ p: 2.5 }}>
                                        <Stack direction="row" alignItems="center" gap={1} mb={0.5}>
                                            <CalendarMonthIcon sx={{ color: isAbsent ? "#d32f2f" : (isDateSelected ? OHEL_GREEN : OHEL_SAGE), fontSize: "1.2rem" }} />
                                            <Typography variant="subtitle1" fontWeight="800" sx={{ color: isAbsent ? "#d32f2f" : OHEL_TEXT_DARK }}>
                                                {formatDateItalian(dateItem.date)}
                                            </Typography>
                                        </Stack>

                                        {dateItem.subtitle && (
                                            <Typography variant="caption" display="block" fontWeight="700" sx={{ color: isAbsent ? "#9e9e9e" : OHEL_OCHRE, textTransform: "uppercase", mb: 1, pl: 3.2 }}>
                                                🔹 {dateItem.subtitle}
                                            </Typography>
                                        )}

                                        <Stack direction="row" alignItems="center" gap={0.8} sx={{ pl: 3.2, mb: 2 }}>
                                            <AccessTimeIcon sx={{ color: "#83a697", fontSize: "0.95rem" }} />
                                            <Typography variant="caption" fontWeight="600" sx={{ color: "#52796f" }}>
                                                Dalle {dateItem.timeRange.start} alle {dateItem.timeRange.end}
                                            </Typography>
                                        </Stack>

                                        <Divider sx={{ borderStyle: "dashed", my: 1.5, borderColor: "#e1ebe5" }} />

                                        <Typography variant="caption" fontWeight="700" display="block" sx={{ color: "#83a697", textTransform: "uppercase", mb: 1 }}>
                                            Seleziona la tua disponibilità:
                                        </Typography>

                                        <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                                            {dateItem.timeSlots.map((slot) => {
                                                const isSelected = selections[dateItem.date]?.includes(slot);
                                                return (
                                                    <Chip
                                                        key={slot}
                                                        label={slot}
                                                        clickable
                                                        disabled={isAbsent}
                                                        onClick={() => handleSlotClick(dateItem.date, slot)}
                                                        sx={{
                                                            borderRadius: "10px",
                                                            fontWeight: "700",
                                                            fontSize: "0.85rem",
                                                            py: 2,
                                                            backgroundColor: isSelected ? OHEL_GREEN : "#f0f4f2",
                                                            color: isSelected ? "#ffffff" : OHEL_TEXT_DARK,
                                                            border: isSelected ? `1px solid ${OHEL_GREEN}` : "1px solid #e1ebe5"
                                                        }}
                                                    />
                                                );
                                            })}
                                        </Box>

                                        <Chip
                                            icon={<BlockIcon fontSize="small" style={{ color: isAbsent ? "#ffffff" : "#757575" }} />}
                                            label="Non sarò presente questo giorno"
                                            clickable
                                            onClick={() => handleAbsenceClick(dateItem.date)}
                                            sx={{
                                                borderRadius: "10px",
                                                fontWeight: "700",
                                                fontSize: "0.85rem",
                                                py: 2,
                                                backgroundColor: isAbsent ? "#d32f2f" : "#f0f4f2",
                                                color: isAbsent ? "#ffffff" : OHEL_TEXT_DARK,
                                                border: isAbsent ? "1px solid #d32f2f" : "1px solid #e1ebe5",
                                                "& .MuiChip-icon": {
                                                    color: isAbsent ? "#ffffff !important" : "#757575 !important"
                                                },
                                                "&:hover": {
                                                    backgroundColor: isAbsent ? "#b71c1c" : "#e2ebe6"
                                                },
                                                transition: "all 0.15s ease"
                                            }}
                                        />

                                        {dateItem.notes && !isAbsent && (
                                            <Box sx={{ mt: 2, p: 1.5, backgroundColor: "#fffbf2", borderRadius: "10px", border: "1px solid #f9ebd2" }}>
                                                <Typography variant="caption" sx={{ color: "#b3761b", display: "block", lineHeight: 1.3 }}>
                                                    📌 {dateItem.notes}
                                                </Typography>
                                            </Box>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                        <Button variant="contained" fullWidth onClick={handleNextStep} sx={{ backgroundColor: OHEL_GREEN, color: "#ffffff", borderRadius: "12px", py: 1.5, fontWeight: "700", textTransform: "none", mt: 1 }}>
                            Continua (Segnalazioni Alimentari) →
                        </Button>
                    </Stack>
                )}

                {/* ---------------- STEP 2: INTOLLERANZE ALIMENTARI ---------------- */}
                {step === 2 && (
                    <Stack gap={2}>
                        <Card sx={{ borderRadius: "20px", border: "1px solid #e1ebe5", borderTop: `4px solid ${OHEL_OCHRE}`, backgroundColor: "#ffffff" }}>
                            <CardContent sx={{ p: 2.5, display: "flex", flexDirection: "column", gap: 2 }}>
                                <Stack direction="row" alignItems="center" gap={1}>
                                    <RestaurantIcon sx={{ color: OHEL_OCHRE }} />
                                    <Typography variant="subtitle1" fontWeight="800" sx={{ color: OHEL_TEXT_DARK }}>
                                        Segnalazioni Alimentari
                                    </Typography>
                                </Stack>
                                <Typography variant="body2" sx={{ color: "#52796f", lineHeight: 1.4 }}>
                                    Spunta le tue eventuali intolleranze o allergie. Se non hai segnalazioni, <strong>lascia pure tutto vuoto</strong> e prosegui:
                                </Typography>

                                <FormGroup>
                                    {COMMON_INTOLERANCES.map((option) => (
                                        <FormControlLabel
                                            key={option}
                                            control={
                                                <Checkbox
                                                    checked={selectedIntolerances.includes(option)}
                                                    onChange={() => handleIntoleranceChange(option)}
                                                    sx={{ color: "#bad1c6", "&.Mui-checked": { color: OHEL_OCHRE } }}
                                                />
                                            }
                                            label={<Typography variant="body2" fontWeight="600" color={OHEL_TEXT_DARK}>{option}</Typography>}
                                        />
                                    ))}
                                </FormGroup>

                                <TextField
                                    label="Altre intolleranze o note specifiche (Opzionale)"
                                    placeholder="es. Allergia ai crostacei / Regime vegetariano"
                                    variant="outlined"
                                    fullWidth
                                    multiline
                                    rows={2}
                                    value={customIntolerance}
                                    onChange={(e) => setCustomIntolerance(e.target.value)}
                                    slotProps={{ inputLabel: { shrink: true } }}
                                    sx={{
                                        mt: 1,
                                        "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: OHEL_OCHRE },
                                        "& .MuiInputLabel-root.Mui-focused": { color: OHEL_OCHRE }
                                    }}
                                />
                            </CardContent>
                        </Card>

                        <Stack direction="row" gap={2}>
                            <Button variant="outlined" fullWidth onClick={() => setStep(1)} sx={{ color: OHEL_SAGE, borderColor: "#bad1c6", borderRadius: "12px", py: 1.5, fontWeight: "700", textTransform: "none" }}>
                                Indietro
                            </Button>
                            <Button variant="contained" fullWidth onClick={handleNextStep} sx={{ backgroundColor: OHEL_GREEN, color: "#ffffff", borderRadius: "12px", py: 1.5, fontWeight: "700", textTransform: "none" }}>
                                Vai al Riepilogo →
                            </Button>
                        </Stack>
                    </Stack>
                )}

                {/* ---------------- STEP 3: RIEPILOGO FINALE ---------------- */}
                {step === 3 && (
                    <Stack gap={2}>
                        <Box display="flex" alignItems="center" gap={1} pl={0.5}>
                            <AssignmentTurnedInIcon sx={{ color: OHEL_GREEN }} />
                            <Typography variant="h6" fontWeight="800" sx={{ color: OHEL_TEXT_DARK }}>
                                Riepilogo Disponibilità
                            </Typography>
                        </Box>

                        <Card sx={{ borderRadius: "20px", border: "1px solid #e1ebe5", backgroundColor: "#ffffff" }}>
                            <CardContent sx={{ p: 2.5, display: "flex", flexDirection: "column", gap: 2 }}>

                                <Typography variant="subtitle2" fontWeight="800" color={OHEL_GREEN} sx={{ textTransform: "uppercase" }}>
                                    📅 Riepilogo presenze per giornata:
                                </Typography>
                                <List disablePadding>
                                    {survey?.dates.map((d) => {
                                        const isDateAbsent = absences[d.date];
                                        const dateSlots = selections[d.date] || [];
                                        return (
                                            <ListItem key={d.date} disableGutters sx={{ py: 0.5, alignItems: "flex-start", flexDirection: "column" }}>
                                                <Typography variant="body2" fontWeight="700" color={OHEL_TEXT_DARK}>
                                                    • {formatDateItalian(d.date)}
                                                </Typography>
                                                <Typography variant="caption" fontWeight="700" color={isDateAbsent ? "#d32f2f" : OHEL_SAGE} sx={{ pl: 1.5 }}>
                                                    {isDateAbsent ? "Stato: NON PRESENTE" : `Fasce scelte: ${dateSlots.join(", ")}`}
                                                </Typography>
                                            </ListItem>
                                        );
                                    })}
                                </List>

                                <Divider sx={{ my: 0.5 }} />

                                <Typography variant="subtitle2" fontWeight="800" color={OHEL_OCHRE} sx={{ textTransform: "uppercase" }}>
                                    🍏 Profilo Alimentare segnalato:
                                </Typography>
                                <Typography variant="body2" fontWeight="600" color={OHEL_TEXT_DARK}>
                                    {selectedIntolerances.length === 0 && !customIntolerance.trim() ? (
                                        <span style={{ fontStyle: "italic", color: "#83a697" }}>Nessuna intolleranza segnalata</span>
                                    ) : (
                                        <>
                                            {selectedIntolerances.join(", ")}
                                            {customIntolerance.trim() && `${selectedIntolerances.length > 0 ? ", " : ""}${customIntolerance.trim()}`}
                                        </>
                                    )}
                                </Typography>

                            </CardContent>
                        </Card>

                        <Box>
                            <Button
                                variant="contained"
                                fullWidth
                                disabled={submitting}
                                onClick={handleVoteSubmit}
                                sx={{ backgroundColor: OHEL_GREEN, color: "#ffffff", borderRadius: "12px", py: 1.5, fontWeight: "700", textTransform: "none", mb: 1.5 }}
                            >
                                {submitting ? "Salvataggio in corso..." : survey?.voted ? "🚀 Aggiorna Disponibilità" : "🚀 Conferma e Invia Tutto"}
                            </Button>
                            <Button variant="text" fullWidth disabled={submitting} onClick={() => setStep(2)} sx={{ color: OHEL_SAGE, fontWeight: 700, textTransform: "none" }}>
                                Modifica qualcosa
                            </Button>
                        </Box>
                    </Stack>
                )}

                {step === 1 && (
                    <Button variant="text" fullWidth onClick={() => navigate("/dashboard")} sx={{ color: OHEL_SAGE, textTransform: "none", fontWeight: 700 }}>
                        Torna alla Dashboard
                    </Button>
                )}

            </Container>
            <Footer />
        </Box>
    );
}

export default SurveyVote;