const tf = require('@tensorflow/tfjs');
const { keyAccessLogs } = require('./persistence');

let model;

// Train the model
async function trainTTModel() {
    const trainingData = [];
    for (const key in keyAccessLogs) {
        const accesses = keyAccessLogs[key];
        if (accesses.length < 2) continue;

        const timeDiffs = [];
        for (let i = 0; i < accesses.length - 1; i++) {
            const diff = (accesses[i + 1] - accesses[i]) / (1000 * 60 * 60); // hours
            timeDiffs.push(diff);
        }
        const avgDiff = timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length;
        trainingData.push({
            input: avgDiff,
            output: avgDiff * 2 // Your logic: TTL = 2x avg interval
        });
    }

    if (trainingData.length > 0) {
        // Prepare tensors
        const xs = tf.tensor2d(trainingData.map(d => [d.input]));
        const ys = tf.tensor2d(trainingData.map(d => [d.output]));

        // Define or reuse model
        if (!model) {
            model = tf.sequential();
            model.add(tf.layers.dense({ units: 8, activation: 'relu', inputShape: [1] }));
            model.add(tf.layers.dense({ units: 1 }));
            model.compile({ optimizer: 'adam', loss: 'meanSquaredError' });
        }

        // Train the model
        await model.fit(xs, ys, {
            epochs: 50,
            batchSize: 8,
            shuffle: true,
            verbose: 0
        });

        xs.dispose();
        ys.dispose();
    }
}

// Use this to predict TTL (in hours) for a given avgDiff
async function predictTTL(avgDiff) {
    if (!model) {
        // Fallback: simple rule if model is not trained yet
        return avgDiff * 2;
    }
    const input = tf.tensor2d([[avgDiff]]);
    const output = model.predict(input);
    const ttl = (await output.data())[0];
    input.dispose();
    output.dispose();
    return ttl;
}

// Track accesses and retrain periodically
let accessCount = 0;
function trackAndRetrain() {
    accessCount++;
    if (accessCount % 100 === 0) {
        trainTTModel();
    }
}

module.exports = { trackAndRetrain, predictTTL };
