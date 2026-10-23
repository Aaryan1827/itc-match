"""Generate synthetic invoices, a mock GSTR-2B CSV and a ground-truth file.

All businesses, PANs and GSTINs are fictional. GSTINs are generated with a
valid check digit so the validator can be tested properly. Rates and HSN codes
are illustrative only and are not tax advice.

Run from the repo root:  python3 scripts/generate_samples.py
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "samples"
INV_DIR = OUT_DIR / "invoices"
INV_DIR.mkdir(parents=True, exist_ok=True)

CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
PERIOD = "092026"


def gstin_check_char(first14: str) -> str:
    """Standard GSTIN check character (mod 36, alternating weights 1 and 2)."""
    total = 0
    for i, ch in enumerate(first14):
        product = CHARSET.index(ch) * (1 if i % 2 == 0 else 2)
        total += product // 36 + product % 36
    return CHARSET[(36 - total % 36) % 36]


def make_gstin(state: str, pan: str, entity: str = "1") -> str:
    base = f"{state}{pan}{entity}Z"
    return base + gstin_check_char(base)


def is_valid_gstin(gstin: str) -> bool:
    return len(gstin) == 15 and gstin[-1] == gstin_check_char(gstin[:-1])


BUYER = {
    "name": "Sahyadri Traders Pvt Ltd",
    "state": "27",
    "city": "Pune, Maharashtra",
    "gstin": make_gstin("27", "AAFCS6254K"),
}

SUPPLIERS = {
    "S1": {"name": "Kothrud Packaging Works", "state": "27", "city": "Pune, Maharashtra",
           "gstin": make_gstin("27", "AAKPK4821M")},
    "S2": {"name": "Surat Textile Mills Ltd", "state": "24", "city": "Surat, Gujarat",
           "gstin": make_gstin("24", "AABCS7743R")},
    "S3": {"name": "Peenya Precision Tools", "state": "29", "city": "Bengaluru, Karnataka",
           "gstin": make_gstin("29", "AAACP3391D")},
    "S4": {"name": "Chennai Polymer Industries", "state": "33", "city": "Chennai, Tamil Nadu",
           "gstin": make_gstin("33", "AAECC5518H")},
    "S5": {"name": "Nashik Agro Supplies", "state": "27", "city": "Nashik, Maharashtra",
           "gstin": make_gstin("27", "AAHFN9027B")},
}

# id, supplier, number, date, rate, lines[(desc, hsn, qty, unit_rate)], planted issue
INVOICES = [
    dict(id="INV01", sup="S1", no="KPW/26/0412", date="2026-09-03", rate=18,
         lines=[("Corrugated cartons 5-ply", "4819", 400, 42.50)], issue=None),
    dict(id="INV02", sup="S2", no="STM/2627/1180", date="2026-09-05", rate=5,
         lines=[("Cotton fabric 40s", "5208", 1200, 96.00)], issue=None),
    dict(id="INV03", sup="S3", no="PPT-0932", date="2026-09-07", rate=18,
         lines=[("Carbide cutting inserts", "8207", 150, 310.00),
                ("Tool holders", "8207", 20, 1250.00)], issue=None),
    dict(id="INV04", sup="S5", no="NAS/0457", date="2026-09-09", rate=5,
         lines=[("Soil conditioner granules", "3105", 500, 78.00)],
         issue="TAX_TYPE_MISMATCH"),
    dict(id="INV05", sup="S4", no="CPI/26-27/2210", date="2026-09-11", rate=18,
         lines=[("Polymer granules HDPE", "3901", 800, 118.00)],
         issue="ARITHMETIC_MISMATCH"),
    dict(id="INV06", sup="S3", no="PPT-0951", date="2026-09-12", rate=18,
         lines=[("Precision gauges", "9031", 40, 865.00)],
         issue="GSTIN_CHECKSUM"),
    dict(id="INV07", sup="S1", no="KPW/26/0433", date="2026-09-14", rate=18,
         lines=[("Printed mono cartons", "4819", 650, 38.00)],
         issue="NOT_IN_2B"),
    dict(id="INV08", sup="S4", no="TS/2026/0148", date="2026-09-16", rate=18,
         lines=[("Polymer sheet 2mm", "3920", 300, 245.00)],
         issue="FUZZY_MATCH"),
    dict(id="INV09", sup="S2", no="STM/2627/1203", date="2026-09-18", rate=12,
         lines=[("Dyed yarn", "5509", 900, 132.00)],
         issue="RATE_NOT_ALLOWED"),
    dict(id="INV10", sup="S2", no="STM/2627/1180", date="2026-09-05", rate=5,
         lines=[("Cotton fabric 40s", "5208", 1200, 96.00)],
         issue="DUPLICATE_INVOICE"),
]

EXPECTED_STATUS = {
    None: "clean",
    "TAX_TYPE_MISMATCH": "fixable",
    "ARITHMETIC_MISMATCH": "fixable",
    "GSTIN_CHECKSUM": "itc_at_risk",
    "NOT_IN_2B": "itc_at_risk",
    "FUZZY_MATCH": "fixable",
    "RATE_NOT_ALLOWED": "needs_review",
    "DUPLICATE_INVOICE": "needs_review",
}


def money(x: float) -> float:
    return round(x + 1e-9, 2)


def compute(inv: dict) -> dict:
    sup, rate = SUPPLIERS[inv["sup"]], inv["rate"]
    taxable = money(sum(q * r for _, _, q, r in inv["lines"]))
    intra = sup["state"] == BUYER["state"]
    igst = cgst = sgst = 0.0
    if inv["issue"] == "TAX_TYPE_MISMATCH":
        igst = money(taxable * rate / 100)  # wrongly charged on an intra-state sale
    elif intra:
        cgst = sgst = money(taxable * rate / 200)
    else:
        igst = money(taxable * rate / 100)
    correct_tax = igst + cgst + sgst
    printed_igst, printed_cgst, printed_sgst = igst, cgst, sgst
    total = money(taxable + correct_tax)
    if inv["issue"] == "ARITHMETIC_MISMATCH":
        printed_igst = money(igst - 450.00)  # tax line understated, total left unchanged
    gstin = sup["gstin"]
    if inv["issue"] == "GSTIN_CHECKSUM":
        wrong = "A" if gstin[-1] != "A" else "B"
        gstin = gstin[:-1] + wrong
    return dict(taxable=taxable, igst=printed_igst, cgst=printed_cgst, sgst=printed_sgst,
                total=total, supplier_gstin=gstin, true_tax=correct_tax)


def render_pdf(inv: dict, calc: dict) -> Path:
    sup, rate = SUPPLIERS[inv["sup"]], inv["rate"]
    path = INV_DIR / f"{inv['id']}.pdf"
    styles = getSampleStyleSheet()
    doc = SimpleDocTemplate(str(path), pagesize=A4, leftMargin=40, rightMargin=40,
                            topMargin=40, bottomMargin=40, title=f"Tax Invoice {inv['no']}")
    s = []
    s.append(Paragraph(f"<b>{sup['name']}</b>", styles["Title"]))
    s.append(Paragraph(f"{sup['city']}<br/>GSTIN: {calc['supplier_gstin']}", styles["Normal"]))
    s.append(Spacer(1, 10))
    s.append(Paragraph("<b>TAX INVOICE</b>", styles["Heading2"]))
    meta = [["Invoice No.", inv["no"], "Invoice Date", inv["date"]],
            ["Place of Supply", f"{BUYER['state']} - Maharashtra", "Reverse Charge", "No"]]
    t = Table(meta, colWidths=[90, 170, 90, 150])
    t.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                           ("FONTSIZE", (0, 0), (-1, -1), 9)]))
    s += [t, Spacer(1, 10)]
    s.append(Paragraph(f"<b>Bill To:</b> {BUYER['name']}, {BUYER['city']}<br/>"
                       f"Buyer GSTIN: {BUYER['gstin']}", styles["Normal"]))
    s.append(Spacer(1, 10))
    rows = [["#", "Description", "HSN", "Qty", "Rate", "Amount"]]
    for i, (d, h, q, r) in enumerate(inv["lines"], 1):
        rows.append([i, d, h, q, f"{r:,.2f}", f"{q * r:,.2f}"])
    lt = Table(rows, colWidths=[25, 210, 55, 45, 70, 85])
    lt.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                            ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                            ("FONTSIZE", (0, 0), (-1, -1), 9),
                            ("ALIGN", (3, 0), (-1, -1), "RIGHT")]))
    s += [lt, Spacer(1, 10)]
    tax_rows = [["Taxable value", f"{calc['taxable']:,.2f}"]]
    if calc["cgst"] or calc["sgst"]:
        tax_rows += [[f"CGST @ {rate / 2:g}%", f"{calc['cgst']:,.2f}"],
                     [f"SGST @ {rate / 2:g}%", f"{calc['sgst']:,.2f}"]]
    if calc["igst"]:
        tax_rows.append([f"IGST @ {rate:g}%", f"{calc['igst']:,.2f}"])
    tax_rows.append(["Invoice total (INR)", f"{calc['total']:,.2f}"])
    tt = Table(tax_rows, colWidths=[150, 100], hAlign="RIGHT")
    tt.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                            ("FONTSIZE", (0, 0), (-1, -1), 9),
                            ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                            ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold")]))
    s += [tt, Spacer(1, 16)]
    s.append(Paragraph("SYNTHETIC SAMPLE - fictional business data for hackathon testing.",
                       styles["Italic"]))
    doc.build(s)
    return path


def main() -> None:
    gstr2b_rows: list[dict] = []
    truth: list[dict] = []
    seen_2b: set[tuple[str, str]] = set()

    for inv in INVOICES:
        calc = compute(inv)
        render_pdf(inv, calc)
        sup = SUPPLIERS[inv["sup"]]
        status = EXPECTED_STATUS[inv["issue"]]
        true_tax = calc["true_tax"]
        truth.append(dict(
            file=f"invoices/{inv['id']}.pdf", id=inv["id"], supplierGstinOnInvoice=calc["supplier_gstin"],
            invoiceNumber=inv["no"], invoiceDate=inv["date"], taxableValue=calc["taxable"],
            totalTaxOnInvoice=money(calc["igst"] + calc["cgst"] + calc["sgst"]),
            invoiceTotal=calc["total"], plantedIssue=inv["issue"], expectedStatus=status,
            taxAtStake=money(true_tax)))

        in_2b = inv["issue"] not in ("NOT_IN_2B", "GSTIN_CHECKSUM", "DUPLICATE_INVOICE")
        number_2b = "TS-2026-0148" if inv["issue"] == "FUZZY_MATCH" else inv["no"]
        key = (sup["gstin"], number_2b)
        if in_2b and key not in seen_2b:
            seen_2b.add(key)
            gstr2b_rows.append({
                "Supplier GSTIN": sup["gstin"], "Supplier Name": sup["name"],
                "Invoice Number": number_2b, "Invoice Date": inv["date"],
                "Taxable Value": calc["taxable"],
                "IGST": money(true_tax) if (sup["state"] != BUYER["state"]
                                            or inv["issue"] == "TAX_TYPE_MISMATCH") else 0,
                "CGST": 0 if (sup["state"] != BUYER["state"] or inv["issue"] == "TAX_TYPE_MISMATCH")
                else money(true_tax / 2),
                "SGST": 0 if (sup["state"] != BUYER["state"] or inv["issue"] == "TAX_TYPE_MISMATCH")
                else money(true_tax / 2),
                "Invoice Value": calc["total"], "Return Period": PERIOD})

    # One entry present in 2B but absent from the uploaded purchase invoices
    extra = SUPPLIERS["S4"]
    gstr2b_rows.append({"Supplier GSTIN": extra["gstin"], "Supplier Name": extra["name"],
                        "Invoice Number": "CPI/26-27/2299", "Invoice Date": "2026-09-20",
                        "Taxable Value": 25000.00, "IGST": 4500.00, "CGST": 0, "SGST": 0,
                        "Invoice Value": 29500.00, "Return Period": PERIOD})

    with open(OUT_DIR / "gstr-2b.csv", "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(gstr2b_rows[0].keys()))
        writer.writeheader()
        writer.writerows(gstr2b_rows)

    itc_at_risk = money(sum(t["taxAtStake"] for t in truth if t["expectedStatus"] == "itc_at_risk"))
    summary = dict(period=PERIOD, buyerGstin=BUYER["gstin"], expectedItcAtRiskInr=itc_at_risk,
                   invoiceCount=len(truth), invoices=truth,
                   gstr2bOnlyEntries=["CPI/26-27/2299"])
    (OUT_DIR / "ground-truth.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")

    for sup in SUPPLIERS.values():
        assert is_valid_gstin(sup["gstin"]), sup
    assert is_valid_gstin(BUYER["gstin"])
    print(f"Wrote {len(truth)} invoices, {len(gstr2b_rows)} GSTR-2B rows. "
          f"Expected ITC at risk: INR {itc_at_risk:,.2f}")


if __name__ == "__main__":
    main()
