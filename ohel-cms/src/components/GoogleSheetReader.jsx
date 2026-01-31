import React, { useEffect, useState } from "react";
import axios from "axios";
import CONFIG from "../config/config";
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
    AppBar,
    Toolbar,
    Container,
    Button,
} from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import FilterListIcon from "@mui/icons-material/FilterList";

import DateDetailsDialog from "./DateDetailsDialog";

const GoogleSheetReader = () => {
    const [groupedData, setGroupedData] = useState({});
    const [loading, setLoading] = useState(true);
    const [associationYear, setAssociationYear] = useState([]);
    const [sortType, setSortType] = useState("chronological");
    const [anchorEl, setAnchorEl] = useState(null);
    const [showPastDates, setShowPastDates] = useState(false); // NUOVO


    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogData, setDialogData] = useState({ dateLabel: "", peopleWithResponses: {} });
    const [rawRows, setRawRows] = useState([]);
    const [headerRow, setHeaderRow] = useState([]);

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    useEffect(() => {
        const fetchSheetData = async () => {
            const { SHEET_ID, API_KEY, RANGE } = CONFIG;
            const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(
                RANGE
            )}?key=${API_KEY}`;

            try {
                const res = await axios.get(url);
                const values = res.data.values || [];
                if (values.length < 2) {
                    setGroupedData({});
                    setLoading(false);
                    return;
                }

                const header = values[0];
                const dataRows = values.slice(1);
                setRawRows(dataRows);
                setHeaderRow(header);

                const nameIndex = header.findIndex((h) => h.toLowerCase().includes("nome"));
                const dateColumns = header
                    .map((h, idx) => ({ idx, label: h }))
                    .filter((col) => col.idx > nameIndex && !col.label.toLowerCase().includes("esigenze"));

                const grouped = {};
                dataRows.forEach((row) => {
                    const nameCell = row[nameIndex];
                    if (!nameCell) return;

                    // Separazione dei nomi multipli
                    const names = nameCell.split(/,|;| e /i).map(n => n.trim()).filter(n => n);

                    dateColumns.forEach(({ idx, label }) => {
                        const cell = row[idx];
                        if (cell && cell.trim() !== "") {
                            if (!grouped[label]) grouped[label] = [];
                            names.forEach(name => {
                                if (!grouped[label].includes(name)) {
                                    grouped[label].push(name);
                                }
                            });
                        }
                    });
                });

                setGroupedData(grouped);
            } catch (err) {
                console.error("Errore nel caricamento dei dati:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchSheetData();
    }, []);

    useEffect(() => {
        const fetchAssociationYear = async () => {

            const { API_KEY } = CONFIG;
            const SHEET_ID = "1OMAGTsjjBQG1lGnn3GmTszjSQ4F1f4gagl7A7usb_lA";
            const RANGE = "Foglio1"

            const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}`;
            const res = await fetch(url);
            const data = await res.json();

            // Trova la prima riga che contiene un numero valido
            const rowWithYear = data.values.find(
                row => row && row.length > 1 && !isNaN(parseInt(row[1], 10))
            );

            setAssociationYear(rowWithYear ? parseInt(rowWithYear[1], 10) : null);
            console.log(associationYear);
        };

        fetchAssociationYear();
    }, [associationYear]);

    // Funzione per contare intolleranze per una data
    // Controlla intolleranze per ogni data separando i nomi multipli
    const getIntolerancesForDate = (dateLabel) => {
        const intolerancesCount = {};
        const nameCol = headerRow.findIndex((h) => h.toLowerCase().includes("nome"));
        const dateColIndex = headerRow.indexOf(dateLabel);
        const foodCol = headerRow.length - 1;

        rawRows.forEach((row) => {
            const nameCell = row[nameCol];
            if (!nameCell) return;

            // Split dei nomi multipli nella stessa cella
            const names = nameCell.split(/,|;| e /i).map(n => n.trim()).filter(n => n);

            const dateResponse = row[dateColIndex] || "";
            const foodResponse = row[foodCol] || "";

            // Solo se la persona partecipa a quella data e ha intolleranze
            if (dateResponse.trim() !== "" && foodResponse.trim() !== "") {
                const foods = foodResponse.split(/,|\n/).map(f => f.trim()).filter(f => f);
                foods.forEach(f => {
                    if (!intolerancesCount[f]) intolerancesCount[f] = [];
                    names.forEach(name => {
                        if (!intolerancesCount[f].includes(name)) intolerancesCount[f].push(name);
                    });
                });
            }
        });

        return intolerancesCount;
    };

// Funzione per aprire il dialog con gestione nomi multipli
    const openDialogForDate = (dateLabel) => {
        const responsesMap = {};
        const foodPreferences = {};
        const nameCol = headerRow.findIndex((h) => h.toLowerCase().includes("nome"));
        const dateColIndex = headerRow.indexOf(dateLabel);
        const foodCol = headerRow.length - 1;

        rawRows.forEach((row) => {
            const nameCell = row[nameCol];
            if (!nameCell) return;

            // Split dei nomi multipli nella stessa cella
            const names = nameCell.split(/,|;| e /i).map(n => n.trim()).filter(n => n);

            const responseCell = row[dateColIndex] || "";
            const responses = responseCell.split(/,|;| e /i).map(r => r.trim()).filter(r => r);

            names.forEach(name => {
                responses.forEach(resp => {
                    if (!responsesMap[resp]) responsesMap[resp] = [];
                    if (!responsesMap[resp].some(p => p.name === name)) {
                        responsesMap[resp].push({ name });
                    }
                });
            });

            const foodCell = row[foodCol] || "";
            if (foodCell.trim() !== "") {
                const foods = foodCell.split(/,|\n/).map(f => f.trim()).filter(f => f);
                foods.forEach(f => {
                    if (!foodPreferences[f]) foodPreferences[f] = [];
                    names.forEach(name => {
                        if (!foodPreferences[f].includes(name)) foodPreferences[f].push(name);
                    });
                });
            }
        });

        // Unione di risposte e intolleranze
        const mergedResponses = { ...responsesMap };
        Object.entries(foodPreferences).forEach(([key, names]) => {
            mergedResponses[key] = names.map(n => ({ name: n }));
        });

        setDialogData({ dateLabel, peopleWithResponses: mergedResponses });
        setDialogOpen(true);
    };


    // Funzione per formattare le date in italiano
    // ✅ Funzione migliorata per formattare correttamente le date italiane
    const formatItalianDate = (rawLabel) => {
        if (!rawLabel) return { main: "", subtitle: "", dateObj: null };
        const cleanLabel = rawLabel.replace(/\s+/g, " ").trim();

        let main = "";
        let subtitleParts = [];

        // Estrae eventuale testo tra parentesi
        const parenMatch = cleanLabel.match(/\(([^)]+)\)/);
        if (parenMatch) {
            main = cleanLabel.replace(/\(.*?\)/g, "").split(/\s{2,}|\n/)[0].trim();
            subtitleParts.push(parenMatch[1].trim());
        } else {
            const splitMatch = cleanLabel.split(/[-–:]+/);
            if (splitMatch.length > 1) {
                main = splitMatch[0].trim();
                subtitleParts.push(splitMatch.slice(1).join(" - ").trim());
            } else {
                main = cleanLabel.trim();
            }
        }

        // Cerca parole chiave dopo la data
        const keywords = ["con", "senza", "spettacolo", "serata", "evento", "ragazzi"];
        if (subtitleParts.length === 0) {
            const lower = cleanLabel.toLowerCase();
            const keyword = keywords.find((k) => lower.includes(` ${k} `));
            if (keyword) {
                const idx = lower.indexOf(` ${keyword} `);
                main = cleanLabel.slice(0, idx).trim();
                subtitleParts.push(cleanLabel.slice(idx).trim());
            }
        }

        // Mappa dei mesi
        const monthMap = {
            gennaio: 1, febbraio: 2, marzo: 3, aprile: 4,
            maggio: 5, giugno: 6, luglio: 7, agosto: 8,
            settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
        };

        const parts = main.split(" ");
        const day = parseInt(parts[0], 10);
        const monthName = parts[1]?.toLowerCase() || "";
        const month = monthMap[monthName] || 1;

        if (!day || !month) {
            return { main: cleanLabel, subtitle: subtitleParts.join("\n"), dateObj: null };
        }

        // 🔑 LOGICA ANNO ASSOCIATIVO
        const year =
            month >= 10
                ? associationYear
                : associationYear + 1;

        const dateObj = new Date(year, month - 1, day);

        const formattedMain = new Intl.DateTimeFormat("it-IT", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
        }).format(dateObj);

        return {
            main: formattedMain,
            subtitle: subtitleParts.join("\n"),
            dateObj,
        };
    };

// ✅ Filtra correttamente le date (mostra/nasconde date passate)
    const filteredDates = Object.keys(groupedData).filter((dateLabel) => {
        const { dateObj } = formatItalianDate(dateLabel);
        if (!dateObj) return false;
        const todayMidnight = new Date();
        todayMidnight.setHours(0, 0, 0, 0);
        return showPastDates || dateObj >= todayMidnight;
    });

// ✅ Ordina le date realmente in ordine cronologico
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
        <Box sx={{ minHeight: "100vh", backgroundColor: "#f8fafc", display: "flex", flexDirection: "column" }}>
            <AppBar position="fixed" elevation={2} sx={{ backgroundColor: "rgba(215,255,186,0.5)", backdropFilter: "blur(8px)", color: "primary.main", zIndex: 1201, width: "100%" }}>
                <Toolbar sx={{
                    display: "flex",
                    flexDirection: "row",
                    justifyContent: "space-between",
                    width: "95%",
                    px: isMobile ? 1.5 : 3,
                    py: isMobile ? 0.5 : 1
                }}>
                    <Typography variant={isMobile ? "h6" : "h5"} fontWeight="bold" color="primary"
                                sx={{flex: 1, textAlign: "left", mb: isMobile ? 1 : 0}}>
                        Disponibilità date <br/><strong>Associazione Ohel</strong>
                    </Typography>
                    <Box sx={{display: "flex", alignItems: "center", flexDirection: isMobile ? "column" : "row"}}>
                        <Box sx={{display: "flex", alignItems: "center"}}>
                            <IconButton onClick={handleClick} color="primary"
                                        size={isMobile ? "small" : "medium"}><FilterListIcon/></IconButton>
                            <Typography onClick={handleClick} variant={isMobile ? "body2" : "body1"}
                                        sx={{cursor: "pointer", mr: 1, fontWeight: 500}}>Filtra</Typography>
                        </Box>
                        <Chip label={getFilterLabel()} onClick={handleClick} color="primary" variant="outlined"
                              size={isMobile ? "small" : "medium"} sx={{ml: 1}}/>
                        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>
                            <MenuItem onClick={() => handleSelectSort("chronological")}>Ordine cronologico</MenuItem>
                            <MenuItem onClick={() => handleSelectSort("peopleDesc")}>Data con più persone</MenuItem>
                            <MenuItem onClick={() => handleSelectSort("peopleAsc")}>Data con meno persone</MenuItem>
                        </Menu>
                        <img style={{ width: isMobile ? "3rem" : "8rem", height: "auto", marginLeft: "10px" }} src="/logo_Ohel.png" alt="logo Ohel"/>
                    </Box>
                </Toolbar>
            </AppBar>
            <Toolbar/>

            <Container maxWidth="md" sx={{ py: 4, flexGrow: 1 }}>
                {loading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}><CircularProgress color="primary" /></Box>
                ) : (
                    <>
                        <Box sx={{ textAlign: "center", mb: 2 }}>
                            <Button variant="outlined" size="small" onClick={() => setShowPastDates(!showPastDates)}>
                                {showPastDates ? "Nascondi date già passate" : "Vedi date già passate"}
                            </Button>
                        </Box>

                        {sortedDates.length === 0 ? (
                            <Typography align="center" color="text.secondary">Nessuna disponibilità trovata.</Typography>
                        ) : (
                            sortedDates.map((date, index) => {
                                const people = groupedData[date];
                                const count = people.length;
                                const { main, subtitle } = formatItalianDate(date);
                                const intolerancesForDate = getIntolerancesForDate(date);
                                const totalIntolerances = Object.keys(intolerancesForDate).length;

                                return (
                                    <Fade in timeout={400 + index * 150} key={date}>
                                        <Card sx={{ mb: 3, borderRadius: 3, boxShadow: 3, "&:hover": { transform: !isMobile ? "scale(1.02)" : "none", transition: "transform 0.2s" } }}>
                                            <CardContent>
                                                <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5} flexWrap={isMobile ? "wrap" : "nowrap"}>
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
                                                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mt: isMobile ? 0.5 : 0 }}>
                                                        {count} {count === 1 ? "persona" : "persone"}
                                                    </Typography>
                                                </Box>

                                                <List dense>
                                                    {people.map((name, i) => (
                                                        <ListItem key={i} disableGutters>
                                                            <ListItemIcon sx={{ minWidth: 30 }}><PersonIcon color="action" sx={{ fontSize: isMobile ? "1rem" : "1.2rem" }} /></ListItemIcon>
                                                            <ListItemText primaryTypographyProps={{ fontSize: isMobile ? "0.9rem" : "1rem" }} primary={name} />
                                                        </ListItem>
                                                    ))}
                                                </List>

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

                                                <Box textAlign="right">
                                                    <Button size="small" onClick={() => openDialogForDate(date)}>Mostra altri dettagli</Button>
                                                </Box>
                                            </CardContent>
                                        </Card>
                                    </Fade>
                                );
                            })
                        )}
                    </>
                )}
            </Container>

            <DateDetailsDialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                dateLabel={dialogData.dateLabel}
                peopleWithResponses={dialogData.peopleWithResponses}
            />

            <Box component="footer" sx={{ textAlign: "center", py: 2, backgroundColor: "rgba(215,255,186,0.5)", mt: "auto", borderTop: "1px solid rgba(0,0,0,0.1)" }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: isMobile ? "0.8rem" : "0.9rem" }}>
                    © 2025 <strong>DigitalCreations</strong>
                </Typography>
            </Box>
        </Box>
    );
};

export default GoogleSheetReader;