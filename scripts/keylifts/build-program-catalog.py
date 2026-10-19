import argparse
import csv
import json
from pathlib import Path


def integer(value):
    return int(value) if value not in (None, "") else None


def main():
    app = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(description="Build the KeyLifts program catalogue used by openGym.")
    parser.add_argument("--source", type=Path, default=app.parent / "research" / "keylifts-opengym")
    parser.add_argument("--output", type=Path, default=app / "api" / "programs" / "catalog.json")
    args = parser.parse_args()

    active = json.loads((args.source / "catalog-active-metadata.json").read_text(encoding="utf-8"))
    audit = json.loads((args.source / "catalog-count-audit.json").read_text(encoding="utf-8"))
    with (args.source / "program-inventory.csv").open(encoding="utf-8-sig", newline="") as handle:
        official = {row["id"]: row for row in csv.DictReader(handle)}
    with (args.source / "community-export" / "community-programs.csv").open(encoding="utf-8-sig", newline="") as handle:
        community = {row["id"]: row for row in csv.DictReader(handle)}

    programs = []
    for item in active:
        source = "official" if item["is_verified"] else "community"
        row = (official if source == "official" else community).get(item["id"])
        programs.append({
            "id": item["id"],
            "name": item["name"],
            "source": source,
            "family": row.get("family") or None if row else None,
            "phase": row.get("phase") or None if row else None,
            "goal": row.get("goal") or None if row else None,
            "weeks": integer(row.get("weeks")) if row else None,
            "daysPerWeek": integer(row.get("days_per_week")) if row else None,
            "userCount": integer(row.get("user_count")) if row and source == "community" else None,
            "workoutCount": integer(row.get("workout_count") or row.get("workouts_in_bundle")) if row else None,
            "catalogStatus": "indexed" if row else "metadata-only",
            "sourceUrl": row.get("public_url_candidate") or None if row and source == "official" else None,
        })

    ids = [program["id"] for program in programs]
    counts = audit["counts"]
    assert len(ids) == len(set(ids)) == counts["active"]
    assert sum(p["source"] == "official" for p in programs) == counts["active_verified"]
    assert sum(p["source"] == "community" for p in programs) == counts["active_community"]

    output = {
        "schemaVersion": 1,
        "sourceCheckedAt": audit["checked_at_utc"],
        "counts": {
            "total": counts["active"],
            "official": counts["active_verified"],
            "community": counts["active_community"],
            "metadataOnly": sum(p["catalogStatus"] == "metadata-only" for p in programs),
        },
        "programs": sorted(programs, key=lambda p: (p["name"].casefold(), p["id"])),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {len(programs)} programs to {args.output}")


if __name__ == "__main__":
    main()
