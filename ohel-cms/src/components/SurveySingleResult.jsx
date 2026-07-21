import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import CONFIG from "../config/config";
import HeaderCompact from "./HeaderCompact";
import Footer from "../components/Footer";

// Importazioni Material-UI
import {
    Box,
    Card,
    CardContent,
    Typography,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    CircularProgress,
    Fade,
    Menu,
    MenuItem,
    IconButton,
    Chip,
    useMediaQuery,
    useTheme,
    Container,
    Button,
    Stack
} from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import FilterListIcon from "@mui/icons-material/FilterList";

import DateDetailsDialog from "./DateDetailsDialog";

const OHEL_LIGHT_GREEN = "#f4f7f5";

const SurveySingleResult = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [surveyTitle, setSurveyTitle] = useState("");
    const [groupedData, setGroupedData] = useState({});
    const [dateDetailsMap, setDateDetailsMap] = useState({});

    const [sortType, setSortType] = useState("chronological");
    const [anchorEl, setAnchorEl] = useState(null);
    const [showPastDates, setShowPastDates] = useState(false);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogData, setDialogData] = useState({ dateLabel: "", peopleWithResponses: {} });

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    const { URL_APPS_SCRIPT } = CONFIG;

    useEffect(() => {
        const fetchSurveyData = async () => {
            const idToken = localStorage.getItem("authToken");
            const storedUserProfile = localStorage.getItem("userProfile");

            if (!idToken || !storedUserProfile) {
                handleLogout();
                return;
            }

            try {
                const currentUser = JSON.parse(storedUserProfile);

                // 1. Dettagli configurazione sondaggio
                const resActive = await fetch(`${URL_APPS_SCRIPT}?action=GET_ACTIVE_SURVEYS&email=${encodeURIComponent(currentUser.email)}`);
                const dataActive = await resActive.json();

                if (dataActive.status === "success") {
                    const currentSurvey = dataActive.surveys.find(s => s.idSondaggio === `SURV_${id}` || s.idSondaggio === id);
                    if (currentSurvey) {
                        setSurveyTitle(currentSurvey.title);
                        const detailsMap = {};
                        currentSurvey.dates.forEach(d => {
                            detailsMap[d.date] = d;
                        });
                        setDateDetailsMap(detailsMap);
                    }
                }

                // 2. Recupero di TUTTI I VOTI dei soci per questo sondaggio
                const resVotes = await fetch(`${URL_APPS_SCRIPT}?action=GET_ALL_SURVEY_VOTES&idSondaggio=SURV_${id}`);
                const dataVotes = await resVotes.json();

                if (dataVotes.status === "success" && dataVotes.dataByMember) {
                    const parsedGrouped = {};

                    Object.entries(dataVotes.dataByMember).forEach(([memberName, memberInfo]) => {
                        const { selections, absences, selectedIntolerances, customIntolerance, generalNotes } = memberInfo;

                        const intolerances = [...(selectedIntolerances || [])];
                        if (customIntolerance && customIntolerance.trim()) {
                            intolerances.push(customIntolerance.trim());
                        }

                        Object.keys(selections || {}).forEach(dateStr => {
                            if (!parsedGrouped[dateStr]) parsedGrouped[dateStr] = [];

                            const isAbsent = !!absences?.[dateStr];
                            const slots = selections[dateStr] || [];

                            if (!isAbsent && slots.length > 0) {
                                parsedGrouped[dateStr].push({
                                    name: memberName,
                                    slots: slots,
                                    isAbsent: false,
                                    intolerances: intolerances,
                                    notes: generalNotes || ""
                                });
                            }
                        });
                    });

                    setGroupedData(parsedGrouped);
                }
            } catch (err) {
                console.error("Errore nel caricamento delle disponibilità:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchSurveyData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, URL_APPS_SCRIPT]);

    const handleLogout = () => {
        localStorage.removeItem("authToken");
        localStorage.removeItem("userProfile");
        navigate("/", { replace: true });
    };

    // Calcolo intolleranze aggregate per data
    const getIntolerancesForDate = (dateStr) => {
        const intolerancesCount = {};
        const peopleList = groupedData[dateStr] || [];

        peopleList.forEach(person => {
            if (person.intolerances && person.intolerances.length > 0) {
                person.intolerances.forEach(f => {
                    if (f !== "Nessuna") {
                        if (!intolerancesCount[f]) intolerancesCount[f] = [];
                        if (!intolerancesCount[f].includes(person.name)) {
                            intolerancesCount[f].push(person.name);
                        }
                    }
                });
            }
        });

        return intolerancesCount;
    };

    // Apertura della modale dei dettagli
    const openDialogForDate = (dateStr) => {
        const peopleList = groupedData[dateStr] || [];
        const responsesMap = {};

        peopleList.forEach(person => {
            person.slots.forEach(slot => {
                if (!responsesMap[slot]) responsesMap[slot] = [];
                responsesMap[slot].push({ name: person.name });
            });

            if (person.notes) {
                const noteKey = `📝 Nota: ${person.notes}`;
                if (!responsesMap[noteKey]) responsesMap[noteKey] = [];
                responsesMap[noteKey].push({ name: person.name });
            }
        });

        const intolerancesMap = getIntolerancesForDate(dateStr);
        Object.entries(intolerancesMap).forEach(([key, names]) => {
            responsesMap[`🍏 ${key}`] = names.map(n => ({ name: n }));
        });

        setDialogData({ dateLabel: dateStr, peopleWithResponses: responsesMap });
        setDialogOpen(true);
    };

    const formatItalianDate = (dateStr) => {
        if (!dateStr) return { main: "", subtitle: "", dateObj: null };

        try {
            const dateObj = new Date(dateStr);
            const formattedMain = new Intl.DateTimeFormat("it-IT", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
            }).format(dateObj);

            const details = dateDetailsMap[dateStr];
            let subtitle = details?.subtitle || "";
            if (details?.timeRange?.start && details?.timeRange?.end) {
                subtitle += ` (${details.timeRange.start} - ${details.timeRange.end})`;
            }

            return {
                main: formattedMain.charAt(0).toUpperCase() + formattedMain.slice(1),
                subtitle: subtitle.trim(),
                dateObj
            };
        } catch (e) {
            return { main: dateStr, subtitle: "", dateObj: null };
        }
    };

    const filteredDates = Object.keys(groupedData).filter((dateStr) => {
        const { dateObj } = formatItalianDate(dateStr);
        if (!dateObj) return true;
        const todayMidnight = new Date();
        todayMidnight.setHours(0, 0, 0, 0);
        return showPastDates || dateObj >= todayMidnight;
    });

    const sortedDates = filteredDates.sort((a, b) => {
        const aDate = formatItalianDate(a).dateObj;
        const bDate = formatItalianDate(b).dateObj;
        if (!aDate || !bDate) return 0;

        if (sortType === "chronological") {
            return aDate - bDate;
        } else if (sortType === "peopleAsc") {
            return (groupedData[a]?.length || 0) - (groupedData[b]?.length || 0);
        } else if (sortType === "peopleDesc") {
            return (groupedData[b]?.length || 0) - (groupedData[a]?.length || 0);
        }
        return 0;
    });

    const handleClick = (event) => setAnchorEl(event.currentTarget);
    const handleClose = () => setAnchorEl(null);
    const handleSelectSort = (type) => { setSortType(type); handleClose(); };

    const getFilterLabel = () => {
        switch (sortType) {
            case "chronological": return "Ordine cronologico";
            case "peopleAsc": return "Data con meno persone";
            case "peopleDesc": return "Data con più persone";
            default: return "Nessun filtro";
        }
    };

    return (
        <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh", backgroundColor: OHEL_LIGHT_GREEN, pt: "84px", boxSizing: "border-box" }}>

            {/* HEADER COMPATTO RIUTILIZZABILE */}
            <HeaderCompact subtitle="Risultati Disponibilità" onLogout={handleLogout} />

            <Container maxWidth="md" sx={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 2, mt: 1, mb: 4 }}>

                {/* INTESTAZIONE E TITOLO SONDAGGIO */}
                <Box pl={0.5}>
                    <Typography variant={isMobile ? "subtitle1" : "h5"} fontWeight="bold" color="primary" sx={{ textAlign: "left", lineHeight: 1.2, mb: 0.5 }}>
                        {surveyTitle || "Risultati Sondaggio"} <br/><strong>Associazione Ohel</strong>
                    </Typography>
                </Box>

                {/* BARRA CONTROLLI CON STILE PRIMARY */}
                <Card sx={{ borderRadius: "16px", border: "1px solid #e1ebe5", backgroundColor: "#ffffff" }}>
                    <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 }, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
                        <Box sx={{ display: "flex", alignItems: "center" }}>
                            <IconButton onClick={handleClick} color="primary" size={isMobile ? "small" : "medium"}>
                                <FilterListIcon />
                            </IconButton>
                            <Typography onClick={handleClick} variant={isMobile ? "body2" : "body1"} sx={{ cursor: "pointer", mr: 1, fontWeight: 500 }} color="primary">
                                Filtra
                            </Typography>
                            <Chip
                                label={getFilterLabel()}
                                onClick={handleClick}
                                color="primary"
                                variant="outlined"
                                size={isMobile ? "small" : "medium"}
                                sx={{ ml: 1 }}
                            />
                            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>
                                <MenuItem onClick={() => handleSelectSort("chronological")}>Ordine cronologico</MenuItem>
                                <MenuItem onClick={() => handleSelectSort("peopleDesc")}>Data con più persone</MenuItem>
                                <MenuItem onClick={() => handleSelectSort("peopleAsc")}>Data con meno persone</MenuItem>
                            </Menu>
                        </Box>

                        <Button size="small" onClick={() => setShowPastDates(!showPastDates)} color="primary" variant="outlined">
                            {showPastDates ? "Nascondi date già passate" : "Vedi date già passate"}
                        </Button>
                    </CardContent>
                </Card>

                {loading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", my: 6 }}>
                        <CircularProgress color="primary" />
                    </Box>
                ) : (
                    <Stack gap={2}>
                        {sortedDates.length === 0 ? (
                            <Card sx={{ borderRadius: "20px", border: "1px solid #e1ebe5" }}>
                                <CardContent sx={{ p: 3, textAlign: "center" }}>
                                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                                        Nessuna disponibilità trovata.
                                    </Typography>
                                </CardContent>
                            </Card>
                        ) : (
                            sortedDates.map((dateStr, index) => {
                                const people = groupedData[dateStr] || [];
                                const count = people.length;
                                const { main, subtitle } = formatItalianDate(dateStr);
                                const intolerancesForDate = getIntolerancesForDate(dateStr);
                                const totalIntolerances = Object.keys(intolerancesForDate).length;

                                return (
                                    <Fade in timeout={400 + index * 150} key={dateStr}>
                                        <Card sx={{ borderRadius: 3, boxShadow: 3, "&:hover": { transform: !isMobile ? "scale(1.02)" : "none", transition: "transform 0.2s" } }}>
                                            <CardContent>
                                                {/* HEADER CARD CON COLOR PRIMARY */}
                                                <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={1.5}>
                                                    <Box sx={{ display: "flex", flexDirection: "column" }}>
                                                        <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
                                                            <CalendarMonthIcon color="primary" sx={{ mr: 1, fontSize: isMobile ? "1.1rem" : "1.3rem" }} />
                                                            <Typography
                                                                variant={isMobile ? "subtitle1" : "h6"}
                                                                fontWeight="bold"
                                                                color="primary"
                                                                sx={{ fontSize: isMobile ? "1rem" : "1.3rem" }}
                                                            >
                                                                {main}
                                                            </Typography>
                                                        </Box>
                                                        {subtitle && (
                                                            <Typography
                                                                variant="body2"
                                                                color="text.secondary"
                                                                sx={{
                                                                    mt: 0.3,
                                                                    fontSize: isMobile ? "0.8rem" : "0.9rem",
                                                                    fontStyle: "italic",
                                                                    whiteSpace: "pre-line",
                                                                    ml: 3.5,
                                                                }}
                                                            >
                                                                {subtitle}
                                                            </Typography>
                                                        )}
                                                    </Box>

                                                    {/* CONTATORE IN ALTO A DESTRA IN GRASSETTO */}
                                                    <Typography
                                                        variant="body2"
                                                        color="primary"
                                                        sx={{
                                                            fontWeight: "bold",
                                                            fontSize: isMobile ? "0.85rem" : "1rem",
                                                            whiteSpace: "nowrap",
                                                            pl: 1
                                                        }}
                                                    >
                                                        {count} {count === 1 ? "persona" : "persone"}
                                                    </Typography>
                                                </Box>

                                                {/* ELENCO DEI PARTECIPANTI */}
                                                <List dense>
                                                    {people.map((p, i) => (
                                                        <ListItem key={i} disableGutters>
                                                            <ListItemIcon sx={{ minWidth: 30 }}>
                                                                <PersonIcon color="action" sx={{ fontSize: isMobile ? "1rem" : "1.2rem" }} />
                                                            </ListItemIcon>
                                                            <ListItemText
                                                                primaryTypographyProps={{ fontSize: isMobile ? "0.9rem" : "1rem" }}
                                                                primary={p.name}
                                                            />
                                                        </ListItem>
                                                    ))}
                                                </List>

                                                {/* CHIP INTOLLERANZE */}
                                                {totalIntolerances > 0 && (
                                                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.8, mt: 1.2 }}>
                                                        {Object.entries(intolerancesForDate).map(([key, names]) => (
                                                            <Chip
                                                                key={key}
                                                                label={`${key} (${names.length})`}
                                                                size="small"
                                                                color="error"
                                                                variant="outlined"
                                                                sx={{
                                                                    fontSize: isMobile ? "0.7rem" : "0.8rem",
                                                                    borderRadius: 2,
                                                                    backgroundColor: "rgba(255,230,230,0.25)",
                                                                    borderColor: "rgba(255,100,100,0.4)",
                                                                }}
                                                            />
                                                        ))}
                                                    </Box>
                                                )}

                                                <Box textAlign="right" mt={1}>
                                                    <Button size="small" color="primary" onClick={() => openDialogForDate(dateStr)}>
                                                        Mostra altri dettagli
                                                    </Button>
                                                </Box>
                                            </CardContent>
                                        </Card>
                                    </Fade>
                                );
                            })
                        )}
                    </Stack>
                )}
            </Container>

            {/* MODALE DEI DETTAGLI */}
            <DateDetailsDialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                dateLabel={dialogData.dateLabel}
                peopleWithResponses={dialogData.peopleWithResponses}
            />

            {/* FOOTER RIUTILIZZABILE */}
            <Footer />
        </Box>
    );
};

export default SurveySingleResult;