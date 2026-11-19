import io
import re
import base64
from datetime import datetime, date, time
from typing import Dict, Any, List, Optional, Tuple
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# Sinonimi supportati per le colonne del questionario
COLUMN_SYNONYMS = {
    "date": ["data", "date", "giorno", "giorno/data"],
    "startTime": ["ora inizio", "orario inizio", "ora_inizio", "inizio", "start", "dalle", "start time"],
    "endTime": ["ora fine", "orario fine", "ora_fine", "fine", "end", "alle", "end time"],
    "subtitle": ["sottotitolo", "subtitle", "titolo turno", "nome turno", "attività", "attivita", "evento", "descrizione turno"],
    "timeSlots": ["fasce orarie", "fasce", "turni", "fasce_orarie", "time slots", "slots", "slot", "orari"],
    "notes": ["note", "notes", "dettagli", "note aggiuntive", "informazioni", "avvertenze"]
}

def clean_header_str(val: Any) -> str:
    """Pulisce e normalizza una stringa di intestazione per il confronto."""
    if val is None:
        return ""
    text = str(val).strip().lower()
    # Rimuove caratteri speciali comuni
    text = re.sub(r"[\*_:;\t\r\n]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text

def is_header_match(header_text: str, synonyms: List[str]) -> bool:
    """Verifica se una cella di header corrisponde a uno dei sinonimi."""
    if not header_text or len(header_text) > 40:
        return False
    # Evita frasi lunghe o istruzioni
    if len(header_text.split()) > 4:
        return False

    for syn in synonyms:
        if header_text == syn:
            return True
        # Verifica se syn compare come parola intera delimitata
        pattern = r"(^|\s)" + re.escape(syn) + r"(\s|$)"
        if re.search(pattern, header_text):
            return True
    return False

def parse_date_value(val: Any) -> Optional[str]:
    """
    Normalizza qualsiasi valore data nel formato standard ISO 'YYYY-MM-DD'.
    Supporta oggetti date/datetime di Python/Excel e stringhe comuni.
    """
    if val is None:
        return None

    if isinstance(val, (datetime, date)):
        return val.strftime("%Y-%m-%d")

    val_str = str(val).strip()
    if not val_str:
        return None

    # Tenta vari formati comuni
    date_formats = [
        "%Y-%m-%d",
        "%d/%m/%Y",
        "%d-%m-%Y",
        "%d.%m.%Y",
        "%Y/%m/%d",
        "%d/%m/%y",
        "%d-%m-%y"
    ]

    for fmt in date_formats:
        try:
            parsed = datetime.strptime(val_str, fmt)
            return parsed.strftime("%Y-%m-%d")
        except ValueError:
            continue

    # Fallback tramite regex per formati tipo YYYY-M-D o D/M/YYYY
    match_iso = re.match(r"^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})", val_str)
    if match_iso:
        y, m, d = match_iso.groups()
        return f"{int(y):04d}-{int(m):02d}-{int(d):02d}"

    match_it = re.match(r"^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})", val_str)
    if match_it:
        d, m, y = match_it.groups()
        return f"{int(y):04d}-{int(m):02d}-{int(d):02d}"

    return None

def parse_time_value(val: Any, default: str = "08:00") -> str:
    """
    Normalizza qualsiasi valore orario nel formato 'HH:MM'.
    Supporta oggetti time/datetime di Python/Excel, numeri float/decimali e stringhe.
    """
    if val is None:
        return default

    if isinstance(val, time):
        return val.strftime("%H:%M")

    if isinstance(val, datetime):
        return val.strftime("%H:%M")

    if isinstance(val, (int, float)):
        # Excel memorizza gli orari come frazioni di giorno (es. 0.5 = 12:00)
        if 0 <= val <= 1:
            total_seconds = int(round(val * 86400))
            hours = (total_seconds // 3600) % 24
            minutes = (total_seconds % 3600) // 60
            return f"{hours:02d}:{minutes:02d}"

    val_str = str(val).strip()
    if not val_str:
        return default

    # Tenta corrispondenza HH:MM o H:M o HH.MM
    match = re.search(r"(\d{1,2})[:.](\d{1,2})", val_str)
    if match:
        h, m = int(match.group(1)), int(match.group(2))
        if 0 <= h < 24 and 0 <= m < 60:
            return f"{h:02d}:{m:02d}"

    # Solo ora (es. '8' o '20')
    match_h = re.match(r"^(\d{1,2})$", val_str)
    if match_h:
        h = int(match_h.group(1))
        if 0 <= h < 24:
            return f"{h:02d}:00"

    return default

def parse_slots_value(val: Any) -> List[str]:
    """
    Normalizza le fasce orarie in una lista di stringhe pulite.
    Default: ['Mattina', 'Pomeriggio', 'Sera'] se vuoto.
    """
    default_slots = ["Mattina", "Pomeriggio", "Sera"]
    if val is None:
        return default_slots

    val_str = str(val).strip()
    if not val_str:
        return default_slots

    # Separa per virgola, punto e virgola, slash o newline
    parts = re.split(r"[,;\n/]+", val_str)
    slots = [p.strip() for p in parts if p.strip()]

    return slots if slots else default_slots

def identify_columns(headers: List[Any]) -> Dict[str, int]:
    """
    Mappa i campi logici ('date', 'startTime', ecc.) agli indici delle colonne
    basandosi sull'elenco di sinonimi supportati.
    """
    col_map: Dict[str, int] = {}
    cleaned_headers = [clean_header_str(h) for h in headers]

    for field, synonyms in COLUMN_SYNONYMS.items():
        for idx, h_text in enumerate(cleaned_headers):
            if not h_text:
                continue
            if is_header_match(h_text, synonyms):
                if field not in col_map:
                    col_map[field] = idx
                    break

    return col_map

def extract_metadata_from_sheet(sheet) -> Tuple[Optional[str], Optional[str], Optional[int]]:
    """
    Cerca di estrarre Titolo e Descrizione da celle di intestazione tipo:
    'Titolo:' -> [Valore]
    'Descrizione:' -> [Valore]
    Restituisce (titolo, descrizione, riga_inizio_dati)
    """
    title = None
    description = None
    table_header_row_idx = None

    max_check_rows = min(sheet.max_row, 15)

    for r_idx in range(1, max_check_rows + 1):
        row_values = [sheet.cell(row=r_idx, column=c_idx).value for c_idx in range(1, 10)]
        cleaned_first = clean_header_str(row_values[0]) if len(row_values) > 0 else ""

        # Controllo se è una riga chiave-valore di titolo
        if "titolo" in cleaned_first and "sottotitolo" not in cleaned_first:
            # Il valore può essere nella cella B o subito dopo
            for c in row_values[1:]:
                if c and str(c).strip():
                    title = str(c).strip()
                    break

        # Controllo se è una riga chiave-valore di descrizione
        elif "descrizione" in cleaned_first and "descrizione turno" not in cleaned_first:
            for c in row_values[1:]:
                if c and str(c).strip():
                    description = str(c).strip()
                    break

        # Verifica se questa riga è invece l'inizio della tabella (contiene la colonna 'Data')
        col_map = identify_columns(row_values)
        if "date" in col_map:
            table_header_row_idx = r_idx
            break

    return title, description, table_header_row_idx

def parse_survey_excel_data(file_bytes: bytes, original_filename: str = "") -> Dict[str, Any]:
    """
    Esegue il parsing di un file Excel (.xlsx) contenente un questionario Ohel.
    Restituisce un dizionario con { "success": True, "survey": {...} } oppure { "success": False, "error": "..." }.
    """
    try:
        workbook = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    except Exception as e:
        return {
            "success": False,
            "error": f"Impossibile leggere il file Excel. Assicurati che sia un file .xlsx valido. Dettaglio: {str(e)}"
        }

    sheet_names = workbook.sheetnames
    if not sheet_names:
        return {"success": False, "error": "Il file Excel non contiene alcun foglio di lavoro."}

    title = None
    description = None
    dates_list: List[Dict[str, Any]] = []

    # 1. Controlla se esiste un foglio dedicato ai metadati (es. 'Info', 'Questionario', 'Generale')
    info_sheet = None
    data_sheet = None

    for name in sheet_names:
        lower_name = name.strip().lower()
        if lower_name in ["info", "informazioni", "questionario", "dati generali", "generale", "metadata"]:
            info_sheet = workbook[name]
        elif lower_name in ["date", "turni", "disponibilità", "disponibilita", "sessioni", "opzioni", "foglio1", "sheet1"]:
            data_sheet = workbook[name]

    if info_sheet:
        t, d, _ = extract_metadata_from_sheet(info_sheet)
        if t:
            title = t
        if d:
            description = d

    # Se data_sheet non è esplicitamente individuato, cerca il foglio con la colonna 'Data'
    if not data_sheet:
        for name in sheet_names:
            sheet_candidate = workbook[name]
            _, _, header_row = extract_metadata_from_sheet(sheet_candidate)
            if header_row:
                data_sheet = sheet_candidate
                break

    # Se ancora non trovato, usiamo il primo foglio
    if not data_sheet:
        data_sheet = workbook.active

    # Estrae metadati e riga header dal foglio dati se non ancora trovati
    sheet_title, sheet_desc, header_row_idx = extract_metadata_from_sheet(data_sheet)
    if not title and sheet_title:
        title = sheet_title
    if not description and sheet_desc:
        description = sheet_desc

    # Se ancora nessun titolo, usiamo il nome del file ripulito
    if not title:
        base_name = original_filename.rsplit(".", 1)[0] if original_filename else "Nuovo Sondaggio"
        base_name = re.sub(r"[_-]+", " ", base_name).strip()
        title = base_name.title() if base_name else "Sondaggio Importato da Excel"

    if not description:
        description = "Sondaggio di disponibilità importato da file Excel."

    # Trova la riga di intestazione delle colonne
    if not header_row_idx:
        for r in range(1, min(data_sheet.max_row, 10) + 1):
            row_vals = [data_sheet.cell(row=r, column=c).value for c in range(1, 15)]
            col_map = identify_columns(row_vals)
            if "date" in col_map:
                header_row_idx = r
                break

    if not header_row_idx:
        # Tenta di assumere riga 1 come header
        header_row_idx = 1

    header_values = [data_sheet.cell(row=header_row_idx, column=c).value for c in range(1, 15)]
    col_map = identify_columns(header_values)

    if "date" not in col_map:
        return {
            "success": False,
            "error": "Colonna 'Data' non trovata nel foglio Excel. Assicurati che una colonna sia intitolata 'Data' o 'Giorno'."
        }

    date_col = col_map["date"] + 1
    start_col = (col_map["startTime"] + 1) if "startTime" in col_map else None
    end_col = (col_map["endTime"] + 1) if "endTime" in col_map else None
    sub_col = (col_map["subtitle"] + 1) if "subtitle" in col_map else None
    slots_col = (col_map["timeSlots"] + 1) if "timeSlots" in col_map else None
    notes_col = (col_map["notes"] + 1) if "notes" in col_map else None

    # Parsing delle righe dati a partire dalla riga successiva all'header
    for r_idx in range(header_row_idx + 1, data_sheet.max_row + 1):
        raw_date = data_sheet.cell(row=r_idx, column=date_col).value
        if raw_date is None or str(raw_date).strip() == "":
            continue

        normalized_date = parse_date_value(raw_date)
        if not normalized_date:
            # Riga ignorata se non è una data valida
            continue

        raw_start = data_sheet.cell(row=r_idx, column=start_col).value if start_col else None
        raw_end = data_sheet.cell(row=r_idx, column=end_col).value if end_col else None
        raw_sub = data_sheet.cell(row=r_idx, column=sub_col).value if sub_col else None
        raw_slots = data_sheet.cell(row=r_idx, column=slots_col).value if slots_col else None
        raw_notes = data_sheet.cell(row=r_idx, column=notes_col).value if notes_col else None

        start_time = parse_time_value(raw_start, default="08:00")
        end_time = parse_time_value(raw_end, default="20:00")
        subtitle = str(raw_sub).strip() if raw_sub is not None else ""
        slots = parse_slots_value(raw_slots)
        notes = str(raw_notes).strip() if raw_notes is not None else ""

        dates_list.append({
            "date": normalized_date,
            "timeRange": {
                "start": start_time,
                "end": end_time
            },
            "subtitle": subtitle,
            "timeSlots": slots,
            "notes": notes
        })

    if not dates_list:
        return {
            "success": False,
            "error": "Nessuna data valida trovata nel file Excel. Verifica che la colonna 'Data' contenga date valide (es. 2026-12-15 o 15/12/2026)."
        }

    # Ordina cronologicamente le date
    dates_list.sort(key=lambda d: d.get("date", ""))

    return {
        "success": True,
        "survey": {
            "title": title,
            "description": description,
            "dates": dates_list
        }
    }

def parse_excel_base64(file_base64: str, file_name: str = "") -> Dict[str, Any]:
    """
    Decodifica una stringa base64 (anche con prefisso data:...) e ne esegue il parsing.
    """
    if not file_base64:
        return {"success": False, "error": "Dati del file assenti (fileBase64 vuoto)."}

    clean_b64 = file_base64
    if "," in clean_b64:
        clean_b64 = clean_b64.split(",", 1)[1]

    try:
        file_bytes = base64.b64decode(clean_b64)
    except Exception as e:
        return {"success": False, "error": f"Codifica base64 non valida: {str(e)}"}

    return parse_survey_excel_data(file_bytes, file_name)

def generate_survey_excel_template() -> bytes:
    """
    Genera un file Excel (.xlsx) professionale e completo di esempio/template
    con formattazione visiva coordinata alla palette di OhelCMS.
    """
    wb = openpyxl.Workbook()

    # Foglio 1: Date e Turni del questionario
    ws = wb.active
    ws.title = "Questionario e Turni"

    # Palette
    color_header_bg = "2E5B43"      # Ohel Green
    color_header_fg = "FFFFFF"
    color_meta_bg = "F4F7F5"        # Ohel Light Green
    color_border = "D0DCD5"

    font_title = Font(name="Segoe UI", size=14, bold=True, color="2E5B43")
    font_bold = Font(name="Segoe UI", size=10, bold=True, color="1E382B")
    font_regular = Font(name="Segoe UI", size=10, color="1E382B")
    font_header = Font(name="Segoe UI", size=10, bold=True, color=color_header_fg)
    font_notes = Font(name="Segoe UI", size=9, italic=True, color="52796F")

    fill_header = PatternFill(start_color=color_header_bg, end_color=color_header_bg, fill_type="solid")
    fill_meta_label = PatternFill(start_color="E5EFE9", end_color="E5EFE9", fill_type="solid")
    fill_meta_val = PatternFill(start_color=color_meta_bg, end_color=color_meta_bg, fill_type="solid")
    fill_zebra = PatternFill(start_color="FAFCFA", end_color="FAFCFA", fill_type="solid")

    thin_border = Border(
        left=Side(style="thin", color=color_border),
        right=Side(style="thin", color=color_border),
        top=Side(style="thin", color=color_border),
        bottom=Side(style="thin", color=color_border)
    )

    # Titolo del template
    ws["A1"] = "CONFIGURAZIONE QUESTIONARIO OHEL"
    ws["A1"].font = font_title
    ws.merge_cells("A1:F1")

    # Metadati
    ws["A3"] = "Titolo:"
    ws["A3"].font = font_bold
    ws["A3"].fill = fill_meta_label
    ws["B3"] = "Disponibilità Turni e Attività Associazione Ohel - Dicembre 2026"
    ws["B3"].font = font_regular
    ws["B3"].fill = fill_meta_val
    ws.merge_cells("B3:F3")

    ws["A4"] = "Descrizione:"
    ws["A4"].font = font_bold
    ws["A4"].fill = fill_meta_label
    ws["B4"] = "Gentili soci, vi chiediamo di indicare le vostre presenze e fasce orarie preferite per le attività del mese di dicembre. È possibile segnalare anche intolleranze alimentari e aggiungere familiari."
    ws["B4"].font = font_regular
    ws["B4"].fill = fill_meta_val
    ws.merge_cells("B4:F4")

    # Istruzioni rapide
    ws["A5"] = "Istruzioni:"
    ws["A5"].font = font_bold
    ws["A5"].fill = fill_meta_label
    ws["B5"] = "Compila la tabella sottostante. La colonna 'Data' è obbligatoria. Le fasce orarie possono essere personalizzate separandole con la virgola."
    ws["B5"].font = font_notes
    ws["B5"].fill = fill_meta_val
    ws.merge_cells("B5:F5")

    # Riga vuota
    # Tabella Intestazioni (Riga 7)
    headers = [
        ("Data", "Data nel formato AAAA-MM-GG o GG/MM/AAAA"),
        ("Ora Inizio", "Orario inizio (es. 08:00)"),
        ("Ora Fine", "Orario fine (es. 20:00)"),
        ("Sottotitolo / Evento", "Denominazione o tipologia attività"),
        ("Fasce Orarie", "Fasce separate da virgola (es. Mattina, Pomeriggio, Sera)"),
        ("Note", "Informazioni aggiuntive per i partecipanti")
    ]

    for col_idx, (h_title, _) in enumerate(headers, start=1):
        cell = ws.cell(row=7, column=col_idx, value=h_title)
        cell.font = font_header
        cell.fill = fill_header
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thin_border
    ws.row_dimensions[7].height = 26

    # Dati di esempio
    sample_rows = [
        ("2026-12-05", "08:30", "19:30", "Apertura Straordinaria e Accoglienza", "Mattina, Pomeriggio, Sera", "Richiesta puntualità per briefing iniziale"),
        ("2026-12-12", "09:00", "18:00", "Turno Ordinario e Laboratori", "Mattina, Pomeriggio", "Pranzo al sacco incluso per chi copre l'intera giornata"),
        ("2026-12-19", "08:00", "22:00", "Festa d'Inverno e Buffet Soci", "Mattina, Pomeriggio, Sera", "Segnalare intolleranze alimentari nello step 2"),
        ("2026-12-26", "10:00", "17:00", "Presidio Solidale Festività", "Mattina, Pomeriggio", "Turno ridotto per festività")
    ]

    for row_offset, row_data in enumerate(sample_rows, start=8):
        for col_idx, val in enumerate(row_data, start=1):
            cell = ws.cell(row=row_offset, column=col_idx, value=val)
            cell.font = font_regular
            cell.border = thin_border
            if row_offset % 2 == 0:
                cell.fill = fill_zebra
            if col_idx in [1, 2, 3]:
                cell.alignment = Alignment(horizontal="center", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")
        ws.row_dimensions[row_offset].height = 22

    # Dimensionamento automatico larghezza colonne
    col_widths = [16, 14, 14, 38, 32, 42]
    for idx, width in enumerate(col_widths, start=1):
        col_letter = get_column_letter(idx)
        ws.column_dimensions[col_letter].width = width

    # Foglio 2: Guida ai campi
    ws_guide = wb.create_sheet(title="Guida Colonne")
    guide_headers = ["Colonna", "Obbligatoria", "Formato Accettato", "Descrizione", "Esempio"]
    for col_idx, h in enumerate(guide_headers, start=1):
        c = ws_guide.cell(row=1, column=col_idx, value=h)
        c.font = font_header
        c.fill = fill_header
        c.border = thin_border
        c.alignment = Alignment(horizontal="center", vertical="center")
    ws_guide.row_dimensions[1].height = 24

    guide_rows = [
        ("Data", "Sì", "AAAA-MM-GG oppure GG/MM/AAAA", "Data del turno o della sessione di voto", "2026-12-15 oppure 15/12/2026"),
        ("Ora Inizio", "No (default 08:00)", "HH:MM (24 ore)", "Orario di avvio del turno", "08:30"),
        ("Ora Fine", "No (default 20:00)", "HH:MM (24 ore)", "Orario di chiusura del turno", "19:00"),
        ("Sottotitolo / Evento", "No", "Testo libero", "Titolo esplicativo del giorno o tipologia evento", "Turno Accoglienza e Banco"),
        ("Fasce Orarie", "No (default Mattina, Pomeriggio, Sera)", "Testo con valori separati da virgola", "Turni specifici selezionabili dagli utenti", "Mattina, Pomeriggio, Sera"),
        ("Note", "No", "Testo libero", "Dettagli o avvertenze mostrate agli utenti", "Breve nota logistica")
    ]

    for row_idx, r_data in enumerate(guide_rows, start=2):
        for col_idx, val in enumerate(r_data, start=1):
            c = ws_guide.cell(row=row_idx, column=col_idx, value=val)
            c.font = font_regular
            c.border = thin_border
            if row_idx % 2 == 1:
                c.fill = fill_zebra
            if col_idx in [1, 2, 3]:
                c.alignment = Alignment(horizontal="center", vertical="center")
            else:
                c.alignment = Alignment(horizontal="left", vertical="center")
        ws_guide.row_dimensions[row_idx].height = 22

    guide_widths = [22, 16, 32, 45, 30]
    for idx, width in enumerate(guide_widths, start=1):
        col_letter = get_column_letter(idx)
        ws_guide.column_dimensions[col_letter].width = width

    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()
