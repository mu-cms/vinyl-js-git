const run = require("gen-run");
const isValidGlob = require("is-valid-glob");
const through = require("through2");
const sink = require("lead");
const Vinyl = require("vinyl");
const minimatch = require("minimatch");
const git = require("git-node");
const createTree = require("js-git/mixins/create-tree");


module.exports = function (url, hash) {
  const repo = git.repo(url);

  createTree(repo);

  return {
    src: function (glob) {
      if (!isValidGlob(glob)) {
        throw new Error("Invalid glob argument: " + glob);
      }

      const out = through.obj();

      run(function* () {
        const commit = yield repo.loadAs("commit", hash);
        const tree = yield repo.loadAs("tree", commit.tree);

        for (const entry of tree) {
          if (minimatch(entry.name, glob)) {
            out.push(new Vinyl({
              path: entry.name,
              stat: {
                mode: entry.mode
              },
              contents: yield repo.loadAs("blob", entry.hash)
            }));
          }
        }

        out.end();
      });

      return out;
    },

    dest: function (folder) {
      const changes = [];
      const out = through.obj(function (file, enc, cb) {
        changes.push({
          path: file.relative,
          mode: file.stat.mode,
          content: file.contents
        });
        cb(null, file);
      }, function (done) {
        run(function* () {
          const commit = yield repo.loadAs("commit", hash);

          changes.base = commit.tree;

          console.log(yield repo.createTree(changes));
          done();
        });
      });

      return sink(out);
    }
  };
}