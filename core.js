const logger = require("./logger.js")("core");

const store = {} //storing the KV
const expirationTimes = {}

const isExpired = (key) => expirationTimes[key] && expirationTimes[key] < Date.now();

const checkExpiration = (key) => {
    if(isExpired(key)) {
        delete store[key];
        delete expirationTimes[key];
        return true;
    }
    return false;
}

const commandHandlers = {
    SET :(args) => {
        if(args.length < 2){
            return "-ERR wrong number of arguments for 'set' command\r\n";
        }
        const [key, value] = args;
        store[key] = {type: "string", value};
        return "+OK\r\n";
    },
    GET:(args) => {
        if(args.length < 1){
            return "-ERR wrong number of arguments for 'get' command\r\n";
        }
        const [key] = args
        if(checkExpiration(key) || !store[key] || store[key].type !== "string"){
            return "$-1\r\n";
        }
        const value = store[key].value;
        return `$${value.length}\r\n${value}\r\n`;
;    },
    DEL:(args) => {
        if(args.length < 1){
            return "-ERR wrong number of arguments for 'del' command\r\n";
        }
        const [key] = args
        if(checkExpiration(key) || !store[key]){
            return ":0\r\n";
        }
        delete store[key];
        delete expirationTimes[key];
        return ":1\r\n";
    },
    EXPIRE:(args) => {
        if(args.length < 2){
            return "-ERR wrong number of arguments for 'expire' command\r\n";
        }
        const [key, seconds] = args;
        if(checkExpiration(key) || !store[key]){
            return ":0\r\n";
        }
        const expirationTime = Date.now() + parseInt(seconds) * 1000;
        expirationTimes[key] = expirationTime;
        return ":1\r\n";
    },
    COMMAND: () => "+OK\r\n",
}

const executeCommand = (command, args) => {
    logger.log(`Received ${command} with args: ${args}`);
    const handler = commandHandlers[command];
    if(!handler){
        return "-ERR unknown command\r\n";
    }
    return handler(args);
}

const parseCommand = (data) => {
    const lines = data.
        toString()
        ?.split("\r\n")
        .filter((line) => !!line)
    logger.log(lines)
    const command = lines[2].toUpperCase();
    const args = lines.slice(4).filter((_, index) => index % 2 === 0);
    logger.log(lines + "\n" + command);
    logger.log(args);
    return { command, args }
}
module.exports = { parseCommand, executeCommand }