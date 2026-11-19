import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import CONFIG from "../config/config";
import HeaderCompact from "./HeaderCompact";
import Footer from "../components/Footer";
import { getCache, clearAllCache, clearCachePattern } from "../utils/cacheManager";
import { logClientEvent } from "../utils/logger";
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
    Alert,
    CircularProgress,
    Paper
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import TableChartIcon from "@mui/icons-material/TableChart";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";

// Palette cromatica Associazione Ohel
const OHEL_GREEN = "#2e5b43";
const OHEL_SAGE = "#52796f";
const OHEL_TEAL = "#0f766e";
const OHEL_LIGHT_GREEN = "#f4f7f5";
const OHEL_TEXT_DARK = "#1e382b";

function SurveyEdit() {
    const navigate = useNavigate();
    const location = useLocation();
    const surveyToEdit = location.state?.surveyToEdit || null;
    const isEditing = Boolean(surveyToEdit);

    const [submitting, setSubmitting] = useState(false);
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [existingActiveSurveys, setExistingActiveSurveys] = useState([]);
    const [dialog, setDialog] = useState({ open: false, title: "", message: "", severity: "info", callback: null });

    // Stati per importazione da file Excel
    const [excelFile, setExcelFile] = useState(null);
    const [excelBase64, setExcelBase64] = useState("");
    const [excelLoading, setExcelLoading] = useState(false);
    const [excelSuccessNotice, setExcelSuccessNotice] = useState(null);
    const [directImportConfirmOpen, setDirectImportConfirmOpen] = useState(false);

    const { URL_APPS_SCRIPT } = CONFIG;

    const showDialog = (title, message, severity = "info", callback = null) => {
        setDialog({ open: true, title, message, severity, callback });
    };

    useEffect(() => {
        const storedUser = localStorage.getItem("userProfile");
        if (!storedUser || !JSON.parse(storedUser).isAdmin) {
            console.warn("Accesso negato: l'utente non è un amministratore.");
            navigate("/", { replace: true });
            return;
        }

        const user = JSON.parse(storedUser);
        const currentEmail = (user.email || "").toLowerCase().trim();

        if (surveyToEdit) {
            const surveyOwner = (surveyToEdit.createdBy || "").toLowerCase().trim();
            if (surveyOwner && surveyOwner !== currentEmail) {
                showDialog("Accesso Negato", "Puoi modificare solo i sondaggi pubblicati da te.", "warning", () => navigate("/surveys/manage"));
            }
        }
    }, [navigate, surveyToEdit]);

    const [title, setTitle] = useState(surveyToEdit?.title || "");
    const [description, setDescription] = useState(surveyToEdit?.description || "");

    const [dates, setDates] = useState(() => {
        if (surveyToEdit && Array.isArray(surveyToEdit.dates) && surveyToEdit.dates.length > 0) {
            return surveyToEdit.dates.map((d, idx) => ({
                id: Date.now() + idx,
                dateValue: d.date || "",
                startTime: d.timeRange?.start || "08:00",
                endTime: d.timeRange?.end || "20:00",
                subtitle: d.subtitle || "",
                timeSlots: Array.isArray(d.timeSlots) ? d.timeSlots.join(", ") : (d.timeSlots || "Mattina, Pomeriggio, Sera"),
                notes: d.notes || ""
            }));
        }
        return [
            {
                id: Date.now(),
                dateValue: "",
                startTime: "08:00",
                endTime: "20:00",
                subtitle: "",
                timeSlots: "Mattina, Pomeriggio, Sera",
                notes: ""
            }
        ];
    });

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

    // Gestione selezione del file Excel locale
    const handleExcelFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const fileName = file.name.toLowerCase();
        if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
            showDialog("Formato Non Supportato", "Seleziona un file con estensione .xlsx o .xls", "warning");
            e.target.value = "";
            return;
        }

        setExcelFile(file);
        setExcelSuccessNotice(null);

        const reader = new FileReader();
        reader.onload = (uploadEvent) => {
            const b64 = uploadEvent.target.result;
            setExcelBase64(b64);
        };
        reader.onerror = () => {
            showDialog("Errore Lettura", "Impossibile leggere il file selezionato.", "error");
        };
        reader.readAsDataURL(file);
    };

    // Chiamata protetta al backend per il parsing del file Excel e popolamento modulo
    const handleParseExcel = async () => {
        if (!excelBase64 || !excelFile) {
            showDialog("File Mancante", "Seleziona prima un file Excel (.xlsx) da analizzare.", "warning");
            return;
        }

        const idToken = localStorage.getItem("authToken");
        if (!idToken) {
            showDialog("Sessione Scaduta", "Sessione non valida o scaduta. Riapri l'applicazione.", "warning", handleLogout);
            return;
        }

        setExcelLoading(true);

        try {
            const response = await fetch(URL_APPS_SCRIPT, {
                method: "POST",
                mode: "cors",
                body: JSON.stringify({
                    action: "PARSE_EXCEL_SURVEY",
                    token: idToken,
                    payload: {
                        fileBase64: excelBase64,
                        fileName: excelFile.name
                    }
                })
            });

            const data = await response.json();

            if (data.status === "success" && data.survey) {
                const s = data.survey;
                if (s.title) setTitle(s.title);
                if (s.description) setDescription(s.description);

                if (Array.isArray(s.dates) && s.dates.length > 0) {
                    const mappedDates = s.dates.map((d, idx) => ({
                        id: Date.now() + idx,
                        dateValue: d.date || "",
                        startTime: d.timeRange?.start || "08:00",
                        endTime: d.timeRange?.end || "20:00",
                        subtitle: d.subtitle || "",
                        timeSlots: Array.isArray(d.timeSlots) ? d.timeSlots.join(", ") : (d.timeSlots || "Mattina, Pomeriggio, Sera"),
                        notes: d.notes || ""
                    }));
                    setDates(mappedDates);
                }

                setExcelSuccessNotice(`✅ File Excel "${excelFile.name}" elaborato con successo! ${s.dates?.length || 0} date caricate nel modulo.`);
                logClientEvent("EXCEL_PARSE_FRONTEND", `Elaborato Excel con ${s.dates?.length} date`, { level: "INFO" });
            } else {
                showDialog("Errore Parsing Excel", data.message || "Impossibile elaborare il file Excel.", "error");
            }
        } catch (err) {
            console.error("[ERRORE PARSING EXCEL]:", err);
            showDialog("Errore di Rete", "Impossibile comunicare con il backend per l'elaborazione del file Excel.", "error");
        } finally {
            setExcelLoading(false);
        }
    };

    // Apertura dialog di conferma per importazione diretta nel DB
    const handleDirectImportClick = async () => {
        if (!excelBase64 || !excelFile) {
            showDialog("File Mancante", "Seleziona prima un file Excel (.xlsx) da importare.", "warning");
            return;
        }

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
                console.warn("Errore verifica sondaggi attivi:", err);
            }
        }

        if (activeSurveys && activeSurveys.length > 0) {
            setExistingActiveSurveys(activeSurveys);
            setDirectImportConfirmOpen(true);
        } else {
            executeDirectImportExcel();
        }
    };

    // Chiamata protetta al backend per parsing + salvataggio diretto nel database
    const executeDirectImportExcel = async () => {
        setDirectImportConfirmOpen(false);
        const idToken = localStorage.getItem("authToken");
        if (!idToken) {
            showDialog("Sessione Scaduta", "Sessione non valida o scaduta. Riapri l'applicazione.", "warning", handleLogout);
            return;
        }

        setExcelLoading(true);

        try {
            const response = await fetch(URL_APPS_SCRIPT, {
                method: "POST",
                mode: "cors",
                body: JSON.stringify({
                    action: "IMPORT_EXCEL_SURVEY",
                    token: idToken,
                    payload: {
                        fileBase64: excelBase64,
                        fileName: excelFile.name,
                        deactivatePrevious: true
                    }
                })
            });

            const data = await response.json();

            if (data.status === "success") {
                logClientEvent("EXCEL_IMPORT_DIRECT", `Sondaggio importato direttamente da Excel: ${data.idSondaggio}`, { level: "SUCCESS" });
                clearCachePattern("surveys");
                clearCachePattern("surveys_active");
                clearCachePattern("surveys_manage");

                showDialog(
                    "Questionario Creato con Successo!",
                    `🚀 Il questionario è stato estratto dal file Excel e salvato nel database (ID: ${data.idSondaggio}). Gli utenti possono ora visualizzarlo e votare!`,
                    "success",
                    () => navigate("/surveys/manage")
                );
            } else {
                showDialog("Errore Importazione", data.message || "Impossibile salvare il sondaggio da Excel.", "error");
            }
        } catch (err) {
            console.error("[ERRORE IMPORT DIRETTO EXCEL]:", err);
            showDialog("Errore di Rete", "Impossibile completare l'operazione di salvataggio.", "error");
        } finally {
            setExcelLoading(false);
        }
    };

    // Controllo di sondaggi già attivi prima dell'invio
    const handleSubmit = async (e) => {
        e.preventDefault();

        // Se siamo in modalità modifica, eseguiamo direttamente l'aggiornamento
        if (isEditing) {
            executeSurveyUpdate();
            return;
        }

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

    // Esecuzione effettiva dell'aggiornamento di un sondaggio esistente
    const executeSurveyUpdate = async () => {
        setSubmitting(true);

        const idToken = localStorage.getItem("authToken");
        if (!idToken) {
            showDialog("Sessione Scaduta", "Sessione non valida o scaduta. Riapri l'applicazione.", "warning", handleLogout);
            return;
        }

        const surveyPayload = {
            idSondaggio: surveyToEdit.idSondaggio,
            title,
            description,
            dates: dates.map(({ dateValue, startTime, endTime, subtitle, timeSlots, notes }) => ({
                date: dateValue,
                timeRange: { start: startTime, end: endTime },
                subtitle,
                timeSlots: typeof timeSlots === "string" ? timeSlots.split(",").map(slot => slot.trim()).filter(Boolean) : timeSlots,
                notes
            }))
        };

        try {
            const response = await fetch(URL_APPS_SCRIPT, {
                method: "POST",
                mode: "cors",
                body: JSON.stringify({
                    action: "UPDATE_SURVEY",
                    token: idToken,
                    payload: surveyPayload
                }),
            });

            if (!response.ok) {
                throw new Error(`Errore di rete. Stato: ${response.status}`);
            }

            const data = await response.json();

            if (data.status === "success") {
                logClientEvent("CLIENT_UPDATE_SURVEY", `Sondaggio "${title}" aggiornato con successo dall'admin`, { level: "SUCCESS" });
                clearCachePattern("surveys");
                clearCachePattern("surveys_active");
                clearCachePattern("surveys_manage");

                showDialog(
                    "Sondaggio Modificato",
                    "💾 Il sondaggio è stato aggiornato con successo!",
                    "success",
                    () => navigate("/surveys/manage")
                );
            } else {
                showDialog("Errore Modifica", "Impossibile aggiornare il sondaggio: " + (data.message || ""), "error");
            }
        } catch (err) {
            console.error("[ERRORE MODIFICA SONDAGGIO]:", err);
            showDialog("Errore di Rete", "Impossibile connettersi al server del backend. Riprova più tardi.", "error");
        } finally {
            setSubmitting(false);
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
                logClientEvent("CLIENT_UPDATE_SURVEY", `Sondaggio "${title}" aggiornato con successo dall'admin`, { level: "SUCCESS" });
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
            <HeaderCompact subtitle={isEditing ? "Modifica Sondaggio" : "Nuovo Sondaggio"} onLogout={handleLogout} />

            <Container maxWidth="sm" sx={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 2, mt: 1, mb: 4 }}>

                <Box display="flex" alignItems="center" justifyContent="space-between" pl={0.5}>
                    <Typography variant="h6" fontWeight="800" sx={{ color: OHEL_TEXT_DARK }}>
                        {isEditing ? "Modifica Sondaggio Presenze" : "Crea Sondaggio Presenze"}
                    </Typography>
                    <Button
                        variant="text"
                        size="small"
                        disabled={submitting}
                        onClick={() => navigate(isEditing ? "/surveys/manage" : "/dashboard")}
                        sx={{ color: OHEL_SAGE, textTransform: "none", fontWeight: 700 }}
                    >
                        Annulla
                    </Button>
                </Box>

                <form onSubmit={handleSubmit}>
                    <Stack gap={2}>

                        {/* SEZIONE COMPATTA: IMPORTA DA EXCEL */}
                        {!isEditing && (
                            <Card sx={{
                                borderRadius: "16px",
                                border: "1px solid #c8ded2",
                                borderTop: `4px solid ${OHEL_GREEN}`,
                                backgroundColor: "#ffffff",
                                boxShadow: "0 2px 8px rgba(46, 91, 67, 0.04)"
                            }}>
                                <CardContent sx={{ p: { xs: 1.8, sm: 2 }, display: "flex", flexDirection: "column", gap: 1.5 }}>
                                    <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                                        <Box display="flex" alignItems="center" gap={1}>
                                            <TableChartIcon sx={{ color: OHEL_GREEN, fontSize: "1.35rem" }} />
                                            <Typography variant="subtitle2" fontWeight="800" sx={{ color: OHEL_TEXT_DARK, fontSize: { xs: "0.95rem", sm: "1rem" } }}>
                                                Importa da Excel (.xlsx)
                                            </Typography>
                                        </Box>
                                        <Button
                                            href="/templates/Template_Questionario_OhelCMS.xlsx"
                                            download="Template_Questionario_OhelCMS.xlsx"
                                            variant="text"
                                            size="small"
                                            startIcon={<FileDownloadIcon sx={{ fontSize: "1rem" }} />}
                                            sx={{ color: OHEL_SAGE, textTransform: "none", fontSize: "0.75rem", fontWeight: 700, p: 0.5 }}
                                        >
                                            Modello .xlsx
                                        </Button>
                                    </Box>

                                    {/* Area File Picker Compatta */}
                                    <input
                                        type="file"
                                        id="excel-survey-upload-input"
                                        accept=".xlsx, .xls"
                                        style={{ display: "none" }}
                                        onChange={handleExcelFileChange}
                                        disabled={excelLoading || submitting}
                                    />

                                    {!excelFile ? (
                                        <label htmlFor="excel-survey-upload-input" style={{ width: "100%" }}>
                                            <Button
                                                variant="outlined"
                                                component="span"
                                                fullWidth
                                                size="medium"
                                                disabled={excelLoading || submitting}
                                                startIcon={<CloudUploadIcon />}
                                                sx={{
                                                    py: 1.2,
                                                    color: OHEL_GREEN,
                                                    borderColor: "#b6d4c4",
                                                    backgroundColor: "#fafcfa",
                                                    textTransform: "none",
                                                    fontWeight: 700,
                                                    fontSize: "0.85rem",
                                                    borderRadius: "12px",
                                                    borderStyle: "dashed",
                                                    borderWidth: "1.5px",
                                                    "&:hover": { borderColor: OHEL_GREEN, backgroundColor: "#f0f7f3" }
                                                }}
                                            >
                                                Scegli File Excel (.xlsx)
                                            </Button>
                                        </label>
                                    ) : (
                                        <Stack spacing={1.2}>
                                            <Paper
                                                variant="outlined"
                                                sx={{
                                                    p: 1.2,
                                                    px: 1.5,
                                                    borderRadius: "12px",
                                                    backgroundColor: "#f2f8f4",
                                                    borderColor: OHEL_GREEN,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "space-between",
                                                    gap: 1
                                                }}
                                            >
                                                <Box display="flex" alignItems="center" gap={1} minWidth={0}>
                                                    <TableChartIcon sx={{ color: OHEL_GREEN, fontSize: "1.2rem", flexShrink: 0 }} />
                                                    <Box minWidth={0}>
                                                        <Typography
                                                            variant="body2"
                                                            fontWeight="700"
                                                            noWrap
                                                            sx={{ color: OHEL_TEXT_DARK, fontSize: "0.82rem" }}
                                                        >
                                                            {excelFile.name}
                                                        </Typography>
                                                        <Typography variant="caption" sx={{ color: "#64748b", fontSize: "0.72rem" }}>
                                                            {(excelFile.size / 1024).toFixed(1)} KB
                                                        </Typography>
                                                    </Box>
                                                </Box>

                                                <label htmlFor="excel-survey-upload-input">
                                                    <Button
                                                        component="span"
                                                        size="small"
                                                        variant="text"
                                                        disabled={excelLoading || submitting}
                                                        sx={{ color: OHEL_SAGE, textTransform: "none", fontSize: "0.75rem", fontWeight: 700, minWidth: "auto", p: 0.5 }}
                                                    >
                                                        Cambia
                                                    </Button>
                                                </label>
                                            </Paper>

                                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                                                <Button
                                                    variant="contained"
                                                    fullWidth
                                                    size="small"
                                                    onClick={handleParseExcel}
                                                    disabled={excelLoading || submitting}
                                                    startIcon={excelLoading ? <CircularProgress size={16} color="inherit" /> : <AutoFixHighIcon />}
                                                    sx={{
                                                        py: 1,
                                                        backgroundColor: OHEL_SAGE,
                                                        color: "#ffffff",
                                                        textTransform: "none",
                                                        fontWeight: 700,
                                                        fontSize: "0.82rem",
                                                        borderRadius: "10px",
                                                        "&:hover": { backgroundColor: "#3e5c54" }
                                                    }}
                                                >
                                                    {excelLoading ? "Elaborazione..." : "Compila Modulo"}
                                                </Button>

                                                <Button
                                                    variant="contained"
                                                    fullWidth
                                                    size="small"
                                                    onClick={handleDirectImportClick}
                                                    disabled={excelLoading || submitting}
                                                    startIcon={excelLoading ? <CircularProgress size={16} color="inherit" /> : <CheckCircleOutlineIcon />}
                                                    sx={{
                                                        py: 1,
                                                        backgroundColor: OHEL_GREEN,
                                                        color: "#ffffff",
                                                        textTransform: "none",
                                                        fontWeight: 800,
                                                        fontSize: "0.82rem",
                                                        borderRadius: "10px",
                                                        "&:hover": { backgroundColor: "#1e382b" }
                                                    }}
                                                >
                                                    {excelLoading ? "Salvataggio..." : "Salva nel DB"}
                                                </Button>
                                            </Stack>
                                        </Stack>
                                    )}

                                    {/* Feedback successo compatto */}
                                    {excelSuccessNotice && (
                                        <Alert severity="success" sx={{ py: 0.5, borderRadius: "10px", fontSize: "0.8rem", fontWeight: 600 }}>
                                            {excelSuccessNotice}
                                        </Alert>
                                    )}
                                </CardContent>
                            </Card>
                        )}

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
                                backgroundColor: isEditing ? OHEL_TEAL : OHEL_GREEN,
                                boxShadow: "0 4px 12px rgba(46, 91, 67, 0.2)",
                                "&:hover": { backgroundColor: isEditing ? "#115e59" : "#1e382b" }
                            }}
                        >
                            {submitting
                                ? (isEditing ? "Salvataggio in corso..." : "Pubblicazione in corso...")
                                : (isEditing ? "Salva Modifiche al Sondaggio →" : "Pubblica Sondaggio Presenze →")}
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

            {/* DIALOG DI AVVISO DISATTIVAZIONE VECCHI SONDAGGI (IMPORTAZIONE DIRETTA EXCEL) */}
            <Dialog
                open={directImportConfirmOpen}
                onClose={() => !excelLoading && setDirectImportConfirmOpen(false)}
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
                        Stai per importare e pubblicare direttamente il nuovo sondaggio dal file <strong>"{excelFile?.name}"</strong>.
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
                        Procedendo, i vecchi sondaggi attivi verranno automaticamente disattivati e il nuovo questionario sarà subito fruibile dai soci.
                    </Typography>

                    <Typography variant="caption" sx={{ color: OHEL_SAGE, fontSize: "0.78rem", display: "block", fontStyle: "italic", backgroundColor: "#f4f7f5", p: 1, borderRadius: "8px" }}>
                        💡 Potrai comunque riabilitare qualsiasi sondaggio disattivato dal <strong>Pannello di Gestione Sondaggi</strong>.
                    </Typography>
                </DialogContent>

                <DialogActions sx={{ p: 2, gap: 1 }}>
                    <Button
                        onClick={() => setDirectImportConfirmOpen(false)}
                        disabled={excelLoading}
                        sx={{ color: OHEL_SAGE, fontWeight: 700, textTransform: "none" }}
                    >
                        Annulla
                    </Button>

                    <Button
                        variant="contained"
                        onClick={executeDirectImportExcel}
                        disabled={excelLoading}
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
                        {excelLoading ? "Salvataggio..." : "Conferma e Salva nel DB →"}
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