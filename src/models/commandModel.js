const logger = require('../utils/logger')('commandModel');
const { store, expirationTimes } = require("../utils/persistence.js");
let { keyAccessLogs } = require("../utils/persistence.js");
const config = require('../config.json');
const { OpenAIEmbeddings } = require('@langchain/openai');
const { trackAndRetrain, predictTTL } = require('../utils/trainModel.js');
require('dotenv').config();

let pipeline;
(async () => {
    const transformers = await import('@xenova/transformers');
    pipeline = transformers.pipeline;
})();

async function initializeEmbedder() {
    if (!pipeline) {
        const transformers = await import('@xenova/transformers');
        pipeline = transformers.pipeline;
    }
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
}
initializeEmbedder();
const isExpired = (key) => expirationTimes[key] && expirationTimes[key] < Date.now();


//Cosine similarity measures how close two vectors are.
function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] ** 2;
        normB += vecB[i] ** 2;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

const checkExpiration = (key) => {
    if (isExpired(key)) {
        delete store[key];
        delete expirationTimes[key];
        return true;
    }
    return false;
}

const commandHandlers = {
    SET: async (args) => {
        if (args.length < 2) {
            return "-ERR wrong number of arguments for 'set' command\r\n";
        }
        const [key, value] = args;
        // Traditionally, Redis stores the value as a string
        // store[key] = { type: "string", value };
        //If using open AI
        // const embedder = new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY });
        // const embedding = await embedder.embedQuery(String(key));


        //Free cost xenova embedding
        const embedding = await embedder(key, { pooling: 'mean', normalize: true });
        store[key] = { type: "string", value, embedding: embedding.tolist()[0] } //convert tensorflow to array
        return "+OK\r\n";
    },
    SEMGET: async (args) => {
        if (args.length < 1) {
            return "-ERR wrong number of arguments for 'semget' command\r\n";
        }
        const [query] = args
        //Open AI Embedding
        // const embedder = new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY });
        // const embedding = await embedder.embedQuery(query);

        const queryEmbedding = await embedder(query, { pooling: 'mean', normalize: true });
        const queryVector = queryEmbedding.tolist()[0]; // Convert to array
        let closestKey;
        const similarityThreshold = 0.5; // Set a threshold for similarity
        let maxSimilarity = -Infinity;
        //finding most similar key
        for (const key in store) {
            if (store[key].type !== "string" || checkExpiration(key)) continue
            const keyEmbedding = store[key].embedding;

            // const similarity = cosineSimilarity(embedding, keyEmbedding);

            const similarity = cosineSimilarity(queryVector, keyEmbedding);
            if (similarity > maxSimilarity) {
                maxSimilarity = similarity;
                closestKey = key;
            }
        }
        if ((!closestKey) || maxSimilarity < similarityThreshold) return '$-1\r\n';

        const value = store[closestKey].value;
        keyAccessLogs[closestKey] = keyAccessLogs[closestKey] || [];
        keyAccessLogs[closestKey].push(Date.now());
        trackAndRetrain()
        return `$${value.length}\r\n${value}\r\n`;
    },
    // traditional GET
    GET: (args) => {
        if (args.length < 1) {
            return "-ERR wrong number of arguments for 'get' command\r\n";
        }
        const [key] = args
        if (checkExpiration(key) || !store[key] || store[key].type !== "string") {
            return "$-1\r\n";
        }
        const value = store[key].value;
        keyAccessLogs[key] = keyAccessLogs[key] || [];
        keyAccessLogs[key].push(Date.now())
        trackAndRetrain()
        return `$${value.length}\r\n${value}\r\n`;
        ;
    },
    DEL: (args) => {
        if (args.length < 1) {
            return "-ERR wrong number of arguments for 'del' command\r\n";
        }
        const [key] = args
        if (checkExpiration(key) || !store[key]) {
            return ":0\r\n";
        }
        delete store[key];
        delete expirationTimes[key];
        return ":1\r\n";
    },
    EXPIRE: async (args) => {
        if (args.length < 2) {
            return "-ERR wrong number of arguments for 'expire' command\r\n";
        }
        const [key, seconds] = args;
        if (checkExpiration(key) || !store[key]) {
            return ":0\r\n";
        }
        if (seconds.toUpperCase() === "AI") {
            const accesses = keyAccessLogs[key] || [];
            if (accesses.length < 2) {
                return "-ERR Not enough data for AI prediction\r\n";
            }
            // Calculate avg interval in hours
            const timeDiffs = [];
            for (let i = 0; i < accesses.length - 1; i++) {
                timeDiffs.push((accesses[i + 1] - accesses[i]) / (1000 * 60 * 60));
            }
            const avgDiff = timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length;
            const predictedTTL = await predictTTL(avgDiff);
            const ttlSeconds = Math.round(predictedTTL * 60 * 60);
            // ... set expiration as usual ...
            expirationTimes[key] = Date.now() + ttlSeconds * 1000;
            return `:${ttlSeconds}\r\n`;
        }
        const expirationTime = Date.now() + parseInt(seconds) * 1000;
        expirationTimes[key] = expirationTime;
        return ":1\r\n";
    },
    TTL: (args) => {
        if (args.length < 1) {
            return "-ERR wrong number of arguments for 'ttl' command\r\n";
        }
        const [key] = args;
        if (!store[key]) return ":-2\r\n";
        if (!expirationTimes[key]) return ":-1\r\n";

        const ttl = Math.floor((expirationTimes[key] - Date.now()) / 1000);
        return ttl > 0 ? `:${ttl}\r\n` : ":-2\r\n";
    },
    INCR: (args) => {
        if (args.length < 1) {
            return "-ERR wrong number of arguments for 'ttl' command\r\n";
        }
        const [key] = args;
        if (!store[key]) {
            store[key] = { type: "string", value: "1" }
            return ":1\r\n";
        };
        const value = parseInt(store[key].value, 10)
        if (isNaN(value)) return "-ERR value is not an integer or out of range\r\n";
        store[key].value = (value + 1).toString();
        return `:${value + 1}\r\n`;

    },
    DECR: (args) => {
        if (args.length < 1) return "-ERR wrong number of arguments for 'decr' command\r\n";
        const [key] = args;
        if (!store[key]) {
            store[key] = { type: "string", value: "-1" }
        }
        const value = parseInt(store[key].value, 10)
        if (isNaN(value)) return "-ERR value is not an integer or out of range\r\n";
        store[key].value = (value - 1).toString()
        return `:${value - 1}\r\n`
    },
    LPUSH: (args) => {
        if (args.length < 2) return "-ERR wrong number of arguments for 'lpush' command\r\n"
        const [key, ...values] = args;
        if (!store[key]) {
            store[key] = { type: "list", value: [] };
        }
        if (store[key].type !== 'list') {
            return "-ERR Operation against a key holding the wrong kind of value\r\n"
        }
        store[key].value.unshift(...values);
        return `:${store[key].value.length}\r\n`

    },
    RPUSH: (args) => {
        if (args.length < 2) return "-ERR wrong number of arguments for 'lpush' command\r\n"
        const [key, ...values] = args;
        if (!store[key]) {
            store[key] = { type: "list", value: [] };
        }
        if (store[key].type !== 'list') {
            return "-ERR Operation against a key holding the wrong kind of value\r\n"
        }
        store[key].value.push(...values);
        return `:${store[key].value.length}\r\n`

    },
    LPOP: (args) => {
        if (args.length < 1) return "-ERR wrong number of arguments for 'lpop' command\r\n";
        const [key] = args;
        if (!store[key] || checkExpiration(key) || store[key].type !== "list" || store[key].value.length === 0) return "$-1\r\n"
        const value = store[key].value.shift();
        return `$${value.length}\r\n${value}\r\n`;
    },
    RPOP: (args) => {
        if (args.length < 1) return "-ERR wrong number of arguments for 'lpop' command\r\n";
        const [key] = args;
        if (!store[key] || checkExpiration(key) || store[key].type !== "list" || store[key].value.length === 0) return "$-1\r\n"
        const value = store[key].value.pop();
        return `$${value.length}\r\n${value}\r\n`;
    },
    LRANGE: (args) => {
        if (args.length < 3) return "-ERR wrong number of arguments for 'lpush' command\r\n"
        const [key, start, stop] = args;
        if (checkExpiration(key) || !store[key] || store[key].type !== "list") return "$-1\r\n"
        const list = store[key].value;
        const startIndex = parseInt(start, 10);
        const endIndex = parseInt(stop, 10);
        const range = list.slice(startIndex, endIndex + 1);

        let response = `*${range.length}\r\n`;
        range.forEach((value) => {
            response += `$${value.length}\r\n${value}\r\n`;
        });
        return response;
    },
    COMMAND: () => "+OK\r\n"
}

const executeCommand = async (command, args, replayingFromAof = false) => {
    logger.log(`Received ${command} with args: ${args} ${replayingFromAof ? "replaying from AOF" : ""}`);
    const handler = commandHandlers[command];
    if (!handler) {
        return "-ERR unknown command\r\n";
    }
    const result = await handler(args);
    if (config.appendonly && !replayingFromAof && config.aofCommands.includes(command)) {
        persistence.appendAof(command, args).then(() => { }).catch(logger.error)
    }
    return result
}

const parseCommand = (data) => {
    const lines = data.
        toString()
        ?.split("\r\n")
        .filter((line) => !!line)
    logger.log(lines)
    const command = lines[2].toUpperCase();
    // Every second line is an argument, starting from the 4th line
    const args = lines.slice(4).filter((_, index) => index % 2 === 0);
    logger.log(lines + "\n" + command);
    logger.log(args);
    return { command, args }
}


module.exports = { commandHandlers, parseCommand, executeCommand }