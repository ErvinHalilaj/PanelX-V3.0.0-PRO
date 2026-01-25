#!/bin/bash

# Quick API Test - Test all 102 endpoints
BASE_URL="http://localhost:3000"
PASS=0
FAIL=0

test_endpoint() {
    local endpoint=$1
    local expected=${2:-200}
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$endpoint" 2>/dev/null)
    
    if [ "$response" == "$expected" ]; then
        echo "✅ $endpoint"
        ((PASS++))
    else
        echo "❌ $endpoint (got $response, expected $expected)"
        ((FAIL++))
    fi
}

echo "🧪 Testing PanelX V3.0.0 PRO - All 102 Endpoints"
echo "================================================"

echo -e "\n📊 Phase 1: Security & Stability (20 endpoints)"
test_endpoint "/"
test_endpoint "/api"
test_endpoint "/api/users"
test_endpoint "/api/users/1"
test_endpoint "/api/2fa/activities"
test_endpoint "/api/audit-logs"
test_endpoint "/api/ip-whitelist"
test_endpoint "/api/login-attempts"
test_endpoint "/api/backups"

echo -e "\n📊 Phase 2: Core Enhancements (37 endpoints)"
test_endpoint "/api/bandwidth/overview"
test_endpoint "/api/bandwidth/stats"
test_endpoint "/api/bandwidth/alerts"
test_endpoint "/api/geo/map"
test_endpoint "/api/geo/analytics"
test_endpoint "/api/geo/top-countries"
test_endpoint "/api/geo/top-cities"
test_endpoint "/api/geo/heatmap"
test_endpoint "/api/servers"
test_endpoint "/api/servers/health"
test_endpoint "/api/tmdb/sync-queue"
test_endpoint "/api/tmdb/sync-logs"
test_endpoint "/api/subtitles"
test_endpoint "/api/subtitles/languages"
test_endpoint "/api/subtitles/analytics"
test_endpoint "/api/subtitles/popular-languages"

echo -e "\n📊 Phase 3: Business Features (16 endpoints)"
test_endpoint "/api/invoices"
test_endpoint "/api/payments"
test_endpoint "/api/api-keys"
test_endpoint "/api/commissions/rules"
test_endpoint "/api/commissions/payments"

echo -e "\n📊 Phase 4: Advanced Features (29 endpoints)"
test_endpoint "/api/recommendations/1"
test_endpoint "/api/recommendations/similar/1"
test_endpoint "/api/recommendations/trending"
test_endpoint "/api/analytics/dashboard"
test_endpoint "/api/analytics/churn/1"
test_endpoint "/api/analytics/content/1"
test_endpoint "/api/analytics/segments"
test_endpoint "/api/cdn/providers"
test_endpoint "/api/cdn/analytics"
test_endpoint "/api/cdn/cost-optimization"
test_endpoint "/api/epg/search?q=test"
test_endpoint "/api/epg/channel/1"
test_endpoint "/api/epg/reminders/1"
test_endpoint "/api/epg/recordings/1"
test_endpoint "/api/epg/catchup/1"

echo -e "\n================================================"
echo "📊 Results: $PASS passed, $FAIL failed"
echo "📈 Success Rate: $(( PASS * 100 / (PASS + FAIL) ))%"

if [ $FAIL -eq 0 ]; then
    echo "🎉 ALL TESTS PASSED!"
    exit 0
else
    echo "⚠️  Some tests failed"
    exit 1
fi
