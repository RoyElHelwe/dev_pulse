#!/bin/bash

# Test script for Office API endpoints
# Usage: ./test-office-api.sh

API_BASE="http://localhost:4000"
WORKSPACE_ID="test-workspace-123"

echo "🧪 Testing Office API Endpoints"
echo "================================"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test 1: Get Templates
echo -e "${BLUE}1. GET Templates${NC}"
echo "curl -X GET $API_BASE/workspaces/$WORKSPACE_ID/office/templates"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE/workspaces/$WORKSPACE_ID/office/templates" 2>/dev/null)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✓ Status: $HTTP_CODE${NC}"
    echo "Response: $BODY" | head -c 200
else
    echo -e "${RED}✗ Status: $HTTP_CODE${NC}"
    echo "Response: $BODY"
fi
echo ""
echo ""

# Test 2: Create Layout
echo -e "${BLUE}2. POST Create Layout${NC}"
LAYOUT_DATA='{
  "name": "Test Office Layout",
  "generationMode": "TEMPLATE",
  "templateId": "tech-startup",
  "layoutData": {
    "width": 1600,
    "height": 1200,
    "zones": [],
    "desks": [
      {
        "id": "desk-1",
        "x": 100,
        "y": 100,
        "type": "standard"
      }
    ],
    "rooms": [],
    "decorations": [],
    "spawnPoint": {
      "x": 800,
      "y": 600
    },
    "metrics": {
      "totalDesks": 1,
      "totalRooms": 0,
      "teamSize": 5,
      "collaborationScore": 0.8
    }
  }
}'

echo "curl -X POST $API_BASE/workspaces/$WORKSPACE_ID/office/layout"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/workspaces/$WORKSPACE_ID/office/layout" \
  -H "Content-Type: application/json" \
  -d "$LAYOUT_DATA" 2>/dev/null)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✓ Status: $HTTP_CODE${NC}"
    echo "Response: $BODY" | head -c 200
else
    echo -e "${RED}✗ Status: $HTTP_CODE${NC}"
    echo "Response: $BODY"
fi
echo ""
echo ""

# Test 3: Get Layout
echo -e "${BLUE}3. GET Layout${NC}"
echo "curl -X GET $API_BASE/workspaces/$WORKSPACE_ID/office/layout"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE/workspaces/$WORKSPACE_ID/office/layout" 2>/dev/null)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ] || [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✓ Status: $HTTP_CODE${NC}"
    echo "Response: $BODY" | head -c 300
else
    echo -e "${RED}✗ Status: $HTTP_CODE${NC}"
    echo "Response: $BODY"
fi
echo ""
echo ""

# Test 4: Assign Desk
echo -e "${BLUE}4. POST Assign Desk${NC}"
DESK_DATA='{
  "deskId": "desk-1",
  "userId": "user-123",
  "isPermanent": true
}'

echo "curl -X POST $API_BASE/workspaces/$WORKSPACE_ID/office/desks"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/workspaces/$WORKSPACE_ID/office/desks" \
  -H "Content-Type: application/json" \
  -d "$DESK_DATA" 2>/dev/null)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ] || [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✓ Status: $HTTP_CODE${NC}"
    echo "Response: $BODY" | head -c 200
else
    echo -e "${RED}✗ Status: $HTTP_CODE${NC}"
    echo "Response: $BODY"
fi
echo ""
echo ""

# Test 5: Get Desk Assignments
echo -e "${BLUE}5. GET Desk Assignments${NC}"
echo "curl -X GET $API_BASE/workspaces/$WORKSPACE_ID/office/desks"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE/workspaces/$WORKSPACE_ID/office/desks" 2>/dev/null)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ] || [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✓ Status: $HTTP_CODE${NC}"
    echo "Response: $BODY" | head -c 200
else
    echo -e "${RED}✗ Status: $HTTP_CODE${NC}"
    echo "Response: $BODY"
fi
echo ""
echo ""

# Summary
echo "================================"
echo -e "${BLUE}📊 Test Summary${NC}"
echo "================================"
echo ""
echo "Note: 401 responses are expected if not authenticated"
echo "Note: 404 responses are expected if workspace doesn't exist yet"
echo ""
echo "Next steps:"
echo "1. Create a workspace through the UI at http://localhost:3000"
echo "2. Use that workspace ID in the tests"
echo "3. Get an auth token to test authenticated endpoints"
