const gulp = require("gulp");
const git = require("./index")("./.git", "HEAD");

gulp.task("default", function(done) {
  return git.src("*")
//    .pipe(gulp.dest("dist"))
    .pipe(git.dest("test"));
});