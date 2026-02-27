echo ">>> Command: dir /s /b sbo-rebirth-planner\boss-data.js"
dir /s /b sbo-rebirth-planner\boss-data.js
echo "Exit Code: $?"
echo ""
echo ">>> Command: dir /s /b sbo-rebirth-planner\boss-readiness.js"
dir /s /b sbo-rebirth-planner\boss-readiness.js
echo "Exit Code: $?"
echo ""
echo ">>> Command: grep -n "function buildContext" sbo-rebirth-planner\app.js"
grep -n "function buildContext" sbo-rebirth-planner\app.js
echo "Exit Code: $?"
echo ""
echo ">>> Command: sed -n "1100,1200p" sbo-rebirth-planner\app.js"
sed -n "1100,1200p" sbo-rebirth-planner\app.js
echo "Exit Code: $?"
echo ""
echo ">>> Command: type sbo-rebirth-planner\data\wiki-raw\bosses.json | findstr /i "Floor-Seven Floor-Sixteen""
type sbo-rebirth-planner\data\wiki-raw\bosses.json | findstr /i "Floor-Seven Floor-Sixteen"
echo "Exit Code: $?"
echo ""