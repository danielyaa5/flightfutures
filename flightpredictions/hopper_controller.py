import random
import copy
import sys
import http
import time

from datetime import datetime, timedelta
from scraper import Scraper
from workers import Workers
from services import Services
from file_db import FileDb as DB
from request_args import RequestArgs as ReqArgs
from threading import Thread
from file_controller import FileController as FileCtrl

LOG_KEY = 'download'
Services = Services("H4sIAAAAAAAAAI2QzWrDMBCE30XnyJX8m/gW2kug7SFOLi0lrKVNKrAlI8suIeTdu0oppbeAQGhnZz7tXpjRaIMJZ1Zf2DSi32hWs6zNAI6rlkMrFc/yvOJQlZKjklUJoLFdIVswjbNReHOATttcZEVe5KUuBJAKw3CTlOuTTzcM6JPeTTaAsbPBr2To4ExtM/rROBv5M3QTRnySJqUsSGwn0+nXqW/Rs5pK1+uCDR6P6NEqHKOpcwq66EJ72DfkUZOPKk3E9s0TFYLp8c3Z2LPu0RsFD89uPKztCTvKoMgRZtSbgD0lvl/+nuR4BO8NfZFyxgABIzLA6XZRLtX6gdpSISsuUp5WO7msZVanWbLKllwsayEiovnNbH5S2IsbwxYVbZ/RVP+hWzzRSu5gllwKnsldKglDJxFCcFHdxfy4fgNUtr7k/gEAAA==")
tot = 0
completed_count = 0
failed_count = 0
refused_count = 0
successful = []

class NoSolutionsException(Exception):
	pass

class NoResException(Exception):
	pass

def progressbar(prefix = "Completed: ", size = 30):
	count = tot
	_i = completed_count
	x = int(size*_i/count)
	sys.stdout.write(" %s[%s%s] %i/%i refused: %i, failed: %i\r" % (prefix, "#"*x, "."*(size-x), _i, count, refused_count, failed_count))
	sys.stdout.flush()
	
class HopperController:
	@staticmethod
	def addAllFiltersToPredArgs(all_pred_args):
		filters = ReqArgs.ALL_FILTER_COMBOS
		new_args = []

		for pred_args in all_pred_args:
			for the_filter in filters:
				pred_args['filter'] = the_filter
				new_args.append(dict(pred_args))

		return new_args

	@staticmethod
	def getPrediction(req_args, batch_id):
		# print('getPrediction req_args: ' + str(req_args))
		res = Services.pricePrediction(req_args)

		if not res:
			FileCtrl.log(LOG_KEY, batch_id, 'No response!', should_print=False)
			raise NoResException()

		res = res.json()['response']

		remove_keys = ['sharing']
		for k in remove_keys:
			if k in res:
				del res[k]

		if 'solutions' in res:
			remove_keys = ['banner']
			for k in remove_keys:
				if k in res['solutions']:
					del res['solutions'][k]
		else:
			FileCtrl.log(LOG_KEY, batch_id, 'Found a prediction result without solution: {}'.format(req_args), should_print=False)
			raise NoSolutionsException()

		res['solutions']['options'] = res['solutions']['options'][:6]
		res['solutions']['slices'] = res['solutions']['options'][:6]

		return res

	@staticmethod
	def savePrediction(pred_args, batch_id, res):
		# print('savePrediction pred_args: ' + str(pred_args))
		key = FileCtrl.getPathFromFlight(pred_args)
		# print('savePrediction key w/o fn: ' + key)
		key += '/#TIME.json'
		DB.create(key, res)

	@staticmethod 
	def downloadPrediction(pred_args, batch_id, retries, save=True):
		global completed_count
		global failed_count
		global refused_count
		global successful

		attempt = 0
		while attempt < retries:
			if attempt: time.sleep(0.5)
			try:
				res = HopperController.getPrediction(pred_args, batch_id)
				# print('downloadPrediction pred_args.filter: ' + str(pred_args['filter']))
				# if 'filterRecommendation' in res: print('downloadPrediction filterRecommendation: ' 
				# 	+ str(res['filterRecommendation']))
				# print('\n')
				if save: HopperController.savePrediction(pred_args, batch_id, res)
				successful.append(pred_args)
				break
			except NoResException as e:
				attempt += 1
				continue
			except NoSolutionsException as e:
				failed_count += 1
				break
			except Exception as e:
				if 'Connection aborted' in str(e):
					attempt += 1
					continue

				FileCtrl.log(LOG_KEY, batch_id, "Problem getting price prediction from api for {}".format(str(pred_args)), err=e)
				FileCtrl.log(LOG_KEY, batch_id, str(e))
				failed_count += 1
				break
		
		if attempt == retries: 
			FileCtrl.log(LOG_KEY, batch_id, 'Couldnt empty response or connection refused for: {}'.format(str(pred_args)), should_print=False)
			refused_count += 1

		completed_count += 1
		progressbar()


	@staticmethod
	def downloadPredictions(all_pred_args, batch_id, all_filters=True, num_workers=100, retries=5, save=True, google=True, screenshots=False):
		global tot
		if all_filters:
			all_pred_args = HopperController.addAllFiltersToPredArgs(all_pred_args)

		tot = len(all_pred_args)
		print('\nSaving {} different queries from hopper...'.format(str(tot)))
		if not save: print('Not saving results!')

		progressbar()
		workers_data = []
		for pred_args in all_pred_args:
			item = (pred_args, batch_id, retries, save)
			workers_data.append(item)

		workers = Workers(num_workers, HopperController.downloadPrediction, workers_data)
		workers.start()
		sys.stdout.write('\n')
		if google: Scraper.scrapeFlights(successful, batch_id, save=save, screenshots=screenshots)
		sys.stdout.flush()
