from functools import reduce

import matplotlib.pyplot as plt
import matplotlib.dates as mdates

from matplotlib.ticker import FormatStrFormatter
from collections import defaultdict

from file_db import FileDb as DB
from file_controller import FileController as FileCtrl
from prediction_controller import PredictionController as PredCtrl

class GraphController:
	@staticmethod
	def changeInPrices(flight, options, distance='domestic', radii='both', range=('2017-04-18', '2017-04-30')):
		key = './data/predictions/{}'.format(distance)
		if radii is not 'both': key += '/%s' % radii

		def inRange(x, y, z): return x <= z and y >= z

		def processor(acc, k):
			date = FileCtrl.getDepDateFromPath(k)
			if not inRange(range[0], range[1], date): return acc

			pred = None
			try:
				pred = DB.read(k)
			except:
				print('Found broken file: %s' % k)
				return acc

			acc[date].append(PredCtrl.getLowestPrice(pred))
			return acc

		avg_low_price = [ (k, sum(v)/len(v)) for k, v in reduce(processor, DB.list(key, recursive=True), defaultdict(list)).items() ]
		avg_low_price.sort(key=lambda tup: tup[0])
		print(avg_low_price)

	@staticmethod
	def predsVsLowestPrices(flight, options):
		path = './data/predictions/' + flight
		entries = sorted(DB.list(path))
		strConverter = mdates.strpdate2num('%Y-%m-%d')
		dates = []
		pred_prices = []
		lowest_prices = []
		num_seats = []
		for entry in entries:
			data = DB.read(path + '/' + entry)
			lowest_prices.append(PredCtrl.getLowestPrice(data))
			pred_prices.append(PredCtrl.getPredPrice(data))
			dates.append(strConverter(FileCtrl.getPredDateFromPath(entry)))
			if options['show_seats']: num_seats.append(PredCtrl.getSeats(data))

		fig, ax = plt.subplots()
		majorFormatter = FormatStrFormatter('$%d')
		if options['show_seats']:
			for label, lowest_price, date in zip(num_seats, lowest_prices, dates):
				plt.annotate(label, xy=(date, lowest_price), xytext=(-10, 3), textcoords='offset points')

		offset(dates, lowest_prices, 0.05)
		plt.plot_date(dates, pred_prices, 'bs-', alpha=1)
		plt.plot_date(dates, lowest_prices, 'g^-', alpha=1)
		ax.set_xlabel('Date', fontsize=14)
		ax.set_ylabel('Price', fontsize=14)
		ax.set_title('Predictions vs Lowest Prices', fontsize=18)
		plt.grid(True)
		plt.setp(ax.xaxis.get_majorticklabels(), rotation=45)
		plt.tight_layout()
		ax.yaxis.set_major_formatter(majorFormatter)
		fig.autofmt_xdate()

	@staticmethod
	def predVsLowestPrices(flight, options):
		pred_date = options['pred_date']
		path = './data/predictions/' + flight
		entries = sorted(DB.list(path))
		strConverter = mdates.strpdate2num('%Y-%m-%d')
		pred_price = None
		dates = []
		pred_prices = []
		lowest_prices = []
		if pred_date: pred_price = PredCtrl.getLowestPrice(pred_date)

		for entry in entries:
			data = DB.read(path + '/' + entry)
			if not pred_date: pred_date = FileCtrl.getPredDateFromPath(entry)

			if not pred_price: pred_price = PredCtrl.getPredPrice(data)

			lowest_prices.append(PredCtrl.getLowestPrice(data))
			pred_prices.append(pred_price)
			dates.append(strConverter(FileCtrl.getPredDateFromPath(entry)))

		fig, ax = plt.subplots()
		majorFormatter = FormatStrFormatter('$%d')
		plt.plot_date(dates, pred_prices, 'b-', alpha=1)
		plt.plot_date(dates, lowest_prices, 'g^-', alpha=0.5)
		ax.set_xlabel('Date', fontsize=14)
		ax.set_ylabel('Price', fontsize=14)
		ax.set_title('Prediction ({}) vs Lowest Prices'.format(pred_date), fontsize=18)
		plt.grid(True)
		plt.setp(ax.xaxis.get_majorticklabels(), rotation=45)
		plt.tight_layout()
		fig.autofmt_xdate()
		ax.yaxis.set_major_formatter(majorFormatter)

	@staticmethod
	def predAccsVsDates(flight):
		path = './data/predictions/' + flight
		entries = sorted(DB.list(path))
		strConverter = mdates.strpdate2num('%Y-%m-%d')
		info = PredCtrl.getFlightInfo(flight)
		dates, accs = PredCtrl.getPredAccs(flight)
		dates = [strConverter(date) for date in dates]

		centeryGraph(dates, accs, plt)
		print(str(offset))
		fig, ax = plt.subplots()
		plt.plot_date(dates, accs, 'bs-', alpha=1)
		ax.set_xlabel('Date', fontsize=14)
		ax.set_ylabel('Accuracy (%)', fontsize=14)
		ax.set_title('Accuracy for Prediction Dates', fontsize=18)
		plt.grid(True)
		plt.setp(ax.xaxis.get_majorticklabels(), rotation=45)
		plt.tight_layout()
		fig.autofmt_xdate()

def centeryGraph(xs, ys, padding=0):
	max_y = max(ys)
	min_y = min(ys)
	val = -1 * max_y if max_y > abs(min_y) else min_y
	val += padding
	vals = [val for x in range(len(xs))]
	plt.plot_date(xs, vals, alpha=0)

def offset(xs, ys, offset_y):
	max_y = max(ys)
	vals = [max_y + max_y * offset_y for x in range(len(xs))]
	plt.plot_date(xs, vals, alpha=0)
