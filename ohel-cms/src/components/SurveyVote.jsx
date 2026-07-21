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
    ListItem,
    IconButton,
    Tabs,
    Tab
} from "@mui/material";
import RestaurantIcon from "@mui/icons-material/Restaurant";
import BlockIcon from "@mui/icons-material/Block";
import EditIcon from "@mui/icons-material/Edit";
import RateReviewIcon from "@mui/icons-material/RateReview";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PersonIcon from "@mui/icons-material/Person";
import InfoIcon from "@mui/icons-material/Info";

// Palette cromatica Associazione Ohel
const OHEL_GREEN = "#2e5b43";
const OHEL_SAGE = "#52796f";
const OHEL_OCHRE = "#d9922b";
const OHEL_LIGHT_GREEN = "#f4f7f5";
const OHEL_TEXT_DARK = "#1e382b";
const OHEL_BLUE = "#2a6f97";

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
    const [isReadOnly, setIsReadOnly] = useState(false);

    // Info su eventuale delegato (se compilato da un altro familiare)
    const [compiledByInfo, setCompiledByInfo] = useState(null);

    // Step: 0: Gestione Membri Gruppo, 1: Turni, 2: Alimentazione, 3: Note, 4: Riepilogo Finale
    const [step, setStep] = useState(0);

    // Membro corrente selezionato nell'interfaccia (indice dell'array members)
    const [activeMemberIdx, setActiveMemberIdx] = useState(0);

    // Array dei membri del nucleo (il primo è sempre l'utente titolare)
    const [members, setMembers] = useState([]);

    // Campi separati per l'aggiunta di un nuovo familiare
    const [newMemberFirstName, setNewMemberFirstName] = useState("");
    const [newMemberLastName, setNewMemberLastName] = useState("");

    // Risposte organizzate per ogni membro
    const [memberResponses, setMemberResponses] = useState({});

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
            const mainMemberName = `${currentUser.nome} ${currentUser.cognome}`.trim();

            try {
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
                    setMembers([mainMemberName]);

                    const initMemberData = (dates) => {
                        const sel = {};
                        const abs = {};
                        dates.forEach(d => {
                            sel[d.date] = [];
                            abs[d.date] = false;
                        });
                        return {
                            selections: sel,
                            absences: abs,
                            selectedIntolerances: [],
                            customIntolerance: "",
                            generalNotes: ""
                        };
                    };

                    const initialResponsesMap = {
                        [mainMemberName]: initMemberData(targetSurvey.dates)
                    };

                    if (targetSurvey.voted) {
                        setIsReadOnly(true);
                        const responseVotes = await fetch(`${URL_APPS_SCRIPT}?action=GET_USER_VOTES&email=${encodeURIComponent(currentUser.email)}&idSondaggio=SURV_${id}`, {
                            method: "GET",
                            mode: "cors"
                        });
                        const dataVotes = await responseVotes.json();

                        if (dataVotes.status === "success" && dataVotes.dataByMember) {
                            const retrievedMembers = Object.keys(dataVotes.dataByMember);
                            if (retrievedMembers.length > 0) {
                                setMembers(retrievedMembers);
                                setMemberResponses(dataVotes.dataByMember);
                            }

                            // Tracciamo se il sondaggio è stato inserito da un altro utente/capofamiglia
                            if (dataVotes.compiledForYouBy && dataVotes.compiledForYouBy.isDelegated) {
                                setCompiledByInfo(dataVotes.compiledForYouBy);
                            }
                        }
                    } else {
                        setMemberResponses(initialResponsesMap);
                    }

                } else {
                    alert("Errore nel recupero dati: " + data.message);
                }
            } catch (err) {
                console.error("Errore nel caricamento del sondaggio:", err);
                alert("Impossibile connettersi al server del backend.");
            } finally {
                setLoading(false);
            }
        };

        caricaDettagliESelezioni();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, URL_APPS_SCRIPT, navigate]);

    const handleLogout = () => {
        localStorage.removeItem("authToken");
        localStorage.removeItem("userProfile");
        navigate("/", { replace: true });
    };

    // Aggiunta membro con controllo obbligatorietà Nome e Cognome
    const handleAddMember = () => {
        const nomeTrimmed = newMemberFirstName.trim();
        const cognomeTrimmed = newMemberLastName.trim();

        if (!nomeTrimmed || !cognomeTrimmed) {
            alert("Per favore inserisci sia il Nome che il Cognome del familiare.");
            return;
        }

        const fullName = `${nomeTrimmed} ${cognomeTrimmed}`;

        if (members.includes(fullName)) {
            alert("Questo membro è già presente nell'elenco.");
            return;
        }

        const updatedMembers = [...members, fullName];
        setMembers(updatedMembers);

        const sel = {};
        const abs = {};
        survey.dates.forEach(d => {
            sel[d.date] = [];
            abs[d.date] = false;
        });

        setMemberResponses({
            ...memberResponses,
            [fullName]: {
                selections: sel,
                absences: abs,
                selectedIntolerances: [],
                customIntolerance: "",
                generalNotes: ""
            }
        });

        setNewMemberFirstName("");
        setNewMemberLastName("");
    };

    const handleRemoveMember = (name) => {
        if (members.indexOf(name) === 0) {
            alert("Non puoi rimuovere l'utente titolare del profilo.");
            return;
        }
        setMembers(members.filter(m => m !== name));
        const updatedResponses = { ...memberResponses };
        delete updatedResponses[name];
        setMemberResponses(updatedResponses);
        setActiveMemberIdx(0);
    };

    const handleSlotClick = (dateStr, slot) => {
        const currentMember = members[activeMemberIdx];
        const memberData = memberResponses[currentMember];

        const currentAbsences = { ...memberData.absences, [dateStr]: false };
        const currentSlots = memberData.selections[dateStr] || [];

        let updatedSlots = currentSlots.includes(slot)
            ? currentSlots.filter(s => s !== slot)
            : [...currentSlots, slot];

        setMemberResponses({
            ...memberResponses,
            [currentMember]: {
                ...memberData,
                absences: currentAbsences,
                selections: { ...memberData.selections, [dateStr]: updatedSlots }
            }
        });
    };

    const handleAbsenceClick = (dateStr) => {
        const currentMember = members[activeMemberIdx];
        const memberData = memberResponses[currentMember];
        const isCurrentlyAbsent = !!memberData.absences[dateStr];

        setMemberResponses({
            ...memberResponses,
            [currentMember]: {
                ...memberData,
                absences: { ...memberData.absences, [dateStr]: !isCurrentlyAbsent },
                selections: !isCurrentlyAbsent
                    ? { ...memberData.selections, [dateStr]: [] }
                    : memberData.selections
            }
        });
    };

    const handleIntoleranceChange = (option) => {
        const currentMember = members[activeMemberIdx];
        const memberData = memberResponses[currentMember] || {};
        const currentIntolerances = memberData.selectedIntolerances || [];

        let updated = [...currentIntolerances];
        if (updated.includes(option)) {
            updated = updated.filter(item => item !== option);
        } else {
            updated.push(option);
        }

        setMemberResponses({
            ...memberResponses,
            [currentMember]: {
                ...memberData,
                selectedIntolerances: updated
            }
        });
    };

    const handleCustomIntoleranceChange = (value) => {
        const currentMember = members[activeMemberIdx];
        const memberData = memberResponses[currentMember] || {};

        setMemberResponses({
            ...memberResponses,
            [currentMember]: {
                ...memberData,
                customIntolerance: value
            }
        });
    };

    const handleGeneralNotesChange = (value) => {
        const currentMember = members[activeMemberIdx];
        const memberData = memberResponses[currentMember] || {};

        setMemberResponses({
            ...memberResponses,
            [currentMember]: {
                ...memberData,
                generalNotes: value
            }
        });
    };

    const formatDateItalian = (dateValue) => {
        try {
            const dateObj = new Date(dateValue);
            return new Intl.DateTimeFormat("it-IT", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric"
            }).format(dateObj);
        } catch (e) {
            return dateValue;
        }
    };

    const handleNextStep = () => {
        const currentMember = members[activeMemberIdx];

        if (step === 0) {
            if (members.length === 0) {
                alert("Inserisci almeno un partecipante.");
                return;
            }
            setActiveMemberIdx(0);
            setStep(1);
        } else if (step === 1) {
            const mData = memberResponses[currentMember];
            const incomplete = survey?.dates.filter(d => (mData.selections[d.date]?.length || 0) === 0 && !mData.absences[d.date]);
            if (incomplete && incomplete.length > 0) {
                alert(`Indica la disponibilità per tutte le date per: ${currentMember}`);
                return;
            }
            setStep(2);
        } else if (step === 2) {
            setStep(3);
        } else if (step === 3) {
            if (activeMemberIdx < members.length - 1) {
                const nextIdx = activeMemberIdx + 1;
                setActiveMemberIdx(nextIdx);
                setStep(1);
            } else {
                setStep(4);
            }
        }
    };

    const handlePrevStep = () => {
        if (step === 1) {
            if (activeMemberIdx > 0) {
                setActiveMemberIdx(activeMemberIdx - 1);
                setStep(3);
            } else {
                setStep(0);
            }
        } else if (step === 2) {
            setStep(1);
        } else if (step === 3) {
            setStep(2);
        } else if (step === 4) {
            setActiveMemberIdx(members.length - 1);
            setStep(3);
        }
    };

    const handleVoteSubmit = async () => {
        setSubmitting(true);
        const idToken = localStorage.getItem("authToken");

        const votePayload = {
            idSondaggio: `SURV_${id}`,
            membersData: memberResponses
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
                alert("🎉 Disponibilità salvate con successo!");
                setIsReadOnly(true);
                setStep(0);
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

    const currentMemberName = members[activeMemberIdx] || "";
    const currentMemberData = memberResponses[currentMemberName] || {};
    const isMainUser = activeMemberIdx === 0;

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh" backgroundColor={OHEL_LIGHT_GREEN}>
                <CircularProgress size={50} sx={{ color: OHEL_GREEN }} />
            </Box>
        );
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh", backgroundColor: OHEL_LIGHT_GREEN, pt: "84px", boxSizing: "border-box" }}>
            <HeaderCompact subtitle={isReadOnly ? "Gruppo Familiare" : (step === 0 ? "Partecipanti" : `Fase ${step} di 4`)} onLogout={handleLogout} />

            <Container maxWidth="xs" sx={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 2, mt: 1, mb: 4 }}>

                {/* INTESTAZIONE */}
                <Box pl={0.5}>
                    <Typography variant="h6" fontWeight="800" sx={{ color: OHEL_TEXT_DARK, lineHeight: 1.2, mb: 0.5 }}>
                        {survey?.title}
                    </Typography>
                    <Typography variant="caption" sx={{ color: OHEL_OCHRE, fontWeight: 700, textTransform: "uppercase" }}>
                        {isReadOnly
                            ? "👁️ Sola Lettura"
                            : step === 0
                                ? "👥 Step 1: Configura Partecipanti"
                                : step === 4
                                    ? "📋 Riepilogo Finale"
                                    : `Partecipante ${activeMemberIdx + 1} di ${members.length} • Fase ${step} di 3`}
                    </Typography>
                </Box>

                {/* BANNER INFORMATIVO SE IL FORM È STATO COMPILATO DA UN PARENTE/DELEGATO */}
                {isReadOnly && compiledByInfo && (
                    <Box
                        sx={{
                            backgroundColor: "#eef6fc",
                            border: "1px solid #b8daff",
                            borderRadius: "16px",
                            p: 2,
                            display: "flex",
                            alignItems: "center",
                            gap: 1.5
                        }}
                    >
                        <InfoIcon sx={{ color: OHEL_BLUE, fontSize: "1.8rem" }} />
                        <Box>
                            <Typography variant="subtitle2" fontWeight="800" sx={{ color: OHEL_TEXT_DARK }}>
                                Inserito da un membro del gruppo
                            </Typography>
                            <Typography variant="caption" sx={{ color: "#52796f", display: "block", lineHeight: 1.3 }}>
                                Le tue preferenze per questa consultazione sono state registrate da: <strong style={{ color: OHEL_BLUE }}>{compiledByInfo.name}</strong> ({compiledByInfo.email}).
                            </Typography>
                            <Typography variant="caption" sx={{ color: "#406353", fontWeight: 600, display: "block", mt: 0.5 }}>
                                Puoi comunque modificare la tua scheda in qualsiasi momento.
                            </Typography>
                        </Box>
                    </Box>
                )}

                {/* TABS PARTECIPANTI */}
                {!isReadOnly && step > 0 && step < 4 && (
                    <Box sx={{ borderBottom: 1, borderColor: "divider", backgroundColor: "#ffffff", borderRadius: "12px", p: 0.5 }}>
                        <Tabs
                            value={activeMemberIdx}
                            onChange={(e, newIdx) => {
                                setActiveMemberIdx(newIdx);
                                setStep(1);
                            }}
                            variant="scrollable"
                            scrollButtons="auto"
                            sx={{ "& .MuiTab-root": { textTransform: "none", fontWeight: 700 } }}
                        >
                            {members.map((m, idx) => (
                                <Tab key={m} label={idx === 0 ? `${m} (Tu)` : m} />
                            ))}
                        </Tabs>
                    </Box>
                )}

                {/* CAPTION GUIDA COMPILAZIONE */}
                {!isReadOnly && step > 0 && step < 4 && (
                    <Box sx={{ backgroundColor: "#e8f0ec", p: 1.5, borderRadius: "12px", border: "1px solid #bad1c6" }}>
                        <Typography variant="caption" fontWeight="700" sx={{ color: OHEL_GREEN, display: "block" }}>
                            👉 Stai compilando per: <strong>{currentMemberName}</strong> {isMainUser && "(Titolare)"}
                        </Typography>
                        <Typography variant="caption" sx={{ color: OHEL_SAGE, display: "block", mt: 0.3 }}>
                            {isMainUser
                                ? "Compila prima le tue preferenze. Successivamente passeremo ai tuoi familiari."
                                : `Fornisci le indicazioni specifiche per ${currentMemberName}.`}
                        </Typography>
                    </Box>
                )}

                {/* ---------------- STEP 0: GESTIONE GRUPPO FAMILIARE ---------------- */}
                {!isReadOnly && step === 0 && (
                    <Stack gap={2}>
                        <Card sx={{ borderRadius: "20px", border: "1px solid #e1ebe5", backgroundColor: "#ffffff" }}>
                            <CardContent sx={{ p: 2.5, display: "flex", flexDirection: "column", gap: 2 }}>
                                <Stack direction="row" alignItems="center" gap={1}>
                                    <GroupAddIcon sx={{ color: OHEL_GREEN }} />
                                    <Typography variant="subtitle1" fontWeight="800" sx={{ color: OHEL_TEXT_DARK }}>
                                        Partecipanti del Nucleo
                                    </Typography>
                                </Stack>
                                <Typography variant="body2" sx={{ color: "#52796f", lineHeight: 1.3 }}>
                                    Includi i familiari o congiunti per cui desideri registrare la disponibilità:
                                </Typography>

                                <List disablePadding>
                                    {members.map((memberName, idx) => (
                                        <ListItem
                                            key={memberName}
                                            secondaryAction={
                                                idx > 0 && (
                                                    <IconButton edge="end" onClick={() => handleRemoveMember(memberName)}>
                                                        <DeleteOutlineIcon sx={{ color: "#d32f2f" }} />
                                                    </IconButton>
                                                )
                                            }
                                            sx={{ borderBottom: "1px solid #f0f4f2", py: 1 }}
                                        >
                                            <Stack direction="row" alignItems="center" gap={1}>
                                                <PersonIcon sx={{ color: idx === 0 ? OHEL_GREEN : OHEL_SAGE }} />
                                                <Typography variant="body2" fontWeight="700" color={OHEL_TEXT_DARK}>
                                                    {memberName} {idx === 0 && "(Titolare Account)"}
                                                </Typography>
                                            </Stack>
                                        </ListItem>
                                    ))}
                                </List>

                                {/* BOX EVIDENZIATO PER L'AGGIUNTA DI UN NUOVO FAMILIARE */}
                                <Box
                                    sx={{
                                        backgroundColor: "#f4f7f5",
                                        border: "1.5px dashed #2e5b43",
                                        borderRadius: "16px",
                                        p: 2,
                                        mt: 1,
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 1.5
                                    }}
                                >
                                    <Typography variant="caption" fontWeight="800" sx={{ color: OHEL_GREEN, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                                        ➕ Vuoi aggiungere un familiare?
                                    </Typography>

                                    <Stack direction="row" gap={1}>
                                        <TextField
                                            size="small"
                                            fullWidth
                                            label="Nome"
                                            placeholder="es. Mario"
                                            value={newMemberFirstName}
                                            onChange={(e) => setNewMemberFirstName(e.target.value)}
                                            slotProps={{ inputLabel: { shrink: true } }}
                                            sx={{ backgroundColor: "#ffffff", borderRadius: "8px" }}
                                        />
                                        <TextField
                                            size="small"
                                            fullWidth
                                            label="Cognome"
                                            placeholder="es. Rossi"
                                            value={newMemberLastName}
                                            onChange={(e) => setNewMemberLastName(e.target.value)}
                                            slotProps={{ inputLabel: { shrink: true } }}
                                            sx={{ backgroundColor: "#ffffff", borderRadius: "8px" }}
                                        />
                                    </Stack>

                                    {/* PULSANTE AD IMPATTO VISIVO ELEVATO */}
                                    <Button
                                        variant="contained"
                                        fullWidth
                                        disabled={!newMemberFirstName.trim() || !newMemberLastName.trim()}
                                        onClick={handleAddMember}
                                        sx={{
                                            backgroundColor: OHEL_GREEN,
                                            color: "#ffffff",
                                            fontWeight: "800",
                                            fontSize: "0.88rem",
                                            textTransform: "none",
                                            borderRadius: "10px",
                                            py: 1.2,
                                            boxShadow: "0 4px 10px rgba(46, 91, 67, 0.2)",
                                            "&:hover": {
                                                backgroundColor: "#1e382b"
                                            },
                                            "&.Mui-disabled": {
                                                backgroundColor: "#c8d6ce",
                                                color: "#83a697"
                                            }
                                        }}
                                    >
                                        + Aggiungi {newMemberFirstName.trim() ? `${newMemberFirstName.trim()} ` : ""}al Gruppo
                                    </Button>
                                </Box>

                            </CardContent>
                        </Card>

                        {/* TASTO PRINCIPALE DI PROSEGUIMENTO */}
                        <Button
                            variant="contained"
                            fullWidth
                            onClick={handleNextStep}
                            sx={{
                                backgroundColor: OHEL_TEXT_DARK,
                                color: "#ffffff",
                                borderRadius: "12px",
                                py: 1.6,
                                fontWeight: "800",
                                textTransform: "none",
                                fontSize: "0.95rem"
                            }}
                        >
                            Inizia Compilazione ({members.length} {members.length === 1 ? "Persona" : "Persone"}) →
                        </Button>
                    </Stack>
                )}

                {/* ---------------- STEP 1: TURNI PER MEMBRO ATTIVO ---------------- */}
                {!isReadOnly && step === 1 && (
                    <Stack gap={2}>
                        {survey?.dates.map((dateItem) => {
                            const isAbsent = !!currentMemberData.absences?.[dateItem.date];
                            const isSelected = (currentMemberData.selections?.[dateItem.date]?.length || 0) > 0;

                            let borderLeftColor = "#bad1c6";
                            if (isAbsent) borderLeftColor = "#d32f2f";
                            else if (isSelected) borderLeftColor = OHEL_GREEN;

                            return (
                                <Card key={dateItem.date} sx={{ borderRadius: "20px", border: "1px solid #e1ebe5", borderLeft: `5px solid ${borderLeftColor}`, backgroundColor: isAbsent ? "#fffcfc" : "#ffffff" }}>
                                    <CardContent sx={{ p: 2.5 }}>
                                        <Typography variant="subtitle1" fontWeight="800" sx={{ color: isAbsent ? "#d32f2f" : OHEL_TEXT_DARK }}>
                                            {formatDateItalian(dateItem.date)}
                                        </Typography>
                                        <Typography variant="caption" fontWeight="600" color="#52796f" display="block" mb={1.5}>
                                            Dalle {dateItem.timeRange.start} alle {dateItem.timeRange.end}
                                        </Typography>

                                        <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                                            {dateItem.timeSlots.map((slot) => {
                                                const slotSelected = currentMemberData.selections?.[dateItem.date]?.includes(slot);
                                                return (
                                                    <Chip
                                                        key={slot}
                                                        label={slot}
                                                        clickable
                                                        disabled={isAbsent}
                                                        onClick={() => handleSlotClick(dateItem.date, slot)}
                                                        sx={{
                                                            fontWeight: "700",
                                                            backgroundColor: slotSelected ? OHEL_GREEN : "#f0f4f2",
                                                            color: slotSelected ? "#ffffff" : OHEL_TEXT_DARK
                                                        }}
                                                    />
                                                );
                                            })}
                                        </Box>

                                        <Chip
                                            icon={<BlockIcon fontSize="small" style={{ color: isAbsent ? "#ffffff" : "#757575" }} />}
                                            label="Non sarà presente questo giorno"
                                            clickable
                                            onClick={() => handleAbsenceClick(dateItem.date)}
                                            sx={{
                                                backgroundColor: isAbsent ? "#d32f2f" : "#f0f4f2",
                                                color: isAbsent ? "#ffffff" : OHEL_TEXT_DARK
                                            }}
                                        />
                                    </CardContent>
                                </Card>
                            );
                        })}

                        <Stack direction="row" gap={2}>
                            <Button variant="outlined" fullWidth onClick={handlePrevStep} sx={{ color: OHEL_SAGE, borderColor: "#bad1c6", borderRadius: "12px", py: 1.5, fontWeight: "700", textTransform: "none" }}>
                                Indietro
                            </Button>
                            <Button variant="contained" fullWidth onClick={handleNextStep} sx={{ backgroundColor: OHEL_GREEN, color: "#ffffff", borderRadius: "12px", py: 1.5, fontWeight: "700", textTransform: "none" }}>
                                Continua (Alimentazione) →
                            </Button>
                        </Stack>
                    </Stack>
                )}

                {/* ---------------- STEP 2: INTOLLERANZE PER MEMBRO ATTIVO ---------------- */}
                {!isReadOnly && step === 2 && (
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
                                    Spunta le eventuali intolleranze o allergie per <strong>{currentMemberName}</strong>. Se non ce ne sono, lascia pure vuoto:
                                </Typography>

                                <FormGroup>
                                    {COMMON_INTOLERANCES.map((option) => (
                                        <FormControlLabel
                                            key={option}
                                            control={
                                                <Checkbox
                                                    checked={(currentMemberData.selectedIntolerances || []).includes(option)}
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
                                    placeholder="es. Allergia ai crostacei / Vegetariano"
                                    variant="outlined"
                                    fullWidth
                                    multiline
                                    rows={2}
                                    value={currentMemberData.customIntolerance || ""}
                                    onChange={(e) => handleCustomIntoleranceChange(e.target.value)}
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
                            <Button variant="outlined" fullWidth onClick={handlePrevStep} sx={{ color: OHEL_SAGE, borderColor: "#bad1c6", borderRadius: "12px", py: 1.5, fontWeight: "700", textTransform: "none" }}>
                                Indietro (Turni)
                            </Button>
                            <Button variant="contained" fullWidth onClick={handleNextStep} sx={{ backgroundColor: OHEL_GREEN, color: "#ffffff", borderRadius: "12px", py: 1.5, fontWeight: "700", textTransform: "none" }}>
                                Continua (Note) →
                            </Button>
                        </Stack>
                    </Stack>
                )}

                {/* ---------------- STEP 3: NOTE GENERICHE PER MEMBRO ATTIVO ---------------- */}
                {!isReadOnly && step === 3 && (
                    <Stack gap={2}>
                        <Card sx={{ borderRadius: "20px", border: "1px solid #e1ebe5", borderTop: `4px solid ${OHEL_SAGE}`, backgroundColor: "#ffffff" }}>
                            <CardContent sx={{ p: 2.5, display: "flex", flexDirection: "column", gap: 2 }}>
                                <Stack direction="row" alignItems="center" gap={1}>
                                    <RateReviewIcon sx={{ color: OHEL_SAGE }} />
                                    <Typography variant="subtitle1" fontWeight="800" sx={{ color: OHEL_TEXT_DARK }}>
                                        Note Generiche (Opzionale)
                                    </Typography>
                                </Stack>
                                <Typography variant="body2" sx={{ color: "#52796f", lineHeight: 1.4 }}>
                                    Comunicazioni o esigenze particolari da segnalare per <strong>{currentMemberName}</strong>:
                                </Typography>

                                <TextField
                                    label="Note od osservazioni personali"
                                    placeholder="es. Arriverà in ritardo / Necessita di un passaggio"
                                    variant="outlined"
                                    fullWidth
                                    multiline
                                    rows={3}
                                    value={currentMemberData.generalNotes || ""}
                                    onChange={(e) => handleGeneralNotesChange(e.target.value)}
                                    slotProps={{ inputLabel: { shrink: true } }}
                                    sx={{
                                        mt: 1,
                                        "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: OHEL_SAGE },
                                        "& .MuiInputLabel-root.Mui-focused": { color: OHEL_SAGE }
                                    }}
                                />
                            </CardContent>
                        </Card>

                        <Stack direction="row" gap={2}>
                            <Button variant="outlined" fullWidth onClick={handlePrevStep} sx={{ color: OHEL_SAGE, borderColor: "#bad1c6", borderRadius: "12px", py: 1.5, fontWeight: "700", textTransform: "none" }}>
                                Indietro (Alimentazione)
                            </Button>
                            <Button variant="contained" fullWidth onClick={handleNextStep} sx={{ backgroundColor: OHEL_GREEN, color: "#ffffff", borderRadius: "12px", py: 1.5, fontWeight: "700", textTransform: "none" }}>
                                {activeMemberIdx < members.length - 1 ? `Prosegui con ${members[activeMemberIdx + 1]} →` : "Vai al Riepilogo Finale →"}
                            </Button>
                        </Stack>
                    </Stack>
                )}

                {/* ---------------- RIEPILOGO E CONFERMA FINALE (STEP 4 O SOLA LETTURA) ---------------- */}
                {(isReadOnly || step === 4) && (
                    <Stack gap={2}>
                        <Card sx={{ borderRadius: "20px", border: "1px solid #e1ebe5", backgroundColor: "#ffffff" }}>
                            <CardContent sx={{ p: 2.5, display: "flex", flexDirection: "column", gap: 2 }}>
                                <Typography variant="subtitle1" fontWeight="800" color={OHEL_GREEN}>
                                    📋 Riepilogo Presenze del Gruppo:
                                </Typography>

                                {members.map((m) => {
                                    const mData = memberResponses[m] || {};
                                    const intolerancesList = [...(mData.selectedIntolerances || [])];
                                    if (mData.customIntolerance?.trim()) {
                                        intolerancesList.push(mData.customIntolerance.trim());
                                    }

                                    return (
                                        <Box key={m} sx={{ p: 2, backgroundColor: "#f8faf9", borderRadius: "16px", border: "1px solid #e1ebe5", display: "flex", flexDirection: "column", gap: 1 }}>
                                            <Typography variant="subtitle2" fontWeight="800" color={OHEL_TEXT_DARK}>
                                                👤 {m}
                                            </Typography>

                                            <Typography variant="caption" fontWeight="700" color={OHEL_GREEN} sx={{ textTransform: "uppercase" }}>
                                                📅 Turni scelti:
                                            </Typography>
                                            {survey?.dates.map((d) => (
                                                <Typography key={d.date} variant="caption" display="block" color={mData.absences?.[d.date] ? "#d32f2f" : OHEL_SAGE} sx={{ pl: 1 }}>
                                                    • {formatDateItalian(d.date)}: {mData.absences?.[d.date] ? "NON PRESENTE" : (mData.selections?.[d.date]?.join(", ") || "Nessun turno")}
                                                </Typography>
                                            ))}

                                            <Divider sx={{ my: 0.5 }} />

                                            <Typography variant="caption" fontWeight="700" color={OHEL_OCHRE} sx={{ textTransform: "uppercase" }}>
                                                🍏 Alimentazione:
                                            </Typography>
                                            <Typography variant="caption" color={OHEL_TEXT_DARK} sx={{ pl: 1 }}>
                                                {intolerancesList.length > 0 ? intolerancesList.join(", ") : "Nessuna intolleranza segnalata"}
                                            </Typography>

                                            <Divider sx={{ my: 0.5 }} />

                                            <Typography variant="caption" fontWeight="700" color={OHEL_SAGE} sx={{ textTransform: "uppercase" }}>
                                                📝 Note:
                                            </Typography>
                                            <Typography variant="caption" color={OHEL_TEXT_DARK} sx={{ pl: 1 }}>
                                                {mData.generalNotes?.trim() ? mData.generalNotes : "Nessuna nota aggiuntiva"}
                                            </Typography>
                                        </Box>
                                    );
                                })}
                            </CardContent>
                        </Card>

                        {!isReadOnly ? (
                            <Box>
                                <Button
                                    variant="contained"
                                    fullWidth
                                    disabled={submitting}
                                    onClick={handleVoteSubmit}
                                    sx={{ backgroundColor: OHEL_GREEN, color: "#ffffff", borderRadius: "12px", py: 1.5, fontWeight: "700", textTransform: "none", mb: 1 }}
                                >
                                    {submitting ? "Salvataggio..." : "🚀 Conferma e Invia per Tutto il Gruppo"}
                                </Button>
                                <Button variant="text" fullWidth disabled={submitting} onClick={handlePrevStep} sx={{ color: OHEL_SAGE, fontWeight: 700, textTransform: "none" }}>
                                    Torna all'ultimo familiare
                                </Button>
                            </Box>
                        ) : (
                            <Box>
                                <Button
                                    variant="contained"
                                    fullWidth
                                    onClick={() => {
                                        setIsReadOnly(false);
                                        setStep(0);
                                    }}
                                    startIcon={<EditIcon />}
                                    sx={{ backgroundColor: OHEL_OCHRE, color: "#ffffff", borderRadius: "12px", py: 1.5, fontWeight: "700", textTransform: "none", mb: 1 }}
                                >
                                    Modifica Gruppo o Risposte
                                </Button>
                                <Button
                                    variant="text"
                                    fullWidth
                                    onClick={() => navigate("/dashboard")}
                                    sx={{ color: OHEL_SAGE, textTransform: "none", fontWeight: 700 }}
                                >
                                    Torna alla Dashboard
                                </Button>
                            </Box>
                        )}
                    </Stack>
                )}

            </Container>
            <Footer />
        </Box>
    );
}

export default SurveyVote;