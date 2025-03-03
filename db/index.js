const { program } = require("commander");
const path = require("path");
const { spawn } = require("child_process");

program.name("jisho").description("Japanese Dictionary Tool").version("1.0.0");

program
  .command("compress")
  .description("Compress the SQLite database")
  .action(() => {
    console.log("Starting compression...");
    spawn("node", [path.join(__dirname, "src", "services", "compress.js")], {
      stdio: "inherit",
    });
  });

program
  .command("migrate")
  .description("Migrate dictionary data to SQLite database")
  .action(() => {
    console.log("Starting migration...");
    spawn(
      "node",
      [path.join(__dirname, "src", "services", "migrationService.js")],
      {
        stdio: "inherit",
      }
    );
  });

program
  .command("search")
  .description("Search the dictionary")
  .argument("[terms...]", "Search terms")
  .action((terms) => {
    spawn(
      "node",
      [path.join(__dirname, "src", "services", "searchService.js"), ...terms],
      {
        stdio: "inherit",
      }
    );
  });

program.parse(process.argv);
