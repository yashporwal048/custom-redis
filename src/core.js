// const logger = require("./utils/logger.js")("core");

// const persistence = require("./utils/persistence.js");
// const { store, expirationTimes } = require("./utils/persistence.js");
// const config = require("./config.json")

// const commandHandlers = {
//     SET: (args) => {
//         if (args.length < 2) {
//             return "-ERR wrong number of arguments for 'set' command\r\n";
//         }
//         const [key, value] = args;
//         store[key] = { type: "string", value };
//         return "+OK\r\n";
//     },
//     GET: (args) => {
//         if (args.length < 1) {
//             return "-ERR wrong number of arguments for 'get' command\r\n";
//         }
//         const [key] = args
//         if (checkExpiration(key) || !store[key] || store[key].type !== "string") {
//             return "$-1\r\n";
//         }
//         const value = store[key].value;
//         return `$${value.length}\r\n${value}\r\n`;
//         ;
//     },
//     DEL: (args) => {
//         if (args.length < 1) {
//             return "-ERR wrong number of arguments for 'del' command\r\n";
//         }
//         const [key] = args
//         if (checkExpiration(key) || !store[key]) {
//             return ":0\r\n";
//         }
//         delete store[key];
//         delete expirationTimes[key];
//         return ":1\r\n";
//     },
//     EXPIRE: (args) => {
//         if (args.length < 2) {
//             return "-ERR wrong number of arguments for 'expire' command\r\n";
//         }
//         const [key, seconds] = args;
//         if (checkExpiration(key) || !store[key]) {
//             return ":0\r\n";
//         }
//         const expirationTime = Date.now() + parseInt(seconds) * 1000;
//         expirationTimes[key] = expirationTime;
//         return ":1\r\n";
//     },
//     TTL: (args) => {
//         if (args.length < 1) {
//             return "-ERR wrong number of arguments for 'ttl' command\r\n";
//         }
//         const [key] = args;
//         if (!store[key]) return ":-2\r\n";
//         if (!expirationTimes[key]) return ":-1\r\n";

//         const ttl = Math.floor((expirationTimes[key] - Date.now()) / 1000);
//         return ttl > 0 ? `:${ttl}\r\n` : ":-2\r\n";
//     },
//     INCR: (args) => {
//         if (args.length < 1) {
//             return "-ERR wrong number of arguments for 'ttl' command\r\n";
//         }
//         const [key] = args;
//         if (!store[key]) {
//             store[key] = { type: "string", value: "1" }
//             return ":1\r\n";
//         };
//         const value = parseInt(store[key].value, 10)
//         if (isNaN(value)) return "-ERR value is not an integer or out of range\r\n";
//         store[key].value = (value + 1).toString();
//         return `:${value + 1}\r\n`;

//     },
//     DECR: (args) => {
//         if (args.length < 1) return "-ERR wrong number of arguments for 'decr' command\r\n";
//         const [key] = args;
//         if (!store[key]) {
//             store[key] = { type: "string", value: "-1" }
//         }
//         const value = parseInt(store[key].value, 10)
//         if (isNaN(value)) return "-ERR value is not an integer or out of range\r\n";
//         store[key].value = (value - 1).toString()
//         return `:${value - 1}\r\n`
//     },
//     LPUSH: (args) => {
//         if (args.length < 2) return "-ERR wrong number of arguments for 'lpush' command\r\n"
//         const [key, ...values] = args;
//         if (!store[key]) {
//             store[key] = { type: "list", value: [] };
//         }
//         if (store[key].type !== 'list') {
//             return "-ERR Operation against a key holding the wrong kind of value\r\n"
//         }
//         store[key].value.unshift(...values);
//         return `:${store[key].value.length}\r\n`

//     },
//     RPUSH: (args) => {
//         if (args.length < 2) return "-ERR wrong number of arguments for 'lpush' command\r\n"
//         const [key, ...values] = args;
//         if (!store[key]) {
//             store[key] = { type: "list", value: [] };
//         }
//         if (store[key].type !== 'list') {
//             return "-ERR Operation against a key holding the wrong kind of value\r\n"
//         }
//         store[key].value.push(...values);
//         return `:${store[key].value.length}\r\n`

//     },
//     LPOP: (args) => {
//         if (args.length < 1) return "-ERR wrong number of arguments for 'lpop' command\r\n";
//         const [key] = args;
//         if (!store[key] || checkExpiration(key) || store[key].type !== "list" || store[key].value.length === 0) return "$-1\r\n"
//         const value = store[key].value.shift();
//         return `$${value.length}\r\n${value}\r\n`;
//     },
//     RPOP: (args) => {
//         if (args.length < 1) return "-ERR wrong number of arguments for 'lpop' command\r\n";
//         const [key] = args;
//         if (!store[key] || checkExpiration(key) || store[key].type !== "list" || store[key].value.length === 0) return "$-1\r\n"
//         const value = store[key].value.pop();
//         return `$${value.length}\r\n${value}\r\n`;
//     },
//     LRANGE: (args) => {
//         if (args.length < 3) return "-ERR wrong number of arguments for 'lpush' command\r\n"
//         const [key, start, stop] = args;
//         if (checkExpiration(key) || !store[key] || store[key].type !== "list") return "$-1\r\n"
//         const list = store[key].value;
//         const startIndex = parseInt(start, 10);
//         const endIndex = parseInt(stop, 10);
//         const range = list.slice(startIndex, endIndex + 1);

//         let response = `*${range.length}\r\n`;
//         range.forEach((value) => {
//             response += `$${value.length}\r\n${value}\r\n`;
//         });
//         return response;
//     },
//     COMMAND: () => "+OK\r\n"
// }

// const executeCommand = (command, args, replayingFromAof = false) => {
//     logger.log(`Received ${command} with args: ${args} ${replayingFromAof ? "replaying from AOF" : ""}`);
//     const handler = commandHandlers[command];
//     if (!handler) {
//         return "-ERR unknown command\r\n";
//     }
//     const result = handler(args);
//     if (config.appendonly && !replayingFromAof && config.aofCommands.includes(command)) {
//         persistence.appendAof(command, args).then(() => { }).catch(logger.error)
//     }
//     return result
// }

// const parseCommand = (data) => {
//     const lines = data.
//         toString()
//         ?.split("\r\n")
//         .filter((line) => !!line)
//     logger.log(lines)
//     const command = lines[2].toUpperCase();
//     // Every second line is an argument, starting from the 4th line
//     const args = lines.slice(4).filter((_, index) => index % 2 === 0);
//     logger.log(lines + "\n" + command);
//     logger.log(args);
//     return { command, args }
// }


// module.exports = { parseCommand, executeCommand }