import json
import os
import time
import fnmatch
from pathlib import Path

from send2trash import send2trash

TIME_INSERT = '#TIME'

def getMsTime():
	return int(time.time() * 1000)

class FileDb:
	@staticmethod
	def mkdirs(filename):
		if not os.path.exists(os.path.dirname(filename)):
			try:
				os.makedirs(os.path.dirname(filename))
			except OSError as exc: # Guard against race condition
				if exc.errno != errno.EEXIST:
					raise

	@staticmethod
	def create(key, data):
		epoch = getMsTime()
		ms = str(int(epoch) % 1000)
		ms = ms + ((3 - len(ms)) * '0')
		key = key.replace(TIME_INSERT, '{};{}'.format(time.strftime('%Y-%m-%d_%H:%M:%S'), ms))
		FileDb.mkdirs(key)
		with open(key, 'w') as f:
			json.dump(data, f, ensure_ascii=False, indent=4, sort_keys=True)

	@staticmethod
	def read(key):
		with open(key) as f:
			return json.load(f)

	@staticmethod
	def update(key, data, json=True):
		FileDb.mkdirs(key)
		with open(key, 'a+') as f:
			if not json:
				f.write(data)
			else:
				json.dump(data, f, ensure_ascii=False, indent=4, sort_keys=True)

	@staticmethod
	def list(key, recursive=False):
		if recursive:
			matches = []
			for root, dirnames, filenames in os.walk(key):
				for filename in fnmatch.filter(filenames, '*.json'):
					matches.append(os.path.join(root, filename))
			return matches

		return fnmatch.filter(os.listdir(key), '*.json')

	@staticmethod
	def remove(key, folder=False, to_trash=False):
		if to_trash: return send2trash(key)
		if not folder: return os.remove(key)

	@staticmethod
	def exists(key, type):
		try:
			my_file = Path(key)
			if type is 'folder': return my_file.is_file()
			return my_file.is_dir()
		except:
			return False


