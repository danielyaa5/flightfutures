'use strict';

const _ = require('lodash');
const express = require('express');
const router = express.Router();

router.get('/flight/:info', (req, res, next) => {
    res.send('500');
});

router.get('/test/:depart_location/:depart_date/:test_value', (req, res, next) => {
    const test_value = req.param('test_value');
    if (test_value) return res.json({ price: Number(test_value) });
    return res.status(500);
});

// get a random [min, max]
router.get('/test/price/random/:min/:max', (req, res, next) => {
   const min = Number(req.params.min);
   const max = Number(req.params.max);

   if (isNaN(min) || isNaN(max)) return res.status(500);

   const price = _.random(min, max);

   console.log('Price', price);

   return res.send(price.toString());
});

module.exports = router;
