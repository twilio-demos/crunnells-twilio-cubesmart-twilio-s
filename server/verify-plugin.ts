import { writeFileSync } from "node:fs";
import { FLEX_PLUGIN_BUNDLE, FLEX_PLUGIN_PATH } from "./src/flex-plugin/bundle.js";

writeFileSync("/tmp/emerald-flex-plugin.js", FLEX_PLUGIN_BUNDLE);
console.log("wrote", FLEX_PLUGIN_BUNDLE.length, "bytes for", FLEX_PLUGIN_PATH);
