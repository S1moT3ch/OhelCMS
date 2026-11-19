import os
import sys
import shutil
import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from services.excel_survey_service import generate_survey_excel_template

# Colori Ohel
COLOR_PRIMARY = RGBColor(0x2E, 0x5B, 0x43)      # #2e5b43
COLOR_SECONDARY = RGBColor(0x52, 0x79, 0x6F)    # #52796f
COLOR_TEXT = RGBColor(0x1E, 0x38, 0x2B)         # #1e382b
COLOR_MUTED = RGBColor(0x66, 0x70, 0x85)        # Grigio scuro

HEX_PRIMARY = "2E5B43"
HEX_SECONDARY = "52796F"
HEX_LIGHT_BG = "F4F7F5"
HEX_ZEBRA = "F9FBF9"
HEX_BORDER = "D0DCD5"

def set_cell_background(cell, hex_color):
    """Imposta il colore di sfondo di una cella DOCX."""
    shading_elm = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>')
    cell._tc.get_or_add_tcPr().append(shading_elm)

def set_cell_margins(cell, top=120, bottom=120, left=150, right=150):
    """Imposta il padding interno di una cella in dxa (1 pt = 20 dxa)."""
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for margin_name, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{margin_name}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def create_sample_docx(file_path: str):
    doc = Document()

    # Impostazioni pagina (Margini 2 cm)
    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.8)
        section.right_margin = Inches(0.8)

    # Titolo Principale
    title_p = doc.add_paragraph()
    title_p.paragraph_format.space_before = Pt(0)
    title_p.paragraph_format.space_after = Pt(4)
    title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run_title = title_p.add_run("ASSOCIAZIONE OHEL")
    run_title.font.name = "Segoe UI"
    run_title.font.size = Pt(22)
    run_title.font.bold = True
    run_title.font.color.rgb = COLOR_PRIMARY

    sub_p = doc.add_paragraph()
    sub_p.paragraph_format.space_after = Pt(18)
    sub_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run_sub = sub_p.add_run("GUIDA OPERATIVA E SPECIFICHE QUESTIONARIO DA FILE EXCEL")
    run_sub.font.name = "Segoe UI"
    run_sub.font.size = Pt(13)
    run_sub.font.bold = True
    run_sub.font.color.rgb = COLOR_SECONDARY

    # Separatore visivo
    hr_p = doc.add_paragraph()
    hr_p.paragraph_format.space_after = Pt(14)
    run_hr = hr_p.add_run("―" * 55)
    run_hr.font.color.rgb = RGBColor(0xCB, 0xD5, 0xE1)
    hr_p.alignment = WD_ALIGN_PARAGRAPH.CENTER

    # Sezione 1: Panoramica e Scopo
    h1 = doc.add_paragraph()
    h1.paragraph_format.space_before = Pt(12)
    h1.paragraph_format.space_after = Pt(6)
    r_h1 = h1.add_run("1. Panoramica del Sistema e Flusso Operativo")
    r_h1.font.name = "Segoe UI"
    r_h1.font.size = Pt(14)
    r_h1.font.bold = True
    r_h1.font.color.rgb = COLOR_PRIMARY

    p1 = doc.add_paragraph()
    p1.paragraph_format.space_after = Pt(8)
    r_p1 = p1.add_run(
        "Questa funzionalità permette a un amministratore autenticato dell'applicazione OhelCMS di "
        "creare e pubblicare nuovi questionari / sondaggi di disponibilità caricando direttamente un file Excel (.xlsx). "
        "Il file viene trasmesso via API protetta (OAuth2 Google ID Token e controllo ruoli RBAC) al backend FastAPI, "
        "dove un motore di parsing analizza automaticamente metadati, date, orari, turni e note, "
        "salvando poi il questionario nel database Redis ad alta affidabilità."
    )
    r_p1.font.name = "Segoe UI"
    r_p1.font.size = Pt(10.5)
    r_p1.font.color.rgb = COLOR_TEXT

    # Sezione 2: Esempio di Questionario Strutturato
    h2 = doc.add_paragraph()
    h2.paragraph_format.space_before = Pt(14)
    h2.paragraph_format.space_after = Pt(6)
    r_h2 = h2.add_run("2. Esempio Pratico di Questionario (Template Reale)")
    r_h2.font.name = "Segoe UI"
    r_h2.font.size = Pt(14)
    r_h2.font.bold = True
    r_h2.font.color.rgb = COLOR_PRIMARY

    p_info = doc.add_paragraph()
    p_info.paragraph_format.space_after = Pt(4)
    r_info1 = p_info.add_run("• Titolo Questionario: ")
    r_info1.font.bold = True
    r_info1.font.color.rgb = COLOR_PRIMARY
    p_info.add_run("Disponibilità Turni e Attività Associazione Ohel - Dicembre 2026\n")

    r_info2 = p_info.add_run("• Descrizione / Istruzioni: ")
    r_info2.font.bold = True
    r_info2.font.color.rgb = COLOR_PRIMARY
    p_info.add_run(
        "Gentili soci, vi chiediamo di indicare le vostre presenze e fasce orarie preferite per le attività "
        "e i presidi del mese di dicembre. È possibile segnalare anche intolleranze alimentari e aggiungere "
        "altri familiari appartenenti al proprio nucleo."
    )

    # Tabella Esempio Date
    p_tab_title = doc.add_paragraph()
    p_tab_title.paragraph_format.space_before = Pt(10)
    p_tab_title.paragraph_format.space_after = Pt(4)
    r_tt = p_tab_title.add_run("Dati delle Sessioni / Date nel File Excel:")
    r_tt.font.bold = True
    r_tt.font.color.rgb = COLOR_SECONDARY

    sample_table_data = [
        ["Data", "Inizio", "Fine", "Sottotitolo / Evento", "Fasce Orarie", "Note"],
        ["2026-12-05", "08:30", "19:30", "Apertura Straordinaria e Accoglienza", "Mattina, Pomeriggio, Sera", "Briefing iniziale alle 08:30"],
        ["2026-12-12", "09:00", "18:00", "Turno Ordinario e Laboratori", "Mattina, Pomeriggio", "Pranzo al sacco incluso per giornata intera"],
        ["2026-12-19", "08:00", "22:00", "Festa d'Inverno e Buffet Soci", "Mattina, Pomeriggio, Sera", "Segnalare intolleranze alimentari nello step 2"],
        ["2026-12-26", "10:00", "17:00", "Presidio Solidale Festività", "Mattina, Pomeriggio", "Turno ridotto per periodo festivo"]
    ]

    col_widths = [Inches(1.0), Inches(0.65), Inches(0.65), Inches(1.8), Inches(1.4), Inches(1.5)]
    table = doc.add_table(rows=len(sample_table_data), cols=6)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER

    for row_idx, row in enumerate(table.rows):
        is_header = (row_idx == 0)
        for col_idx, cell in enumerate(row.cells):
            cell.width = col_widths[col_idx]
            cell.text = sample_table_data[row_idx][col_idx]
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER if col_idx in [0, 1, 2] else WD_ALIGN_PARAGRAPH.LEFT
            run = p.runs[0]
            run.font.name = "Segoe UI"
            run.font.size = Pt(8.5) if not is_header else Pt(9)
            set_cell_margins(cell, top=100, bottom=100, left=120, right=120)

            if is_header:
                run.font.bold = True
                run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
                set_cell_background(cell, HEX_PRIMARY)
            else:
                run.font.color.rgb = COLOR_TEXT
                if row_idx % 2 == 1:
                    set_cell_background(cell, HEX_ZEBRA)
                else:
                    set_cell_background(cell, "FFFFFF")

    # Sezione 3: Specifiche e Colonne Riconosciute
    h3 = doc.add_paragraph()
    h3.paragraph_format.space_before = Pt(16)
    h3.paragraph_format.space_after = Pt(6)
    r_h3 = h3.add_run("3. Specifiche delle Colonne Accettate dal Parser")
    r_h3.font.name = "Segoe UI"
    r_h3.font.size = Pt(14)
    r_h3.font.bold = True
    r_h3.font.color.rgb = COLOR_PRIMARY

    spec_data = [
        ["Colonna", "Obbligatoria", "Formato Accettato", "Descrizione e Sinonimi"],
        ["Data", "Sì", "AAAA-MM-GG oppure GG/MM/AAAA", "Data della giornata/turno. Sinonimi: Date, Giorno."],
        ["Ora Inizio", "No (default 08:00)", "HH:MM (es. 08:30)", "Orario di inizio disponibilità. Sinonimi: Inizio, Start."],
        ["Ora Fine", "No (default 20:00)", "HH:MM (es. 19:30)", "Orario di fine disponibilità. Sinonimi: Fine, End."],
        ["Sottotitolo", "No", "Testo libero", "Titolo esplicativo o attività. Sinonimi: Evento, Attività, Titolo Turno."],
        ["Fasce Orarie", "No (default Mattina, Pom., Sera)", "Testo separato da virgola", "Fasce selezionabili dall'utente. Sinonimi: Turni, Slots, Orari."],
        ["Note", "No", "Testo libero", "Avvertenze o dettagli operativi mostrati all'utente."]
    ]

    col_widths_spec = [Inches(1.2), Inches(1.1), Inches(1.9), Inches(2.8)]
    table_spec = doc.add_table(rows=len(spec_data), cols=4)
    table_spec.alignment = WD_TABLE_ALIGNMENT.CENTER

    for row_idx, row in enumerate(table_spec.rows):
        is_header = (row_idx == 0)
        for col_idx, cell in enumerate(row.cells):
            cell.width = col_widths_spec[col_idx]
            cell.text = spec_data[row_idx][col_idx]
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER if col_idx in [1] else WD_ALIGN_PARAGRAPH.LEFT
            run = p.runs[0]
            run.font.name = "Segoe UI"
            run.font.size = Pt(8.5) if not is_header else Pt(9)
            set_cell_margins(cell, top=100, bottom=100, left=120, right=120)

            if is_header:
                run.font.bold = True
                run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
                set_cell_background(cell, HEX_SECONDARY)
            else:
                run.font.color.rgb = COLOR_TEXT
                if row_idx % 2 == 1:
                    set_cell_background(cell, HEX_ZEBRA)

    # Sezione 4: Interazione Utente e Risultati nel Database
    h4 = doc.add_paragraph()
    h4.paragraph_format.space_before = Pt(16)
    h4.paragraph_format.space_after = Pt(6)
    r_h4 = h4.add_run("4. Come gli Utenti Interagiscono con il Questionario")
    r_h4.font.name = "Segoe UI"
    r_h4.font.size = Pt(14)
    r_h4.font.bold = True
    r_h4.font.color.rgb = COLOR_PRIMARY

    p_user = doc.add_paragraph()
    p_user.paragraph_format.space_after = Pt(8)
    p_user.add_run(
        "Una volta che il questionario è memorizzato in Redis dallo stato 'ATTIVO':\n"
        "1. Comparirà automaticamente nella Dashboard di tutti i soci abilitati.\n"
        "2. Cliccando su 'Partecipa', l'utente accede alla procedura di compilazione a 5 step:\n"
        "   • Step 0: Scelta partecipanti (il socio titolare o aggiunta di familiari/deleghe del nucleo).\n"
        "   • Step 1: Selezione delle disponibilità per ciascuna data e fascia oraria caricata dall'Excel "
        "(con opzione rapida 'Non disponibile' per le date in cui non può presenziare).\n"
        "   • Step 2: Segnalazione intolleranze o allergie alimentari (es. Celiachia, Lattosio, Frutta a guscio).\n"
        "   • Step 3: Eventuali note logistiche e preferenze particolari.\n"
        "   • Step 4: Riepilogo e invio definitivo sicuro con ricevuta.\n"
        "3. Gli amministratori possono seguire l'andamento in tempo reale tramite la schermata Risultati "
        "e modificare il questionario o visualizzare i log di sistema."
    )
    for r in p_user.runs:
        r.font.name = "Segoe UI"
        r.font.size = Pt(10)
        r.font.color.rgb = COLOR_TEXT

    # Sezione 5: Sicurezza e Protezione
    h5 = doc.add_paragraph()
    h5.paragraph_format.space_before = Pt(14)
    h5.paragraph_format.space_after = Pt(6)
    r_h5 = h5.add_run("5. Protezione e Sicurezza dei Dati")
    r_h5.font.name = "Segoe UI"
    r_h5.font.size = Pt(14)
    r_h5.font.bold = True
    r_h5.font.color.rgb = COLOR_PRIMARY

    p_sec = doc.add_paragraph()
    p_sec.paragraph_format.space_after = Pt(8)
    p_sec.add_run(
        "• Autenticazione Forte: Ogni richiesta verso il backend trasporta il token Google ID Token "
        "firmato crittograficamente da Google.\n"
        "• Controllo Autorizzativo RBAC: Il backend verifica nei registri Redis che l'email chiamante "
        "abbia espressamente il flag isAdmin = True.\n"
        "• Validazione in Memoria: Il file Excel viene letto in streaming di memoria (BytesIO) senza file temporanei "
        "esposti sul disco del server, prevenendo problemi di sicurezza e injection.\n"
        "• Audit Log Immutabile: Ogni parsing o importazione genera una voce nel log degli eventi di sistema "
        "con indirizzo IP, timestamp esatto e autore dell'operazione."
    )
    for r in p_sec.runs:
        r.font.name = "Segoe UI"
        r.font.size = Pt(10)
        r.font.color.rgb = COLOR_TEXT

    doc.save(file_path)
    print(f"File DOCX salvato con successo: {file_path}")

def main():
    # 1. Generazione Template Excel (.xlsx)
    excel_bytes = generate_survey_excel_template()

    root_excel = os.path.join(os.path.dirname(BASE_DIR), "Template_Questionario_OhelCMS.xlsx")
    public_excel = os.path.join(os.path.dirname(BASE_DIR), "ohel-cms", "public", "templates", "Template_Questionario_OhelCMS.xlsx")

    with open(root_excel, "wb") as f:
        f.write(excel_bytes)
    with open(public_excel, "wb") as f:
        f.write(excel_bytes)

    print(f"Template Excel generato in: {root_excel} e {public_excel}")

    # 2. Generazione File Esempio Word (.docx)
    root_docx = os.path.join(os.path.dirname(BASE_DIR), "Esempio_Questionario_OhelCMS.docx")
    public_docx = os.path.join(os.path.dirname(BASE_DIR), "ohel-cms", "public", "templates", "Esempio_Questionario_OhelCMS.docx")

    create_sample_docx(root_docx)
    shutil.copyfile(root_docx, public_docx)
    print(f"File DOCX generato in: {root_docx} e {public_docx}")

if __name__ == "__main__":
    main()
