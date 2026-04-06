# import_cricsheet_json.py
# ----------------------------------------
# Cricsheet JSON -> your SQLite database (schema-aware)
# - Fills matches.team_a/team_b/toss_winner/winner_id even without a teams table
# - Fills innings.batting_team/bowling_team likewise
# - ball_events: writes 'innings' (lowercase), phases PP 1–5, MO 6–15, DO 16–20
# - partnerships: complete list, start_over/end_over with ball precision, start_wicket from 1, opponent_team set

import os, sys, json, sqlite3
from contextlib import contextmanager

DB_PATH_DEFAULT = "cricket_analysis.db"
STRICT_UNMAPPED_PLAYERS = True
FIELDING_EVENT_ID = {"caught": 2, "stumped": 14}

DISMISSAL_MAP = {
    "caught": "caught",
    "caught and bowled": "caught",
    "stumped": "stumped",
    "bowled": "bowled",
    "lbw": "lbw",
    "run out": "run out",
    "hit wicket": "hit wicket",
    "retired out": "retired out",
    "timed out": "timed out",
    "handled the ball": "handled the ball",
    "obstructing the field": "obstructing the field",
    "hit the ball twice": "hit the ball twice",
}

@contextmanager
def fast_conn(db_path):
    db_dir = os.path.dirname(os.path.abspath(db_path))
    if db_dir and not os.path.isdir(db_dir):
        os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys=ON;")
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=OFF;")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def _collect_all_names_from_json(mdict):
    """
    Walk the Cricsheet JSON and collect every display name that can appear:
    batters, non-strikers, bowlers, dismissed players, fielders.
    Returns a sorted list of unique names.
    """
    names = set()
    innings = mdict.get("innings", []) or []
    for inns in innings:
        overs = inns.get("overs", []) or []
        for over in overs:
            deliveries = over.get("deliveries", []) or []
            for d in deliveries:
                b = d.get("batter") or d.get("striker")
                if b: names.add(b)
                ns = d.get("non_striker") or d.get("nonStriker")
                if ns: names.add(ns)
                bow = d.get("bowler")
                if bow: names.add(bow)

                wickets = d.get("wickets") or []
                if wickets:
                    wk = wickets[0]
                    po = wk.get("player_out") or wk.get("player") or wk.get("batter_out")
                    if po: names.add(po)
                    fielders = wk.get("fielders") or wk.get("fielder")
                    if isinstance(fielders, list):
                        for f in fielders:
                            if isinstance(f, dict):
                                n = f.get("name")
                                if n: names.add(n)
                            elif isinstance(f, str):
                                names.add(f)
                    elif isinstance(fielders, dict):
                        n = fielders.get("name")
                        if n: names.add(n)
                    elif isinstance(fielders, str):
                        names.add(fielders)
    return sorted(names)

def _name_in_db(conn, display_name: str) -> bool:
    """
    True if the name is resolvable via player_alias.alias OR players.player_name
    """
    # alias check
    if table_exists(conn, "player_alias"):
        row = conn.execute(
            "SELECT 1 FROM player_alias WHERE lower(alias)=lower(?) LIMIT 1",
            (display_name,)
        ).fetchone()
        if row: return True
    # direct player_name check
    row = conn.execute(
        "SELECT 1 FROM players WHERE lower(player_name)=lower(?) LIMIT 1",
        (display_name,)
    ).fetchone()
    return bool(row)

def preflight_player_report(json_path: str, db_path: str) -> bool:
    """
    Scan JSON for all display names; report any that are missing.
    If missing found, write a file next to the JSON and print instructions.
    Returns True if OK to proceed (no missing), False if you should stop and fix.
    """
    with open(json_path, "r", encoding="utf-8") as f:
        js = json.load(f)

    all_names = _collect_all_names_from_json(js)
    missing = []
    with sqlite3.connect(db_path) as conn:
        conn.execute("PRAGMA foreign_keys=ON;")
        for nm in all_names:
            if not _name_in_db(conn, nm):
                missing.append(nm)

    if not missing:
        print("[preflight] All player names/aliases are present.")
        return True

    base = os.path.splitext(os.path.basename(json_path))[0]
    report_path = os.path.join(os.path.dirname(os.path.abspath(json_path)),
                               f"missing_players_{base}.txt")

    # Build a small, helpful report
    lines = []
    lines.append("=== Missing players / aliases ===")
    for nm in missing:
        lines.append(f"- {nm}")
    lines.append("")
    lines.append("=== SQL templates (adjust columns as needed) ===")
    lines.append("-- If the player already exists in `players`, add an alias mapping:")
    lines.append("INSERT INTO player_alias(alias, player_id) VALUES ('<DISPLAY_NAME>', <PLAYER_ID>);")
    lines.append("")
    lines.append("-- If the player does not exist at all, add them (minimal example):")
    lines.append("INSERT INTO players(player_name) VALUES ('<DISPLAY_NAME>');")
    lines.append("-- Then map the alias to the new player_id:")
    lines.append("INSERT INTO player_alias(alias, player_id) VALUES ('<DISPLAY_NAME>', <NEW_PLAYER_ID>);")
    lines.append("")
    lines.append("After inserting the needed rows, re-run the importer.")
    txt = "\n".join(lines)

    with open(report_path, "w", encoding="utf-8") as f:
        f.write(txt)

    print("\n[preflight] Some players/aliases are missing. No data was imported.\n")
    print(txt)
    print(f"\n[preflight] A copy was saved to: {report_path}\n")
    return False

def table_exists(conn, name: str) -> bool:
    return bool(conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",(name,)
    ).fetchone())

def table_columns(conn, name: str) -> dict:
    # returns {col_name: col_type}
    cols = {}
    for cid, cname, ctype, notnull, dflt, pk in conn.execute(f"PRAGMA table_info({name})"):
        cols[cname] = (ctype or "")
    return cols

def col_type(conn, table: str, col: str) -> str:
    return table_columns(conn, table).get(col, "")

def is_text_column(conn, table: str, col: str) -> bool:
    t = col_type(conn, table, col).upper()
    return ("CHAR" in t) or ("TEXT" in t) or ("CLOB" in t)

def is_int_column(conn, table: str, col: str) -> bool:
    t = col_type(conn, table, col).upper()
    # SQLite uses dynamic typing; treat empty (unspecified) as OK for ints too
    return ("INT" in t) or (t == "")

def fk_map_for_table(conn, table: str) -> dict:
    """Return {column_name: target_table} for FKs on `table`."""
    fks = {}
    for row in conn.execute(f"PRAGMA foreign_key_list({table})"):
        # row: (id, seq, table, from, to, on_update, on_delete, match)
        target_table = row[2]
        from_col = row[3]
        fks[from_col] = target_table
    return fks

def ensure_country(conn, country_name: str) -> int | None:
    """Find or create countries.country_id for the given name."""
    if not table_exists(conn, "countries"):
        return None
    name = (country_name or "").strip()
    row = conn.execute(
        "SELECT country_id FROM countries WHERE lower(country_name)=lower(?)",
        (name,)
    ).fetchone()
    if row:
        return row[0]
    # create missing country row
    cur = conn.execute("INSERT INTO countries (country_name) VALUES (?)", (name,))
    return cur.lastrowid

def lookup_country_id(conn, country_like: str) -> int | None:
    """(Replaces previous version) Try exact, then common variants; if still missing, create it."""
    if not table_exists(conn, "countries"):
        return None
    raw = (country_like or "").strip()
    # exact
    row = conn.execute(
        "SELECT country_id FROM countries WHERE lower(country_name)=lower(?)",
        (raw,)
    ).fetchone()
    if row:
        return row[0]

    # try variants
    candidates = set()
    if raw.lower().endswith(" women"):
        candidates.add(raw[:-7].strip())
    else:
        candidates.add(f"{raw} Women")
    if "brazil" in raw.lower():
        candidates.add("Brasil")
        candidates.add("Brasil Women")
    if "brasil" in raw.lower():
        candidates.add("Brasil Women")

    for cand in candidates:
        row = conn.execute(
            "SELECT country_id FROM countries WHERE lower(country_name)=lower(?)",
            (cand,)
        ).fetchone()
        if row:
            return row[0]

    # last resort: create exactly what we were asked to store
    return ensure_country(conn, raw)

def ensure_team(conn, team_name: str) -> int | None:
    """Find or create teams.team_id for the given name (if you have a teams table)."""
    if not table_exists(conn, "teams"):
        return None
    cols = table_columns(conn, "teams")
    id_col = "team_id" if "team_id" in cols else ("id" if "id" in cols else None)
    name_col = "name" if "name" in cols else None
    if not (id_col and name_col):
        return None
    row = conn.execute(f"SELECT {id_col} FROM teams WHERE {name_col}=?", (team_name,)).fetchone()
    if row:
        return row[0]
    cur = conn.execute(f"INSERT INTO teams ({name_col}) VALUES (?)", (team_name,))
    return cur.lastrowid

def resolve_team_id_for_target(conn, target_table: str, team_name: str) -> int | None:
    """
    If FK points to teams -> ensure_team.
    If FK points to countries -> ensure_country/lookup_country_id.
    Otherwise try teams then countries.
    """
    tgt = (target_table or "").lower()
    if tgt == "teams":
        return ensure_team(conn, team_name)
    if tgt == "countries":
        return ensure_country(conn, team_name)  # guarantees existence
    tid = ensure_team(conn, team_name)
    return tid if tid is not None else ensure_country(conn, team_name)

def value_for_team_column(conn, table: str, column: str, team_name: str) -> int | str | None:
    """
    Decide what to store in team-ish columns:
      - If the column has an FK -> store the referenced **ID** (ensuring the row exists).
      - Else if the column is TEXT -> store the **name**.
      - Else (numeric without FK) -> prefer teams.id, fallback to countries.id.
    """
    fks = fk_map_for_table(conn, table)
    if column in fks:
        return resolve_team_id_for_target(conn, fks[column], team_name)
    if is_text_column(conn, table, column):
        return team_name
    tid = ensure_team(conn, team_name)
    if tid is not None:
        return tid
    return lookup_country_id(conn, team_name)



def get_ball_col(conn) -> str:
    cols = table_columns(conn, "ball_events")
    if "ball_in_over" in cols: return "ball_in_over"
    if "balls_this_over" in cols: return "balls_this_over"
    raise RuntimeError("ball_events needs 'ball_in_over' or 'balls_this_over'.")

def extras_from_delivery(d):
    top = d.get("extras") or {}
    return {
        "wides": int(top.get("wides", 0)),
        "no_balls": int(top.get("noballs", top.get("no_balls", 0))),
        "byes": int(top.get("byes", 0)),
        "leg_byes": int(top.get("legbyes", top.get("leg_byes", 0))),
        "penalty_runs": int(top.get("penalty", 0)),
    }

def extras_json_dict(wides,no_balls,byes,leg_byes,penalty_runs):
    return {
        "wides": wides,
        "no_balls": no_balls,
        "byes": byes,
        "leg_byes": leg_byes,
        "penalty": 0,
        "penalty_runs": penalty_runs,
    }

# PHASES: PP 1–5, MO 6–15, DO 16–20
def phases_for_over(over_no:int, total_overs:int=20):
    if 0 <= over_no <= 5:   return 1,0,0
    if 6 <= over_no <= 13:  return 0,1,0
    return 0,0,1

def overs_from_legal_balls(legal_balls:int) -> str:
    return f"{legal_balls//6}.{legal_balls%6}"

# TEAM NORMALIZATION
def normalize_team_name(raw_name: str, info: dict) -> str:
    """
    Convert Cricsheet team name -> canonical DB name.

    - Brazil -> Brasil
    - For gendered teams:
         female -> "XYZ Women"
         male   -> "XYZ Men"
    """
    gender = (info.get("gender") or "").lower().strip()
    base_map = {
        "Brazil": "Brasil",
        "Brasil": "Brasil",  # safety
        "Canada": "Canada",
        "Jamaica": "Jamaica",
        # add any other spelling fixes here
    }

    base = base_map.get(raw_name.strip(), raw_name.strip())

    if gender == "female" and not base.endswith(" Women"):
        return f"{base} Women"
    if gender == "male" and not base.endswith(" Men"):
        return f"{base} Men"

    return base

def lookup_country_id(conn, country_like: str) -> int | None:
    """
    Resolve your countries table:
      - table: countries
      - id   : country_id
      - name : country_name
    Try exact match first (e.g., 'Brasil Women'), then fallbacks that
    add/remove ' Women' or map Brazil->Brasil, etc.
    """
    if not table_exists(conn, "countries"):
        return None

    raw = (country_like or "").strip()
    # Try exact first (your table already has 'Brasil Women')
    row = conn.execute(
        "SELECT country_id FROM countries WHERE lower(country_name)=lower(?)",
        (raw,)
    ).fetchone()
    if row:
        return row[0]

    # Common variants
    candidates = set()

    # If the string endswith Women, also try without it
    if raw.lower().endswith(" women"):
        candidates.add(raw[:-7].strip())
    else:
        # Also try adding ' Women'
        candidates.add(f"{raw} Women")

    # Brazil -> Brasil localization
    if "brazil" in raw.lower():
        candidates.add(raw.lower().replace("brazil", "brasil").title())
        candidates.add("Brasil Women")
    if "brasil" in raw.lower():
        candidates.add("Brasil Women")
        candidates.add("Brasil")

    for cand in candidates:
        row = conn.execute(
            "SELECT country_id FROM countries WHERE lower(country_name)=lower(?)",
            (cand,)
        ).fetchone()
        if row:
            return row[0]

    return None

def upsert_team(conn, team_name):
    # Prefer teams table; else fall back to country id or None
    if not team_name:
        return None
    if table_exists(conn, "teams"):
        cols = table_columns(conn, "teams")
        id_col = "team_id" if "team_id" in cols else ("id" if "id" in cols else None)
        name_col = "name" if "name" in cols else None
        if id_col and name_col:
            row = conn.execute(f"SELECT {id_col} FROM teams WHERE {name_col}=?", (team_name,)).fetchone()
            if row:
                return row[0]
            cur = conn.execute(f"INSERT INTO teams({name_col}) VALUES (?)", (team_name,))
            return cur.lastrowid
    # no teams table: try countries
    return lookup_country_id(conn, team_name)

def choose_team_value(conn, table: str, column: str, team_name: str, team_id: int | None):
    """
    Decide what to write into a team column:
      - if TEXT column: write name
      - else write id (from teams table or countries id)
    """
    if is_text_column(conn, table, column):
        return team_name
    return team_id

# NAME RESOLUTION
def resolve_player_id(conn, display_name, strict=STRICT_UNMAPPED_PLAYERS):
    if not display_name:
        return None
    nm = display_name.strip()
    if table_exists(conn, "player_alias"):
        row = conn.execute(
            "SELECT player_id FROM player_alias WHERE lower(alias)=lower(?)",
            (nm,)
        ).fetchone()
        if row: return row[0]
    row = conn.execute(
        "SELECT player_id FROM players WHERE lower(player_name)=lower(?)",
        (nm,)
    ).fetchone()
    if row: return row[0]
    if strict:
        raise ValueError(f"Unmapped player: '{display_name}'")
    cur = conn.execute("INSERT INTO players(player_name) VALUES (?)", (nm,))
    return cur.lastrowid

# MATCH / INNINGS INSERTS
def insert_match(conn, info):
    mcols = table_columns(conn, "matches")
    if not mcols: raise RuntimeError("matches table not found.")

    teams = info.get("teams", []) or ["",""]
    team_a_name_raw, team_b_name_raw = (teams[0] or ""), (teams[1] or "")
    team_a_name = normalize_team_name(team_a_name_raw, info)
    team_b_name = normalize_team_name(team_b_name_raw, info)

    date_val = info.get("dates") or []
    match_date = (date_val[0].get("date") if date_val and isinstance(date_val[0], dict)
                  else (str(date_val[0]) if date_val else ""))
    venue = info.get("venue") or ""
    overs = int(info.get("overs") or (20 if (info.get("match_type") or "").lower().startswith("t20") else 20))

    toss = info.get("toss", {}) or {}
    toss_winner_name = normalize_team_name(toss.get("winner",""), info) if toss.get("winner") else None
    toss_decision_raw = (toss.get("decision") or "").strip().lower()
    toss_decision = "Field" if toss_decision_raw == "field" else ("Bat" if toss_decision_raw == "bat" else None)

    outcome = info.get("outcome", {}) or {}
    by = outcome.get("by", {}) or {}
    winner_name = normalize_team_name(outcome.get("winner",""), info) if outcome.get("winner") else None
    margin_val = None
    if "runs" in by: margin_val = by.get("runs")
    elif "wickets" in by: margin_val = by.get("wickets")

    # IDs (teams/countries)
    team_a_id = upsert_team(conn, team_a_name)
    team_b_id = upsert_team(conn, team_b_name)
    toss_winner_id = upsert_team(conn, toss_winner_name) if toss_winner_name else None
    winner_id = upsert_team(conn, winner_name) if winner_name else None

    # Result text with winner name (if present)
    result_text = None
    if winner_name and margin_val is not None:
        if "runs" in by:
            result_text = f"{winner_name} won by {margin_val} runs"
        elif "wickets" in by:
            result_text = f"{winner_name} won by {margin_val} wickets"

    data = {}
    if "match_date" in mcols: data["match_date"] = match_date
    if "venue" in mcols: data["venue"] = venue
    if "total_overs" in mcols: data["total_overs"] = overs
    if "adjusted_overs" in mcols: data["adjusted_overs"] = overs

    # --- team fields with FK-aware storage (IDs if FK, otherwise names) ---
    if "team_a" in mcols: data["team_a"] = value_for_team_column(conn, "matches", "team_a", team_a_name)
    if "team_b" in mcols: data["team_b"] = value_for_team_column(conn, "matches", "team_b", team_b_name)
    if "toss_winner" in mcols and toss_winner_name is not None:
        # FORCE NAME
        data["toss_winner"] = toss_winner_name

    # winner_id also FK-aware (commonly to countries or teams)
    if "winner_id" in mcols and winner_name is not None:
        data["winner_id"] = value_for_team_column(conn, "matches", "winner_id", winner_name)

    if "toss_decision" in mcols and toss_decision is not None: data["toss_decision"] = toss_decision
    if "margin" in mcols and margin_val is not None: data["margin"] = margin_val
    if "result" in mcols and result_text is not None: data["result"] = result_text

    col_list = ", ".join(data.keys()); ph = ", ".join(["?"]*len(data))
    cur = conn.execute(f"INSERT INTO matches ({col_list}) VALUES ({ph})", tuple(data.values()))
    match_id = cur.lastrowid
    return match_id, team_a_name, team_b_name, overs, team_a_id, team_b_id

def insert_innings(conn, info, match_id, inns_idx, batting_team_raw, bowling_team_raw, max_overs):
    icols = table_columns(conn, "innings")
    if not icols: raise RuntimeError("innings table not found.")

    bat_name = normalize_team_name(batting_team_raw, info)
    bowl_name = normalize_team_name(bowling_team_raw, info)

    bat_id = upsert_team(conn, bat_name)
    bowl_id = upsert_team(conn, bowl_name)

    data = {}
    if "match_id" in icols: data["match_id"] = match_id
    if "innings" in icols: data["innings"] = inns_idx
    if "innings_number" in icols: data["innings_number"] = inns_idx
    if "max_overs" in icols: data["max_overs"] = max_overs


    # batting_team / bowling_team with FK-aware storage
    if "batting_team" in icols: data["batting_team"] = bat_name
    if "bowling_team" in icols: data["bowling_team"] = bowl_name


    col_list = ", ".join(data.keys()); ph = ", ".join(["?"]*len(data))
    cur = conn.execute(f"INSERT INTO innings ({col_list}) VALUES ({ph})", tuple(data.values()))
    innings_id = cur.lastrowid
    return innings_id, bat_id, bowl_id, bat_name, bowl_name

# MAIN IMPORT
def import_cricsheet_json(json_path, db_path):
    with open(json_path, "r", encoding="utf-8") as f:
        m = json.load(f)

    info = m.get("info", {}) or {}

    with fast_conn(db_path) as conn:
        match_id, team_a_name, team_b_name, max_overs, team_a_id, team_b_id = insert_match(conn, info)

        innings_list = m.get("innings", []) or []
        for inns_idx, inns in enumerate(innings_list, start=1):
            batting_team_raw = inns.get("team") or ""
            # deduce bowling team: the other one
            bowling_team_raw = team_b_name if normalize_team_name(batting_team_raw, info) == normalize_team_name(team_a_name, info) else team_a_name

            innings_id, bat_team_id, bowl_team_id, bat_team_name, bowl_team_name = insert_innings(conn, info, match_id, inns_idx, batting_team_raw, bowling_team_raw, max_overs)

            # tracking
            ball_col_name = get_ball_col(conn)
            legal_ball_seq = 0
            batting_order_seen, seen_set = [], set()

            # partnerships
            partnerships = []
            p_b1 = p_b2 = None
            p_runs = p_balls = p_dots = p_ones = p_twos = p_threes = p_fours = p_sixes = 0
            p_start_over = 0.0
            next_start_wicket = 1

            # remember last legal ball location for innings-end
            last_leg_over, last_leg_bio = 0, 0

            def over_ball_to_float(over_no_zero: int, legal_bio: int) -> float:
                """
                Return fractional progress through the innings:
                    over_no_zero + legal_ball_index/6
                e.g. for over_no_zero=19 (20th over):
                    ball 1 -> 19 + 1/6 ≈ 19.1667
                    ball 2 -> 19 + 2/6 ≈ 19.3333
                    ball 3 -> 19 + 3/6 = 19.5
                    ball 4 -> 19 + 4/6 ≈ 19.6667
                    ball 5 -> 19 + 5/6 ≈ 19.8333
                    ball 6 -> 20.0
                """
                lb = max(1, int(legal_bio))     # guard against 0
                return over_no_zero + lb / 6.0

            def maybe_start_partnership(b1, b2, over_no, bio, is_legal):
                nonlocal p_b1, p_b2, p_start_over
                if is_legal and p_b1 is None and p_b2 is None and b1 and b2:
                    p_b1, p_b2 = b1, b2
                    # first starts at 0.0; subsequent start at precise ball float
                    if legal_ball_seq > 0:
                        p_start_over = over_ball_to_float(over_no, bio)

            def flush_partnership(end_over_float):
                nonlocal partnerships, p_b1, p_b2, p_runs, p_balls, p_dots, p_ones, p_twos, p_threes, p_fours, p_sixes, p_start_over, next_start_wicket
                if p_b1 and p_b2:
                    partnerships.append({
                        "b1": p_b1, "b2": p_b2,
                        "runs": p_runs, "balls": p_balls,
                        "dots": p_dots, "ones": p_ones, "twos": p_twos, "threes": p_threes,
                        "fours": p_fours, "sixes": p_sixes,
                        "start_over": p_start_over, "end_over": end_over_float,
                        "start_wicket": next_start_wicket
                    })
                    next_start_wicket += 1
                # reset counters; next start when we see next legal ball with two batters
                p_b1 = p_b2 = None
                p_runs = p_balls = p_dots = p_ones = p_twos = p_threes = p_fours = p_sixes = 0

            overs_list = inns.get("overs") or []

            for over_block in overs_list:
                over_no = int(over_block.get("over", 0))
                pp, mo, do = phases_for_over(over_no + 1, max_overs)

                deliveries = over_block.get("deliveries", []) or []
                legal_in_over = 0
                for i, d in enumerate(deliveries):
                    batter = d.get("batter") or d.get("striker") or ""
                    non_striker = d.get("non_striker") or d.get("nonStriker") or ""
                    bowler = d.get("bowler") or ""

                    batter_id = resolve_player_id(conn, batter)
                    non_striker_id = resolve_player_id(conn, non_striker) if non_striker else None
                    bowler_id = resolve_player_id(conn, bowler)

                    for pid in (batter_id, non_striker_id):
                        if pid and pid not in seen_set:
                            seen_set.add(pid)
                            batting_order_seen.append(pid)

                    r = d.get("runs") or {}
                    runs_bat = int(r.get("batter", r.get("batsman", 0)))
                    ex = extras_from_delivery(d)
                    is_legal = (ex["wides"] == 0 and ex["no_balls"] == 0)

                    # advance legal-in-over only when delivery is legal
                    if is_legal:
                        legal_in_over += 1

                    # this is what we will STORE in balls_this_over: the legal index (repeats on illegal)
                    balls_this_over_val = legal_in_over if legal_in_over > 0 else 0

                    # partnership starter now uses zero-based over + legal ball index
                    maybe_start_partnership(batter_id, non_striker_id, over_no, balls_this_over_val, is_legal)

                    # Wicket details
                    dismissal = None; dismissed_id = None; fielder_id = None
                    wickets = d.get("wickets") or []
                    if wickets:
                        wk = wickets[0]
                        kind_raw = (wk.get("kind") or "").strip().lower()
                        if kind_raw:
                            kind = DISMISSAL_MAP.get(kind_raw, kind_raw)
                            dismissal = kind
                            dismissed_name = wk.get("player_out") or wk.get("player") or wk.get("batter_out")
                            dismissed_id = resolve_player_id(conn, dismissed_name) if dismissed_name else None
                            fielders = wk.get("fielders") or wk.get("fielder")
                            if kind_raw == "caught and bowled":
                                fielder_id = bowler_id
                            else:
                                f_name = None
                                if isinstance(fielders, list) and fielders:
                                    f = fielders[0]
                                    f_name = f.get("name") if isinstance(f, dict) else str(f)
                                elif isinstance(fielders, dict):
                                    f_name = fielders.get("name")
                                elif isinstance(fielders, str):
                                    f_name = fielders
                                if f_name:
                                    fielder_id = resolve_player_id(conn, f_name)

                    is_dot = int(
                        runs_bat == 0 and
                        ex["wides"] == 0 and ex["no_balls"] == 0 and
                        ex["byes"] == 0 and ex["leg_byes"] == 0 and ex["penalty_runs"] == 0
                    )

                    ball_number_val = None
                    if is_legal:
                        legal_ball_seq += 1               # global legal-only counter
                        ball_number_val = legal_ball_seq
                        last_leg_over, last_leg_bio = over_no, balls_this_over_val
                        # partnership counters
                        if p_b1 and p_b2:
                            if runs_bat == 0 and ex["byes"] == 0 and ex["leg_byes"] == 0 and ex["penalty_runs"] == 0:
                                p_dots += 1
                            if runs_bat == 1: p_ones += 1
                            elif runs_bat == 2: p_twos += 1
                            elif runs_bat == 3: p_threes += 1
                            elif runs_bat == 4: p_fours += 1
                            elif runs_bat == 6: p_sixes += 1
                            p_runs += runs_bat + ex["byes"] + ex["leg_byes"]
                            p_balls += 1

                    extras_str = json.dumps(extras_json_dict(
                        ex["wides"], ex["no_balls"], ex["byes"], ex["leg_byes"], ex["penalty_runs"]
                    ))

                    # Insert ball (schema-aware)
                    bcols = table_columns(conn, "ball_events")
                    ball_col_name = get_ball_col(conn)  # 'ball_in_over' or 'balls_this_over'

                    insert_cols = ["innings_id", "over_number", ball_col_name,
                                "batter_id", "non_striker_id", "bowler_id",
                                "runs", "wides", "no_balls", "byes", "leg_byes", "penalty_runs",
                                "dot_balls", "dismissal_type", "dismissed_player_id"]
                    vals = [innings_id, over_no, balls_this_over_val,
                            batter_id, non_striker_id, bowler_id,
                            runs_bat, ex["wides"], ex["no_balls"], ex["byes"], ex["leg_byes"], ex["penalty_runs"],
                            is_dot, dismissal, dismissed_id]

                    # ensure lowercase 'innings' too
                    if "innings" in bcols: insert_cols.append("innings"); vals.append(inns_idx)
                    if "Innings" in bcols: insert_cols.append("Innings"); vals.append(inns_idx)
                    if "ball_number" in bcols: insert_cols.append("ball_number"); vals.append(ball_number_val or 0)
                    if "fielder_id" in bcols: insert_cols.append("fielder_id"); vals.append(fielder_id)
                    if "extras" in bcols: insert_cols.append("extras"); vals.append(extras_str)
                    if "aerial" in bcols: insert_cols.append("aerial"); vals.append(0)
                    pp, mo, do = phases_for_over(over_no, max_overs)
                    if "is_powerplay" in bcols: insert_cols.append("is_powerplay"); vals.append(pp)
                    if "is_middle_overs" in bcols: insert_cols.append("is_middle_overs"); vals.append(mo)
                    if "is_death_overs" in bcols: insert_cols.append("is_death_overs"); vals.append(do)

                    cur = conn.execute(
                        f"INSERT OR IGNORE INTO ball_events ({', '.join(insert_cols)}) VALUES ({', '.join(['?']*len(vals))})",
                        tuple(vals)
                    )
                    ball_id = cur.lastrowid

                    if dismissal in FIELDING_EVENT_ID and fielder_id:
                        ev_id = FIELDING_EVENT_ID[dismissal]
                        if table_exists(conn, "ball_fielding_events"):
                            conn.execute("INSERT OR IGNORE INTO ball_fielding_events (ball_id, event_id) VALUES (?, ?)",
                                         (ball_id, ev_id))
                        if table_exists(conn, "fielding_contributions"):
                            conn.execute("""
                                INSERT OR IGNORE INTO fielding_contributions (ball_id, fielder_id, boundary_saved)
                                VALUES (?, ?, 0)
                            """, (ball_id, fielder_id))

                    # On wicket during a legal ball, close current partnership at precise ball
                    if dismissal and is_legal and (p_b1 and p_b2):
                        flush_partnership(end_over_float=over_ball_to_float(over_no, balls_this_over_val))

            # If an active partnership remains (innings ended without wicket), close it at last legal ball
            if p_b1 and p_b2:
                flush_partnership(end_over_float=over_ball_to_float(last_leg_over, last_leg_bio))

            # totals for innings
            totals = conn.execute(f"""
                SELECT
                  COALESCE(SUM(runs + wides + no_balls + byes + leg_byes + penalty_runs),0),
                  COALESCE(SUM(CASE WHEN dismissal_type IS NOT NULL THEN 1 ELSE 0 END),0),
                  COALESCE(SUM(CASE WHEN (wides=0 AND no_balls=0) THEN 1 ELSE 0 END),0),
                  COALESCE(SUM(wides),0), COALESCE(SUM(no_balls),0), COALESCE(SUM(byes),0),
                  COALESCE(SUM(leg_byes),0), COALESCE(SUM(penalty_runs),0)
                FROM ball_events
                WHERE innings_id=?
            """, (innings_id,)).fetchone()

            total_runs, wickets, legal_balls, s_wides, s_nb, s_byes, s_lb, s_pen = totals
            overs_bowled = overs_from_legal_balls(legal_balls)
            extras_total = (s_wides + s_nb + s_byes + s_lb + s_pen)

            icols = table_columns(conn, "innings")
            update_sets = []; args = []
            if "total_runs" in icols: update_sets += ["total_runs=?"]; args += [total_runs]
            if "wickets" in icols: update_sets += ["wickets=?"]; args += [wickets]
            if "overs_bowled" in icols: update_sets += ["overs_bowled=?"]; args += [overs_bowled]
            if "extras" in icols: update_sets += ["extras=?"]; args += [extras_total]
            if "completed" in icols: update_sets += ["completed=?"]; args += [1]
            if update_sets:
                args += [innings_id]
                conn.execute(f"UPDATE innings SET {', '.join(update_sets)} WHERE innings_id=?", args)

            # adjusted_target after inns#1
            mcols = table_columns(conn, "matches")
            if inns_idx == 1 and "adjusted_target" in mcols:
                conn.execute("UPDATE matches SET adjusted_target=? WHERE match_id=?", (total_runs+1, match_id))

            # insert partnerships
            if table_exists(conn, "partnerships") and partnerships:
                pcols = table_columns(conn, "partnerships")

                # --- FORCE NAME for opponent_team ---
                if "opponent_team" in pcols:
                    opp_val = bowl_team_name
                for p in partnerships:
                    cols = []; vals = []
                    if "innings_id" in pcols: cols.append("innings_id"); vals.append(innings_id)
                    if "start_wicket" in pcols: cols.append("start_wicket"); vals.append(p["start_wicket"])
                    if "batter1_id" in pcols: cols.append("batter1_id"); vals.append(p["b1"])
                    if "batter2_id" in pcols: cols.append("batter2_id"); vals.append(p["b2"])
                    if "runs" in pcols: cols.append("runs"); vals.append(p["runs"])
                    if "balls" in pcols: cols.append("balls"); vals.append(p["balls"])
                    if "dots" in pcols: cols.append("dots"); vals.append(p["dots"])
                    if "ones" in pcols: cols.append("ones"); vals.append(p["ones"])
                    if "twos" in pcols: cols.append("twos"); vals.append(p["twos"])
                    if "threes" in pcols: cols.append("threes"); vals.append(p["threes"])
                    if "fours" in pcols: cols.append("fours"); vals.append(p["fours"])
                    if "sixes" in pcols: cols.append("sixes"); vals.append(p["sixes"])
                    if "start_over" in pcols: cols.append("start_over"); vals.append(p["start_over"])
                    if "end_over" in pcols: cols.append("end_over"); vals.append(p["end_over"])
                    if "opponent_team" in pcols: cols.append("opponent_team"); vals.append(opp_val)
                    if "unbeaten" in pcols:
                        unbeaten_val = 1 if (p is partnerships[-1] and wickets < 10) else 0
                        cols.append("unbeaten"); vals.append(unbeaten_val)
                    conn.execute(
                        f"INSERT INTO partnerships ({', '.join(cols)}) VALUES ({', '.join(['?']*len(vals))})",
                        tuple(vals)
                    )
            # --- Player match roles: batting order for this innings ---
            if table_exists(conn, "player_match_roles") and batting_order_seen:
                pr_cols = table_columns(conn, "player_match_roles")
                for pos, pid in enumerate(batting_order_seen, start=1):
                    cols = []; vals = []
                    if "match_id" in pr_cols: cols.append("match_id"); vals.append(match_id)
                    if "team_id" in pr_cols: cols.append("team_id"); vals.append(bat_team_id)
                    if "player_id" in pr_cols: cols.append("player_id"); vals.append(pid)
                    if "batting_position" in pr_cols: cols.append("batting_position"); vals.append(pos)
                    if "role" in pr_cols: cols.append("role"); vals.append("batter")
                    if "is_captain" in pr_cols: cols.append("is_captain"); vals.append(0)
                    if "is_keeper" in pr_cols:
                        row = conn.execute(
                            "SELECT COALESCE(is_wicketkeeper,0) FROM players WHERE player_id=?",
                            (pid,)
                        ).fetchone()
                        is_k = int(row[0] or 0) if row else 0
                        cols.append("is_keeper"); vals.append(is_k)
                    conn.execute(
                        f"INSERT OR IGNORE INTO player_match_roles ({', '.join(cols)}) VALUES ({', '.join(['?']*len(vals))})",
                        tuple(vals)
                    )

        # Also back-fill matches.team_a/team_b/toss_winner/winner_id if they were NULL but columns exist:
        # (no-op if we already set them)
        # Not strictly necessary; left out to keep it simple.

def main():
    if len(sys.argv) < 2:
        print("Usage: python import_cricsheet_json.py <match.json> [db_path]")
        sys.exit(1)
    json_path = sys.argv[1]
    db_path = sys.argv[2] if len(sys.argv) >= 3 else os.environ.get("CRICKET_DB", DB_PATH_DEFAULT)
    print(f"[import] Using DB: {os.path.abspath(db_path)}")

    # >>> PRE-FLIGHT PLAYER CHECK <<<
    if not preflight_player_report(json_path, db_path):
        sys.exit(2)  # stop so you can add players/aliases

    import_cricsheet_json(json_path, db_path)
    print("Import complete.")

if __name__ == "__main__":
    main()
