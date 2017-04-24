import re
import datetime
import time
import logging

from file_db import FileDb as DB
from request_args import RequestArgs as ReqArgs

airports_map = DB.read('./config/airports_map.json')

class FileController:
	@staticmethod
	def getPredDateFromPath(path):
		date_time = path.split('/')[-1].replace('.json', '')
		return date_time.split('_')[0]

	def getDepDateFromPath(path):
		return path.split('/')[-3].split('+')[0]

	@staticmethod
	def getPathWoFn(path):
		return re.search('.*(?=\/)', path).group()

	@staticmethod
	def getPathFromFlight(flight, prefix='./data/predictions'):
		filter_name = ReqArgs.getFilterName(flight)
		travel_date = flight['depart']
		trip_type = 'oneway'
		dom_or_int = 'domestic' if airports_map[flight['dest']]['iso'] == airports_map[flight['orig']]['iso'] else 'international'

		if 'return' in flight:
			trip_type = 'roundtrip'
			travel_date = travel_date + '+' + flight['return']

		key = '{}/{}/{}/{}-2-{}/{}/{}'.format(prefix, dom_or_int, trip_type, flight['orig'], flight['dest'], travel_date, filter_name)

		return key

	@staticmethod
	def log(key, id, msg, should_print=True, err=None):
		msg = str(msg)
		if should_print: 
			print(msg)
			if err: logging.exception('')

		msg += '\n'
		DB.update('./data/logs/{}/{}.txt'.format(key, id), msg, False)