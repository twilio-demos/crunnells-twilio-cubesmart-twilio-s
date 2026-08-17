const fs = require('fs');
const p = '/home/project/server/node_modules/twilio/lib/rest/taskrouter/v1/workspace/task.d.ts';
const src = fs.readFileSync(p, 'utf8');
const i = src.indexOf('interface TaskListInstancePageOptions');
const j = src.indexOf('interface TaskListInstanceOptions');
console.log(src.slice(Math.min(i, j) - 2200, Math.min(i, j) + 200));
