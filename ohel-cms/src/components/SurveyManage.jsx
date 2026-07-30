import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import CONFIG from "../config/config";
import HeaderCompact from "./HeaderCompact";
import Footer from "../components/Footer";
import { getCache, setCache, clearCachePattern, clearAllCache } from "../utils/cacheManager";
import LoadingScreen from "./LoadingScreen";
import MessageDialog from "./MessageDialog";

// Importazioni Material-UI
import {
    Box,
    Container,
    Card,
    CardContent,
    Typography,
    Button,
    Stack,
    Chip,
    Switch,
    FormControlLabel,
    TextField,
    InputAdornment,
    Divider,
    Paper,
    Snackbar,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    useMediaQuery,
    useTheme
} from "@mui/material";
import TuneIcon from "@mui/icons-material/Tune";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import SearchIcon from "@mui/icons-material/Search";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import AssessmentIcon from "@mui/icons-material/Assessment";
import SaveIcon from "@mui/icons-material/Save";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import RestoreFromTrashIcon from "@mui/icons-material/RestoreFromTrash";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";

// Palette cromatica Associazione Ohel
const OHEL_GREEN = "#2e5b43";
const OHEL_SAGE = "#52796f";
const OHEL_TEAL = "#0f766e";
const OHEL_PURPLE = "#6b5b95";
const OHEL_LIGHT_GREEN = "#f4f7f5";
const OHEL_TEXT_DARK = "#1e382b";
const OHEL_ORANGE = "#e65f2b";

function SurveyManage() {
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    // Stato server originale di riferimento
    const [initialSurveys, setInitialSurveys] = useState([]);
    // Stato locale React modificabile
    const [surveys, setSurveys] = useState([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState("ALL"); // "ALL", "ACTIVE", "DISABLED"

    const [dialog, setDialog] = useState({ open: false, title: "", message: "", severity: "info" });
    const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

    const { URL_APPS_SCRIPT } = CONFIG;

    const showDialog = (title, message, severity = "info") => {
        setDialog({ open: true, title, message, severity });
    };

    const handleLogout = useCallback(() => {
        clearAllCache();
        localStorage.removeItem("authToken");
        localStorage.removeItem("userProfile");
        navigate("/", { replace: true });
    }, [navigate]);

    const caricaTuttiSondaggi = useCallback(async () => {
        const storedUserProfile = localStorage.getItem("userProfile");
        if (!storedUserProfile) {
            handleLogout();
            return;
        }
        const currentUser = JSON.parse(storedUserProfile);

        // Caricamento istantaneo da cache
        const cachedSurveys = getCache(`surveys_manage_admin`);
        if (cachedSurveys && cachedSurveys.data) {
            const parsedCache = cachedSurveys.data.map(s => ({ ...s, pendingDelete: false }));
            setInitialSurveys(parsedCache);
            setSurveys(parsedCache);
            setLoading(false);
        }

        try {
            const response = await fetch(
                `${URL_APPS_SCRIPT}?action=GET_ALL_SURVEYS&email=${encodeURIComponent(currentUser.email)}`,
                { method: "GET", mode: "cors" }
            );
            const data = await response.json();

            if (data.status === "success" && data.surveys) {
                const processedSurveys = data.surveys.map(s => ({
                    ...s,
                    active: s.status ? s.status === "ATTIVO" : (s.active !== undefined ? Boolean(s.active) : true),
                    pendingDelete: false
                }));
                setInitialSurveys(processedSurveys);
                setSurveys(processedSurveys);
                setCache(`surveys_manage_admin`, processedSurveys, 5 * 60 * 1000);
            } else {
                const fallbackRes = await fetch(
                    `${URL_APPS_SCRIPT}?action=GET_ACTIVE_SURVEYS&email=${encodeURIComponent(currentUser.email)}`,
                    { method: "GET", mode: "cors" }
                );
                const fallbackData = await fallbackRes.json();
                if (fallbackData.status === "success" && fallbackData.surveys) {
                    const processed = fallbackData.surveys.map(s => ({
                        ...s,
                        active: s.status ? s.status === "ATTIVO" : (s.active !== undefined ? Boolean(s.active) : true),
                        pendingDelete: false
                    }));
                    setInitialSurveys(processed);
                    setSurveys(processed);
                    setCache(`surveys_manage_admin`, processed, 5 * 60 * 1000);
                }
            }
        } catch (err) {
            console.error("Errore nel caricamento dei sondaggi:", err);
        } finally {
            setLoading(false);
        }
    }, [URL_APPS_SCRIPT, handleLogout]);

    useEffect(() => {
        const storedUser = localStorage.getItem("userProfile");
        if (!storedUser || !JSON.parse(storedUser).isAdmin) {
            console.warn("Accesso negato: riservato agli amministratori.");
            navigate("/dashboard", { replace: true });
            return;
        }

        caricaTuttiSondaggi();
    }, [navigate, caricaTuttiSondaggi]);

    // Modifica SOLO dello stato locale React per lo switch
    const handleToggleLocalStatus = (idSondaggio) => {
        setSurveys(prev =>
            prev.map(s => {
                if (s.idSondaggio === idSondaggio) {
                    const newActiveState = !s.active;
                    return {
                        ...s,
                        active: newActiveState,
                        status: newActiveState ? "ATTIVO" : "DISATTIVATO"
                    };
                }
                return s;
            })
        );
    };

    // Segna/desegna un sondaggio per l'eliminazione locale
    const handleToggleLocalDelete = (idSondaggio) => {
        setSurveys(prev =>
            prev.map(s => {
                if (s.idSondaggio === idSondaggio) {
                    return { ...s, pendingDelete: !s.pendingDelete };
                }
                return s;
            })
        );
    };

    // Sondaggi contrassegnati per l'eliminazione
    const pendingDeleteSurveys = useMemo(() => {
        return surveys.filter(s => s.pendingDelete);
    }, [surveys]);

    // Sondaggi con modifica di stato attivo/disattivato
    const modifiedStatusSurveys = useMemo(() => {
        const initialMap = new Map(initialSurveys.map(s => [s.idSondaggio, s.active]));
        return surveys.filter(s => {
            if (s.pendingDelete) return false;
            const origActive = initialMap.get(s.idSondaggio);
            return origActive !== undefined && origActive !== s.active;
        });
    }, [initialSurveys, surveys]);

    const hasUnsavedChanges = pendingDeleteSurveys.length > 0 || modifiedStatusSurveys.length > 0;

    // Annullamento di tutte le modifiche locali
    const handleDiscardChanges = () => {
        setSurveys(initialSurveys.map(s => ({ ...s, pendingDelete: false })));
    };

    // Gestione del click sul pulsante "Salva Modifiche"
    const handleSaveClick = () => {
        if (pendingDeleteSurveys.length > 0) {
            setDeleteConfirmOpen(true);
        } else {
            executeSaveAll();
        }
    };

    // Esecuzione salvataggio effettivo nel DB (disattivazione/attivazione ed eliminazione fisica)
    const executeSaveAll = async () => {
        setDeleteConfirmOpen(false);
        setSaving(true);
        const idToken = localStorage.getItem("authToken");

        let hasError = false;

        try {
            // 1. Esecuzione eliminazioni sondaggi nel DB (DELETE_SURVEY)
            for (const delSurvey of pendingDeleteSurveys) {
                try {
                    const response = await fetch(URL_APPS_SCRIPT, {
                        method: "POST",
                        mode: "cors",
                        body: JSON.stringify({
                            action: "DELETE_SURVEY",
                            token: idToken,
                            payload: { idSondaggio: delSurvey.idSondaggio }
                        })
                    });

                    const data = await response.json();
                    if (data.status !== "success") {
                        console.error(`[DELETE_SURVEY] Errore dal server per ${delSurvey.idSondaggio}:`, data.message);
                        hasError = true;
                    }
                } catch (err) {
                    console.error(`Errore nell'eliminazione del sondaggio ${delSurvey.idSondaggio}:`, err);
                    hasError = true;
                }
            }

            // 2. Esecuzione cambi di stato nel DB per quelli non eliminati (TOGGLE_SURVEY_STATUS)
            for (const modified of modifiedStatusSurveys) {
                try {
                    const newStatusString = modified.active ? "ATTIVO" : "DISATTIVATO";
                    const response = await fetch(URL_APPS_SCRIPT, {
                        method: "POST",
                        mode: "cors",
                        body: JSON.stringify({
                            action: "TOGGLE_SURVEY_STATUS",
                            token: idToken,
                            payload: {
                                idSondaggio: modified.idSondaggio,
                                newStatus: newStatusString
                            }
                        })
                    });

                    const data = await response.json();
                    if (data.status !== "success") {
                        console.error(`[TOGGLE_SURVEY_STATUS] Errore per ${modified.idSondaggio}:`, data.message);
                        hasError = true;
                    }
                } catch (err) {
                    console.error(`Errore modifica stato sondaggio ${modified.idSondaggio}:`, err);
                    hasError = true;
                }
            }

            // 3. Calcolo nuovo stato ed aggiornamento della cache
            const remainingSurveys = surveys
                .filter(s => !s.pendingDelete)
                .map(s => ({ ...s, pendingDelete: false }));

            setInitialSurveys(remainingSurveys);
            setSurveys(remainingSurveys);
            setCache(`surveys_manage_admin`, remainingSurveys, 5 * 60 * 1000);
            clearCachePattern("surveys");

            if (hasError) {
                showDialog("Attenzione", "Alcune modifiche potrebbero non essere state salvate correttamente sul server. Ricarica la pagina per verificare.", "warning");
            } else {
                setSnackbar({
                    open: true,
                    message: pendingDeleteSurveys.length > 0
                        ? "🗑️ Sondaggio ed intero storico risposte eliminati definitivamente con successo!"
                        : "💾 Modifiche salvate nel database con successo!",
                    severity: "success"
                });
            }
        } catch (err) {
            console.error("Errore durante il salvataggio nel DB:", err);
            showDialog("Errore Salvataggio", "Impossibile completare le operazioni nel database. Riprova più tardi.", "error");
        } finally {
            setSaving(false);
        }
    };

    const filteredSurveys = surveys.filter(s => {
        const matchesSearch = s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (s.description && s.description.toLowerCase().includes(searchTerm.toLowerCase()));

        if (filterStatus === "ACTIVE") return matchesSearch && s.active;
        if (filterStatus === "DISABLED") return matchesSearch && !s.active;
        return matchesSearch;
    });

    const getCleanSurveyId = (fullId) => fullId.replace("SURV_", "");

    if (loading) {
        return <LoadingScreen message="Caricamento sondaggi dal database..." color={OHEL_TEAL} />;
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh", backgroundColor: OHEL_LIGHT_GREEN, pt: "80px", boxSizing: "border-box" }}>
            <HeaderCompact subtitle="Gestione Sondaggi" onLogout={handleLogout} />

            <Container maxWidth="md" sx={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 2.5, mt: 1, mb: hasUnsavedChanges ? 10 : 5, px: { xs: 2, sm: 3 } }}>

                {/* PULSANTE TORNA ALLA DASHBOARD */}
                <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Button
                        startIcon={<ArrowBackIcon />}
                        onClick={() => navigate("/dashboard")}
                        sx={{
                            color: OHEL_SAGE,
                            fontWeight: 700,
                            textTransform: "none",
                            fontSize: "0.88rem",
                            "&:hover": { backgroundColor: "rgba(82, 121, 111, 0.08)" }
                        }}
                    >
                        Torna alla Dashboard
                    </Button>

                    <Button
                        variant="contained"
                        size="small"
                        onClick={() => navigate("/surveys/edit")}
                        sx={{
                            backgroundColor: OHEL_TEAL,
                            color: "#ffffff",
                            borderRadius: "10px",
                            fontWeight: 700,
                            textTransform: "none",
                            px: 2,
                            boxShadow: "0 2px 8px rgba(15, 118, 110, 0.2)",
                            "&:hover": { backgroundColor: "#115e59" }
                        }}
                    >
                        + Nuovo Sondaggio
                    </Button>
                </Box>

                {/* INTESTAZIONE PAGINA */}
                <Card sx={{ borderRadius: "20px", border: "1px solid #e1ebe5", backgroundColor: "#ffffff", boxShadow: "0 4px 16px rgba(15, 118, 110, 0.05)" }}>
                    <CardContent sx={{ p: 2.5 }}>
                        <Stack direction="row" alignItems="center" gap={1.2} mb={1}>
                            <Box sx={{ backgroundColor: "#ccfbf1", p: 1, borderRadius: "10px", display: "flex" }}>
                                <TuneIcon sx={{ color: OHEL_TEAL, fontSize: "1.4rem" }} />
                            </Box>
                            <Typography variant="h6" fontWeight="800" sx={{ color: OHEL_TEXT_DARK, lineHeight: 1.2 }}>
                                Pannello Gestione Sondaggi
                            </Typography>
                        </Stack>
                        <Typography variant="body2" sx={{ color: "#64748b", fontSize: "0.88rem", lineHeight: 1.4 }}>
                            Abilita, disabilita o rimuovi definitivamente i sondaggi ed il loro storico dal database dell'Associazione. Le modifiche rimangono locali finché non clicchi su <strong>Salva Modifiche</strong>.
                        </Typography>
                    </CardContent>
                </Card>

                {/* BARRA RICERCA E FILTRI */}
                <Box display="flex" flexDirection={{ xs: "column", sm: "row" }} gap={1.5} alignItems="center" justifyContent="space-between">
                    <TextField
                        placeholder="Cerca sondaggio..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        size="small"
                        fullWidth
                        sx={{
                            backgroundColor: "#ffffff",
                            borderRadius: "12px",
                            "& .MuiOutlinedInput-root": { borderRadius: "12px" }
                        }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon sx={{ color: OHEL_SAGE, fontSize: "1.2rem" }} />
                                </InputAdornment>
                            ),
                        }}
                    />

                    <Stack direction="row" gap={1} flexShrink={0}>
                        <Chip
                            label={`Tutti (${surveys.length})`}
                            onClick={() => setFilterStatus("ALL")}
                            color={filterStatus === "ALL" ? "primary" : "default"}
                            variant={filterStatus === "ALL" ? "filled" : "outlined"}
                            sx={{ fontWeight: 700, borderRadius: "8px", backgroundColor: filterStatus === "ALL" ? OHEL_TEAL : "transparent" }}
                        />
                        <Chip
                            label={`Attivi (${surveys.filter(s => s.active && !s.pendingDelete).length})`}
                            onClick={() => setFilterStatus("ACTIVE")}
                            color={filterStatus === "ACTIVE" ? "success" : "default"}
                            variant={filterStatus === "ACTIVE" ? "filled" : "outlined"}
                            sx={{ fontWeight: 700, borderRadius: "8px" }}
                        />
                        <Chip
                            label={`Disabilitati (${surveys.filter(s => !s.active && !s.pendingDelete).length})`}
                            onClick={() => setFilterStatus("DISABLED")}
                            color={filterStatus === "DISABLED" ? "error" : "default"}
                            variant={filterStatus === "DISABLED" ? "filled" : "outlined"}
                            sx={{ fontWeight: 700, borderRadius: "8px" }}
                        />
                    </Stack>
                </Box>

                {/* ELENCO SONDAGGI */}
                <Stack gap={2}>
                    {filteredSurveys.length > 0 ? (
                        filteredSurveys.map((survey) => {
                            const initialMap = new Map(initialSurveys.map(s => [s.idSondaggio, s.active]));
                            const isStatusModified = initialMap.has(survey.idSondaggio) && initialMap.get(survey.idSondaggio) !== survey.active;
                            const isPendingDelete = survey.pendingDelete;

                            let borderStyle = "1px solid #e1ebe5";
                            let borderLeftColor = survey.active ? OHEL_GREEN : "#94a3b8";
                            let bgColor = survey.active ? "#ffffff" : "#f8fafc";
                            let shadow = "0 4px 14px rgba(0,0,0,0.03)";

                            if (isPendingDelete) {
                                borderStyle = "2px solid #ef4444";
                                borderLeftColor = "#dc2626";
                                bgColor = "#fef2f2";
                                shadow = "0 4px 16px rgba(239, 68, 68, 0.15)";
                            } else if (isStatusModified) {
                                borderStyle = `2px solid ${OHEL_ORANGE}`;
                                shadow = "0 4px 16px rgba(230, 95, 43, 0.15)";
                            }

                            return (
                                <Card
                                    key={survey.idSondaggio}
                                    sx={{
                                        borderRadius: "18px",
                                        border: borderStyle,
                                        borderLeft: `6px solid ${borderLeftColor}`,
                                        backgroundColor: bgColor,
                                        boxShadow: shadow,
                                        transition: "all 0.2s ease"
                                    }}
                                >
                                    <CardContent sx={{ p: 2.2, "&:last-child": { pb: 2.2 } }}>
                                        <Box display="flex" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" gap={1.5} mb={1}>
                                            <Box flex={1} minWidth="220px">
                                                <Stack direction="row" alignItems="center" gap={1} mb={0.5} flexWrap="wrap">
                                                    <Typography
                                                        variant="subtitle1"
                                                        fontWeight="800"
                                                        sx={{
                                                            color: isPendingDelete ? "#991b1b" : (survey.active ? OHEL_TEXT_DARK : "#64748b"),
                                                            fontSize: "1rem",
                                                            textDecoration: isPendingDelete ? "line-through" : "none"
                                                        }}
                                                    >
                                                        {survey.title}
                                                    </Typography>

                                                    {!isPendingDelete && (
                                                        <Chip
                                                            icon={survey.active ? <CheckCircleIcon style={{ fontSize: 13 }} /> : <CancelIcon style={{ fontSize: 13 }} />}
                                                            label={survey.active ? "Attivo" : "Disabilitato"}
                                                            size="small"
                                                            sx={{
                                                                height: 22,
                                                                backgroundColor: survey.active ? "#dcfce7" : "#f1f5f9",
                                                                color: survey.active ? "#15803d" : "#64748b",
                                                                fontWeight: 700,
                                                                fontSize: "0.72rem",
                                                                borderRadius: "6px"
                                                            }}
                                                        />
                                                    )}

                                                    {isPendingDelete && (
                                                        <Chip
                                                            label="In Eliminazione"
                                                            size="small"
                                                            sx={{
                                                                height: 22,
                                                                backgroundColor: "#fee2e2",
                                                                color: "#991b1b",
                                                                fontWeight: 800,
                                                                fontSize: "0.70rem",
                                                                borderRadius: "6px"
                                                            }}
                                                        />
                                                    )}

                                                    {!isPendingDelete && isStatusModified && (
                                                        <Chip
                                                            label="Modificato"
                                                            size="small"
                                                            sx={{
                                                                height: 22,
                                                                backgroundColor: "#ffedd5",
                                                                color: "#c2410c",
                                                                fontWeight: 800,
                                                                fontSize: "0.70rem",
                                                                borderRadius: "6px"
                                                            }}
                                                        />
                                                    )}
                                                </Stack>

                                                {survey.description && (
                                                    <Typography variant="body2" sx={{ color: isPendingDelete ? "#7f1d1d" : "#64748b", fontSize: "0.85rem", lineHeight: 1.35, mb: 1 }}>
                                                        {survey.description}
                                                    </Typography>
                                                )}
                                            </Box>

                                            {/* INTERRUTTORE STATO LOCALE */}
                                            {!isPendingDelete && (
                                                <Box display="flex" alignItems="center" gap={1} sx={{ backgroundColor: isStatusModified ? "#fff7ed" : "#f1f5f9", p: 0.8, px: 1.5, borderRadius: "12px", border: isStatusModified ? "1px solid #ffedd5" : "none" }}>
                                                    <FormControlLabel
                                                        control={
                                                            <Switch
                                                                checked={survey.active}
                                                                onChange={() => handleToggleLocalStatus(survey.idSondaggio)}
                                                                color="success"
                                                                size="small"
                                                            />
                                                        }
                                                        label={
                                                            <Typography variant="caption" fontWeight="800" sx={{ color: survey.active ? "#15803d" : "#64748b", fontSize: "0.78rem" }}>
                                                                {survey.active ? "Abilitato" : "Disabilitato"}
                                                            </Typography>
                                                        }
                                                        sx={{ m: 0 }}
                                                    />
                                                </Box>
                                            )}
                                        </Box>

                                        <Divider sx={{ my: 1.5 }} />

                                        {/* PIÈ DI CARD CON INFO DATE ED AZIONI */}
                                        <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                                            <Chip
                                                icon={<CalendarMonthIcon style={{ fontSize: 14, color: OHEL_SAGE }} />}
                                                label={survey.dates ? `${survey.dates.length} date configurate` : "Date configurate"}
                                                variant="outlined"
                                                size="small"
                                                sx={{ height: 24, borderColor: "#cbd5e1", color: "#475569", fontWeight: 600, fontSize: "0.75rem" }}
                                            />

                                            <Stack direction="row" gap={1}>
                                                <Button
                                                    variant="outlined"
                                                    size="small"
                                                    startIcon={<AssessmentIcon style={{ fontSize: 15 }} />}
                                                    onClick={() => navigate(`/surveys/results/${getCleanSurveyId(survey.idSondaggio)}`)}
                                                    sx={{
                                                        height: 30,
                                                        borderRadius: "8px",
                                                        textTransform: "none",
                                                        fontWeight: 700,
                                                        borderColor: OHEL_PURPLE,
                                                        color: OHEL_PURPLE,
                                                        fontSize: "0.76rem",
                                                        "&:hover": { backgroundColor: "#f3e8ff", borderColor: "#52467b" }
                                                    }}
                                                >
                                                    Risultati
                                                </Button>

                                                <Button
                                                    variant="outlined"
                                                    color={isPendingDelete ? "info" : "error"}
                                                    size="small"
                                                    startIcon={isPendingDelete ? <RestoreFromTrashIcon style={{ fontSize: 15 }} /> : <DeleteOutlineIcon style={{ fontSize: 15 }} />}
                                                    onClick={() => handleToggleLocalDelete(survey.idSondaggio)}
                                                    sx={{
                                                        height: 30,
                                                        borderRadius: "8px",
                                                        textTransform: "none",
                                                        fontWeight: 700,
                                                        fontSize: "0.76rem"
                                                    }}
                                                >
                                                    {isPendingDelete ? "Ripristina" : "Elimina"}
                                                </Button>
                                            </Stack>
                                        </Box>
                                    </CardContent>
                                </Card>
                            );
                        })
                    ) : (
                        <Card sx={{ borderRadius: "18px", border: "1px dashed #cbd5e1", backgroundColor: "#ffffff" }}>
                            <CardContent sx={{ p: 4, textAlign: "center" }}>
                                <TuneIcon sx={{ fontSize: 40, color: OHEL_SAGE, mb: 1, opacity: 0.6 }} />
                                <Typography variant="subtitle1" fontWeight="700" sx={{ color: OHEL_TEXT_DARK, mb: 0.5 }}>
                                    Nessun sondaggio trovato
                                </Typography>
                                <Typography variant="caption" sx={{ color: "#64748b" }}>
                                    Non ci sono sondaggi corrispettivi ai filtri selezionati.
                                </Typography>
                            </CardContent>
                        </Card>
                    )}
                </Stack>

            </Container>

            {/* FLOATING ACTION BAR IN FONDO ALLA PAGINA */}
            {hasUnsavedChanges && (
                <Paper
                    elevation={8}
                    sx={{
                        position: "fixed",
                        bottom: 24,
                        left: "50%",
                        transform: "translateX(-50%)",
                        zIndex: 1300,
                        borderRadius: "20px",
                        py: 1.2,
                        px: { xs: 2, sm: 2.5 },
                        backgroundColor: "#ffffff",
                        border: `1.5px solid ${pendingDeleteSurveys.length > 0 ? "#ef4444" : OHEL_ORANGE}`,
                        boxShadow: pendingDeleteSurveys.length > 0
                            ? "0 10px 30px rgba(239, 68, 68, 0.25)"
                            : "0 10px 30px rgba(230, 95, 43, 0.25)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: { xs: 1, sm: 2 },
                        width: { xs: "calc(100% - 32px)", sm: "auto" },
                        maxWidth: "600px",
                        boxSizing: "border-box"
                    }}
                >
                    <Box display="flex" alignItems="center" gap={1} sx={{ minWidth: 0 }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: pendingDeleteSurveys.length > 0 ? "#dc2626" : OHEL_ORANGE, flexShrink: 0 }} />
                        <Typography
                            variant="body2"
                            fontWeight="800"
                            sx={{
                                color: OHEL_TEXT_DARK,
                                fontSize: { xs: "0.78rem", sm: "0.88rem" },
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis"
                            }}
                        >
                            {pendingDeleteSurveys.length > 0
                                ? `${pendingDeleteSurveys.length} ${pendingDeleteSurveys.length === 1 ? "sondaggio da eliminare" : "sondaggi da eliminare"}`
                                : `${modifiedStatusSurveys.length} ${modifiedStatusSurveys.length === 1 ? "modifica non salvata" : "modifiche non salvate"}`}
                        </Typography>
                    </Box>

                    <Stack direction="row" gap={{ xs: 0.5, sm: 1 }} alignItems="center" flexShrink={0}>
                        <Button
                            size="small"
                            startIcon={<RestartAltIcon fontSize="small" />}
                            onClick={handleDiscardChanges}
                            disabled={saving}
                            sx={{ color: OHEL_SAGE, textTransform: "none", fontWeight: 700, px: { xs: 0.8, sm: 1.2 }, fontSize: { xs: "0.75rem", sm: "0.82rem" } }}
                        >
                            Annulla
                        </Button>

                        <Button
                            variant="contained"
                            size="small"
                            startIcon={<SaveIcon fontSize="small" />}
                            onClick={handleSaveClick}
                            disabled={saving}
                            sx={{
                                backgroundColor: pendingDeleteSurveys.length > 0 ? "#dc2626" : OHEL_ORANGE,
                                color: "#ffffff",
                                fontWeight: 800,
                                textTransform: "none",
                                borderRadius: "12px",
                                px: { xs: 1.5, sm: 2.2 },
                                py: 0.8,
                                fontSize: { xs: "0.78rem", sm: "0.85rem" },
                                boxShadow: pendingDeleteSurveys.length > 0
                                    ? "0 4px 14px rgba(220, 38, 38, 0.35)"
                                    : "0 4px 14px rgba(230, 95, 43, 0.35)",
                                "&:hover": { backgroundColor: pendingDeleteSurveys.length > 0 ? "#b91c1c" : "#c84e1d" }
                            }}
                        >
                            {saving ? "Salvataggio..." : "Salva Modifiche"}
                        </Button>
                    </Stack>
                </Paper>
            )}

            {/* DIALOG BOX DI CONFERMA ELIMINAZIONE ADATTATA ALLA LARGHEZZA DELLO SCHERMO */}
            <Dialog
                open={deleteConfirmOpen}
                onClose={() => !saving && setDeleteConfirmOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: "20px",
                        p: { xs: 0.5, sm: 1 },
                        m: { xs: 2, sm: 3 },
                        width: { xs: "calc(100% - 32px)", sm: "auto" }
                    }
                }}
            >
                <DialogTitle sx={{ fontWeight: 800, color: "#991b1b", display: "flex", alignItems: "center", gap: 1.2, pb: 1, fontSize: { xs: "1.1rem", sm: "1.25rem" } }}>
                    <ReportProblemIcon sx={{ color: "#dc2626", fontSize: { xs: "1.5rem", sm: "1.8rem" } }} />
                    Eliminazione Sondaggio
                </DialogTitle>

                <DialogContent dividers sx={{ py: 2, px: { xs: 2, sm: 3 } }}>
                    <Typography variant="body2" sx={{ color: "#334155", lineHeight: 1.5, mb: 1.5, fontSize: { xs: "0.82rem", sm: "0.88rem" } }}>
                        Stai per rimuovere definitivamente dal database i seguenti sondaggi insieme a <strong>TUTTI i voti e le risposte registrate dai soci</strong>:
                    </Typography>

                    <Box sx={{ backgroundColor: "#fef2f2", p: 1.5, borderRadius: "12px", border: "1px solid #fecaca", mb: 2 }}>
                        {pendingDeleteSurveys.map((survey) => (
                            <Typography key={survey.idSondaggio} variant="body2" fontWeight="800" sx={{ color: "#991b1b", fontSize: { xs: "0.82rem", sm: "0.88rem" } }}>
                                • {survey.title}
                            </Typography>
                        ))}
                    </Box>

                    <Alert severity="error" icon={false} sx={{ borderRadius: "12px", fontSize: { xs: "0.78rem", sm: "0.82rem" }, fontWeight: 700, backgroundColor: "#fee2e2", color: "#991b1b" }}>
                        ⚠️ Questa azione è completamente IRREVERSIBILE e non potrà essere annullata in seguito.
                    </Alert>
                </DialogContent>

                <DialogActions sx={{ p: { xs: 2, sm: 2.5 }, gap: 1, flexDirection: { xs: "column-reverse", sm: "row" }, justifyContent: "flex-end" }}>
                    <Button
                        onClick={() => setDeleteConfirmOpen(false)}
                        disabled={saving}
                        fullWidth={isMobile}
                        sx={{ color: OHEL_SAGE, fontWeight: 700, textTransform: "none", py: { xs: 1, sm: 0.8 } }}
                    >
                        Annulla
                    </Button>

                    <Button
                        variant="contained"
                        color="error"
                        onClick={executeSaveAll}
                        disabled={saving}
                        fullWidth={isMobile}
                        sx={{
                            backgroundColor: "#dc2626",
                            color: "#ffffff",
                            borderRadius: "10px",
                            fontWeight: 800,
                            textTransform: "none",
                            px: 2.2,
                            py: { xs: 1, sm: 0.8 },
                            boxShadow: "0 4px 12px rgba(220, 38, 38, 0.3)",
                            "&:hover": { backgroundColor: "#b91c1c" }
                        }}
                    >
                        {saving ? "Eliminazione..." : "Conferma ed Elimina Definitivamente"}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            >
                <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%', borderRadius: "12px", fontWeight: 700 }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>

            <MessageDialog
                open={dialog.open}
                onClose={() => setDialog(prev => ({ ...prev, open: false }))}
                title={dialog.title}
                message={dialog.message}
                severity={dialog.severity}
            />

            <Footer />
        </Box>
    );
}

export default SurveyManage;