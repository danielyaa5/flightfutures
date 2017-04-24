import re
from file_db import FileDb as DB
from prediction_store import PredictionStore as PredStore
from scraper import Scraper

# Delete everything downloaded today
def deleteTodaysFiles():
	PredStore.deleteDates(should_delete=True)

# Try regex on html file
def tryRegex():
	html = DB.read('./data/screenshots/international/roundtrip/LAX-2-DXB/2017-05-08+2017-05-18/NonStopFilter/2017-03-21_16:26:05;606.html');
	res = re.findall('((?<=\$)[0-9,$–-]+)<\/div><div.*?(one way)|(round trip)<\/div>|Check price', html)
	print(str(res))

def scrapeForDate(date):
	Scraper.scrapeFlights('./data/predictions&%s' % date, 'script', save=True, check_existing=False, screenshots=True)

# deleteTodaysFiles()

scrapeForDate('2017-03-25')

# tryRegex()