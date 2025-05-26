const net = require('net');
const { startServer } = require('./controllers/serverController.js')
const { init } = require('./config.js')

const port = process.env.PORT || 6379;
const host = process.env.HOST || '127.0.0.1';

startServer(port, host)
init();

