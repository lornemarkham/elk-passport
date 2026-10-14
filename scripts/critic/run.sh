#!/usr/bin/env bash
# GO HAVE A DAY critic — one unattended run.
#
#   scripts/critic/run.sh                  # best evidence available, no browser
#   CRITIC_SCREENS=1 scripts/critic/run.sh # also screenshots and PDFs
#
# Evidence, best first. The run's report says which one it got, on line one:
#   1. live Atlas      CRITIC_LIVE=1 with ATLAS_API_URL (+ ATLAS_SERVICE_TOKEN).
#                      One read-only GET /discovery/candidates?on=TODAY&childAge=5.
#                      Opt-in, because ATLAS_API_URL's default (localhost:3000) is
#                      not Atlas on every machine.
#   2. Atlas snapshot  CRITIC_CORPUS=<saved body.json[.gz]>
#   3. fixture         the committed 2026-10-11 snapshot. Labelled FIXTURE ONLY:
#                      it detects code changes against fixed data, nothing else.
#
# Writes $CRITIC_HOME/runs/<id>/{run.json,report.md,delta.json,pages.json,
# screens/} and appends one line to $CRITIC_HOME/history.jsonl. Compares with
# the latest earlier run on the same kind of evidence (or CRITIC_PREVIOUS).
#
# Exit: 0 ran · 2 the critic itself failed · 3 regressed (only with
# CRITIC_FAIL_ON_REGRESSION=1) · 4 screenshots disagreed with the run.
# Never writes to Atlas, never deploys, never touches .env.local.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
CRITIC_HOME="${CRITIC_HOME:-${XDG_STATE_HOME:-$HOME/.local/state}/ghad-critic}"
RUN_ID="${CRITIC_RUN_ID:-$(date -u +%Y%m%dT%H%M%SZ)}"
RUN_DIR="$CRITIC_HOME/runs/$RUN_ID"
TODAY="${CRITIC_TODAY:-$(TZ=America/Vancouver date +%F)}"
FIXTURE="$ROOT/docs/product/critic/evidence/atlas-candidates-2026-10-11.json.gz"
mkdir -p "$RUN_DIR"
log() { echo "[critic $RUN_ID] $*" | tee -a "$RUN_DIR/run.log"; }

# ── Evidence ───────────────────────────────────────────────────────────────
KIND="" WHERE="" CORPUS="" FETCHED=""
if [[ "${CRITIC_LIVE:-0}" == "1" && -n "${ATLAS_API_URL:-}" ]]; then
  url="${ATLAS_API_URL%/}/discovery/candidates?on=$TODAY&childAge=5"
  auth=()
  [[ -n "${ATLAS_SERVICE_TOKEN:-}" ]] && auth=(-H "Authorization: Bearer $ATLAS_SERVICE_TOKEN")
  log "asking live Atlas: ${ATLAS_API_URL%/}/discovery/candidates (on=$TODAY, childAge=5)"
  if curl -sSf --max-time 180 "${auth[@]}" "$url" -o "$RUN_DIR/corpus.json" 2>>"$RUN_DIR/run.log" &&
    node -e 'const b=require(process.argv[1]);if(!Array.isArray(b.candidates)||!b.candidates.length)process.exit(1)' "$RUN_DIR/corpus.json"; then
    KIND=live-atlas WHERE="${ATLAS_API_URL%/}" CORPUS="$RUN_DIR/corpus.json"
    FETCHED="$(date -u +%FT%TZ)"
  else
    log "live Atlas did not answer with candidates; falling back (see run.log)"
    rm -f "$RUN_DIR/corpus.json"
  fi
fi
if [[ -z "$KIND" && -n "${CRITIC_CORPUS:-}" ]]; then
  [[ -f "$CRITIC_CORPUS" ]] || { log "CRITIC_CORPUS=$CRITIC_CORPUS does not exist"; exit 2; }
  KIND="${CRITIC_SOURCE_KIND:-atlas-snapshot}" WHERE="$CRITIC_CORPUS" CORPUS="$CRITIC_CORPUS"
  FETCHED="$(date -u -r "$CRITIC_CORPUS" +%FT%TZ)"
fi
if [[ -z "$KIND" ]]; then
  KIND=fixture WHERE="${FIXTURE#"$ROOT"/}" CORPUS="$FIXTURE"
fi
log "evidence: $KIND ($WHERE)"

# ── Compare with ───────────────────────────────────────────────────────────
PREVIOUS="${CRITIC_PREVIOUS:-}"
if [[ -z "$PREVIOUS" && -d "$CRITIC_HOME/runs" ]]; then
  PREVIOUS="$(node -e '
    const fs=require("fs"),p=require("path");const [home,kind,self]=process.argv.slice(1);
    const runs=fs.readdirSync(p.join(home,"runs")).filter(d=>d!==self).sort().reverse();
    for(const d of runs){const f=p.join(home,"runs",d,"run.json");
      try{if(JSON.parse(fs.readFileSync(f,"utf8")).source.kind===kind){console.log(f);break}}catch{}}
  ' "$CRITIC_HOME" "$KIND" "$RUN_ID")"
fi
[[ -n "$PREVIOUS" ]] && log "comparing with $PREVIOUS"

# ── The run ────────────────────────────────────────────────────────────────
if ! CRITIC_CORPUS="$CORPUS" CRITIC_SOURCE_KIND="$KIND" CRITIC_SOURCE_WHERE="$WHERE" \
  CRITIC_FETCHED_AT="$FETCHED" CRITIC_TODAY="$TODAY" CRITIC_RUN_ID="$RUN_ID" \
  CRITIC_RUN_DIR="$RUN_DIR" CRITIC_PREVIOUS="$PREVIOUS" \
  npx vitest run -c scripts/critic/vitest.critic.config.ts >>"$RUN_DIR/run.log" 2>&1; then
  log "the critic failed — see $RUN_DIR/run.log"
  exit 2
fi
[[ -f "$RUN_DIR/run.json" ]] || { log "no run.json written"; exit 2; }

# ── Screenshots (optional: needs a free port and a few minutes) ────────────
STATUS=0
if [[ "${CRITIC_SCREENS:-0}" == "1" ]]; then
  APP_PORT="${CRITIC_APP_PORT:-3121}" MOCK_PORT="${CRITIC_MOCK_PORT:-3122}"
  for port in "$APP_PORT" "$MOCK_PORT"; do
    if ss -ltn "sport = :$port" | grep -q LISTEN; then
      log "port $port is busy; refusing to screenshot whatever is on it"; exit 2
    fi
  done
  node scripts/critic/atlas-mock.mjs "$CORPUS" "$MOCK_PORT" >>"$RUN_DIR/run.log" 2>&1 &
  MOCK_PID=$!
  # Placeholders, not credentials: middleware needs *a* Supabase URL, and a
  # closed port makes every page render signed out.
  ATLAS_API_URL="http://127.0.0.1:$MOCK_PORT" ATLAS_SERVICE_TOKEN="" \
    NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:9" NEXT_PUBLIC_SUPABASE_ANON_KEY="placeholder" \
    OPENAI_API_KEY="" setsid npx next dev -p "$APP_PORT" >>"$RUN_DIR/next.log" 2>&1 &
  APP_PID=$!
  # Its own process group: `npx` exits and leaves next-server behind otherwise.
  cleanup() {
    kill -- "-$APP_PID" 2>/dev/null || true
    kill "$MOCK_PID" 2>/dev/null || true
    wait 2>/dev/null || true
  }
  trap cleanup EXIT
  for _ in $(seq 1 120); do
    curl -sf -o /dev/null "http://127.0.0.1:$APP_PORT/go" && break
    sleep 2
  done
  # Belt and braces: the app must be the one we started, not a stale server.
  owner="$(ss -ltnpH "sport = :$APP_PORT" | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)"
  log "screenshots from next dev pid ${owner:-?} (started $APP_PID) on $APP_PORT"
  node scripts/critic/screens.mjs "$RUN_DIR" "http://127.0.0.1:$APP_PORT" >>"$RUN_DIR/run.log" 2>&1 || STATUS=$?
  [[ "$STATUS" == "4" ]] && log "screenshots disagree with the run — see screens.json"
  [[ "$STATUS" != "0" && "$STATUS" != "4" ]] && log "screenshots failed ($STATUS) — see run.log"
  cleanup
  trap - EXIT
fi

# ── History ────────────────────────────────────────────────────────────────
node -e '
  const fs=require("fs");const [dir,home]=process.argv.slice(1);
  const r=JSON.parse(fs.readFileSync(dir+"/run.json","utf8"));
  let d;try{d=JSON.parse(fs.readFileSync(dir+"/delta.json","utf8"))}catch{}
  const line={runId:r.runId,source:r.source.kind,sha:r.source.sha256.slice(0,12),commit:r.code.commit,
    branch:r.code.branch,code:r.code.fingerprint,totals:r.totals,regressed:d?d.regressed:null,
    against:d?d.against:null,causes:d?d.causes:null};
  fs.appendFileSync(home+"/history.jsonl",JSON.stringify(line)+"\n");
  console.log(`overall ${r.totals.overall} · ${r.totals.objectiveFindings} objective findings`+
    (d?` · vs ${d.against}: ${d.totals.overall>=0?"+":""}${d.totals.overall} (${d.causes.join(", ")||"no change"})${d.regressed?" REGRESSED":""}`:""));
' "$RUN_DIR" "$CRITIC_HOME" | while read -r line; do log "$line"; done
ln -sfn "$RUN_DIR" "$CRITIC_HOME/latest"
log "report: $RUN_DIR/report.md"

if [[ "${CRITIC_FAIL_ON_REGRESSION:-0}" == "1" && -f "$RUN_DIR/delta.json" ]] &&
  node -e 'process.exit(require(process.argv[1]).regressed?0:1)' "$RUN_DIR/delta.json"; then
  exit 3
fi
exit "$STATUS"
