import sys
sys.path.append('../')  

import json
from file_db import FileDb as DB

def convertArrayToMap(orig_key, new_key, index_name):
	arr = DB.read(orig_key)
	converted_map = {}

	for item in arr:
		converted_map[item[index_name]] = item

	DB.create(new_key, converted_map)

convertArrayToMap('./config/airports.json', './config/airports_map.json', 'iata')
