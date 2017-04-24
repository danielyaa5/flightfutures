import re

TRIP_FILTER = 'TripFilter'
FILTERS = 'filters'
AND_FILTER = 'AndFilter'

def andFilters(filters):
	return {
		FILTERS: filters,
		TRIP_FILTER: AND_FILTER
	}

class RequestArgs:
	NO_FILTER = { TRIP_FILTER:'NoFilter' }
	NO_LOW_COST_CARRIER = { TRIP_FILTER:'NoLowCostCarrierFilter' }
	NON_STOP = { TRIP_FILTER:'NonStopFilter' }
	SHORT_LAYOVER = { TRIP_FILTER: 'ShortLayoverFilter' }
	NO_LOW_COST_CARRIER_AND_NON_STOP = andFilters([NO_LOW_COST_CARRIER, NON_STOP])
	NO_LOW_COST_CARRIER_AND_SHORT_LAYOVER = andFilters([NO_LOW_COST_CARRIER, SHORT_LAYOVER])
	ALL_FILTER_COMBOS = [
		NO_FILTER,
		NO_LOW_COST_CARRIER,
		NON_STOP,
		SHORT_LAYOVER,
		NO_LOW_COST_CARRIER_AND_NON_STOP,
		NO_LOW_COST_CARRIER_AND_SHORT_LAYOVER
	]

	@classmethod
	def getFilter(cls, filt):
		filt = '_'.join(re.findall('[A-Z][a-z]*', filt)).upper()
		try:
			return getattr(cls, filt)
		except:
			return getattr(cls, filt.replace('_FILTER', ''))

	@classmethod
	def isNoLowCost(cls, filter):
		if filter == cls.NO_LOW_COST_CARRIER: return True
		if filter == cls.NO_LOW_COST_CARRIER_AND_SHORT_LAYOVER['filters']: return True
		if filter == cls.NO_LOW_COST_CARRIER_AND_NON_STOP['filters']: return True
		return False

	@classmethod
	def isShortLayover(cls, filter):
		if filter == cls.SHORT_LAYOVER: return True
		if filter == cls.NO_LOW_COST_CARRIER_AND_SHORT_LAYOVER: return True
		return False

	@classmethod
	def getFilterName(cls, flight):
		filter = 'NoFilter' if not 'filter' in flight else flight['filter']
		filter_name = ''
		if 'filters' in filter:
			for i, f in enumerate(filter['filters']):
				filter_name = filter_name + f['TripFilter']
				if i <= len(filter['filters']) - 2:
					filter_name = filter_name + 'And'

		else:
			filter_name = filter['TripFilter']

		return filter_name