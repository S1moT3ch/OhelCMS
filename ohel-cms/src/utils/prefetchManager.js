import CONFIG from "../config/config";
import { getCache, setCache } from "./cacheManager";

/**
 * Esegue il prefetch silenzioso dei dati in background per rendere istantanea
 * la navigazione verso le altre pagine (GoogleSheetReader, SurveyVote, SurveySingleResult).
 *
 * @param {string} email - Email dell'utente corrente
 * @param {Array} activeSurveys - Elenco dei sondaggi attivi dell'utente
 * @param {boolean} isAdmin - Flag che indica se l'utente è un amministratore
 */
export const prefetchBackgroundData = async (email, activeSurveys = [], isAdmin = false) => {
    // Usiamo setTimeout per non impattare le prestazioni di rendering del thread principale della Dashboard
    setTimeout(async () => {
        try {
            const { SHEET_ID, API_KEY, RANGE, URL_APPS_SCRIPT } = CONFIG;

            // 1. Prefetch dati Foglio Presenze Google Sheets (se non presenti o scaduti)
            const cachedSheet = getCache("sheet_availability_data");
            if (!cachedSheet || cachedSheet.isStale) {
                const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(RANGE)}?key=${API_KEY}`;
                fetch(url)
                    .then((r) => r.json())
                    .then((data) => {
                        const values = data.values || [];
                        if (values.length >= 2) {
                            const header = values[0];
                            const dataRows = values.slice(1);
                            const nameIndex = header.findIndex((h) => h.toLowerCase().includes("nome"));
                            const dateColumns = header
                                .map((h, idx) => ({ idx, label: h }))
                                .filter((col) => col.idx > nameIndex && !col.label.toLowerCase().includes("esigenze"));

                            const grouped = {};
                            dataRows.forEach((row) => {
                                const nameCell = row[nameIndex];
                                if (!nameCell) return;
                                const names = nameCell.split(/,|;| e /i).map((n) => n.trim()).filter((n) => n);
                                dateColumns.forEach(({ idx, label }) => {
                                    const cell = row[idx];
                                    if (cell && cell.trim() !== "") {
                                        if (!grouped[label]) grouped[label] = [];
                                        names.forEach((name) => {
                                            if (!grouped[label].includes(name)) grouped[label].push(name);
                                        });
                                    }
                                });
                            });

                            setCache(
                                "sheet_availability_data",
                                { groupedData: grouped, rawRows: dataRows, headerRow: header },
                                10 * 60 * 1000
                            );
                        }
                    })
                    .catch((err) => console.warn("[PREFETCH] Errore caricamento presenze foglio:", err));
            }

            // 2. Prefetch Anno Associativo (se non presente o scaduto)
            const cachedYear = getCache("sheet_association_year");
            if (!cachedYear || cachedYear.isStale) {
                const SHEET_YEAR_ID = "1OMAGTsjjBQG1lGnn3GmTszjSQ4F1f4gagl7A7usb_lA";
                const RANGE_YEAR = "Foglio1";
                const urlYear = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_YEAR_ID}/values/${RANGE_YEAR}?key=${API_KEY}`;

                fetch(urlYear)
                    .then((r) => r.json())
                    .then((data) => {
                        if (data && data.values) {
                            const rowWithYear = data.values.find((r) => r && r.length > 1 && !isNaN(parseInt(r[1], 10)));
                            const yearVal = rowWithYear ? parseInt(rowWithYear[1], 10) : null;
                            if (yearVal) {
                                setCache("sheet_association_year", yearVal, 60 * 60 * 1000);
                            }
                        }
                    })
                    .catch((err) => console.warn("[PREFETCH] Errore caricamento anno associativo:", err));
            }

            // 3. Prefetch dei voti utente e dei risultati generali per ciascun sondaggio attivo
            if (activeSurveys && activeSurveys.length > 0) {
                activeSurveys.forEach((survey) => {
                    const fullId = survey.idSondaggio || "";
                    const id = fullId.replace("SURV_", "");
                    if (!id) return;

                    // Prefetch voti personali dell'utente (se ha già votato)
                    if (survey.voted && email) {
                        const cachedVotes = getCache(`survey_user_votes_${id}_${email}`);
                        if (!cachedVotes || cachedVotes.isStale) {
                            fetch(`${URL_APPS_SCRIPT}?action=GET_USER_VOTES&email=${encodeURIComponent(email)}&idSondaggio=SURV_${id}`)
                                .then((r) => r.json())
                                .then((dataVotes) => {
                                    if (dataVotes.status === "success" && dataVotes.dataByMember) {
                                        setCache(`survey_user_votes_${id}_${email}`, dataVotes, 5 * 60 * 1000);
                                    }
                                })
                                .catch((err) => console.warn(`[PREFETCH] Errore voti utente per sondaggio ${id}:`, err));
                        }
                    }

                    // Prefetch risultati aggregati di tutti i soci per questo sondaggio
                    const cachedAllVotes = getCache(`survey_all_votes_${id}`);
                    if (!cachedAllVotes || cachedAllVotes.isStale) {
                        fetch(`${URL_APPS_SCRIPT}?action=GET_ALL_SURVEY_VOTES&idSondaggio=SURV_${id}`)
                            .then((r) => r.json())
                            .then((dataVotes) => {
                                if (dataVotes.status === "success" && dataVotes.dataByMember) {
                                    const detailsMap = {};
                                    (survey.dates || []).forEach((d) => {
                                        detailsMap[d.date] = d;
                                    });

                                    const parsedGrouped = {};
                                    Object.entries(dataVotes.dataByMember).forEach(([memberName, memberInfo]) => {
                                        const { selections, absences, selectedIntolerances, customIntolerance, generalNotes } = memberInfo;
                                        const intolerances = [...(selectedIntolerances || [])];
                                        if (customIntolerance && customIntolerance.trim()) {
                                            intolerances.push(customIntolerance.trim());
                                        }

                                        Object.keys(selections || {}).forEach((dateStr) => {
                                            if (!parsedGrouped[dateStr]) parsedGrouped[dateStr] = [];
                                            const isAbsent = !!absences?.[dateStr];
                                            const slots = selections[dateStr] || [];
                                            if (!isAbsent && slots.length > 0) {
                                                parsedGrouped[dateStr].push({
                                                    name: memberName,
                                                    slots: slots,
                                                    isAbsent: false,
                                                    intolerances: intolerances,
                                                    notes: generalNotes || "",
                                                });
                                            }
                                        });
                                    });

                                    setCache(
                                        `survey_all_votes_${id}`,
                                        {
                                            surveyTitle: survey.title,
                                            dateDetailsMap: detailsMap,
                                            groupedData: parsedGrouped,
                                        },
                                        5 * 60 * 1000
                                    );
                                }
                            })
                            .catch((err) => console.warn(`[PREFETCH] Errore risultati sondaggio ${id}:`, err));
                    }
                });
            }

            // 4. Prefetch dati Gestione Sondaggi per utenti Admin
            if (isAdmin && email) {
                const cachedManageSurveys = getCache("surveys_manage_admin");
                if (!cachedManageSurveys || cachedManageSurveys.isStale) {
                    fetch(`${URL_APPS_SCRIPT}?action=GET_ALL_SURVEYS&email=${encodeURIComponent(email)}`)
                        .then((r) => r.json())
                        .then((data) => {
                            if (data.status === "success" && data.surveys) {
                                const processedSurveys = data.surveys.map((s) => ({
                                    ...s,
                                    active: s.status ? s.status === "ATTIVO" : (s.active !== undefined ? Boolean(s.active) : true)
                                }));
                                setCache("surveys_manage_admin", processedSurveys, 5 * 60 * 1000);
                            }
                        })
                        .catch((err) => console.warn("[PREFETCH] Errore caricamento Gestione Sondaggi Admin:", err));
                }
            }
        } catch (err) {
            console.warn("[PREFETCH] Errore prefetch in background:", err);
        }
    }, 200);
};
