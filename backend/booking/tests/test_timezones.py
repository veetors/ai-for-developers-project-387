"""Multi-timezone: business rules follow Owner.timezone, not a hardcoded MSK."""

from __future__ import annotations

from datetime import UTC, datetime

from booking.app_registry import app_registry

VLADIVOSTOK = "Asia/Vladivostok"


def _as_utc(local_iso: str) -> datetime:
    """Parse a local wall-clock ISO string (with fixed offset) and convert to UTC."""

    return datetime.fromisoformat(local_iso).astimezone(UTC)


def _book(client, event_type_id: int, start_at: datetime):
    return client.post(
        f"/api/event-types/{event_type_id}/bookings",
        json={
            "guest_name": "Ann",
            "guest_email": "ann@example.com",
            "start_at": start_at.isoformat(),
        },
    )


def test_event_type_exposes_owner_timezone(client, make_event_type):
    # Arrange / Act
    et = make_event_type(name="TZ visible")

    # Assert
    assert et["timezone"] == "Europe/Moscow"


def test_grid_follows_owner_timezone(client, make_event_type, frozen_clock, fixed_now):
    # Arrange
    app_registry.set_owner_timezone(VLADIVOSTOK)
    et = make_event_type(name="Vladivostok grid")

    # Act
    response = client.get(f"/api/event-types/{et['id']}/slots?date=2099-06-01")

    # Assert
    assert response.status_code == 200
    slots = response.json()
    assert len(slots) == 32
    # 06:00 VLAT == 20:00 UTC of the previous day — proves the grid isn't MSK-bound.
    first = datetime.fromisoformat(slots[0]["start_at"])
    assert first == _as_utc("2099-06-01T06:00:00+10:00")
    last_end = datetime.fromisoformat(slots[-1]["end_at"])
    assert last_end == _as_utc("2099-06-01T22:00:00+10:00")


def test_work_hours_reject_before_start(client, make_event_type, frozen_clock, fixed_now):
    # Arrange
    app_registry.set_owner_timezone(VLADIVOSTOK)
    et = make_event_type(name="Vladivostok hours")

    # Act: 05:00 VLAT is before the 06:00 work start → rejected.
    early = _book(client, et["id"], _as_utc("2099-06-02T05:00:00+10:00"))

    # Assert
    assert early.status_code == 422
    assert early.json()["error"]["code"] == "slot_outside_hours"


def test_work_hours_accept_at_start(client, make_event_type, frozen_clock, fixed_now):
    # Arrange
    app_registry.set_owner_timezone(VLADIVOSTOK)
    et = make_event_type(name="Vladivostok hours")

    # Act: 06:00 VLAT on a future day → accepted.
    ok = _book(client, et["id"], _as_utc("2099-06-02T06:00:00+10:00"))

    # Assert
    assert ok.status_code == 200, ok.text


def test_booking_window_follows_owner_timezone(
    client, make_event_type, frozen_clock, fixed_now
):
    # Arrange
    app_registry.set_owner_timezone(VLADIVOSTOK)
    et = make_event_type(name="Vladivostok window")

    # Act: 2099-06-15 VLAT is 14 days after today (2099-06-01 VLAT) → outside the window.
    response = client.get(f"/api/event-types/{et['id']}/slots?date=2099-06-15")

    # Assert
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "slot_outside_window"
