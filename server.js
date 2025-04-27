const net = require('net');
const { parseCommand, executeCommand } = require('./core.js');
const logger = require('./logger.js')("server");

const server = net.createServer((socket) => {
    logger.log('Client connected');

    socket.on("data", (data) => {
        let response;
        try {
            const { command, args } = parseCommand(data);
            response = executeCommand(command, args);
        } catch (error) {
            logger.error(error);
            response = "-ERR unknown command\r\n";
        }
        socket.write(response);
    });

    socket.on("end", () => {
        logger.log("Client disconnected");
    });

    socket.on('error', (err) => {
        logger.log(`Server error: ${err.message}`);
    });
});

const port = process.env.PORT || 6379;
const host = process.env.HOST || '127.0.0.1';

server.listen(port, host, () => {
    logger.log(`Server running at http://${host}:${port}/`);
});
