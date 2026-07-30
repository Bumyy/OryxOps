import io
import os
from datetime import datetime

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, Image, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus.flowables import HRFlowable

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.live_models import (
    LiveFlightBooking,
    LiveFlightSchedule,
    Pilot,
    LiveAircraft,
    Aircraft,
    Pirep,
    LivePilotCareer,
    LiveCareerPath,
    LiveCareerRank
)

# ─── Color Palette ───────────────────────────────────────────────────────────
MAROON       = colors.HexColor("#6A0C2C")
MAROON_LIGHT = colors.HexColor("#8B1A3D")
DARK_TEXT    = colors.HexColor("#111827")
MUTED_TEXT   = colors.HexColor("#374151")   # Darker — was #6B7280
LIGHT_MUTED  = colors.HexColor("#6B7280")   # Darker — was #9CA3AF
BORDER_GRAY  = colors.HexColor("#D1D5DB")
BG_CARD      = colors.HexColor("#F9FAFB")
BG_HEADER_ROW= colors.HexColor("#F3F4F6")
EMERALD      = colors.HexColor("#059669")
GOLD         = colors.HexColor("#B45309")
WHITE        = colors.white


def _kv_row(key: str, val: str, styles: dict) -> list:
    """Returns a two-cell row: [key_paragraph, value_paragraph]."""
    return [Paragraph(key, styles['key']), Paragraph(val, styles['val'])]


def _section_heading(title: str, style) -> list:
    """Returns a list of flowables for a section heading."""
    return [Spacer(1, 8), Paragraph(title, style), HRFlowable(width="100%", thickness=0.5, color=BORDER_GRAY, spaceAfter=6)]


async def build_pay_slip_pdf_bytes(db: AsyncSession, booking_id: int) -> bytes:
    """Fetches booking data from DB and returns rendered PDF as bytes."""
    stmt = (
        select(LiveFlightBooking)
        .where(LiveFlightBooking.id == booking_id)
    )
    res = await db.execute(stmt)
    booking = res.scalars().first()

    if not booking:
        raise ValueError("Booking record not found")

    # Fetch related models
    sched_res = await db.execute(select(LiveFlightSchedule).where(LiveFlightSchedule.id == booking.schedule_id))
    sched = sched_res.scalars().first()

    dep_pilot = None
    if booking.departure_pilot_id:
        dep_pilot_res = await db.execute(select(Pilot).where(Pilot.id == booking.departure_pilot_id))
        dep_pilot = dep_pilot_res.scalars().first()

    arr_pilot = None
    if booking.arrival_pilot_id and booking.arrival_pilot_id != booking.departure_pilot_id:
        arr_pilot_res = await db.execute(select(Pilot).where(Pilot.id == booking.arrival_pilot_id))
        arr_pilot = arr_pilot_res.scalars().first()

    dep_pirep = None
    if booking.departure_pirep_id:
        pirep_res = await db.execute(select(Pirep).where(Pirep.id == booking.departure_pirep_id))
        dep_pirep = pirep_res.scalars().first()

    live_ac = None
    ac_type = None
    if sched and sched.aircraft_id:
        ac_res = await db.execute(select(LiveAircraft).where(LiveAircraft.id == sched.aircraft_id))
        live_ac = ac_res.scalars().first()
        if live_ac:
            ac_type_res = await db.execute(select(Aircraft).where(Aircraft.id == live_ac.aircraft_type_id))
            ac_type = ac_type_res.scalars().first()

    # Pilot Career Details
    career_path_name = "Standard Operations"
    rank_name = f"Grade {dep_pilot.grade}" if dep_pilot and dep_pilot.grade else "Pilot"

    if dep_pilot:
        pc_res = await db.execute(
            select(LivePilotCareer)
            .where(LivePilotCareer.pilot_id == dep_pilot.id)
            .order_by(desc(LivePilotCareer.id))
            .limit(1)
        )
        pilot_career = pc_res.scalars().first()
        if pilot_career:
            if pilot_career.career_path_id:
                cp_res = await db.execute(select(LiveCareerPath).where(LiveCareerPath.id == pilot_career.career_path_id))
                cp = cp_res.scalars().first()
                if cp:
                    career_path_name = cp.name
            if pilot_career.current_rank_id:
                rk_res = await db.execute(select(LiveCareerRank).where(LiveCareerRank.id == pilot_career.current_rank_id))
                rk = rk_res.scalars().first()
                if rk:
                    rank_name = rk.name

    # ─── Data Calculations ───────────────────────────────────────────────────
    earnings = float(booking.earnings or 0.0)
    expenses = float(booking.expenses or 0.0)
    net_profit = earnings - expenses
    is_solo = (booking.departure_pilot_id == booking.arrival_pilot_id) or (booking.arrival_pilot_id is None)

    payout_share_pct = 0.10 if is_solo else 0.05
    min_payout = 750.0 if is_solo else 350.0
    pilot_salary = max(min_payout, net_profit * payout_share_pct) if net_profit > 0 else min_payout

    actual_flight_mins = dep_pirep.flighttime if dep_pirep and dep_pirep.flighttime else 0
    actual_hours = actual_flight_mins // 60
    actual_mins = actual_flight_mins % 60
    duration_str = f"{actual_hours:02d}h {actual_mins:02d}m" if actual_flight_mins > 0 else "N/A"

    fpm = booking.landing_fpm or 0
    if fpm <= 150:
        smoothness_label = "Butter (Exceptional)"
    elif fpm <= 250:
        smoothness_label = "Smooth Touchdown"
    elif fpm <= 350:
        smoothness_label = "Firm Landing"
    else:
        smoothness_label = "Hard Landing"

    rep_score = float(booking.reputation_score or 0.0)
    dispatched_str = booking.dispatched_at.strftime("%d %b %Y, %H:%M UTC") if booking.dispatched_at else "N/A"

    callsign_str = dep_pilot.callsign if dep_pilot and dep_pilot.callsign else "QRV000"
    pilot_name = dep_pilot.name if dep_pilot else "Unknown"
    flight_mode_str = "Solo Flight (Full Leg)" if is_solo else f"Split Flight (Landing: {arr_pilot.name if arr_pilot else 'N/A'})"
    reviewer_id = dep_pirep.acceptedid if dep_pirep and dep_pirep.acceptedid else "Auto-Approved"

    # ─── Document Setup ──────────────────────────────────────────────────────
    buffer = io.BytesIO()
    PAGE_W, PAGE_H = letter
    MARGIN = 0.45 * inch
    CONTENT_W = PAGE_W - 2 * MARGIN

    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=MARGIN,
        bottomMargin=MARGIN
    )

    base_styles = getSampleStyleSheet()

    # ─── Typography Styles ───────────────────────────────────────────────────
    styles = {
        'brand_title': ParagraphStyle('BrandTitle',
            fontName='Helvetica-Bold', fontSize=24, textColor=MAROON, leading=28, alignment=1),
        'brand_subtitle': ParagraphStyle('BrandSub',
            fontName='Helvetica-Bold', fontSize=9, textColor=DARK_TEXT, letterSpacing=2, leading=12, alignment=1),
        'doc_title_centered': ParagraphStyle('DocTitleCent',
            fontName='Helvetica-Bold', fontSize=14, textColor=DARK_TEXT, leading=18, alignment=1),
        'airline_centered': ParagraphStyle('AirlineCent',
            fontName='Helvetica-Bold', fontSize=8, textColor=MUTED_TEXT, letterSpacing=1, leading=11, alignment=1),
        
        'ref_item_l': ParagraphStyle('RefL',
            fontName='Helvetica', fontSize=8, textColor=MUTED_TEXT, alignment=0, leading=11),
        'ref_item_c': ParagraphStyle('RefC',
            fontName='Helvetica', fontSize=8, textColor=MUTED_TEXT, alignment=1, leading=11),
        'ref_item_r': ParagraphStyle('RefR',
            fontName='Helvetica', fontSize=8, textColor=MUTED_TEXT, alignment=2, leading=11),
        
        'section': ParagraphStyle('Section',
            fontName='Helvetica-Bold', fontSize=9, textColor=MAROON,
            letterSpacing=1.0, leading=13),
        'key': ParagraphStyle('Key',
            fontName='Helvetica', fontSize=8.5, textColor=MUTED_TEXT, leading=12),
        'val': ParagraphStyle('Val',
            fontName='Helvetica-Bold', fontSize=9.5, textColor=DARK_TEXT, leading=13),
        'val_right': ParagraphStyle('ValRight',
            fontName='Helvetica-Bold', fontSize=9.5, textColor=DARK_TEXT,
            alignment=2, leading=13),
        'val_right_green': ParagraphStyle('ValRightGreen',
            fontName='Helvetica-Bold', fontSize=9.5, textColor=EMERALD,
            alignment=2, leading=13),
        'val_right_red': ParagraphStyle('ValRightRed',
            fontName='Helvetica-Bold', fontSize=9.5, textColor=colors.HexColor("#DC2626"),
            alignment=2, leading=13),
        'tbl_header': ParagraphStyle('TblHeader',
            fontName='Helvetica-Bold', fontSize=8, textColor=MUTED_TEXT, leading=11),
        'tbl_header_r': ParagraphStyle('TblHeaderR',
            fontName='Helvetica-Bold', fontSize=8, textColor=MUTED_TEXT,
            alignment=2, leading=11),
        'salary_label': ParagraphStyle('SalLabel',
            fontName='Helvetica-Bold', fontSize=9.5, textColor=DARK_TEXT, leading=14),
        'salary_val': ParagraphStyle('SalVal',
            fontName='Helvetica-Bold', fontSize=14, textColor=MAROON,
            alignment=2, leading=18),
        'footer': ParagraphStyle('Footer',
            fontName='Helvetica', fontSize=8.5, textColor=MUTED_TEXT,
            alignment=1, leading=13),
        'thank_you': ParagraphStyle('ThankYou',
            fontName='Helvetica-Bold', fontSize=10.5, textColor=MAROON,
            alignment=1, leading=15),
    }

    story = []

    # ─── HEADER (CENTERED, NO LOGO) ──────────────────────────────────────────
    story.append(Paragraph("ORYXOPS", styles['brand_title']))
    story.append(Paragraph("QATARI VIRTUAL", styles['brand_subtitle']))
    story.append(Spacer(1, 10))
    story.append(Paragraph("PILOT FLIGHT PAY SLIP", styles['doc_title_centered']))
    story.append(Paragraph(f"Season Operations  ·  Booking Leg #{booking.id}", styles['airline_centered']))
    story.append(Spacer(1, 10))

    # Reference info block (horizontal, 3-column table)
    ref_data = [
        [
            Paragraph(f"REFERENCE: <b>PS-{booking.id:04d} / {callsign_str}</b>", styles['ref_item_l']),
            Paragraph(f"ISSUED: <b>{dispatched_str}</b>", styles['ref_item_c']),
            Paragraph(f"STATUS: <font color='#059669'><b>APPROVED & PAID</b></font>", styles['ref_item_r'])
        ]
    ]
    ref_table = Table(ref_data, colWidths=[CONTENT_W / 3.0, CONTENT_W / 3.0, CONTENT_W / 3.0])
    ref_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))
    story.append(ref_table)
    story.append(Spacer(1, 4))
    story.append(HRFlowable(width="100%", thickness=1.5, color=MAROON, spaceAfter=12))

    # ─── CREW & PILOT PROFILE ────────────────────────────────────────────────
    story.append(Paragraph("CREW & PILOT PROFILE", styles['section']))
    story.append(HRFlowable(width="100%", thickness=0.4, color=BORDER_GRAY, spaceAfter=6))

    crew_data = [
        [
            Paragraph("PILOT NAME", styles['tbl_header']),
            Paragraph("CALLSIGN", styles['tbl_header']),
            Paragraph("PILOT ID", styles['tbl_header']),
            Paragraph("RANK", styles['tbl_header']),
        ],
        [
            Paragraph(f"<b>{pilot_name}</b>", styles['val']),
            Paragraph(f"<b>{callsign_str}</b>", styles['val']),
            Paragraph(f"#{dep_pilot.id if dep_pilot else 'N/A'}", styles['val']),
            Paragraph(rank_name, styles['val']),
        ],
        [
            Paragraph("SIMBRIEF ID", styles['tbl_header']),
            Paragraph("CAREER PATH", styles['tbl_header']),
            Paragraph("FLIGHT MODE", styles['tbl_header']),
            Paragraph("", styles['tbl_header']),
        ],
        [
            Paragraph(str(dep_pilot.simbrief_id) if dep_pilot and dep_pilot.simbrief_id else "—", styles['val']),
            Paragraph(career_path_name, styles['val']),
            Paragraph(flight_mode_str, styles['val']),
            Paragraph("", styles['val']),
        ],
    ]
    col_w = CONTENT_W / 4
    crew_table = Table(crew_data, colWidths=[col_w, col_w, col_w, col_w])
    crew_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BG_HEADER_ROW),
        ('BACKGROUND', (0, 2), (-1, 2), BG_HEADER_ROW),
        ('LINEBELOW', (0, 0), (-1, 0), 0.5, BORDER_GRAY),
        ('LINEBELOW', (0, 1), (-1, 1), 0.5, BORDER_GRAY),
        ('LINEBELOW', (0, 2), (-1, 2), 0.5, BORDER_GRAY),
        ('BOX', (0, 0), (-1, -1), 0.8, BORDER_GRAY),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(crew_table)
    story.append(Spacer(1, 12))

    # ─── FLIGHT OPERATIONS RECORD ────────────────────────────────────────────
    story.append(Paragraph("FLIGHT OPERATIONS RECORD", styles['section']))
    story.append(HRFlowable(width="100%", thickness=0.4, color=BORDER_GRAY, spaceAfter=6))

    dep_icao = sched.departure if sched else "???"
    arr_icao = sched.arrival if sched else "???"
    flight_num = sched.flight_number if sched else "N/A"
    ac_model = ac_type.name if ac_type else "Unknown Aircraft"
    ac_icao = ac_type.icao if ac_type else "XXXX"
    ac_reg = live_ac.registration if live_ac else "—"
    livery = ac_type.liveryname if ac_type and hasattr(ac_type, 'liveryname') and ac_type.liveryname else "Standard Livery"
    pax = booking.pax_count or 0
    fuel = dep_pirep.fuelused if dep_pirep and dep_pirep.fuelused else 0

    ops_data = [
        [
            Paragraph("FLIGHT NUMBER", styles['tbl_header']),
            Paragraph("ROUTE", styles['tbl_header']),
            Paragraph("AIRCRAFT", styles['tbl_header']),
            Paragraph("REGISTRATION", styles['tbl_header']),
        ],
        [
            Paragraph(f"<b>{flight_num}</b>", styles['val']),
            Paragraph(f"<b>{dep_icao} → {arr_icao}</b>", styles['val']),
            Paragraph(f"{ac_model} ({ac_icao})", styles['val']),
            Paragraph(ac_reg, styles['val']),
        ],
        [
            Paragraph("LIVERY", styles['tbl_header']),
            Paragraph("PASSENGERS", styles['tbl_header']),
            Paragraph("FUEL BURNED", styles['tbl_header']),
            Paragraph("", styles['tbl_header']), # Spanned
        ],
        [
            Paragraph(livery, styles['val']),
            Paragraph(f"{pax} Pax", styles['val']),
            Paragraph(f"{fuel:,} kg", styles['val']),
            Paragraph("", styles['val']), # Spanned
        ],
    ]
    ops_table = Table(ops_data, colWidths=[col_w, col_w, col_w, col_w])
    ops_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BG_HEADER_ROW),
        ('BACKGROUND', (0, 2), (-1, 2), BG_HEADER_ROW),
        ('SPAN', (2, 2), (3, 2)),
        ('SPAN', (2, 3), (3, 3)),
        ('LINEBELOW', (0, 0), (-1, 0), 0.5, BORDER_GRAY),
        ('LINEBELOW', (0, 1), (-1, 1), 0.5, BORDER_GRAY),
        ('LINEBELOW', (0, 2), (-1, 2), 0.5, BORDER_GRAY),
        ('BOX', (0, 0), (-1, -1), 0.8, BORDER_GRAY),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(ops_table)
    story.append(Spacer(1, 12))

    # ─── PERFORMANCE METRICS ─────────────────────────────────────────────────
    story.append(Paragraph("PERFORMANCE METRICS", styles['section']))
    story.append(HRFlowable(width="100%", thickness=0.4, color=BORDER_GRAY, spaceAfter=6))

    perf_data = [
        [
            Paragraph("LANDING RATE", styles['tbl_header']),
            Paragraph("QUALITY", styles['tbl_header']),
            Paragraph("PIREP REVIEWER", styles['tbl_header']),
            Paragraph("REPUTATION SCORE", styles['tbl_header']),
        ],
        [
            Paragraph(f"<b>{fpm} FPM</b>", styles['val']),
            Paragraph(smoothness_label, styles['val']),
            Paragraph(f"Staff #{reviewer_id}", styles['val']),
            Paragraph(f"<b>{rep_score:.2f} / 5.00</b>", styles['val']),
        ],
    ]
    perf_table = Table(perf_data, colWidths=[col_w, col_w, col_w, col_w])
    perf_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BG_HEADER_ROW),
        ('LINEBELOW', (0, 0), (-1, 0), 0.5, BORDER_GRAY),
        ('BOX', (0, 0), (-1, -1), 0.8, BORDER_GRAY),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(perf_table)
    story.append(Spacer(1, 12))

    # ─── FINANCIAL STATEMENT (DUAL CURRENCY QAR & USD) ──────────────────────
    story.append(Paragraph("FINANCIAL STATEMENT", styles['section']))
    story.append(HRFlowable(width="100%", thickness=0.4, color=BORDER_GRAY, spaceAfter=6))

    share_label = "10% — Solo (Full Leg)" if is_solo else "5% — Split (Half Leg)"
    
    # Currency conversions
    usd_rate = 3.64
    earnings_usd = earnings / usd_rate
    expenses_usd = expenses / usd_rate
    net_profit_usd = net_profit / usd_rate
    pilot_salary_usd = pilot_salary / usd_rate

    LEFT_W = CONTENT_W * 0.50
    RIGHT_W = CONTENT_W * 0.25

    fin_data = [
        [
            Paragraph("ITEM", styles['tbl_header']),
            Paragraph("AMOUNT (QAR)", styles['tbl_header_r']),
            Paragraph("AMOUNT (USD)", styles['tbl_header_r']),
        ],
        [
            Paragraph("Gross Leg Revenue", styles['key']),
            Paragraph(f"+{earnings:,.2f}", styles['val_right_green']),
            Paragraph(f"+${earnings_usd:,.2f}", styles['val_right_green']),
        ],
        [
            Paragraph("Operating Expenses", styles['key']),
            Paragraph(f"−{expenses:,.2f}", styles['val_right_red']),
            Paragraph(f"−${expenses_usd:,.2f}", styles['val_right_red']),
        ],
        [
            Paragraph("<b>Net Leg Profit</b>", styles['key']),
            Paragraph(f"<b>{net_profit:,.2f}</b>", styles['val_right']),
            Paragraph(f"<b>${net_profit_usd:,.2f}</b>", styles['val_right']),
        ],
        [
            Paragraph(f"Pilot Share Rate  ({share_label})", styles['key']),
            Paragraph("Applied", ParagraphStyle('AppliedQAR', fontName='Helvetica', fontSize=8, textColor=EMERALD, alignment=2, leading=12)),
            Paragraph("Applied", ParagraphStyle('AppliedUSD', fontName='Helvetica', fontSize=8, textColor=EMERALD, alignment=2, leading=12)),
        ],
    ]
    fin_table = Table(fin_data, colWidths=[LEFT_W, RIGHT_W, RIGHT_W])
    fin_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BG_HEADER_ROW),
        ('LINEBELOW', (0, 0), (-1, 0), 0.5, BORDER_GRAY),
        ('LINEBELOW', (0, 1), (-1, 1), 0.5, BORDER_GRAY),
        ('LINEBELOW', (0, 2), (-1, 2), 0.5, BORDER_GRAY),
        ('LINEBELOW', (0, 3), (-1, 3), 1, colors.HexColor("#D1D5DB")),
        ('LINEBELOW', (0, 4), (-1, 4), 0.5, BORDER_GRAY),
        ('BOX', (0, 0), (-1, -1), 0.8, BORDER_GRAY),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(fin_table)
    story.append(Spacer(1, 10))

    # ─── SALARY TOTAL BOX (DUAL CURRENCY) ────────────────────────────────────
    sal_label = Paragraph(
        f"<b>NET PILOT SALARY CREDITED TO WALLET</b><br/>"
        f"<font size='7.5' color='#4B5563'>Booking #{booking.id} · {callsign_str} · {dispatched_str}</font>",
        styles['salary_label']
    )
    sal_val = Paragraph(
        f"<b>+ {pilot_salary:,.2f} QAR</b><br/>"
        f"<font size='9.5' color='#B45309'>≈ ${pilot_salary_usd:,.2f} USD</font>",
        styles['salary_val']
    )

    salary_box = Table([[sal_label, sal_val]], colWidths=[LEFT_W, RIGHT_W + RIGHT_W])
    salary_box.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1.5, MAROON),
        ('LINEAFTER', (0, 0), (0, 0), 0.5, BORDER_GRAY),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(salary_box)
    story.append(Spacer(1, 20))

    # ─── FOOTER ──────────────────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER_GRAY, spaceAfter=8))
    
    footer_text = (
        "This document is system-generated by <b>OryxOps — Qatari Virtual Operations Center</b>.<br/>"
        "All values are sourced live from the operations database. "
        "Salary is credited to Pilot QAR Wallet upon PIREP approval."
    )
    story.append(Paragraph(footer_text, styles['footer']))
    story.append(Spacer(1, 6))
    story.append(Paragraph("Thank you for flying with Qatari Virtual ✈", styles['thank_you']))

    doc.build(story)
    return buffer.getvalue()
