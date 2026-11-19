import unittest
import base64
import os
import sys
import io
import openpyxl

# Assicura il path del backend
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from services.excel_survey_service import (
    generate_survey_excel_template,
    parse_survey_excel_data,
    parse_excel_base64,
    parse_date_value,
    parse_time_value,
    parse_slots_value
)

class TestExcelSurveyService(unittest.TestCase):

    def test_parse_date_value(self):
        self.assertEqual(parse_date_value("2026-12-15"), "2026-12-15")
        self.assertEqual(parse_date_value("15/12/2026"), "2026-12-15")
        self.assertEqual(parse_date_value("15-12-2026"), "2026-12-15")
        self.assertEqual(parse_date_value("05/01/2027"), "2027-01-05")
        self.assertIsNone(parse_date_value("not_a_date"))

    def test_parse_time_value(self):
        self.assertEqual(parse_time_value("08:30"), "08:30")
        self.assertEqual(parse_time_value("8.30"), "08:30")
        self.assertEqual(parse_time_value("9"), "09:00")
        self.assertEqual(parse_time_value("18"), "18:00")
        self.assertEqual(parse_time_value(None, default="08:00"), "08:00")

    def test_parse_slots_value(self):
        self.assertEqual(parse_slots_value("Mattina, Pomeriggio"), ["Mattina", "Pomeriggio"])
        self.assertEqual(parse_slots_value("Turno 1; Turno 2; Turno 3"), ["Turno 1", "Turno 2", "Turno 3"])
        self.assertEqual(parse_slots_value(""), ["Mattina", "Pomeriggio", "Sera"])

    def test_generate_and_parse_template(self):
        excel_bytes = generate_survey_excel_template()
        self.assertGreater(len(excel_bytes), 1000)

        result = parse_survey_excel_data(excel_bytes, "template_test.xlsx")
        self.assertTrue(result.get("success"), f"Errore parsing: {result.get('error')}")

        survey = result.get("survey", {})
        self.assertIn("Dicembre 2026", survey.get("title", ""))
        self.assertIn("Gentili soci", survey.get("description", ""))

        dates = survey.get("dates", [])
        self.assertEqual(len(dates), 4)

        first_date = dates[0]
        self.assertEqual(first_date.get("date"), "2026-12-05")
        self.assertEqual(first_date.get("timeRange", {}).get("start"), "08:30")
        self.assertEqual(first_date.get("timeRange", {}).get("end"), "19:30")
        self.assertIn("Mattina", first_date.get("timeSlots", []))
        self.assertIn("Sera", first_date.get("timeSlots", []))
        self.assertEqual(first_date.get("subtitle"), "Apertura Straordinaria e Accoglienza")

    def test_parse_base64(self):
        excel_bytes = generate_survey_excel_template()
        b64 = "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64," + base64.b64encode(excel_bytes).decode("utf-8")
        result = parse_excel_base64(b64, "sondaggio.xlsx")
        self.assertTrue(result.get("success"))
        self.assertEqual(len(result["survey"]["dates"]), 4)

    def test_simple_table_without_metadata(self):
        """Testa una tabella Excel minimale (solo riga header + righe dati in formato italiano)"""
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Turni"
        ws.append(["Giorno", "Inizio", "Fine", "Attività", "Turni"])
        ws.append(["25/12/2026", "10:00", "16:00", "Natale Solidale", "Pranzo, Pomeriggio"])
        ws.append(["31/12/2026", "18:00", "23:59", "Cenone e Veglione", "Serale"])

        buf = io.BytesIO()
        wb.save(buf)

        res = parse_survey_excel_data(buf.getvalue(), "turni_feste_fine_anno.xlsx")
        self.assertTrue(res.get("success"))
        self.assertEqual(res["survey"]["title"], "Turni Feste Fine Anno")
        dates = res["survey"]["dates"]
        self.assertEqual(len(dates), 2)
        self.assertEqual(dates[0]["date"], "2026-12-25")
        self.assertEqual(dates[0]["timeRange"]["start"], "10:00")
        self.assertEqual(dates[0]["timeRange"]["end"], "16:00")
        self.assertEqual(dates[0]["subtitle"], "Natale Solidale")
        self.assertEqual(dates[0]["timeSlots"], ["Pranzo", "Pomeriggio"])
        self.assertEqual(dates[1]["date"], "2026-12-31")

if __name__ == "__main__":
    unittest.main()
