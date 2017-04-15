const express = require('express');
const router = express.Router();

/* GET users listing. */
router.get('/:depart_location/:depart_date/:test_value', (req, res, next) => {
    const test_value = req.param('test_value');
    if (test_value) return res.json({ price: Number(test_value) });
});

module.exports = router;
