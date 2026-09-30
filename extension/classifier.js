(function (scope) {
  "use strict";
  const WORD = /[\p{L}\p{N}_]/u;

  function tokenize(text) {
    const unigrams = String(text ?? "").toLowerCase().split(/\s+/u).map((chunk) => {
      let start = 0;
      let end = chunk.length;
      while (start < end && !WORD.test(chunk[start])) start += 1;
      while (end > start && !WORD.test(chunk[end - 1])) end -= 1;
      return chunk.slice(start, end);
    }).filter(Boolean);
    const tokens = [...unigrams];
    for (let index = 0; index + 1 < unigrams.length; index += 1) {
      tokens.push(`${unigrams[index]} ${unigrams[index + 1]}`);
    }
    return tokens;
  }

  function createClassifier(model) {
    if (!model || model.format !== "tfidf-linear-svm-v1") throw new Error("Mô hình XSS không hợp lệ.");
    const featureIndex = new Map(model.features.map((term, index) => [term, index]));
    function classify(text) {
      const counts = new Map();
      for (const token of tokenize(text)) {
        const index = featureIndex.get(token);
        if (index !== undefined) counts.set(index, (counts.get(index) || 0) + 1);
      }
      let squaredNorm = 0;
      const values = [];
      for (const [index, count] of counts) {
        const value = count * model.idf[index];
        values.push([index, value]);
        squaredNorm += value * value;
      }
      const norm = Math.sqrt(squaredNorm) || 1;
      let margin = model.intercept;
      for (const [index, value] of values) margin += (value / norm) * model.coef[index];
      return {
        label: margin >= 0 ? model.classes[1] : model.classes[0],
        margin,
        risk: 1 / (1 + Math.exp(-margin)),
        matchedFeatures: values.length
      };
    }
    return { classify, tokenize };
  }
  scope.XSSClassifier = { createClassifier, tokenize };
})(typeof self !== "undefined" ? self : globalThis);
