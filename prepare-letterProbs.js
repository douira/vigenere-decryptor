const fs = require("fs");
fs.readFile("letterProbs-raw.json", (err, data) => {
  if (err) {
    throw err;
  }
  data = JSON.parse(data.toString());
  const arr = [];
  for (const prop in data) {
    const val = data[prop];
    arr.push({
      name: prop,
      val: val
    });
  }
  const sum = arr.reduce((acc, obj) => acc + obj.val, 0);
  arr.forEach((obj) => {
    obj.val = obj.val / sum;
  });
  arr.sort((a, b) => {
    return a.name.localeCompare(b.name);
  });
  const out = {};
  arr.forEach((obj) => {
    out[obj.name] = obj.val;
  });
  fs.writeFile("letterProbs.json", JSON.stringify(out, null, 2), (err) => {
    if (err) {
      throw err;
    }
    console.log("Success!");
  });
});
