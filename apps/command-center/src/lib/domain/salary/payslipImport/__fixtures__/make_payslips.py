"""
Writes the synthetic payslip PDFs used by the payslip import tests. Every company, person and
number in them is made up. The PDFs are written by hand (no PDF library) so each one exercises
a different part of the reader: compressed content, a two-byte font with a ToUnicode map, an
object stream, a form XObject and an image-only page. pypdf (with `cryptography`) then makes
password-protected copies with RC4, AES-128 and AES-256.

Run from this folder:  python3 make_payslips.py
"""

import zlib
from pathlib import Path

HERE = Path(__file__).parent
PASSWORD = "sample-pass"


def esc(text):
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


class Page:
    """Text at absolute positions; F1 Helvetica, F2 Helvetica-Bold (or a Type0 font)."""

    def __init__(self, two_byte=None):
        self.ops = []
        self.two_byte = two_byte

    def text(self, x, y, s, size=10, bold=False):
        font = "F2" if bold else "F1"
        if self.two_byte is not None:
            codes = "".join("%04X" % self.two_byte.code(ch) for ch in s)
            body = "<%s> Tj" % codes
        else:
            body = "(%s) Tj" % esc(s)
        self.ops.append("BT /%s %d Tf %.2f %.2f Td %s ET" % (font, size, x, y, body))

    def kerned(self, x, y, parts, size=10):
        """A TJ array: strings with kerning numbers between them."""
        items = " ".join(p if isinstance(p, str) and p.startswith("-") else
                         ("(%s)" % esc(p) if isinstance(p, str) else str(p)) for p in parts)
        self.ops.append("BT /F1 %d Tf 1 0 0 1 %.2f %.2f Tm [%s] TJ ET" % (size, x, y, items))

    def rule(self, y):
        self.ops.append("0.5 w 40 %.2f m 555 %.2f l S" % (y, y))

    def content(self):
        return "\n".join(self.ops).encode("latin-1")


class CidFont:
    """Two-byte codes in order of first use, mapped back to Unicode by a ToUnicode CMap."""

    def __init__(self):
        self.codes = {}

    def code(self, ch):
        if ch not in self.codes:
            self.codes[ch] = len(self.codes) + 3
        return self.codes[ch]

    def cmap(self):
        lines = ["/CIDInit /ProcSet findresource begin", "12 dict begin", "begincmap",
                 "1 begincodespacerange <0000> <FFFF> endcodespacerange"]
        items = sorted(self.codes.items(), key=lambda kv: kv[1])
        lines.append("%d beginbfchar" % len(items))
        for ch, code in items:
            lines.append("<%04X> <%s>" % (code, ch.encode("utf-16-be").hex().upper()))
        lines += ["endbfchar", "endcmap", "CMapName currentdict /CMap defineresource pop",
                  "end", "end"]
        return "\n".join(lines).encode("latin-1")


def write_pdf(path, objects, root=1, info=None):
    """objects: list of bytes bodies, numbered from 1. Classic xref table."""
    out = bytearray(b"%PDF-1.5\n%\xe2\xe3\xcf\xd3\n")
    offsets = []
    for i, body in enumerate(objects):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % (i + 1) + body + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
    for at in offsets:
        out += b"%010d 00000 n \n" % at
    extra = b" /Info %d 0 R" % info if info else b""
    out += b"trailer\n<< /Size %d /Root %d 0 R%s >>\nstartxref\n%d\n%%%%EOF\n" % (
        len(objects) + 1, root, extra, xref)
    path.write_bytes(bytes(out))


def stream(data, compress=True, extra=b""):
    if compress:
        data = zlib.compress(data)
        return b"<< /Length %d /Filter /FlateDecode%s >>\nstream\n" % (len(data), extra) + \
            data + b"\nendstream"
    return b"<< /Length %d%s >>\nstream\n" % (len(data), extra) + data + b"\nendstream"


HELVETICA = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
HELVETICA_BOLD = (b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold "
                  b"/Encoding /WinAnsiEncoding >>")


def simple_pdf(path, page, compress=True):
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
        b"/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",
        stream(page.content(), compress),
        HELVETICA,
        HELVETICA_BOLD,
    ]
    write_pdf(path, objects)


def header(p, company, title, bold=True):
    p.text(40, 790, company, 16, bold)
    p.text(40, 774, "4th Floor, Sample Tower, Example Road, Bengaluru 560001", 8)
    p.text(40, 750, title, 12, True)


def identity_block(p, y):
    p.text(40, y, "Employee Name: Sample Employee", 9)
    p.text(300, y, "Employee ID: EMP-0001", 9)
    p.text(40, y - 14, "UAN: 000000000000", 9)
    p.text(300, y - 14, "PAN: XXXXX0000X", 9)
    p.text(40, y - 28, "Bank A/c No: 000000001234", 9)
    p.text(300, y - 28, "Date of Joining: 01/06/2023", 9)


def layout_two_column():
    """(a) Earnings | Amount | Deductions | Amount, Helvetica, compressed."""
    p = Page()
    header(p, "Example Technologies Pvt Ltd", "Payslip for the month of September 2026")
    identity_block(p, 726)
    p.text(40, 668, "Pay Date: 30/09/2026", 9)
    p.text(300, 668, "Days Paid: 30", 9)
    p.rule(656)
    y = 640
    p.text(40, y, "Earnings", 10, True)
    p.text(200, y, "Amount (INR)", 10, True)
    p.text(300, y, "Deductions", 10, True)
    p.text(470, y, "Amount (INR)", 10, True)
    rows = [("Basic", "50,000.00", "Provident Fund", "1,800.00"),
            ("HRA", "20,000.00", "Professional Tax", "200.00"),
            ("Special Allowance", "15,250.50", "Income Tax", "7,450.00"),
            ("Conveyance", "1,600.00", "", "")]
    for left, la, right, ra in rows:
        y -= 16
        p.text(40, y, left)
        p.text(250 - 5 * len(la), y, la)
        if right:
            p.text(300, y, right)
            p.text(520 - 5 * len(ra), y, ra)
    y -= 20
    p.text(40, y, "Total Earnings", 10, True)
    p.text(200, y, "86,850.50", 10, True)
    p.text(300, y, "Total Deductions", 10, True)
    p.text(475, y, "9,450.00", 10, True)
    p.text(40, y - 24, "Net Pay: Rs. 77,400.50", 11, True)
    p.text(40, y - 38, "(Rupees Seventy Seven Thousand Four Hundred and Fifty Paise Only)", 8)
    simple_pdf(HERE / "payslip-two-column.pdf", p)


def layout_label_value():
    """(b) Label: value list, a Type0 font with Identity-H and a ToUnicode map, ₹ amounts."""
    font = CidFont()
    p = Page(font)
    header(p, "Sample Software Solutions LLP", "Pay Period: 01/08/2026 - 31/08/2026")
    p.text(40, 730, "Employee Name: Sample Employee", 9)
    p.text(40, 716, "PF No: XX/XXX/0000000/000/0000000", 9)
    lines = [("Earnings", None), ("Basic Salary: ₹ 1,23,456.00", None),
             ("House Rent Allowance: ₹ 49,382.00", None), ("Leave Travel Allowance: ₹ 5,000", None),
             ("Deductions", None), ("Employee PF: ₹ 14,815.00", None), ("VPF: ₹ 2,000.00", None),
             ("TDS: ₹ 31,250.00", None), ("Prof. Tax: ₹ 200.00", None),
             ("Group Medical Insurance: ₹ 1,250.00", None),
             ("Gross Earnings: ₹ 1,77,838.00", None), ("Total Deductions: ₹ 49,515.00", None),
             ("Net Salary: ₹ 1,28,323.00", None), ("Salary credited on 31 Aug 2026", None)]
    y = 690
    for text, _ in lines:
        bold = text in ("Earnings", "Deductions")
        p.text(40, y, text, 10, bold)
        y -= 16
    widths = b"[3 [" + b" ".join(b"500" for _ in range(200)) + b"]]"
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
        b"/Resources << /Font << /F1 5 0 R /F2 5 0 R >> >> /Contents 4 0 R >>",
        stream(p.content()),
        b"<< /Type /Font /Subtype /Type0 /BaseFont /SampleSans /Encoding /Identity-H "
        b"/DescendantFonts [6 0 R] /ToUnicode 7 0 R >>",
        b"<< /Type /Font /Subtype /CIDFontType2 /BaseFont /SampleSans "
        b"/CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> "
        b"/DW 500 /W " + widths + b" /CIDToGIDMap /Identity >>",
        stream(font.cmap()),
    ]
    write_pdf(HERE / "payslip-label-value.pdf", objects)


def layout_ytd():
    """(c) Current Month and YTD columns; fonts and page in an object stream; TJ kerning."""
    p = Page()
    p.text(40, 790, "Example Analytics Private Limited", 15, True)
    p.text(40, 774, "Plot 12, Sample Industrial Area, Pune 411001", 8)
    p.text(40, 750, "Salary slip for Jul'26", 12, True)
    identity_block(p, 730)
    p.text(40, 676, "Days Paid: 31", 9)
    p.text(300, 676, "LOP Days: 0", 9)
    y = 650
    for title, rows, total in [
        ("Earnings", [("Basic", "40,000.00", "1,60,000.00"), ("HRA", "16,000.00", "64,000.00"),
                      ("Other Allowance", "9,000.00", "36,000.00"),
                      ("Performance Bonus", "5,000.00", "5,000.00")],
         ("Gross Earnings", "70,000.00", "2,65,000.00")),
        ("Deductions", [("EPF", "4,800.00", "19,200.00"), ("Professional Tax", "200.00", "800.00"),
                        ("Income Tax", "5,600.00", "22,400.00"),
                        ("Meal Coupons", "1,100.00", "4,400.00")],
         ("Total Deductions", "11,700.00", "46,800.00")),
    ]:
        p.text(40, y, title, 10, True)
        p.text(330, y, "Current Month", 10, True)
        p.text(470, y, "YTD", 10, True)
        for label, current, ytd in rows:
            y -= 15
            p.kerned(40, y, [label])
            p.kerned(330, y, [current[:2], -20, current[2:]])
            p.text(470, y, ytd)
        y -= 17
        p.text(40, y, total[0], 10, True)
        p.text(330, y, total[1], 10, True)
        p.text(470, y, total[2], 10, True)
        y -= 28
    p.text(40, y, "Take Home", 11, True)
    p.text(330, y, "58,300.00", 11, True)
    # Objects 3 (page), 5 and 6 (fonts) live in object stream 7.
    inner = [(3, b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
                 b"/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>"),
             (5, HELVETICA), (6, HELVETICA_BOLD)]
    head, body = [], b""
    for num, data in inner:
        head.append(b"%d %d" % (num, len(body)))
        body += data + b"\n"
    head_bytes = b" ".join(head) + b"\n"
    objstm = zlib.compress(head_bytes + body)
    direct = {
        1: b"<< /Type /Catalog /Pages 2 0 R >>",
        2: b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        4: stream(p.content()),
        7: b"<< /Type /ObjStm /N 3 /First %d /Length %d /Filter /FlateDecode >>\nstream\n" % (
            len(head_bytes), len(objstm)) + objstm + b"\nendstream",
    }
    write_with_xref_stream(HERE / "payslip-ytd.pdf", direct, {3: (7, 0), 5: (7, 1), 6: (7, 2)})


def write_with_xref_stream(path, direct, packed):
    """PDF 1.5 layout: some objects packed in an object stream, found by an xref stream."""
    out = bytearray(b"%PDF-1.5\n%\xe2\xe3\xcf\xd3\n")
    offsets = {}
    for num in sorted(direct):
        offsets[num] = len(out)
        out += b"%d 0 obj\n" % num + direct[num] + b"\nendobj\n"
    size = max(list(direct) + list(packed)) + 2
    xref_num = size - 1
    offsets[xref_num] = len(out)
    rows = b""
    for num in range(size):
        if num in offsets:
            rows += bytes([1]) + offsets[num].to_bytes(4, "big") + (0).to_bytes(2, "big")
        elif num in packed:
            rows += bytes([2]) + packed[num][0].to_bytes(4, "big") + packed[num][1].to_bytes(2, "big")
        else:
            rows += bytes([0]) + (0).to_bytes(4, "big") + (65535).to_bytes(2, "big")
    data = zlib.compress(rows)
    out += b"%d 0 obj\n<< /Type /XRef /Size %d /W [1 4 2] /Root 1 0 R /Length %d " % (
        xref_num, size, len(data))
    out += b"/Filter /FlateDecode >>\nstream\n" + data + b"\nendstream\nendobj\n"
    out += b"startxref\n%d\n%%%%EOF\n" % offsets[xref_num]
    path.write_bytes(bytes(out))


def layout_employer_pf():
    """(d) Full | Actual columns, employer PF and EPS printed; drawn inside a form XObject."""
    p = Page()
    header(p, "Sample Retail Services Ltd.", "Pay slip for October, 2026")
    identity_block(p, 726)
    y = 650
    p.text(40, y, "Earnings", 10, True)
    p.text(180, y, "Full", 10, True)
    p.text(240, y, "Actual", 10, True)
    p.text(320, y, "Deductions", 10, True)
    p.text(480, y, "Actual", 10, True)
    rows = [("Basic", "15,000", "15,000", "PF", "1,800"),
            ("Dearness Allowance", "5,000", "5,000", "ESI", "195"),
            ("Overtime", "0", "1,200", "Salary Advance", "2,000"),
            ("Arrears", "", "500", "", "")]
    for left, full, actual, right, amount in rows:
        y -= 15
        p.text(40, y, left)
        if full:
            p.text(180, y, full)
        p.text(240, y, actual)
        if right:
            p.text(320, y, right)
            p.text(480, y, amount)
    y -= 18
    p.text(40, y, "Gross Pay", 10, True)
    p.text(240, y, "21,700", 10, True)
    p.text(320, y, "Total Deductions", 10, True)
    p.text(480, y, "3,995", 10, True)
    y -= 30
    p.text(40, y, "Employer Contributions", 10, True)
    p.text(40, y - 15, "Employer PF: Rs. 550.00")
    p.text(40, y - 30, "Pension Fund (EPS): Rs. 1,250.00")
    p.text(40, y - 45, "Employer ESI: Rs. 846.00")
    p.text(40, y - 70, "Amount credited to bank: 17,705/-", 11, True)
    form = stream(p.content(), extra=b" /Type /XObject /Subtype /Form /BBox [0 0 595 842] "
                                     b"/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >>")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
        b"/Resources << /XObject << /Fm1 7 0 R >> >> /Contents 4 0 R >>",
        stream(b"q 1 0 0 1 0 0 cm /Fm1 Do Q"),
        HELVETICA,
        HELVETICA_BOLD,
        form,
    ]
    write_pdf(HERE / "payslip-employer-pf.pdf", objects)


def layout_scanned():
    """An image-only page, like a scanned payslip: no text at all."""
    pixels = zlib.compress(bytes([200] * 30 * 30))
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
        b"/Resources << /XObject << /Im1 5 0 R >> >> /Contents 4 0 R >>",
        stream(b"q 595 0 0 842 0 0 cm /Im1 Do Q"),
        b"<< /Type /XObject /Subtype /Image /Width 30 /Height 30 /ColorSpace /DeviceGray "
        b"/BitsPerComponent 8 /Length %d /Filter /FlateDecode >>\nstream\n" % len(pixels)
        + pixels + b"\nendstream",
    ]
    write_pdf(HERE / "payslip-scanned.pdf", objects)


def encrypt(source, target, algorithm):
    from pypdf import PdfReader, PdfWriter

    writer = PdfWriter(clone_from=PdfReader(HERE / source))
    writer.encrypt(user_password=PASSWORD, owner_password="owner-" + PASSWORD,
                   algorithm=algorithm)
    with open(HERE / target, "wb") as handle:
        writer.write(handle)


if __name__ == "__main__":
    layout_two_column()
    layout_label_value()
    layout_ytd()
    layout_employer_pf()
    layout_scanned()
    encrypt("payslip-two-column.pdf", "payslip-aes256.pdf", "AES-256")
    encrypt("payslip-label-value.pdf", "payslip-aes128.pdf", "AES-128")
    encrypt("payslip-ytd.pdf", "payslip-rc4.pdf", "RC4-128")
