import time
import logging
import math
import matplotlib.pyplot as plt

from collections import defaultdict

from graph_controller import GraphController as GraphCtrl
from file_db import FileDb as DB
from file_controller import FileController as FileCtrl
from prediction_controller import PredictionController as PredCtrl

class AnalysisController:
	@staticmethod
	def shouldSkip(pred_fn, pred_filters, distances, radii):
		pred_fn_split = pred_fn.split('/')
		if pred_filters[0] != 'AllFilters':
			match = False
			for pred_filter in pred_filters:
				if pred_filter in pred_fn_split: match = True

			if not match: return True

		if distances[0] != 'both':
			match = False
			for distance in distances:
				if distance in pred_fn_split: match = True

			if not match: return True

		if radii[0] != 'both':
			match = False
			for radius in radii:
				if radius in pred_fn_split: match = True

			if not match: return True

		return False

	@staticmethod
	def filterDups(preds):
		results = []
		for i, pred in enumerate(preds):
			if i == 0: 
				results.append(pred)
				continue

			prev = preds[i-1]
			if FileCtrl.getPathWoFn(pred['fn']) == FileCtrl.getPathWoFn(prev['fn']) \
				and pred['pred_savings'] == prev['pred_savings']: continue

			results.append(pred)
		return results

	@staticmethod
	def list(sort_type='greatest_savings', pred_filters='AllFilters', distances='both',
			waits_only=True, pred_date=False, skip_duplicates=True, radii='both'):
		if not isinstance(pred_filters, list): pred_filters = [pred_filters]

		if radii == 'both': radii = ['oneway', 'roundtrip']

		if not isinstance(radii, list): radii = [radii]
		
		if distances == 'both': distances = ['domestic', 'international']

		if not isinstance(distances, list): distances = [distances]

		distances.sort()
		distances_dir = '_and_'.join(distances)
		radii.sort()
		radii_dir = '_and_'.join(radii)
		pred_filters.sort()
		filter_dir = '_and_'.join(pred_filters)
		save_key = './data/analysis/lists/{}/{}/{}/{}/#TIME.json'.format(sort_type, distances_dir, radii_dir, filter_dir)
		preds = DB.list('./data/predictions', recursive=True)
		preds_by_savings = PredCtrl.getPreds(preds, pred_filters, waits_only, pred_date, distances, radii, AnalysisController.shouldSkip)

		def greatestSavings(): 
			preds_by_savings.sort(key=lambda pred: pred['pred_savings'], reverse=True)

		sort = { 'greatest_savings': greatestSavings }

		sort[sort_type]()

		if skip_duplicates: preds_by_savings = AnalysisController.filterDups(preds_by_savings)

		DB.create(save_key, preds_by_savings)
		print('Done')

	@staticmethod
	def graph(flight, options={}, graph_types='changeInPrices'):
		options = defaultdict(lambda: None, options)
		getattr(GraphCtrl, graph_types)(flight, options)
		plt.show()
