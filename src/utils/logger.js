require('dotenv').config()
const debugNameSpaces = (process.env.DEBUG ||'*').split(',').map((ns) =>ns.trim())
const logger = (namespace) => {
    const log = (mode, message) => {

        const logMessage = `${new Date().toISOString()}  ${mode} ${namespace} - ${message}`;

        if(mode === "error"){
            console[mode](logMessage);
            return
        }
        if(debugNameSpaces.includes("*") || debugNameSpaces.includes(namespace)) {
             //to do console.log, console.error, console.warn, console.debug based on the mode
            console[mode](logMessage);
        } 
    }

    return {
        log: (message) => log("log", message),
        error: (message) => log("error", message),
        info: (message) => log("info", message),
        warn: (message) => log("warn", message)
    }
};

module.exports = logger;