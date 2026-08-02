"""Tests for the iCalendar event exporter."""

import re

from app.export.calendar_exporter import CalendarExporter


def _line(ics: str, prop: str) -> str:
    return next(line for line in ics.split("\r\n") if line.startswith(prop + ":")).removeprefix(prop + ":")


def test_escapes_special_chars_in_text_fields():
    ics = CalendarExporter.generate_ics_event(
        summary='Backend, "Go" \\ lead; urgent',
        description="Line1\r\nLine2\nLine3\rEnd",
        location="Room A, Bldg 1; Floor 2",
        start_datetime_iso="2026-03-10T09:30:00Z",
    )
    assert 'SUMMARY:Backend\\, "Go" \\\\ lead\\; urgent' in ics
    assert "DESCRIPTION:Line1\\nLine2\\nLine3\\nEnd" in ics
    assert "LOCATION:Room A\\, Bldg 1\\; Floor 2" in ics


def test_uid_unique_and_caller_supplied_uid_honored():
    first = CalendarExporter.generate_ics_event("a", "b", "2026-03-10T09:30:00Z")
    second = CalendarExporter.generate_ics_event("a", "b", "2026-03-10T09:30:00Z")
    assert _line(first, "UID") != _line(second, "UID")
    assert re.match(r"^tayari-event-[0-9a-f]{32}@tayari\.ai$", _line(first, "UID"))

    fixed = CalendarExporter.generate_ics_event("a", "b", "2026-03-10T09:30:00Z", event_id="job-42")
    assert _line(fixed, "UID") == "tayari-event-job-42@tayari.ai"


def test_dtstamp_uses_valid_ical_utc_format():
    ics = CalendarExporter.generate_ics_event("a", "b", "2026-03-10T09:30:00Z")
    assert re.match(r"^\d{8}T\d{6}Z$", _line(ics, "DTSTAMP"))


def test_dtstart_naive_input_assumed_utc():
    ics = CalendarExporter.generate_ics_event("a", "b", "2026-03-10T09:30:00")
    assert _line(ics, "DTSTART") == "20260310T093000Z"


def test_dtstart_offset_input_converted_to_utc():
    ics = CalendarExporter.generate_ics_event("a", "b", "2026-03-10T09:30:00-04:00")
    assert _line(ics, "DTSTART") == "20260310T133000Z"


def test_dtstart_z_suffixed_input():
    ics = CalendarExporter.generate_ics_event("a", "b", "2026-03-10T09:30:00Z")
    assert _line(ics, "DTSTART") == "20260310T093000Z"
