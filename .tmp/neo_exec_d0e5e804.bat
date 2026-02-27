echo ">>> Command: type sbo-rebirth-planner\boss-data.js"
type sbo-rebirth-planner\boss-data.js
echo "Exit Code: $?"
echo ""
echo ">>> Command: type sbo-rebirth-planner\data\wiki-raw\bosses.json"
type sbo-rebirth-planner\data\wiki-raw\bosses.json
echo "Exit Code: $?"
echo ""
echo ">>> Command: grep -n "Storm Atronach" sbo-rebirth-planner\boss-data.js"
grep -n "Storm Atronach" sbo-rebirth-planner\boss-data.js
echo "Exit Code: $?"
echo ""
echo ">>> Command: grep -n "Two-Headed Giant" sbo-rebirth-planner\boss-data.js"
grep -n "Two-Headed Giant" sbo-rebirth-planner\boss-data.js
echo "Exit Code: $?"
echo ""
echo ">>> Command: python -c "import json; b=json.load(open('sbo-rebirth-planner/data/wiki-raw/bosses.json')); print([x for x in b['bosses'] if 'Storm Atronach' in x['name'] or 'Two-Headed Giant' in x['name']])""
python -c "import json; b=json.load(open('sbo-rebirth-planner/data/wiki-raw/bosses.json')); print([x for x in b['bosses'] if 'Storm Atronach' in x['name'] or 'Two-Headed Giant' in x['name']])"
echo "Exit Code: $?"
echo ""