import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import CONFIG from "../config/config";
import HeaderCompact from "./HeaderCompact";
import Footer from "../components/Footer";
import { getCache, clearAllCache, clearCachePattern } from "../utils/cacheManager";
import MessageDialog from "./MessageDialog";

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
    Stack,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Alert
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

// Palette cromatica Associazione Ohel
const OHEL_GREEN = "#2e5b43";
const OHEL_SAGE = "#52796f";
const OHEL_LIGHT_GREEN = "#f4f7f5";
const OHEL_TEXT_DARK = "#1e382b";

function SurveyEdit() {
    const navigate = useNavigate();
    const [submitting, setSubmitting] = useState(false);
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [existingActiveSurveys, setExistingActiveSurveys] = useState([]);
    const [dialog, setDialog] = useState({ open: false, title: "", message: "", severity: "info", callback: null });

    const { URL_APPS_SCRIPT } = CONFIG;

    const showDialog = (title, message, severity = "info", callback = null) => {
        setDialog({ open: true, title, message, severity, callback });
    };

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
        clearAllCache();
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

    // Controllo di sondaggi già attivi prima dell'invio
    const handleSubmit = async (e) => {
        e.preventDefault();

        const storedUser = localStorage.getItem("userProfile");
        const email = storedUser ? JSON.parse(storedUser).email : "";

        let activeSurveys = [];
        const cachedSurveys = getCache(`surveys_active_${email}`);
        if (cachedSurveys && cachedSurveys.data) {
            activeSurveys = cachedSurveys.data;
        } else if (email) {
            try {
                const res = await fetch(`${URL_APPS_SCRIPT}?action=GET_ACTIVE_SURVEYS&email=${encodeURIComponent(email)}`);
                const data = await res.json();
                if (data.status === "success" && data.surveys) {
                    activeSurveys = data.surveys;
                }
            } catch (err) {
                console.warn("Errore durante la verifica dei sondaggi attivi:", err);
            }
        }

        // Se ci sono sondaggi vecchi attivi, avvisiamo l'admin tramite Dialog
        if (activeSurveys && activeSurveys.length > 0) {
            setExistingActiveSurveys(activeSurveys);
            setConfirmDialogOpen(true);
        } else {
            executeSurveyCreation();
        }
    };

    // Esecuzione effettiva della creazione sondaggio e disattivazione vecchi sondaggi
    const executeSurveyCreation = async () => {
        setSubmitting(true);
        setConfirmDialogOpen(false);

        const idToken = localStorage.getItem("authToken");
        if (!idToken) {
            showDialog("Sessione Scaduta", "Sessione non valida o scaduta. Riapri l'applicazione.", "warning", handleLogout);
            return;
        }

        const storedUser = localStorage.getItem("userProfile");
        const email = storedUser ? JSON.parse(storedUser).email : "";

        // 1. Disattivazione esplicita nel DB per ciascun vecchio sondaggio attivo
        if (existingActiveSurveys && existingActiveSurveys.length > 0) {
            for (const oldSurvey of existingActiveSurveys) {
                try {
                    await fetch(URL_APPS_SCRIPT, {
                        method: "POST",
                        mode: "cors",
                        body: JSON.stringify({
                            action: "TOGGLE_SURVEY_STATUS",
                            token: idToken,
                            payload: {
                                idSondaggio: oldSurvey.idSondaggio,
                                newStatus: "DISATTIVATO"
                            }
                        })
                    });
                } catch (err) {
                    console.warn(`Impossibile disattivare sondaggio ${oldSurvey.idSondaggio}:`, err);
                }
            }
        }

        // 2. Creazione del nuovo sondaggio attivo
        const surveyPayload = {
            title,
            description,
            deactivatePrevious: true,
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
                clearCachePattern("surveys");
                clearCachePattern("surveys_active");
                clearCachePattern("surveys_manage");
                if (email) clearCachePattern(`surveys_active_${email}`);

                showDialog("Sondaggio Pubblicato", "🚀 Nuovo sondaggio pubblicato con successo! I sondaggi precedenti sono stati disattivati.", "success", () => navigate("/dashboard"));
            } else {
                showDialog("Errore Salvataggio", "Impossibile salvare il sondaggio: " + data.message, "error");
            }
        } catch (err) {
            console.error("[ERRORE PUBBLICAZIONE SONDAGGIO]:", err);
            showDialog("Errore di Rete", "Impossibile connettersi al server del backend. Riprova più tardi.", "error");
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
                                />

                                <TextField
                                    label="Descrizione / Note per i soci (opzionale)"
                                    placeholder="es. Indica la tua disponibilità per le giornate del mese..."
                                    variant="outlined"
                                    multiline
                                    rows={2}
                                    disabled={submitting}
                                    fullWidth
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    slotProps={{ inputLabel: { shrink: true } }}
                                />
                            </CardContent>
                        </Card>

                        {/* ELENCO CARD DATE */}
                        <Box display="flex" alignItems="center" justifyContent="space-between" px={0.5} mt={1}>
                            <Typography variant="subtitle1" fontWeight="800" sx={{ color: OHEL_TEXT_DARK }}>
                                2. Date e Fasce Orarie
                            </Typography>
                            <Typography variant="caption" sx={{ color: OHEL_SAGE, fontWeight: 600 }}>
                                {dates.length} {dates.length === 1 ? "data inserita" : "date inserite"}
                            </Typography>
                        </Box>

                        {dates.map((item, index) => (
                            <Card key={item.id} sx={{
                                borderRadius: "20px",
                                border: "1px solid #e1ebe5",
                                backgroundColor: "#ffffff",
                                boxShadow: "0 4px 12px rgba(46, 91, 67, 0.02)"
                            }}>
                                <CardContent sx={{ p: 2.5, display: "flex", flexDirection: "column", gap: 2 }}>
                                    <Box display="flex" alignItems="center" justifyContent="space-between">
                                        <Typography variant="subtitle2" fontWeight="800" sx={{ color: OHEL_GREEN }}>
                                            📅 {formatHeaderDate(item.dateValue, index)}
                                        </Typography>
                                        {dates.length > 1 && (
                                            <IconButton
                                                size="small"
                                                color="error"
                                                disabled={submitting}
                                                onClick={() => removeDateRow(item.id)}
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        )}
                                    </Box>

                                    <TextField
                                        label="Seleziona Data"
                                        type="date"
                                        required
                                        disabled={submitting}
                                        fullWidth
                                        value={item.dateValue}
                                        onChange={(e) => updateDateRow(item.id, "dateValue", e.target.value)}
                                        slotProps={{ inputLabel: { shrink: true } }}
                                    />

                                    <Stack direction="row" gap={1.5}>
                                        <TextField
                                            label="Ora Inizio"
                                            type="time"
                                            disabled={submitting}
                                            fullWidth
                                            value={item.startTime}
                                            onChange={(e) => updateDateRow(item.id, "startTime", e.target.value)}
                                            slotProps={{ inputLabel: { shrink: true } }}
                                        />
                                        <TextField
                                            label="Ora Fine"
                                            type="time"
                                            disabled={submitting}
                                            fullWidth
                                            value={item.endTime}
                                            onChange={(e) => updateDateRow(item.id, "endTime", e.target.value)}
                                            slotProps={{ inputLabel: { shrink: true } }}
                                        />
                                    </Stack>

                                    <TextField
                                        label="Fasce Orarie (separate da virgola)"
                                        disabled={submitting}
                                        fullWidth
                                        value={item.timeSlots}
                                        onChange={(e) => updateDateRow(item.id, "timeSlots", e.target.value)}
                                        helperText="I soci potranno scegliere una o più di queste opzioni"
                                        slotProps={{ inputLabel: { shrink: true } }}
                                    />

                                    <TextField
                                        label="Sottotitolo / Dettaglio (opzionale)"
                                        placeholder="es. Pranzo sociale e riunione"
                                        disabled={submitting}
                                        fullWidth
                                        value={item.subtitle}
                                        onChange={(e) => updateDateRow(item.id, "subtitle", e.target.value)}
                                        slotProps={{ inputLabel: { shrink: true } }}
                                    />

                                    <TextField
                                        label="Note o informazioni utili"
                                        placeholder="es. Portare abiti comodi"
                                        disabled={submitting}
                                        fullWidth
                                        value={item.notes}
                                        onChange={(e) => updateDateRow(item.id, "notes", e.target.value)}
                                        slotProps={{ inputLabel: { shrink: true } }}
                                    />
                                </CardContent>
                            </Card>
                        ))}

                        <Button
                            variant="outlined"
                            startIcon={<AddIcon />}
                            onClick={addDateRow}
                            disabled={submitting}
                            sx={{
                                borderRadius: "14px",
                                textTransform: "none",
                                fontWeight: 700,
                                borderColor: OHEL_SAGE,
                                color: OHEL_GREEN,
                                py: 1.2,
                                borderStyle: "dashed",
                                borderWidth: 2,
                                "&:hover": { borderWidth: 2, borderColor: OHEL_GREEN, backgroundColor: "rgba(46, 91, 67, 0.04)" }
                            }}
                        >
                            Aggiungi un'altra Data
                        </Button>

                        <Divider sx={{ my: 1 }} />

                        <Button
                            type="submit"
                            variant="contained"
                            disabled={submitting}
                            sx={{
                                borderRadius: "14px",
                                textTransform: "none",
                                fontWeight: 800,
                                fontSize: "1rem",
                                py: 1.5,
                                backgroundColor: OHEL_GREEN,
                                boxShadow: "0 4px 12px rgba(46, 91, 67, 0.2)",
                                "&:hover": { backgroundColor: "#1e382b" }
                            }}
                        >
                            {submitting ? "Pubblicazione in corso..." : "Pubblica Sondaggio Presenze →"}
                        </Button>

                    </Stack>
                </form>

            </Container>

            {/* DIALOG DI AVVISO DISATTIVAZIONE VECCHI SONDAGGI ATTIVI */}
            <Dialog
                open={confirmDialogOpen}
                onClose={() => !submitting && setConfirmDialogOpen(false)}
                maxWidth="xs"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: "20px",
                        p: 1
                    }
                }}
            >
                <DialogTitle sx={{ fontWeight: 800, color: OHEL_TEXT_DARK, display: "flex", alignItems: "center", gap: 1.2, pb: 1 }}>
                    <WarningAmberIcon sx={{ color: "#d97706", fontSize: "1.8rem" }} />
                    Disattivazione Sondaggi Attivi
                </DialogTitle>

                <DialogContent dividers sx={{ py: 2 }}>
                    <Typography variant="body2" sx={{ color: "#475569", lineHeight: 1.5, mb: 1.5 }}>
                        Stai per pubblicare il nuovo sondaggio <strong>"{title}"</strong>.
                    </Typography>

                    <Alert severity="warning" sx={{ borderRadius: "12px", mb: 1.5, fontSize: "0.82rem", fontWeight: 600 }}>
                        Attualmente risultano attivi i seguenti sondaggi:
                    </Alert>

                    <Box sx={{ backgroundColor: "#f8fafc", p: 1.5, borderRadius: "12px", border: "1px solid #e2e8f0", mb: 2 }}>
                        {existingActiveSurveys.map((survey, index) => (
                            <Typography key={index} variant="body2" fontWeight="700" sx={{ color: OHEL_TEXT_DARK, fontSize: "0.85rem" }}>
                                • {survey.title || survey.idSondaggio}
                            </Typography>
                        ))}
                    </Box>

                    <Typography variant="body2" sx={{ color: "#475569", lineHeight: 1.4, mb: 1.5 }}>
                        Pubblicando quello nuovo, i vecchi sondaggi attivi verranno automaticamente disattivati.
                    </Typography>

                    <Typography variant="caption" sx={{ color: OHEL_SAGE, fontSize: "0.78rem", display: "block", fontStyle: "italic", backgroundColor: "#f4f7f5", p: 1, borderRadius: "8px" }}>
                        💡 Potrai comunque riabilitare qualsiasi sondaggio disattivato in ogni momento dal <strong>Pannello di Gestione Sondaggi</strong>.
                    </Typography>
                </DialogContent>

                <DialogActions sx={{ p: 2, gap: 1 }}>
                    <Button
                        onClick={() => setConfirmDialogOpen(false)}
                        disabled={submitting}
                        sx={{ color: OHEL_SAGE, fontWeight: 700, textTransform: "none" }}
                    >
                        Annulla
                    </Button>

                    <Button
                        variant="contained"
                        onClick={executeSurveyCreation}
                        disabled={submitting}
                        sx={{
                            backgroundColor: OHEL_GREEN,
                            color: "#ffffff",
                            borderRadius: "10px",
                            fontWeight: 800,
                            textTransform: "none",
                            px: 2.2,
                            boxShadow: "0 2px 8px rgba(46, 91, 67, 0.2)",
                            "&:hover": { backgroundColor: "#1e382b" }
                        }}
                    >
                        {submitting ? "Pubblicazione..." : "Conferma e Pubblica →"}
                    </Button>
                </DialogActions>
            </Dialog>

            <Footer />

            <MessageDialog
                open={dialog.open}
                onClose={() => {
                    setDialog(prev => ({ ...prev, open: false }));
                    if (dialog.callback) dialog.callback();
                }}
                title={dialog.title}
                message={dialog.message}
                severity={dialog.severity}
            />
        </Box>
    );
}

export default SurveyEdit;