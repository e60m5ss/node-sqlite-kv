<h1 align="center">node-sqlite-kv</h1>

> Key-value store with node:sqlite

## Installation

```bash
npm install node-sqlite-kv
# or
yarn add node-sqlite-kv
# or
pnpm add node-sqlite-kv
# or
bun add node-sqlite-kv
```

## Example

```js
import { KVSync } from "node-sqlite-kv";

// use :memory: for in-memory storage
// path is optional, defaults to :memory:
const kv = new KVSync("./data.sqlite");

// set values
kv.set("number", 123);
kv.set("string", "hello world");
kv.set("boolean", true);
kv.set("null", null);
kv.set("array", [1, 2, 3]);
kv.set("object", { settings: { theme: "dark" } });
kv.set("date", new Date());

// get values
kv.get("number"); // 123
kv.get("string"); // "hello world"
kv.get("boolean"); // true
kv.get("null"); // null
kv.get("array"); // [1, 2, 3]
kv.get("object"); // { settings: { theme: "dark" } }
kv.get("date"); // Date

// update values
kv.set("number", 999);
kv.get("number"); // 999

// delete values
kv.delete("array"); // [1, 2, 3]
kv.get("array"); // null

// list all entries
kv.all();
// [
//      { key: "string", value: "hello world" },
//      { key: "number", value: 999 },
//      { key: "boolean", value: true },
//      // ...
// ];

// delete all entries
kv.clear();
```

## Contributing

Pull requests are always welcomed. For more major changes, please open an issue to discuss what you wish to change.

## License

[MIT](LICENSE)
