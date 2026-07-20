import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import CONFIG from "../config/config"; // Config importata correttamente
import HeaderCompact from "./HeaderCompact";
import Footer from "../components/Footer";

// Importazioni Material-UI
import {
    Box,
    Container,
    Card,
    CardContent,
    Typography,
    TextField,
    Button,
    IconButton,
    Divider,
    Stack
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";

// Palette cromatica espansa e dinamica basata sul logo
const OHEL_GREEN = "#2e5b43";
const OHEL_SAGE = "#52796f";
const OHEL_OCHRE = "#d9922b";
const OHEL_LIGHT_GREEN = "#f4f7f5";
const OHEL_TEXT_DARK = "#1e382b";

function SurveyEdit() {
    const navigate = useNavigate();
    const [submitting, setSubmitting] = useState(false); // Stato di caricamento per l'invio

    // Estrazione dell'URL del backend come nell'esempio della Home
    const { URL_APPS_SCRIPT } = CONFIG;

    useEffect(() => {
        const storedUser = localStorage.getItem("userProfile");
        if (!storedUser || !JSON.parse(storedUser).isAdmin) {
            console.warn("Accesso negato: l'utente non è un amministratore.");
            navigate("/", { replace: true });
        }
    }, [navigate]);

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");

    const [dates, setDates] = useState([
        {
            id: Date.now(),
            dateValue: "",
            startTime: "08:00",
            endTime: "20:00",
            subtitle: "",
            timeSlots: "Mattina, Pomeriggio, Sera",
            notes: ""
        }
    ]);

    const handleLogout = () => {
        localStorage.removeItem("authToken");
        localStorage.removeItem("userProfile");
        navigate("/", { replace: true });
    };

    const addDateRow = () => {
        setDates([
            ...dates,
            {
                id: Date.now(),
                dateValue: "",
                startTime: "08:00",
                endTime: "20:00",
                subtitle: "",
                timeSlots: "Mattina, Pomeriggio, Sera",
                notes: ""
            }
        ]);
    };

    const removeDateRow = (id) => {
        if (dates.length > 1) {
            setDates(dates.filter(d => d.id !== id));
        }
    };

    const updateDateRow = (id, key, value) => {
        setDates(dates.map(d => d.id === id ? { ...d, [key]: value } : d));
    };

    const formatHeaderDate = (dateValue, index) => {
        if (!dateValue) return `Opzione Data #${index + 1}`;

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
            return `Opzione Data #${index + 1}`;
        }
    };

    // Interazione reale con il backend Google Apps Script tramite POST
    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        const idToken = localStorage.getItem("authToken");
        if (!idToken) {
            alert("Sessione non valida o scaduta. Riapri l'applicazione.");
            handleLogout();
            return;
        }

        const surveyPayload = {
            title,
            description,
            dates: dates.map(({ dateValue, startTime, endTime, subtitle, timeSlots, notes }) => ({
                date: dateValue,
                timeRange: { start: startTime, end: endTime },
                subtitle,
                timeSlots: timeSlots.split(",").map(slot => slot.trim()),
                notes
            }))
        };

        try {
            const response = await fetch(URL_APPS_SCRIPT, {
                method: "POST",
                mode: "cors",
                body: JSON.stringify({
                    action: "CREATE_SURVEY",
                    token: idToken,
                    payload: surveyPayload
                }),
            });

            if (!response.ok) {
                throw new Error(`Errore di rete. Stato: ${response.status}`);
            }

            const data = await response.json();

            if (data.status === "success") {
                alert("🚀 Sondaggio pubblicato su Google Sheets con successo!");
                navigate("/dashboard");
            } else {
                alert("Impossibile salvare il sondaggio: " + data.message);
            }
        } catch (err) {
            console.error("[ERRORE PUBBLICAZIONE SONDAGGIO]:", err);
            alert("Errore di rete. Verifica la connessione o le configurazioni CORS del backend.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                minHeight: "100vh",
                backgroundColor: OHEL_LIGHT_GREEN,
                pt: "84px",
                boxSizing: "border-box"
            }}
        >
            <HeaderCompact subtitle="Nuovo Sondaggio" onLogout={handleLogout} />

            <Container maxWidth="sm" sx={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 2, mt: 1, mb: 4 }}>

                <Box display="flex" alignItems="center" justifyContent="space-between" pl={0.5}>
                    <Typography variant="h6" fontWeight="800" sx={{ color: OHEL_TEXT_DARK }}>
                        Crea Sondaggio Presenze
                    </Typography>
                    <Button
                        variant="text"
                        size="small"
                        disabled={submitting}
                        onClick={() => navigate("/dashboard")}
                        sx={{ color: OHEL_SAGE, textTransform: "none", fontWeight: 700 }}
                    >
                        Annulla
                    </Button>
                </Box>

                <form onSubmit={handleSubmit}>
                    <Stack gap={2}>

                        {/* CARD INFO GENERALI */}
                        <Card sx={{
                            borderRadius: "20px",
                            border: "1px solid #e1ebe5",
                            borderTop: `4px solid ${OHEL_SAGE}`,
                            backgroundColor: "#ffffff",
                            boxShadow: "0 4px 12px rgba(46, 91, 67, 0.02)"
                        }}>
                            <CardContent sx={{ p: 2.5, display: "flex", flexDirection: "column", gap: 2 }}>
                                <Typography variant="subtitle1" fontWeight="700" sx={{ color: OHEL_SAGE }}>
                                    1. Informazioni Generali
                                </Typography>

                                <TextField
                                    label="Titolo / Periodo del sondaggio"
                                    placeholder="es. Turni e disponibilità - Settembre 2026"
                                    variant="outlined"
                                    required
                                    disabled={submitting}
                                    fullWidth
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    slotProps={{ inputLabel: { shrink: true } }}
                                    sx={{
                                        "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: OHEL_SAGE },
                                        "& .MuiInputLabel-root.Mui-focused": { color: OHEL_SAGE }
                                    }}
                                />

                                <TextField
                                    label="Note o indicazioni generali per i soci"
                                    placeholder="es. Seleziona le fasce orarie in cui sei disponibile per le attività associative."
                                    variant="outlined"
                                    multiline
                                    rows={2}
                                    disabled={submitting}
                                    fullWidth
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    slotProps={{ inputLabel: { shrink: true } }}
                                    sx={{
                                        "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: OHEL_SAGE },
                                        "& .MuiInputLabel-root.Mui-focused": { color: OHEL_SAGE }
                                    }}
                                />
                            </CardContent>
                        </Card>

                        <Typography
                            variant="caption"
                            fontWeight="700"
                            sx={{ color: "#406353", textTransform: "uppercase", letterSpacing: "0.05em", pl: 0.5, mt: 1 }}
                        >
                            2. Configura Date e Fasce Orarie
                        </Typography>

                        {/* BLOCCO DELLE DATE DINAMICHE */}
                        {dates.map((dateItem, index) => (
                            <Card
                                key={dateItem.id}
                                sx={{
                                    borderRadius: "20px",
                                    border: "1px solid #e1ebe5",
                                    borderLeft: `5px solid ${dateItem.dateValue ? OHEL_GREEN : OHEL_OCHRE}`,
                                    backgroundColor: dateItem.dateValue ? "#ffffff" : "#fdfbf7",
                                    position: "relative",
                                    transition: "all 0.3s ease"
                                }}
                            >
                                <CardContent sx={{ p: 2.5, display: "flex", flexDirection: "column", gap: 2 }}>
                                    <Box display="flex" justifyContent="space-between" alignItems="center">
                                        <Typography
                                            variant="subtitle2"
                                            fontWeight="800"
                                            color={dateItem.dateValue ? OHEL_GREEN : OHEL_OCHRE}
                                        >
                                            {formatHeaderDate(dateItem.dateValue, index)}
                                        </Typography>

                                        {dates.length > 1 && (
                                            <IconButton
                                                color="error"
                                                size="small"
                                                disabled={submitting}
                                                onClick={() => removeDateRow(dateItem.id)}
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        )}
                                    </Box>

                                    {/* RIGA 1: DATA E SOTTOTITOLO */}
                                    <Stack direction={{ xs: "column", sm: "row" }} gap={2}>
                                        <TextField
                                            type="date"
                                            label="Scegli il Giorno"
                                            required
                                            disabled={submitting}
                                            fullWidth
                                            value={dateItem.dateValue}
                                            onChange={(e) => updateDateRow(dateItem.id, "dateValue", e.target.value)}
                                            slotProps={{ inputLabel: { shrink: true } }}
                                            sx={{
                                                "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: OHEL_GREEN },
                                                "& .MuiInputLabel-root.Mui-focused": { color: OHEL_GREEN }
                                            }}
                                        />
                                        <TextField
                                            label="Sottotitolo della data (Opzionale)"
                                            placeholder="es. Serata coi ragazzi 12-14"
                                            disabled={submitting}
                                            fullWidth
                                            value={dateItem.subtitle}
                                            onChange={(e) => updateDateRow(dateItem.id, "subtitle", e.target.value)}
                                            slotProps={{ inputLabel: { shrink: true } }}
                                            sx={{
                                                "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: OHEL_GREEN },
                                                "& .MuiInputLabel-root.Mui-focused": { color: OHEL_GREEN }
                                            }}
                                        />
                                    </Stack>

                                    {/* RANGE ORARIO (DALLE / ALLE) */}
                                    <Stack direction="row" gap={2}>
                                        <TextField
                                            type="time"
                                            label="Orario Inizio (Dalle)"
                                            required
                                            disabled={submitting}
                                            fullWidth
                                            value={dateItem.startTime}
                                            onChange={(e) => updateDateRow(dateItem.id, "startTime", e.target.value)}
                                            slotProps={{ inputLabel: { shrink: true } }}
                                            sx={{
                                                "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: OHEL_GREEN },
                                                "& .MuiInputLabel-root.Mui-focused": { color: OHEL_GREEN }
                                            }}
                                        />
                                        <TextField
                                            type="time"
                                            label="Orario Fine (Alle)"
                                            required
                                            disabled={submitting}
                                            fullWidth
                                            value={dateItem.endTime}
                                            onChange={(e) => updateDateRow(dateItem.id, "endTime", e.target.value)}
                                            slotProps={{ inputLabel: { shrink: true } }}
                                            sx={{
                                                "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: OHEL_GREEN },
                                                "& .MuiInputLabel-root.Mui-focused": { color: OHEL_GREEN }
                                            }}
                                        />
                                    </Stack>

                                    <TextField
                                        label="Fasce Orarie Selezionabili (separate da virgola)"
                                        placeholder="Mattina, Pomeriggio, Sera"
                                        required
                                        disabled={submitting}
                                        fullWidth
                                        value={dateItem.timeSlots}
                                        onChange={(e) => updateDateRow(dateItem.id, "timeSlots", e.target.value)}
                                        helperText="I soci indicheranno la disponibilità per queste fasce."
                                        slotProps={{ inputLabel: { shrink: true } }}
                                        sx={{
                                            "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: OHEL_GREEN },
                                            "& .MuiInputLabel-root.Mui-focused": { color: OHEL_GREEN }
                                        }}
                                    />

                                    <TextField
                                        label="Indicazioni specifiche (Opzionali)"
                                        placeholder="es. Servono almeno 3 persone"
                                        disabled={submitting}
                                        fullWidth
                                        value={dateItem.notes}
                                        onChange={(e) => updateDateRow(dateItem.id, "notes", e.target.value)}
                                        slotProps={{ inputLabel: { shrink: true } }}
                                        sx={{
                                            "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: OHEL_GREEN },
                                            "& .MuiInputLabel-root.Mui-focused": { color: OHEL_GREEN }
                                        }}
                                    />
                                </CardContent>
                            </Card>
                        ))}

                        {/* BOTTONE AGGIUNGI DATA */}
                        <Button
                            variant="outlined"
                            startIcon={<AddIcon />}
                            disabled={submitting}
                            onClick={addDateRow}
                            sx={{
                                color: OHEL_OCHRE,
                                borderColor: "#f3d19e",
                                borderRadius: "12px",
                                textTransform: "none",
                                fontWeight: "750",
                                py: 1.2,
                                backgroundColor: "#ffffff",
                                "&:hover": { borderColor: OHEL_OCHRE, backgroundColor: "#fffbf2" }
                            }}
                        >
                            Aggiungi un'altra data a questo sondaggio
                        </Button>

                        <Divider sx={{ my: 1, borderColor: "#bad1c6" }} />

                        {/* PUBBLICAZIONE SONDAGGIO */}
                        <Button
                            type="submit"
                            variant="contained"
                            fullWidth
                            disabled={submitting}
                            sx={{
                                backgroundColor: OHEL_GREEN,
                                color: "#ffffff",
                                borderRadius: "12px",
                                py: 1.5,
                                textTransform: "none",
                                fontWeight: "700",
                                fontSize: "1rem",
                                boxShadow: "0 4px 12px rgba(46, 91, 67, 0.15)",
                                "&:hover": { backgroundColor: OHEL_TEXT_DARK }
                            }}
                        >
                            {submitting ? "Pubblicazione in corso..." : "🚀 Pubblica Sondaggio Presenze"}
                        </Button>

                    </Stack>
                </form>
            </Container>

            <Footer />
        </Box>
    );
}

export default SurveyEdit;