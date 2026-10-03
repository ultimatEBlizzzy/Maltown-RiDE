#!/usr/bin/env bash
# MALTown RiDE — end-to-end acceptance flow (spec §30).
# Runs against a live server. Usage: BASE=http://localhost:3000 bash scripts/e2e-acceptance.sh
set -u
B="${BASE:-http://localhost:3000}"
PASS=0; FAIL=0

jsonget() {
  node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const o=JSON.parse(d);const ks=process.argv[1].split(".");let v=o;for(const k of ks){v=v==null?null:v[k];}console.log(v==null?"":(typeof v==="object"?JSON.stringify(v):String(v)));}catch(e){process.exit(0);}})' "$1"
}

check() { # check <description> <actual> <expected>
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "  ✅ $1"; else FAIL=$((FAIL+1)); echo "  ❌ $1 — got '$2', expected '$3'"; fi
}

echo "== MALTown RiDE E2E acceptance =="
echo "-- health"
OK=$(curl -sf "$B/api/health" | jsonget ok)
check "health endpoint" "$OK" "true"

echo "-- 1/2. login rider + driver"
RT=$(curl -sf -X POST "$B/api/auth/login" -H 'Content-Type: application/json' -d '{"email":"rider@maltown.dev","password":"Rider123!"}' | jsonget token)
DT=$(curl -sf -X POST "$B/api/auth/login" -H 'Content-Type: application/json' -d '{"email":"driver1@maltown.dev","password":"Driver123!"}' | jsonget token)
AT=$(curl -sf -X POST "$B/api/auth/login" -H 'Content-Type: application/json' -d '{"email":"admin@maltown.dev","password":"Admin123!"}' | jsonget token)
[ -n "$RT" ] && [ -n "$DT" ] && [ -n "$AT" ] && check "auth tokens issued" "yes" "yes" || check "auth tokens issued" "no" "yes"

echo "-- 3/4. driver online + location recorded"
curl -sf -X POST "$B/api/drivers/online" -H "Authorization: Bearer $DT" -H 'Content-Type: application/json' -d '{"lat":-23.0010,"lng":30.6960}' > /dev/null
NEARC=$(curl -sf "$B/api/drivers/nearby?lat=-23.002718&lng=30.6946597" -H "Authorization: Bearer $RT" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).drivers.length))')
check "nearby drivers discovered" "$([ "$NEARC" -ge 1 ] && echo ok)" "ok"

echo "-- 7/8. route + fare estimate (backend authoritative)"
EST=$(curl -sf -X POST "$B/api/rides/estimate" -H "Authorization: Bearer $RT" -H 'Content-Type: application/json' -d '{"pickup":{"lat":-23.002718,"lng":30.6946597},"destination":{"lat":-22.9369282,"lng":30.7204003}}')
check "estimate returns distance" "$(echo "$EST" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).distanceKm>0))')" "true"

echo "-- 9. ride requested → SEARCHING"
RIDE=$(curl -sf -X POST "$B/api/rides" -H "Authorization: Bearer $RT" -H 'Content-Type: application/json' -d '{"pickup":{"lat":-23.002718,"lng":30.6946597,"address":"Malamulele town centre"},"destination":{"lat":-22.9369282,"lng":30.7204003,"address":"Xigalo Village"},"vehiclePref":"STANDARD"}')
RID=$(echo "$RIDE" | jsonget ride.id)
check "ride status SEARCHING" "$(echo "$RIDE" | jsonget ride.status)" "SEARCHING"
check "est fare computed" "$(echo "$RIDE" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).ride.estFare>0))')" "true"

echo "-- 11. driver receives the request"
REQID=$(curl -sf "$B/api/drivers/requests" -H "Authorization: Bearer $DT" | jsonget requests.0.rideId)
check "request delivered to driver" "$REQID" "$RID"

echo "-- 12. driver accepts (atomic lock) + duplicate acceptance prevented"
ACCSTATUS=$(echo "$RID" | xargs -I{} curl -s -o /dev/null -w '%{http_code}' -X POST "$B/api/rides/{}/accept" -H "Authorization: Bearer $DT")
check "first accept succeeds" "$ACCSTATUS" "200"
DT2=$(curl -sf -X POST "$B/api/auth/login" -H 'Content-Type: application/json' -d '{"email":"driver2@maltown.dev","password":"Driver123!"}' | jsonget token)
DUPCODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$B/api/rides/$RID/accept" -H "Authorization: Bearer $DT2")
check "second driver rejected after lock" "$DUPCODE" "409"

echo "-- 13. rider sees driver + DRIVER_ARRIVING"
RD=$(curl -sf "$B/api/rides/$RID" -H "Authorization: Bearer $RT")
check "rider sees status" "$(echo "$RD" | jsonget ride.status)" "DRIVER_ARRIVING"
check "rider sees driver name" "$(echo "$RD" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(Boolean(JSON.parse(d).ride.driver.name)))')" "true"

echo "-- 14/15/16. driver arrives"
curl -sf -X POST "$B/api/rides/$RID/arrive" -H "Authorization: Bearer $DT" > /dev/null
check "DRIVER_ARRIVED" "$(curl -sf "$B/api/rides/$RID" -H "Authorization: Bearer $RT" | jsonget ride.status)" "DRIVER_ARRIVED"

echo "-- 17/18. trip starts → IN_PROGRESS"
curl -sf -X POST "$B/api/rides/$RID/start" -H "Authorization: Bearer $DT" > /dev/null
check "IN_PROGRESS" "$(curl -sf "$B/api/rides/$RID" -H "Authorization: Bearer $RT" | jsonget ride.status)" "IN_PROGRESS"

echo "-- invalid transition rejected (IN_PROGRESS -> CANCELLED)"
BADC=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$B/api/rides/$RID/cancel" -H "Authorization: Bearer $RT" -H 'Content-Type: application/json' -d '{}')
check "in-trip cancel blocked" "$BADC" "409"

echo "-- 19. live driver location update"
curl -sf -X POST "$B/api/drivers/location" -H "Authorization: Bearer $DT" -H 'Content-Type: application/json' -d '{"lat":-23.0040,"lng":30.6920,"heading":270}' > /dev/null
check "rider sees driver location" "$(curl -sf "$B/api/rides/$RID" -H "Authorization: Bearer $RT" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(Boolean(JSON.parse(d).ride.driverLocation)))')" "true"

echo "-- 21-24. complete trip, final fare + payment"
DONE=$(curl -sf -X POST "$B/api/rides/$RID/complete" -H "Authorization: Bearer $DT")
check "ride COMPLETED" "$(echo "$DONE" | jsonget ride.status)" "COMPLETED"
check "final fare recorded" "$(echo "$DONE" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).ride.finalFare>0))')" "true"
check "payment SUCCESS" "$(echo "$DONE" | jsonget ride.payment.status)" "SUCCESS"

echo "-- 25. rider history shows the trip"
HIST=$(curl -sf "$B/api/rides?scope=history" -H "Authorization: Bearer $RT")
HIT=$(echo "$HIST" | RID="$RID" node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).rides.some(r=>r.id===process.env.RID)))')
check "history contains ride" "$HIT" "true"

echo "-- 26. driver earnings updated"
EARN=$(curl -sf "$B/api/drivers/me/earnings" -H "Authorization: Bearer $DT")
check "today earnings > 0" "$(echo "$EARN" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).today>0))')" "true"

echo "-- rating recorded"
curl -sf -X POST "$B/api/rides/$RID/rate" -H "Authorization: Bearer $RT" -H 'Content-Type: application/json' -d '{"score":5,"comment":"Great ride!"}' > /dev/null
check "rating saved" "$(curl -sf "$B/api/rides/$RID" -H "Authorization: Bearer $RT" | jsonget ride.rating.score)" "5"

echo "-- 27. admin dashboard reflects the ride"
DASH=$(curl -sf "$B/api/admin/dashboard" -H "Authorization: Bearer $AT")
check "admin sees revenue" "$(echo "$DASH" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).totals.revenueTotal>0))')" "true"
check "admin sees completed rides" "$(echo "$DASH" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).totals.completedTotal>0))')" "true"

echo "-- authorization: rider cannot use driver/admin endpoints"
FORB=$(curl -s -o /dev/null -w '%{http_code}' "$B/api/admin/dashboard" -H "Authorization: Bearer $RT")
check "rider blocked from admin" "$FORB" "403"
UNAUTH=$(curl -s -o /dev/null -w '%{http_code}' "$B/api/rides")
check "unauthenticated blocked" "$UNAUTH" "401"
OTHER=$(curl -s -o /dev/null -w '%{http_code}' "$B/api/rides/$RID" -H "Authorization: Bearer $DT2")
check "other driver blocked from ride" "$OTHER" "403"

echo ""
echo "== RESULT: $PASS passed, $FAIL failed =="
[ "$FAIL" = "0" ]
