const File = require("vinyl");
const Minimatch = require("minimatch").Minimatch;
const join = require("path").join;
const run = require("gen-run");
const isValidGlob = require("is-valid-glob");
const through = require("through2");
const sink = require("lead");
const modes = require("js-git/lib/modes");

module.exports = (repo) => {
  // return vinyl adapter
  return {
    src: src,
    dest: dest
  };

  function src(glob, opt) {
    // check if glob is valid
    if (!isValidGlob(glob)) {
      throw new Error("Invalid glob argument: " + glob);
    }
    // create glob matcher
    const matcher = new Minimatch(glob);
    // construct options with defaults
    const options = Object.assign({
      commit: "HEAD"
    }, opt);
    // create stream
    const out = through.obj();
    // run so yield works
    run(function* () {
      // load commit from options.commit
      const commit = yield repo.loadAs("commit", options.commit);
      // create tree walker
      const walker = yield repo.treeWalk(commit.tree);
      // malloc object variable
      let object;
      // walk tree until we run out of objects
      while (object = yield walker.read()) {
        const mode = object.mode;
        const path = object.path;
        // check that object is a file and that path matches glob
        if (modes.toType(mode) === "blob" && matcher.match(path)) {
          // create a file and push to stream
          out.push(new File({
            cwd: "/",
            path: path,
            stat: {
              mode: mode
            },
            contents: yield repo.loadAs("blob", object.hash),
          }));
        }
      }
    }, err => {
      // emit error to stream if any
      if (err) {
        out.emit("error", err);
      }
      // close stream
      out.end();
    });
    // return stream to gulp
    return out;
  }

  function dest(ref, opt) {
    // init changes array
    const changes = [];
    // create stream that buffers changes and writes them to the repo on close, wrap it in sink and return to gulp
    return sink(through.obj(buffer, write));

    function buffer(file, enc, cb) {
      // wrap in try for async error support
      try {
        // check that file is not a directory
        if (!file.isDirectory()) {
          // push change object to changes
          changes.push({
            path: file.relative,
            mode: file.stat.mode,
            content: file.contents
          });
        }
        // pass file to stream
        cb(null, file);
      }
      // report errors async
      catch (e) {
        cb(e);
      }
    }

    function write(done) {
      // if there are no changes we're done
      if (changes.length === 0) {
        done();
      }
      // else run so yield works
      else run(function* () {
        // resolve hash for branch
        const parent = yield repo.readRef(ref);
        // check that we have parent
        if (!parent) {
          throw new Error("Unable to read ref: " + ref);
        }
        // get base commit
        const base = yield repo.loadAs("commit", parent);
        // set tree changes should be calculated from
        changes.base = base.tree;
        // create tree from changes
        const tree = yield repo.createTree(changes);
        // skip if no changes
        if (tree !== changes.base) {
          // save new commit passing opt and update branch ref
          yield repo.updateRef(ref, yield repo.saveAs("commit", Object.assign({}, opt, {
            tree: tree,
            parent: parent,
          })));
        }
      }, done);
    }
  }
}
