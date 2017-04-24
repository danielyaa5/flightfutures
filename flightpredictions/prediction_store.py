import time
import os

from file_db import FileDb as DB

class PredictionStore:
	@staticmethod
	def deleteValue(value, should_delete):
		paths = DB.list('./data/predictions', recursive=True)
		for path in paths:
			if DB.read(path) == value:
				if should_delete:
					DB.remove(path)
					continue

				print(path)

	@staticmethod
	def deleteDates(dates=['Today'], should_delete=False):
		if dates[0] == 'Today': dates[0] = time.strftime('%Y-%m-%d')
		
		paths = DB.list('./data/predictions', recursive=True)
		for path in paths:
			for date in dates:
				if date in path:
					if should_delete:
						DB.remove(path, to_trash=True)
						continue

					print(path)

	@staticmethod
	def delete(del_type='dates', dates=['Today'], should_delete=False, value=None):
		if not should_delete: print('Not actually deleting!')

		if del_type == 'dates': PredictionStore.deleteDates(dates, should_delete)

		if del_type == 'value': PredictionStore.deleteValue(value, should_delete)


	@staticmethod
	def rename():
		paths = DB.list('./data/predictions', recursive=True)

		for path in paths:
			epoch = int(path.split('/')[-1].replace('.json', ''))
			ms = str(int(epoch) % 1000)
			ms = ms + ((3 - len(ms)) * '0')
			epoch_s = epoch/1000
			new_fn = time.strftime('%Y-%m-%d_%H:%M:%S', time.localtime(epoch_s))
			new_fn = new_fn + ';{}'.format(str(ms))
			new_key = path.replace(str(epoch), new_fn)
			os.rename(path, new_key)
				
