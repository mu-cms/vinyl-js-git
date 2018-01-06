const run = require("gen-run");
const gulp = require("gulp");
const logger = require("gulplog");
const modes = require("js-git/lib/modes");
const repo = {};
const author = {
  name: "Mikael Karon",
  email: "mikael@karon.se"
};

require("js-git/mixins/mem-db")(repo);
require("js-git/mixins/walkers")(repo);
require("js-git/mixins/create-tree")(repo);
require("js-git/mixins/formats")(repo);

const git = require("..")(repo);

gulp.task("prepare", done => {
  run(function* () {
    yield repo.updateRef("HEAD", yield repo.saveAs("commit", {
      tree: yield repo.createTree({
        "index.html": {
          mode: modes.file,
          content: "THIS IS A TEST"
        },
        "test/file.html": {
          mode: modes.file,
          content: "WOOT"

        }
      }),
      author: author,
      message: "initial commit"
    }));
  }, done);
});

gulp.task("git", () => {
  return git.src("**")
    .pipe(git.dest("HEAD", {
      author: author,
      message: "mu-cms"
    }))
    .on("data", data => logger.info(data));
});

gulp.task("default", gulp.series("prepare", "git"));