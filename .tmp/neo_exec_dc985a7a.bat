echo ">>> Command: find . -maxdepth 4 -name "app.js" -o -name "index.ts" -o -name "index.html""
find . -maxdepth 4 -name "app.js" -o -name "index.ts" -o -name "index.html"
echo "Exit Code: $?"
echo ""
echo ">>> Command: ls -F sbo-rebirth-planner/supabase/functions/sbo-ai-advisor/"
ls -F sbo-rebirth-planner/supabase/functions/sbo-ai-advisor/
echo "Exit Code: $?"
echo ""
echo ">>> Command: cat sbo-rebirth-planner/supabase/functions/sbo-ai-advisor/index.ts | head -n 100"
cat sbo-rebirth-planner/supabase/functions/sbo-ai-advisor/index.ts | head -n 100
echo "Exit Code: $?"
echo ""
echo ">>> Command: cat sbo-rebirth-planner/app.js | grep -C 5 "SBO_AI_CONFIG""
cat sbo-rebirth-planner/app.js | grep -C 5 "SBO_AI_CONFIG"
echo "Exit Code: $?"
echo ""
echo ">>> Command: cat sbo-rebirth-planner/data/wiki-raw/bosses.json | head -n 50"
cat sbo-rebirth-planner/data/wiki-raw/bosses.json | head -n 50
echo "Exit Code: $?"
echo ""
echo ">>> Command: ls -F sbo-rebirth-planner/test_edge_function.js sbo-rebirth-planner/test_frontend_context.js"
ls -F sbo-rebirth-planner/test_edge_function.js sbo-rebirth-planner/test_frontend_context.js
echo "Exit Code: $?"
echo ""
echo ">>> Command: cat sbo-rebirth-planner/DEPLOYMENT_VERIFICATION.md"
cat sbo-rebirth-planner/DEPLOYMENT_VERIFICATION.md
echo "Exit Code: $?"
echo ""