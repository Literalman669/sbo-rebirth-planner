echo ">>> Command: type sbo-rebirth-planner\index.html"
type sbo-rebirth-planner\index.html
echo "Exit Code: $?"
echo ""
echo ">>> Command: findstr /n "chat-panel chatbot ask ai-advisor" sbo-rebirth-planner\app.js"
findstr /n "chat-panel chatbot ask ai-advisor" sbo-rebirth-planner\app.js
echo "Exit Code: $?"
echo ""
echo ">>> Command: sed -n "1,200p" sbo-rebirth-planner\app.js"
sed -n "1,200p" sbo-rebirth-planner\app.js
echo "Exit Code: $?"
echo ""
echo ">>> Command: type sbo-rebirth-planner\test_frontend_context.js"
type sbo-rebirth-planner\test_frontend_context.js
echo "Exit Code: $?"
echo ""
echo ">>> Command: node sbo-rebirth-planner\test_edge_function.js"
node sbo-rebirth-planner\test_edge_function.js
echo "Exit Code: $?"
echo ""