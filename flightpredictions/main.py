import datetime

from hopper_controller import HopperController
from analysis_controller import AnalysisController
from args_generator import ArgsGenerator

domestic_dests = ['ATL', 'ORD', 'JFK', 'DEN', 'DFW', 'SFO', 'LAS', 'MIA', 'CLT', 'PHX', 'IAH', 'SEA']
international_dests = ['CDG', 'AMS', 'PEK', 'HND', 'FRA', 'DXB', 'LHR', 'HKG', 'PVG', 'ICN', 'DEL', 'MAD', 'SIN']

def generateArgs():
	# ArgsGenerator.generateAndSavePredictionArgs('LAX', domestic_dests, '2017-04-21', international=False)
	# ArgsGenerator.generateAndSavePredictionArgs('LAX', international_dests, '2017-04-22', international=True)

	ArgsGenerator.generateAndSavePredictionArgs('LAX', domestic_dests, '2017-04-23', international=False, roundtrip=21)
	ArgsGenerator.generateAndSavePredictionArgs('LAX', international_dests, '2017-04-24', international=True, roundtrip=21)

def download():
	print('Downloading...')
	# generateArgs()
	batch_id = datetime.datetime.now().strftime('%Y-%m-%d_%H:%M:%S')
	args = ArgsGenerator.getArgsByFileIdxs([0, 1])
	HopperController.downloadPredictions(args, batch_id, save=True, screenshots=True)

def analyze():
	print('Analyzing...')
	# AnalysisController.list(radii='oneway', pred_filters='NoFilter')
	AnalysisController.graph('domestic/oneway/LAX-2-ATL/2017-04-19/NoFilter', { 'show_seats': True })

def Main():
	download()
	# analyze()

Main()