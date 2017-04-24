import random
from datetime import datetime, timedelta
from file_db import FileDb as DB
from file_controller import FileController as FileCtrl
from request_args import RequestArgs as ReqArgs

class ArgsGenerator:
	@staticmethod
	def getArgsFromKey(key, date):
		paths = DB.list(key, recursive=True)
		return [ ArgsGenerator.getArgFromPath(path) for path in paths if FileCtrl.getPredDateFromPath(path) == date ]

	@staticmethod
	def getArgFromPath(path):
		arg = {}
		data = path.split('predictions/')[1].split('/')
		location = data[2].split('-')
		dates = data[3].split('+')
		filt = data[4]
		arg['orig'] = location[0]
		arg['dest'] = location[2]
		arg['depart'] = dates[0]
		arg['filter'] = ReqArgs.getFilter(filt)
		if len(dates) is 2: arg['return'] = dates[1]
		return arg

	@staticmethod
	def mergeArgs(args):
		if len(args) == 0: return []

		if len(args) == 1: return args[0]

		merged = args[0];
		for i, arg in enumerate(args):
			if i == 0: continue

			for pred in arg:
				if pred in merged: continue
				merged.append(pred)

		return merged

	@staticmethod
	def getArgFiles(idxs, radii='both'):
		if isinstance(idxs, int): idxs = [i]

		if radii == 'both': radii = ['oneway', 'roundtrip']

		if not isinstance(radii, list): radii = [radii]

		bases = [
			'./data/generated_args/oneway/domestic',
			'./data/generated_args/oneway/international',
			'./data/generated_args/oneway/international',
			'./data/generated_args/roundtrip/domestic',
			'./data/generated_args/roundtrip/international'
		]
		paths = []
		for base in bases:
			match = False
			for radius in radii:
				if radius in base: match = True

			if not match: continue

			for i in idxs:
				filenames = DB.list(base)
				if i >= len(filenames): continue
				filename = filenames[i]
				paths.append('{}/{}'.format(base, filename))

		return paths

	@staticmethod
	def getArgsByFileIdxs(idxs, radii='both'):
		args = []
		paths = ArgsGenerator.getArgFiles(idxs, radii)
		for path in paths:
			args.append(DB.read(path))

		return ArgsGenerator.mergeArgs(args)

	@staticmethod
	def generateAndSavePredictionArgs(orig, dests, start_date, international, name=False, spacing_in_days=11, args_per_dest=22, roundtrip=False):
		args = [];
		for dest in dests:
			depart_date = datetime.strptime(start_date, '%Y-%m-%d')
			return_date = False
			arg = { 'depart': start_date, 'orig': orig, 'dest': dest }
			if roundtrip:
				trip_length = random.randint(3, roundtrip)
				return_date = depart_date + timedelta(days=trip_length)
				return_date = return_date.strftime('%Y-%m-%d')
				arg['return'] = return_date

			args.append(arg)
			for i in range(args_per_dest-1):
				skip_days = random.randint(3, spacing_in_days)
				depart_date = depart_date + timedelta(days=skip_days)

				if roundtrip:
					trip_length = random.randint(3, roundtrip)
					return_date = depart_date + timedelta(days=trip_length)
					return_date = return_date.strftime('%Y-%m-%d')

				depart_date = depart_date.strftime('%Y-%m-%d')
				arg = { 'depart': depart_date, 'orig': orig, 'dest': dest }

				if roundtrip:
					arg['return'] = return_date

				args.append(arg)
				depart_date = datetime.strptime(depart_date, '%Y-%m-%d')

		flight_range = 'international' if international else 'domestic'
		trip_type = 'roundtrip' if roundtrip else 'oneway'
		filename = '{}-#TIME.json'.format(name) if name else '#TIME.json'
		key = './data/generated_args/{}/{}/{}'.format(trip_type, flight_range, filename)
		DB.create(key, args)
