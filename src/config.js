const persistence = require('./utils/persistence')
const config = require('./config.json')
const logger = require('./utils/logger.js')("config")
const init = () => {
    if (config.snapshot) {
        logger.log("persistence mode:'Snapshot'")
        // Loading the snapshot
        persistence.loadSnapshotSync()
        setInterval(async () => {
            await persistence.saveSnapshot();
        }, config.snapshotInterval || 5000);
    } else if (config.appendonly) {
        logger.log("persistence mode: 'Append-Only'")
        persistence.replayAofSync(executeCommand)
    } else {
        logger.log("persistence mode:'in-memory'")
    }
}

module.exports = { init }