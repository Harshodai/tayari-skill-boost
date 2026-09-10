check_service_health() {
    local svc="$1"
    echo "Checking health for $svc..."
    if [[ "$svc" == "python-ai" ]]; then
        curl --fail --silent --max-time 5 "http://localhost:8000/health" >/dev/null
    elif [[ "$svc" == "go-backend" ]]; then
        curl --fail --silent --max-time 5 "http://localhost:8080/healthz" >/dev/null
    else
        local cid
        cid=$("${compose[@]}" ps -q "$svc" 2>/dev/null)
        if [[ -n "$cid" ]]; then
            local status
            status=$(docker inspect --format='{{.State.Status}}' "$cid")
            [[ "$status" == "running" ]]
        else
            return 1
        fi
    fi
}
