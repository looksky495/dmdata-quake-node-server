import util from "node:util";

export function parseArgs(args){
  return util.parseArgs({
    args,
    options: {
      "init": {
        type: "boolean",
        short: "i"
      },
      "help": {
        type: "boolean",
        short: "h"
      },
      "version": {
        type: "boolean",
        short: "v"
      },
      "port": {
        type: "string",
        short: "p",
        default: "80"
      },
      "dbhost": {
        type: "string",
        short: "d",
        default: "localhost:27017"
      }
    }
  });
}

export function printHelp(){
  console.log(`Usage: node index.js [options]

Options:
  -i, --init      Initialize the received data directory
  -h, --help      Show this help message
  -v, --version   Show version information
  -p, --port      Port to run the server on (default: 80)
  -d, --dbhost    MongoDB host (default: localhost:27017)`);
}

export async function printVersion(){
  const fs = await import("node:fs");
  const path = await import("node:path");

  const packageJson = fs.readFileSync(path.join(import.meta.dirname, "package.json"), "utf-8");
  const { version } = JSON.parse(packageJson);
  console.log(`v${version}`);
}
