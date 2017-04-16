'use strict';

const _ = require('lodash');
const express = require('express');
const router = express.Router();

/* GET users listing. */
router.get('/test/:depart_location/:depart_date/:test_value', (req, res, next) => {
    const test_value = req.param('test_value');
    if (test_value) return res.json({ price: Number(test_value) });
    return res.status(500);
});

router.get('/test/random/inclusive/:min/:max', (req, res, next) => {
   const min = Number(req.param('min'));
   const max = Number(req.param('max'));

   if (isNaN(min) || isNaN(max)) return res.status(500);

   const value = _.random(min, max);

   return res.json({ value });
});

module.exports = router;
