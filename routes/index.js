'use strict';
var express = require('express');
var router = express.Router();

router.get('/', function(req, res) {
    res.send({
        status: 200,
        message: "Hello world"
    })
});

module.exports = router;