import argparse
import csv
import hashlib
import json
import re
from pathlib import Path


def integer(value):
    return int(value) if value not in (None, "") else None


def levels(value):
    found = set(re.findall(r"beginner|intermediate|advanced", str(value or ""), re.IGNORECASE))
    return [level for level in ("Beginner", "Intermediate", "Advanced") if level.casefold() in {item.casefold() for item in found}]


def bundled_official(source):
    text = (source / "keylifts-public" / "web.js").read_text(encoding="utf-8")
    module = next(line for line in text.splitlines() if line.endswith("}),2410,[]);"))
    literal = module.split("t.exports=", 1)[1].rsplit("}),2410,[]);", 1)[0]
    token = re.compile(r'"(?:\\.|[^"\\])*"|[A-Za-z_$][A-Za-z0-9_$]*(?=\s*:)')
    literal = token.sub(lambda match: match[0] if match[0].startswith('"') else json.dumps(match[0]), literal)
    return {program["id"]: program for program in json.loads(literal)}


def workouts_of(program):
    workouts = program.get("workouts_v2") or program.get("workouts") or []
    if isinstance(workouts, str):
        workouts = json.loads(workouts)
    return workouts or []


def ordered(items):
    return sorted(items or [], key=lambda item: integer(item.get("order")) if integer(item.get("order")) is not None else 999)


def ordered_days(items):
    def position(item):
        sequence = integer(item.get("sequence"))
        named = re.search(r"\bday\s+(\d+)\b", str(item.get("name") or ""), re.IGNORECASE)
        order = integer(item.get("order"))
        return sequence if sequence is not None else int(named.group(1)) if named else order if order is not None else 999
    return sorted(items or [], key=position)


def normalise_detail(program, source):
    weeks = {}
    issues = []
    for workout in workouts_of(program):
        week_number = integer(workout.get("week")) or 1
        exercises = []
        for exercise in ordered(workout.get("exercises")):
            sets = ordered(exercise.get("exerciseSets"))
            row = {key: value for key, value in exercise.items() if key not in {"exerciseSets", "templateWorkoutId"}}
            row["sets"] = sets
            if not (row.get("name") or row.get("exerciseName") or row.get("category") or row.get("recommendation") or any(item.get("exerciseName") for item in sets)):
                issues.append("exercise-without-name-or-category")
            exercises.append(row)
        day = {key: value for key, value in workout.items() if key != "exercises"}
        day["exercises"] = exercises
        weeks.setdefault(week_number, []).append(day)
    normalised_weeks = [{"number": number, "days": ordered_days(days)} for number, days in sorted(weeks.items())]
    declared_weeks = integer(program.get("number_of_weeks"))
    if declared_weeks and declared_weeks != len(normalised_weeks):
        issues.append("week-count-mismatch")
    payload = {
        "schemaVersion": 1,
        "id": program["id"],
        "name": program.get("name"),
        "source": source,
        "sourceUpdatedAt": program.get("server_updated_at"),
        "compatibilityIssues": sorted(set(issues)),
        "schedule": normalised_weeks,
    }
    encoded = json.dumps(normalised_weeks, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    payload["contentVersion"] = hashlib.sha256(encoded).hexdigest()
    return payload


def main():
    app = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(description="Build the KeyLifts program catalogue and local full-detail cache used by openGym.")
    parser.add_argument("--source", type=Path, default=app.parent / "research" / "keylifts-opengym")
    parser.add_argument("--output", type=Path, default=app / "api" / "programs" / "catalog.json")
    parser.add_argument("--details-output", type=Path, default=app / "api" / "programs" / "details")
    args = parser.parse_args()

    active = json.loads((args.source / "catalog-active-metadata.json").read_text(encoding="utf-8"))
    audit = json.loads((args.source / "catalog-count-audit.json").read_text(encoding="utf-8"))
    with (args.source / "program-inventory.csv").open(encoding="utf-8-sig", newline="") as handle:
        official = {row["id"]: row for row in csv.DictReader(handle)}
    with (args.source / "community-export" / "community-programs.csv").open(encoding="utf-8-sig", newline="") as handle:
        community = {row["id"]: row for row in csv.DictReader(handle)}
    community_source = {
        row["id"]: row
        for row in json.loads((args.source / "community-export" / "source-templates.json").read_text(encoding="utf-8"))
    }
    official_source = bundled_official(args.source)

    programs = []
    for item in active:
        source = "official" if item["is_verified"] else "community"
        row = (official if source == "official" else community).get(item["id"])
        raw = (official_source if source == "official" else community_source).get(item["id"])
        programs.append({
            "id": item["id"],
            "name": item["name"],
            "source": source,
            "family": row.get("family") or None if row else None,
            "phase": row.get("phase") or None if row else None,
            "goal": row.get("goal") or None if row else None,
            "weeks": integer(row.get("weeks")) if row else None,
            "daysPerWeek": integer(row.get("days_per_week")) if row else None,
            "levels": levels(raw.get("levels")) if raw else [],
            "userCount": integer(row.get("user_count")) if row and source == "community" else None,
            "workoutCount": integer(row.get("workout_count") or row.get("workouts_in_bundle")) if row else None,
            "catalogStatus": "indexed" if row else "metadata-only",
            "sourceUrl": row.get("public_url_candidate") or None if row and source == "official" else None,
            "createdAt": raw.get("server_created_at") if raw else None,
            "updatedAt": raw.get("server_updated_at") if raw else None,
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

    args.details_output.mkdir(parents=True, exist_ok=True)
    expected = set()
    for program in programs:
        raw = (official_source if program["source"] == "official" else community_source).get(program["id"])
        if not raw:
            continue
        detail = normalise_detail(raw, program["source"])
        if not detail["schedule"]:
            continue
        path = args.details_output / f'{program["id"]}.json'
        path.write_text(json.dumps(detail, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        expected.add(path.name)
    for stale in args.details_output.glob("*.json"):
        if stale.name not in expected:
            stale.unlink()

    assert len(expected) == len(programs) - output["counts"]["metadataOnly"]
    print(f"Wrote {len(programs)} catalogue rows and {len(expected)} full program details")


if __name__ == "__main__":
    main()
