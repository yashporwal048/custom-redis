const fs = require('fs');
const fsp = fs.promises;
const path = require("path");

const logger = require("./logger.js")("persistence");
const config = require("../config.json")

class Persistence {
    DATA_FILE = path.join('src/snapshots/', "data.rdb");
    //for testing purposes, use better directories
    AOF_FILE = path.join('src/snapshots/', "data.aof")
    constructor() {
        this.store = {}
        this.expirationTimes = {} 
        this.keyAccessLogs = {};
    }

    async saveSnapshot() {
        const data = JSON.stringify({
            store: this.store,
            expirationTime: this.expirationTimes,
            keyAccessLogs: this.keyAccessLogs
        })
        try {
            await fsp.writeFile(this.DATA_FILE, data);
            logger.log(`Saved datastore to ${this.DATA_FILE}`);
        } catch (error) {
            logger.error(`Error saving snapshot: ${error.message}`);

        }
    }
    // Is not an async function because whenever server reconnects the data should be loaded fully first.
    loadSnapshotSync() {
        if (!fs.existsSync(this.DATA_FILE)) {
            logger.warn(`No snapshot found at ${this.DATA_FILE}`);
            return;
        }
        try {
            const data = fs.readFileSync(this.DATA_FILE).toString();
            if (data) {
                const { store: loadedStore, expirationTime: loadedExpirationTimes, keyAccessLogs: loadedKeyAccessLogs} = JSON.parse(data);
                Object.assign(this.store, loadedStore);
                Object.assign(this.expirationTimes, loadedExpirationTimes);
                Object.assign(this.keyAccessLogs, loadedKeyAccessLogs);
                logger.log(`Loaded datastore from ${this.DATA_FILE}`);
            }
        } catch (error) {
            logger.error(`Error loading snapshot: ${error.message}`);
        }
    }

    async appendAof(command, args) {
        let aofLog = `${command} ${args.join(" ")}\r\n`;
        try {
            await fsp.appendFile(this.AOF_FILE, aofLog);
            logger.info(`Appended command to AOF: ${aofLog}`);
        } catch (error) {
            logger.error(`Error appending to AOF: ${error.message}`);
        }
    }

    replayAofSync(executeCommand) {
        if (!config.appendonly || !fs.existsSync(this.AOF_FILE)) return;
        try {
            const data = fs.readFileSync(this.AOF_FILE).toString();
            if(!data) return;
            const logs = data.split('\r\n').filter(Boolean)
            logger.info("Replay AOF Started");

            for(const logEntry of logs){
                const [command, ...args] = logEntry.split(" ");
                executeCommand(command, args, true)

            }
        } catch(error){
            logger.error(`Error replaying AOF: ${error.message}`);
        }
    }
}
module.exports = new Persistence();