import React from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    Box,
    Typography,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    DialogActions,
    Button,
    Stack,
    useTheme,
    useMediaQuery
} from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import RestaurantIcon from "@mui/icons-material/Restaurant";
import StickyNote2Icon from "@mui/icons-material/StickyNote2";

const DateDetailsDialog = ({ open, onClose, dateLabel, peopleWithResponses }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    // Parole chiave flessibili per identificare le opzioni di presenza/fasce orarie
    const dayKeywords = [
        "mattina",
        "pomeriggio",
        "sera",
        "notte",
        "pranzo",
        "cena",
        "giornata",
        "giorno",
        "posto",
        "passaggio",
        "presenza",
        "turno",
        "orario",
        "disponibil",
        "partecip"
    ];

    // Ordine cronologico delle fasce orarie per l'ordinamento
    const CHRONOLOGICAL_ORDER = [
        "mattina",
        "pranzo",
        "pomeriggio",
        "sera",
        "cena",
        "notte",
        "giornata",
        "giorno",
        "passaggio",
        "posto"
    ];

    const getChronologicalIndex = (key) => {
        const lowerKey = key.trim().toLowerCase();
        const index = CHRONOLOGICAL_ORDER.findIndex(k => lowerKey.includes(k));
        return index !== -1 ? index : 999;
    };

    const options = {};
    const notes = {};
    const intolerances = {};

    // Separazione: opzioni del giorno vs note vs intolleranze
    Object.entries(peopleWithResponses || {}).forEach(([key, people]) => {
        if (!people || people.length === 0) return;

        const normalizedKey = key.trim().toLowerCase();

        // Controllo se è una nota (prefissata con 📝 o contenente la parola 'nota')
        const isNote = key.startsWith("📝") || normalizedKey.includes("nota") || normalizedKey.includes("note");

        // Controllo se è un'opzione di fascia oraria / presenza
        const isDayOption = !isNote && !key.startsWith("🍏") && dayKeywords.some((keyword) => normalizedKey.includes(keyword));

        if (isNote) {
            notes[key] = people;
        } else if (isDayOption) {
            options[key] = people;
        } else {
            // Intolleranza alimentare o altra esigenza speciale
            intolerances[key] = people;
        }
    });

    // Ordinamento cronologico delle fasce orarie (Mattina -> Pranzo -> Pomeriggio -> Sera -> Cena -> Notte)
    const sortedOptions = Object.entries(options).sort((a, b) => {
        const indexA = getChronologicalIndex(a[0]);
        const indexB = getChronologicalIndex(b[0]);
        return indexA - indexB;
    });

    // Elenco unico delle persone coinvolte in questa specifica data
    const peopleInDate = new Set(
        Object.values(options)
            .flat()
            .map((p) => p.name)
    );

    // Se non ci sono opzioni esplicite ma ci sono risposte, includiamo tutte le persone
    if (peopleInDate.size === 0) {
        Object.values(peopleWithResponses || {}).flat().forEach(p => {
            if (p?.name) peopleInDate.add(p.name);
        });
    }

    // Filtriamo le intolleranze mostrando solo quelle delle persone effettivamente presenti nella data
    const intolerancesFiltered = {};
    Object.entries(intolerances).forEach(([intol, people]) => {
        const involved = people.filter((p) => peopleInDate.has(p.name));
        if (involved.length > 0) intolerancesFiltered[intol] = involved;
    });

    // Filtriamo le note per la data
    const notesFiltered = {};
    Object.entries(notes).forEach(([noteKey, people]) => {
        const involved = people.filter((p) => peopleInDate.has(p.name));
        if (involved.length > 0) notesFiltered[noteKey] = involved;
    });

    // Trasformazione delle note filtrate in un elenco pulito di note individuali
    const notesList = [];
    Object.entries(notesFiltered).forEach(([noteKey, people]) => {
        const cleanNoteText = noteKey
            .replace(/^📝\s*Nota:\s*/i, "")
            .replace(/^Nota:\s*/i, "")
            .replace(/^📝\s*/i, "")
            .trim();

        people.forEach((p) => {
            notesList.push({
                name: p.name,
                text: cleanNoteText
            });
        });
    });

    // Renderizzatore universale delle schede per categoria (Fasce Orarie vs Intolleranze)
    const renderPeopleBox = (title, people, type = "option") => {
        const isIntolerance = type === "intolerance";
        const borderColor = isIntolerance ? "#fecaca" : "grey.300";
        const bgColor = isIntolerance ? "rgba(254, 226, 226, 0.4)" : "rgba(255,255,255,1)";
        const titleColor = isIntolerance ? "#c2410c" : "primary.main";
        const IconComponent = isIntolerance ? RestaurantIcon : PersonIcon;
        const iconColor = isIntolerance ? "#c2410c" : "#2e5b43";

        return (
            <Box
                key={title}
                flex={1}
                minWidth={180}
                border={1}
                borderColor={borderColor}
                borderRadius={3}
                p={1.5}
                sx={{
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                    backgroundColor: bgColor,
                    transition: "all 0.2s ease",
                    "&:hover": {
                        transform: !isMobile ? "translateY(-2px)" : "none",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)"
                    }
                }}
            >
                <Typography
                    fontWeight="800"
                    mb={0.8}
                    color={titleColor}
                    sx={{ fontSize: isMobile ? "1.05rem" : "0.95rem", lineHeight: 1.2 }}
                >
                    {title} ({people.length} {people.length === 1 ? "persona" : "persone"})
                </Typography>
                <List dense disablePadding>
                    {people.map((p, i) => (
                        <ListItem key={i} disableGutters sx={{ py: 0.3 }}>
                            <ListItemIcon sx={{ minWidth: 26 }}>
                                <IconComponent
                                    sx={{
                                        fontSize: isMobile ? "1.1rem" : "1.1rem",
                                        color: iconColor
                                    }}
                                />
                            </ListItemIcon>
                            <ListItemText
                                primaryTypographyProps={{
                                    fontSize: isMobile ? "0.95rem" : "0.9rem",
                                    fontWeight: 600
                                }}
                                primary={p.name}
                            />
                        </ListItem>
                    ))}
                </List>
            </Box>
        );
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle
                sx={{
                    fontWeight: "800",
                    color: "#1e382b",
                    backgroundColor: "rgba(46, 91, 67, 0.08)",
                    pb: 1.5
                }}
            >
                Dettagli data
                <Typography fontSize="0.95rem" color="#52796f" fontWeight="600">{dateLabel}</Typography>
            </DialogTitle>

            <DialogContent dividers sx={{ py: 2.5, display: "flex", flexDirection: "column", gap: 2.5 }}>

                {/* 1. Fasce Orarie e Presenze della giornata (IN ORDINE CRONOLOGICO) */}
                {sortedOptions.length > 0 && (
                    <Box display="flex" flexWrap="wrap" gap={1.8}>
                        {sortedOptions.map(([option, people]) =>
                            renderPeopleBox(option, people, "option")
                        )}
                    </Box>
                )}

                {/* 2. Intolleranze e Esigenze Alimentari */}
                {Object.keys(intolerancesFiltered).length > 0 && (
                    <Box>
                        <Box display="flex" alignItems="center" mb={1.5}>
                            <Box flexGrow={1} height={1} bgcolor="grey.300" />
                            <Typography
                                variant="caption"
                                sx={{
                                    mx: 1.5,
                                    color: "#c2410c",
                                    fontWeight: 800,
                                    fontSize: "0.78rem",
                                    letterSpacing: 0.5,
                                    textTransform: "uppercase"
                                }}
                            >
                                🍽️ Intolleranze / Esigenze Alimentari
                            </Typography>
                            <Box flexGrow={1} height={1} bgcolor="grey.300" />
                        </Box>
                        <Box display="flex" flexWrap="wrap" gap={1.8}>
                            {Object.entries(intolerancesFiltered).map(([intol, people]) =>
                                renderPeopleBox(intol, people, "intolerance")
                            )}
                        </Box>
                    </Box>
                )}

                {/* 3. Sezione Dedicata Note e Segnalazioni dei Soci (IN FONDO, SOTTO LE INTOLLERANZE) */}
                {notesList.length > 0 && (
                    <Box>
                        <Box display="flex" alignItems="center" mb={1.5}>
                            <Box flexGrow={1} height={1} bgcolor="grey.300" />
                            <Typography
                                variant="caption"
                                sx={{
                                    mx: 1.5,
                                    color: "#b45309",
                                    fontWeight: 800,
                                    fontSize: "0.78rem",
                                    letterSpacing: 0.5,
                                    textTransform: "uppercase"
                                }}
                            >
                                📝 Note e Segnalazioni dei Soci ({notesList.length})
                            </Typography>
                            <Box flexGrow={1} height={1} bgcolor="grey.300" />
                        </Box>

                        <Stack gap={1.2}>
                            {notesList.map((item, idx) => (
                                <Box
                                    key={idx}
                                    sx={{
                                        p: 1.6,
                                        borderRadius: "14px",
                                        backgroundColor: "#fffbeb",
                                        border: "1px solid #fde68a",
                                        boxShadow: "0 2px 8px rgba(180, 83, 9, 0.05)",
                                        display: "flex",
                                        alignItems: "flex-start",
                                        gap: 1.4
                                    }}
                                >
                                    <StickyNote2Icon sx={{ color: "#b45309", fontSize: "1.25rem", mt: 0.2, shrink: 0 }} />
                                    <Box flex={1}>
                                        <Typography variant="subtitle2" fontWeight="800" sx={{ color: "#78350f", fontSize: "0.9rem", lineHeight: 1.2 }}>
                                            {item.name}
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: "#92400e", fontSize: "0.85rem", lineHeight: 1.35, fontStyle: "italic", mt: 0.4 }}>
                                            "{item.text}"
                                        </Typography>
                                    </Box>
                                </Box>
                            ))}
                        </Stack>
                    </Box>
                )}

            </DialogContent>

            <DialogActions
                sx={{
                    backgroundColor: "#f4f7f5",
                    borderTop: "1px solid rgba(0,0,0,0.08)",
                    px: 2.5,
                    py: 1.5
                }}
            >
                <Button
                    onClick={onClose}
                    variant="contained"
                    sx={{
                        backgroundColor: "#2e5b43",
                        color: "#ffffff",
                        borderRadius: "10px",
                        fontWeight: 700,
                        textTransform: "none",
                        px: 3,
                        "&:hover": { backgroundColor: "#1e382b" }
                    }}
                >
                    Chiudi
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default DateDetailsDialog;