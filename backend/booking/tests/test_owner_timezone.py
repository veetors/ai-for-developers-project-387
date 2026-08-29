"""Owner.timezone drives the slot grid and booking window (not hardcoded MSK)."""

from __future__ import annotations

from datetime import datetime

from booking.app_registry import app_registry
from booking.domain import Owner

YEKATERINBURG = "Asia/Yekaterinburg"  # UTC+5


def _set_owner_timezone(tz: str) -> None:
    owner = app_registry.owner
    app_registry.reset()
    app_registry._owner_repo.owner = Owner(id=owner.id, name=owner.name, timezone=tz)


def test_grid_slot_times_follow_owner_timezone(client, make_event_type, frozen_clock):
    """Fix owner tz to UTC+5; first slot (06:00 local) must be 01:00 UTC."""

    _set_owner_timezone(YEKATERINBURG)
    et = make_event_type(name="Ural")
    slots = client.get(f"/api/event-types/{et['id']}/slots?date=2099-06-01").json()
    first = slots[0]
    assert datetime.fromisoformat(first["start_at"]) == datetime.fromisoformat(
        "2099-06-01T01:00:00+00:00"
    )
    assert datetime.fromisoformat(first["end_at"]) == datetime.fromisoformat(
        "2099-06-01T01:30:00+00:00"
    )
    assert len(slots) == 32


def test_owner_timezone_exposed_on_event_type(client, make_event_type, frozen_clock):
    _set_owner_timezone(YEKATERINBURG)
    et = make_event_type(name="Tz exposed")
    body = client.get(f"/api/event-types/{et['id']}").json()
    assert body["timezone"] == YEKATERINBURG


def test_booking_work_hours_use_owner_timezone(client, make_event_type, frozen_clock):
    """18:00 UTC = 21:00 MSK (ok) but 23:00 Yekaterinburg (out of hours).
    Proves the work-hours rule binds to the owner's tz, not MSK."""

    start = "2099-06-01T18:00:00+00:00"

    et_msk = make_event_type(name="Ural hours msk")
    ok = client.post(
        f"/api/event-types/{et_msk['id']}/bookings",
        json={
            "guest_name": "Ann",
            "guest_email": "ann@example.com",
            "start_at": start,
        },
    )
    assert ok.status_code == 200, ok.text

    _set_owner_timezone(YEKATERINBURG)
    et_ural = make_event_type(name="Ural hours ural")
    bad = client.post(
        f"/api/event-types/{et_ural['id']}/bookings",
        json={
            "guest_name": "Ann",
            "guest_email": "ann@example.com",
            "start_at": start,
        },
    )
    assert bad.status_code == 422
    assert bad.json()["error"]["code"] == "slot_outside_hours"
