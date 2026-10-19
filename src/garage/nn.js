// A tiny neural network, written out by hand for the wheel's LAB mode: two inputs → one hidden
// layer (tanh) → one output (sigmoid), trained with full-batch gradient descent with momentum on
// binary cross-entropy. Small enough to read in one sitting; pure, so it runs in Node too.
//   createNet(hidden, seed)       weights from a seeded random, so a reset is repeatable
//   predict(net, x)               P(class 1) for one input [a, b]
//   train(net, X, Y, lr, steps)   that many gradient steps; returns the loss after the last one
//   loss(net, X, Y)               mean binary cross-entropy
export function createNet(hidden = 4, seed = 1) {
  const rand = mulberry(seed);
  const g = () => (rand() * 2 - 1) * Math.sqrt(1 / 2); // inputs are scaled to about ±1
  return {
    hidden,
    w1: Array.from({ length: hidden }, () => [g(), g()]), // hidden × 2
    b1: Array.from({ length: hidden }, () => 0),
    w2: Array.from({ length: hidden }, () => (rand() * 2 - 1) * Math.sqrt(1 / hidden)),
    b2: 0,
    v: null, // momentum, made on the first step
    steps: 0,
  };
}

const sigmoid = (z) => 1 / (1 + Math.exp(-z));

function forward(net, x) {
  const h = net.w1.map((w, j) => Math.tanh(w[0] * x[0] + w[1] * x[1] + net.b1[j]));
  const z = h.reduce((a, hj, j) => a + hj * net.w2[j], net.b2);
  return { h, p: sigmoid(z) };
}
export const predict = (net, x) => forward(net, x).p;

export function loss(net, X, Y) {
  let sum = 0;
  for (let i = 0; i < X.length; i++) {
    const p = Math.min(1 - 1e-7, Math.max(1e-7, predict(net, X[i])));
    sum += Y[i] ? -Math.log(p) : -Math.log(1 - p);
  }
  return sum / Math.max(1, X.length);
}

export function train(net, X, Y, lr = 0.1, steps = 1, momentum = 0.9) {
  const H = net.hidden;
  const n = Math.max(1, X.length);
  if (!net.v) net.v = { w1: net.w1.map(() => [0, 0]), b1: new Array(H).fill(0), w2: new Array(H).fill(0), b2: 0 };
  const v = net.v;
  for (let s = 0; s < steps; s++) {
    const gw1 = net.w1.map(() => [0, 0]);
    const gb1 = new Array(H).fill(0);
    const gw2 = new Array(H).fill(0);
    let gb2 = 0;
    for (let i = 0; i < X.length; i++) {
      const x = X[i];
      const { h, p } = forward(net, x);
      const dz = p - Y[i]; // d(BCE)/dz for a sigmoid output
      gb2 += dz;
      for (let j = 0; j < H; j++) {
        gw2[j] += dz * h[j];
        const dh = dz * net.w2[j] * (1 - h[j] * h[j]); // back through tanh
        gb1[j] += dh;
        gw1[j][0] += dh * x[0];
        gw1[j][1] += dh * x[1];
      }
    }
    // momentum step (gradients averaged over the batch)
    v.b2 = momentum * v.b2 - (lr * gb2) / n;
    net.b2 += v.b2;
    for (let j = 0; j < H; j++) {
      v.w2[j] = momentum * v.w2[j] - (lr * gw2[j]) / n;
      net.w2[j] += v.w2[j];
      v.b1[j] = momentum * v.b1[j] - (lr * gb1[j]) / n;
      net.b1[j] += v.b1[j];
      for (let k = 0; k < 2; k++) {
        v.w1[j][k] = momentum * v.w1[j][k] - (lr * gw1[j][k]) / n;
        net.w1[j][k] += v.w1[j][k];
      }
    }
    net.steps += 1;
  }
  return loss(net, X, Y);
}

// a small seeded random (mulberry32)
function mulberry(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
