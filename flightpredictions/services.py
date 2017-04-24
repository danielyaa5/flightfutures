import requests
import json

BASE_URL = 'https://mobile-api.hopper.com'


class Endpoints:
    PREDICTION = BASE_URL + '/api/v2/prediction'


class Services:

    def __init__(self, hKey):
        self.headers = {'H-Request': hKey, 'Content-Type': 'application/json'}

    def pricePrediction(self, req_args):
        payload = {
            'alertKey': {
                'filter': {
                    'TripFilter': 'NoFilter'
                },
                'grouping': {
                    'route': {
                        'destination': {
                            'regionType': 'airport'
                        },
                        'origin': {
                            'regionType': 'airport'
                        }
                    },
                    'TripGrouping': 'DateGrouping'
                }
            },
            'isOnboarding': False,
            'autoWatch': False
        }

        payload['alertKey']['grouping']['departureDate'] = req_args['depart']
        payload['alertKey']['grouping']['route']['destination']['code'] = req_args['dest']
        payload['alertKey']['grouping']['route']['origin']['code'] = req_args['orig']

        if 'return' in req_args:
            payload['alertKey']['grouping']['returnDate'] = req_args['return']

        if 'filter' in req_args:
            payload['alertKey']['filter'] = req_args['filter']
        url = Endpoints.PREDICTION

        return requests.post(url, json=payload, headers=self.headers)
