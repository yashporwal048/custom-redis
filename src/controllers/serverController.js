const net = require('net');
const { parseCommand, executeCommand } = require('../models/commandModel.js');
const logger = require('../utils/logger.js')("server");

const startServer = (port, host) => {
    const server = net.createServer((socket) => {
        logger.log('Client connected');

        socket.on("data", async (data) => {
            let response;
            try {
                const { command, args } = parseCommand(data);
                response = await executeCommand(command, args);
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
    server.listen(port, host, () => {
        logger.log(`Server running at http://${host}:${port}/`);
    });
}
module.exports = { startServer }