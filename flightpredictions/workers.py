import logging
import sys

from threading import Thread
from queue import Queue

class Workers:
	def __init__(self, num_workers, workerFunc, data=[], progressbar=False):
		self.workerFunc = workerFunc
		self.num_workers = num_workers
		self.failed = 0
		self.completed = 0
		self.total = len(data)
		self.progressbar = progressbar
		self.q = Queue()
		for item in data:
			self.q.put(item)


	def worker(self):
		while True:
			item = self.q.get()
			try:
				self.workerFunc(*item)
			except Exception as e:
				self.failed += 1
				if self.progressbar: 
					logging.exception('')
				else: 
					print('Worker caught exception')
					raise e
			finally:
				self.completed += 1
				self.runProgressbar()
				self.q.task_done()

	def put(self, data):
		self.q.put(data)
		self.total += 1

	def start(self):
		self.runProgressbar()
		for i in range(self.num_workers):
			t = Thread(target=self.worker, args=())
			t.daemon = True
			t.start()

		self.q.join()
		if self.progressbar:
			sys.stdout.write('\n')
			sys.stdout.flush()

	def runProgressbar(self, prefix='Completed: ', size=30):
		if not self.progressbar: return

		x = int(size*self.completed/self.total)
		sys.stdout.write(' %s[%s%s] %i/%i failed: %i\r' % (prefix, '#'*x, '.'*(size-x), self.completed, self.total, self.failed))
		sys.stdout.flush()