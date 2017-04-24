import re

from file_db import FileDb as DB
from file_controller import FileController as FileCtrl

class PredictionController:
	@staticmethod
	def getSeats(pred_data):
		return pred_data['solutions']['options'][0]['seatAvailability']
		
	@staticmethod
	def getPredOverLowestPrice(pred_data):
		return PredictionController.getSavings(pred_data) / PredictionController.getLowestPrice(pred_data)

	@staticmethod
	def getPredPrice(pred_data):
		return PredictionController.getLowestPrice(pred_data) - PredictionController.getSavings(pred_data)

	@staticmethod
	def getSavings(pred_data):
		rec_body = ' '.join(pred_data['predictionCopy']['recommendationBody'])
		savings = 0
		if pred_data['recommendation'] == 'wait':
			savings = re.search('(?<=\$)\d*', rec_body).group()
			savings = int(savings)

		return savings

	@staticmethod
	def getLowestPrice(pred_data):
		return float(re.search('\d+', pred_data['predictionCopy']['lowestPrice'].replace(',', '')).group())

	@staticmethod
	def getFlightInfo(flight):
		path = './data/predictions/' + flight
		entries = sorted(DB.list(path))
		data = DB.read(path + '/' + entries[0])
		info = {}
		info['Origin'] = data['predictionCopy']['origin']
		info['Destination'] = data['predictionCopy']['destination']
		info['Travel Dates'] = data['predictionCopy']['travelDates']
		return info

	@staticmethod
	def createPred(pred_data, pred_fn, date_time):
		new_pred = {}
		new_pred['fn'] = pred_fn
		new_pred['datetime_predicted'] = date_time
		new_pred['recommendation'] = pred_data['recommendation']
		new_pred['pred_savings'] = PredictionController.getPredPrice(pred_data)
		new_pred['lowest_price_at_pred'] = PredictionController.getLowestPrice(pred_data)
		new_pred['pred_price'] = PredictionController.getPredPrice(pred_data)
		new_pred['orig'] = pred_data['predictionCopy']['origin']
		new_pred['dest'] = pred_data['predictionCopy']['destination']
		new_pred['travel_dates'] = pred_data['predictionCopy']['travelDates']
		return new_pred

	@staticmethod
	def getPredAcc(flight, pd):
		path = './data/predictions/' + flight
		entries = sorted(DB.list(path))
		lp = math.inf
		PPpd = None
		for entry in entries:
			d = FileCtrl.getPredDateFromPath(entry)
			if d < pd: continue

			data = DB.read(path + '/' + entry)
			curr_lp = PredictionController.getLowestPrice(data)
			if curr_lp < lp: lp = curr_lp

			if d == pd: PPpd = PredictionController.getPredPrice(data)

		return lp/PPpd

	@staticmethod
	def getPredAccs(flight):
		lps = PredictionController.getLowestPrices(flight)
		dates = sorted(list(lps.keys()))
		accs = []
		for d in dates:
			lp = lps[d]['lp']
			pp = lps[d]['pp']
			accs.append(lp/pp - 1)
				
		return (dates, accs);
		
	@staticmethod
	def getLowestPrices(flight):
		'''
		returns a dict containing the date 
		and lowest price afer the date
		and predicted price at date
		'''
		path = './data/predictions/' + flight
		entries = sorted(DB.list(path))
		lps = {}
		accs = []
		for entry in entries:
			d = FileCtrl.getPredDateFromPath(entry)
			data = DB.read(path + '/' + entry)
			pp = PredictionController.getPredPrice(data)
			curr_lp = PredictionController.getLowestPrice(data)
			if not d in lps or curr_lp < lps[d]['lp']: lps[d] = { 'lp': curr_lp, 'pp': pp}

		dates = sorted(list(lps.keys()), reverse=True)
		for i, d in enumerate(dates):
			if i == 0: continue

			prev = dates[i - 1]
			curr = dates[i]
			if lps[prev]['lp'] < lps[curr]['lp']: lps[curr]['lp'] = lps[prev]['lp']

		return lps

	@staticmethod
	def getPreds(preds, pred_filters, waits_only, pred_date, distances, radii, shouldSkip):
			results = []
			for pred_fn in preds:
				try:					
					if shouldSkip(pred_fn, pred_filters, distances, radii): continue

					pred_data = DB.read(pred_fn)
					if pred_data['PredictionResponse'] == 'NotAvailable': continue

					if waits_only and pred_data['recommendation'] != 'wait': continue

					date_time = pred_fn.split('/')[-1].replace('.json', '').split(';')[0]
					date = date_time.split('_')[0]
					curr_date = time.strftime('%Y-%m-%d')
					if pred_date and curr_date != date: continue

					results.append(PredictionController.createPred(pred_data, pred_fn, date_time))
				except Exception as e:
					print('Problem processing ' + pred_fn)
					raise e

			return results