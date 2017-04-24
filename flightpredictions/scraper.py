import time
import re
import logging
import math
import sys

from collections import OrderedDict

from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

from request_args import RequestArgs as ReqArgs
from args_generator import ArgsGenerator as ArgGen
from workers import Workers
from file_db import FileDb as DB
from file_controller import FileController as FileCtrl

driver = webdriver.PhantomJS(service_log_path='./data/logs/scraper/ghostdriver.log')


class FilterNotSupported(Exception):
	pass

class ScrapeFail(Exception):
	pass

class NoScrapeDataFound(Exception):
	pass

class Scraper:
	@classmethod
	def scrapeFlights(cls, flights, batch_id, check_existing=True, save=False, screenshots=False, workers=1):
		print('\nScraping google flights...')
		if not save: print('Not saving!')
		if isinstance(flights, dict): flights = [flights]
		if isinstance(flights, str): 
			flights = flights.split('&')
			key = flights[0]
			date = flights[1]
			flights = ArgGen.getArgsFromKey(key, date)

		if workers is not 1:
			data = [ (flight, batch_id, check_existing, save, screenshots) for flight in flights]
			workers = Workers(num_workers=1, workerFunc=cls.scrapeFlight, data=data, progressbar=True)
			workers.start()
		else:
			failed = 0
			completed = 0
			total = len(flights)
			cls.runProgressbar(completed, failed, total)
			for flight in flights:
				try:
					cls.scrapeFlight(flight, batch_id, check_existing, save, screenshots)
				except Exception as e:
					failed += 1
					logging.exception('Scrape failed')

				completed += 1
				cls.runProgressbar(completed, failed, total)

		driver.quit()
		sys.stdout.write('\n')
		sys.stdout.flush()

	@classmethod
	def scrapeFlight(cls, flight, batch_id, check_existing, save, screenshots=False):
		if check_existing and not cls.shouldUpdate(flight): return
		url = ''
		try:
			url = cls.createUrl(flight)
		except FilterNotSupported:
			return cls.updateFlight(flight, 'NA', save);

		html = cls.getHtml(url)
		if screenshots: cls.saveScreenshot(flight, url, html)

		data = { 'prices': cls.getPricesFromHtml(url, html, flight, screenshots), 'url': url }
		cls.updateFlight(flight, data, save)
		return data

	@classmethod
	def shouldUpdate(cls, flight):
		key = FileCtrl.getPathFromFlight(flight)
		try:
			filename = DB.list(key)[-1].split('/')[-1]
			key += '/{}'.format(filename)
			flight_data = DB.read(key)
			return 'googlePrices' not in flight_data
		except:
			return False

	@classmethod
	def updateFlight(cls, flight, prices, save):
		if not save: return
		key = FileCtrl.getPathFromFlight(flight)
		try:
			filename = DB.list(key)[-1].split('/')[-1]
			key += '/{}'.format(filename)
			flight_data = DB.read(key)
			flight_data['googlePrices'] = prices
			DB.create(key, flight_data)
		except:
			pass

	@classmethod
	def createUrl(cls, flight):
		url = 'https://www.google.com/flights/#search;f={};t={};d={}'.format(flight['orig'], flight['dest'], flight['depart'])
		the_filter = flight['filter']['filters'] if 'filters' in flight['filter'] else flight['filter']

		if ReqArgs.isNoLowCost(the_filter): raise FilterNotSupported(flight)

		if 'return' in flight:
			url += ';r={}'.format(flight['return'])
		else:
			url += ';tt=o'

		if ReqArgs.isShortLayover(the_filter): url += ';s=1'

		if ReqArgs.NON_STOP == the_filter: url += ';s=0'

		return url

	@classmethod
	def getPricesFromHtml(cls, url, html, flight, screenshots):
		def cleanPrices(price):
			price = price[0].split('–$')[0].replace(',', '') #remove - in xxx-$xxx
			if not price: return 'Check price'

			return int(price)

		prices = list(map(cleanPrices,
			re.findall('((?<=\$)[0-9,$–-]+)<\/div><div.*?(one way|round trip)<\/div>|Check price', html))) # -- because one is weird unicode
		operators = list(
			map(lambda operator: operator.replace('<span> ·', ',').replace('<span>', ''), 
				re.findall('(?<=<\/div>)?[\w\s]*<span>[\w\s,·]+', html)))
		if 'Check price' in prices:
			i = prices.index('Check price')
			del prices[i]
			del operators[i]

		if len(operators) != len(prices) or len(operators) == 0 or len(prices) == 0:
			print('Prices: ' + str(prices))
			print('Operators: ' + str(operators))
			print('URL: ' + url)
			if not screenshots: cls.saveScreenshot(flight, url, html)
			raise ScrapeFail(flight, url)
		
		data = OrderedDict()
		sorted_prices = sorted(list(zip(prices, operators)), key=lambda tup: tup[0])
		for i, tup in enumerate(sorted_prices):
			price, operator = tup
			data[i+1] = { 'price': price, 'operators': operator }

		return data

	@classmethod
	def saveScreenshot(cls, flight, url, data):
		epoch = int(time.time() * 1000)
		ms = str(int(epoch) % 1000)
		ms = ms + ((3 - len(ms)) * '0')
		timestamp = '{};{}'.format(time.strftime('%Y-%m-%d_%H:%M:%S'), ms)
		key = FileCtrl.getPathFromFlight(flight, prefix='data/screenshots')
		key = '{}/{}.png'.format(key, timestamp)
		DB.mkdirs(key)
		DB.create(key.replace('.png', '.html'), data)
		driver.save_screenshot(key)

	@classmethod
	def runProgressbar(cls, completed, failed, total, prefix='Completed: ', size=30):
		x = int(size*completed/total)
		sys.stdout.write(' %s[%s%s] %i/%i failed: %i\r' % (prefix, '#'*x, '.'*(size-x), completed, total, failed))
		sys.stdout.flush()

	@classmethod
	def getHtml(cls, url):
		POLL_TIME = 0.3
		SAFTEY_TIME = 0.25
		MAX_RETRIES = 50

		retries = 0
		driver.get(url)
		time.sleep(POLL_TIME)
		html = ''
		try:
			html = driver.find_element_by_id('root').get_attribute('innerHTML')
		except Exception as e:
			pass

		def loadTester(_html):
			return not len(re.findall('(\$[0-9,$–-]+)<\/div><div.*?(one way)|(round trip)<\/div>|Check price', html))

		while loadTester(html) and retries <= MAX_RETRIES:
			retries += 1
			time.sleep(POLL_TIME)
			try:
				html = driver.find_element_by_id('root').get_attribute('innerHTML')
			except:
				pass

		if html == '': raise NoScrapeDataFound(url)
		
		time.sleep(SAFTEY_TIME)
		html = driver.find_element_by_id('root').get_attribute('innerHTML')
		soup = BeautifulSoup(html, 'html.parser') # remove map
		for div in soup.findAll('div', {'class':'gm-style'}): 
			div.decompose()

		html = str(soup)
		return html


# for i in range(1000):
# 	data = Scraper.scrapeFlight(
# 		{'orig': 'LAX', 'dest': 'SIN', 'depart': '2017-10-02', 'filter': {'TripFilter': 'ShortLayoverFilter'}},
# 		'test',
# 		check_existing=False,
# 		save=False,
# 		screenshots=False
# 	)
# 	if data['prices'][1]['price'] != 374: print(str(data))



